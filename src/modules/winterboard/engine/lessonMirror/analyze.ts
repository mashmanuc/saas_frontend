/**
 * Аналіз пари сусідніх фото-станів (прототип: `chalk`, `plan_step` у render_clip.py; пороги — README прототипу).
 * Чиста функція над RGBA: що з'явилось, що стерли, у якому порядку й коли проявляти.
 *
 * Пороги задані для знімка 1600×900 («Дзеркало» шле саме такі) і масштабуються з розміром кадру.
 */
import { boxesOf, dilate, dropSmall, gaussBlur, label8, toGray } from './raster'
import { readingOrder, type OrderItem } from './order'
import type { TransitionKind } from './types'

/** Пороги прототипу (1600×900) */
export const MIRROR_ENGINE = {
  refWidth: 1600,
  chalkBlurSigma: 10,
  chalkThreshold: 28,
  newDilate: 3,
  brightnessDelta: 18,
  minPart: 25,
  minStep: 250,
  unitDilate: 10,
  haloDilate: 2,
  cleanDilate: 4,
  railMarginPx: 12,
  speedPxPerS: 650,
  unitMinS: 0.25,
  unitMaxS: 1.4,
  gapS: 0.06,
  eraseS: 0.8,
  afterEraseS: 0.15,
  lightS: 0.25,
  /** Нижче цієї кореляції грубих яскравостей — інша сцена (не та сама дошка) → snap */
  sceneMinCorr: 0.6,
} as const

export type PairReason = 'write' | 'erase' | 'erase_write' | 'light_only' | 'size_mismatch' | 'scene_changed'

export interface PairAnalysis {
  kind: TransitionKind
  reason: PairReason
  width: number
  height: number
  /** Нових / стертих пікселів крейди */
  newPx: number
  gonePx: number
  /** Тривалість переходу, мс (snap — 0) */
  durationMs: number
  /** Коли кожен піксель нового напису (з ореолом) починає проявлятись, мс; Infinity — не напис. null — нового немає */
  revealMs: Float32Array | null
  /** Губка зліва направо через усю дошку, мс; 0 — стирання немає */
  eraseMs: number
  /** Де «чистий B» замальовуємо фоном (нова крейда із запасом); null — не треба */
  cleanMask: Uint8Array | null
}

/**
 * Кореляція грубих (32×18) середніх яскравостей — та сама дошка чи інша сцена. Пікселі `skip` (крейда обох
 * знімків) не враховуються: густо списана й щойно стерта дошка — та сама сцена, а різниця в крейді — не «інша».
 */
export function coarseCorrelation(ga: Float32Array, gb: Float32Array, w: number, h: number, skip?: Uint8Array): number {
  const GX = 32
  const GY = 18
  const sa = new Float64Array(GX * GY)
  const sb = new Float64Array(GX * GY)
  const cnt = new Float64Array(GX * GY)
  for (let y = 0; y < h; y++) {
    const cy = Math.min(GY - 1, Math.floor((y * GY) / h))
    for (let x = 0; x < w; x++) {
      const c = cy * GX + Math.min(GX - 1, Math.floor((x * GX) / w))
      const i = y * w + x
      if (skip && skip[i]) continue
      sa[c] += ga[i]
      sb[c] += gb[i]
      cnt[c]++
    }
  }
  let ma = 0
  let mb = 0
  let used = 0
  for (let c = 0; c < sa.length; c++) {
    if (!cnt[c]) continue
    sa[c] /= cnt[c]; sb[c] /= cnt[c]; ma += sa[c]; mb += sb[c]; used++
  }
  if (!used) return 1
  ma /= used
  mb /= used
  let num = 0
  let da = 0
  let db = 0
  for (let c = 0; c < sa.length; c++) {
    if (!cnt[c]) continue
    const x = sa[c] - ma
    const y = sb[c] - mb
    num += x * y
    da += x * x
    db += y * y
  }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 1
}

function chalkMask(g: Float32Array, w: number, h: number, sigma: number): Uint8Array {
  const blur = gaussBlur(g, w, h, sigma)
  const m = new Uint8Array(g.length)
  for (let i = 0; i < g.length; i++) m[i] = g[i] - blur[i] > MIRROR_ENGINE.chalkThreshold ? 1 : 0
  return m
}

export function analyzePair(
  a: Uint8ClampedArray | Uint8Array, aw: number, ah: number,
  b: Uint8ClampedArray | Uint8Array, bw: number, bh: number,
): PairAnalysis {
  const empty = (kind: TransitionKind, reason: PairReason, durationMs: number, w = bw, h = bh): PairAnalysis => ({
    kind, reason, width: w, height: h, newPx: 0, gonePx: 0, durationMs, revealMs: null, eraseMs: 0, cleanMask: null,
  })
  if (aw !== bw || ah !== bh) return empty('snap', 'size_mismatch', 0)
  const w = bw
  const h = bh
  const n = w * h
  const E = MIRROR_ENGINE
  const lin = w / E.refWidth
  const area = lin * lin
  const r = (v: number) => Math.max(1, Math.round(v * lin))

  const gA = toGray(a, n)
  const gB = toGray(b, n)
  const sigma = E.chalkBlurSigma * lin
  const cA = chalkMask(gA, w, h, sigma)
  const cB = chalkMask(gB, w, h, sigma)
  const dA = dilate(cA, w, h, r(E.newDilate))
  const dB = dilate(cB, w, h, r(E.newDilate))
  const anyChalk = new Uint8Array(n)
  for (let i = 0; i < n; i++) anyChalk[i] = dA[i] | dB[i]
  if (coarseCorrelation(gA, gB, w, h, anyChalk) < E.sceneMinCorr) return empty('snap', 'scene_changed', 0)
  const rawNew = new Uint8Array(n)
  const rawGone = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    if (cB[i] && !dA[i] && gB[i] - gA[i] > E.brightnessDelta) rawNew[i] = 1
    if (cA[i] && !dB[i] && gA[i] - gB[i] > E.brightnessDelta) rawGone[i] = 1
  }
  const minPart = Math.max(4, Math.round(E.minPart * area))
  const fresh = dropSmall(rawNew, w, h, minPart)
  const gone = dropSmall(rawGone, w, h, minPart)
  let newPx = 0
  let gonePx = 0
  for (let i = 0; i < n; i++) { newPx += fresh[i]; gonePx += gone[i] }
  const minStep = Math.max(20, Math.round(E.minStep * area))

  let t = 0
  let eraseMs = 0
  if (gonePx >= minStep) {
    eraseMs = E.eraseS * 1000
    t = (E.eraseS + E.afterEraseS) * 1000
  }
  if (newPx < minStep) {
    const res = empty(eraseMs ? 'erase' : 'light_only', eraseMs ? 'erase' : 'light_only', t ? t + E.lightS * 1000 : E.lightS * 1000)
    return { ...res, newPx, gonePx, eraseMs }
  }

  // Написи: нова крейда, розширена до слів; рамки — за справжніми пікселями
  const { labels, count } = label8(dilate(fresh, w, h, r(E.unitDilate)), w, h)
  const actual = boxesOf(labels, count, w, fresh)
  const halo = dilate(fresh, w, h, r(E.haloDilate))
  const rail = E.railMarginPx * lin
  const items: OrderItem[] = []
  for (let k = 1; k <= count; k++) {
    const bx = actual[k]
    if (!bx) continue
    const bw_ = bx.right - bx.left
    const bh_ = bx.bottom - bx.top
    // рейка біля лівого/правого краю дошки — відблиск на рамці, не крейда
    if ((bx.left < rail || bx.right > w - rail) && bh_ > 3 * bw_) continue
    items.push({ id: k, box: bx })
  }
  const order = readingOrder(items)

  // Пікселі ореолу кожного напису — одним проходом
  const perUnit = new Map<number, number[]>()
  for (const k of order) perUnit.set(k, [])
  for (let i = 0; i < n; i++) {
    if (!halo[i]) continue
    const list = perUnit.get(labels[i])
    if (list) list.push(i)
  }
  const revealMs = new Float32Array(n).fill(Infinity)
  const speed = E.speedPxPerS * lin
  for (const k of order) {
    const px = perUnit.get(k)!
    if (!px.length) continue
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const i of px) {
      const x = i % w
      const y = (i - x) / w
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
    }
    const uw = x1 - x0 + 1
    const uh = y1 - y0 + 1
    const horizontal = uw >= 0.8 * uh
    const along0 = horizontal ? x0 : y0
    const alongMax = Math.max(1, (horizontal ? x1 : y1) - along0)
    const length = horizontal ? Math.max(uw, uh) : uh
    const dur = Math.min(E.unitMaxS, Math.max(E.unitMinS, length / speed)) * 1000
    for (const i of px) {
      const x = i % w
      const pos = horizontal ? x : (i - x) / w
      revealMs[i] = t + ((pos - along0) / alongMax) * dur
    }
    t += dur + E.gapS * 1000
  }
  return {
    kind: eraseMs ? 'erase' : 'write',
    reason: eraseMs ? 'erase_write' : 'write',
    width: w, height: h, newPx, gonePx, durationMs: t, revealMs, eraseMs,
    cleanMask: dilate(fresh, w, h, r(E.cleanDilate)),
  }
}
