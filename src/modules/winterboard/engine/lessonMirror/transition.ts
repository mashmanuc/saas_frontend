/**
 * План переходу між двома фото-станами й малювання кадру на момент t (браузер: полотна).
 *
 * Як у прототипі (render_clip.py), але дешево для кожного кадру:
 *  - світло перетікає A → «чистий B» (нова крейда замальована фоном довкола — під ще не написаним не
 *    просвічують обриси майбутнього напису);
 *  - стирання — губка зліва направо через усю дошку (м'який край 0,2 с);
 *  - напис — пікселі B з'являються за своїм часом (пом'якшення 0,12 с); оновлюємо лише ті, що змінюються
 *    в цьому кадрі, тож кадр не перераховує всю картинку.
 * На момент t ≥ тривалості — точне фото B (ТЗ: на межі кроку — точний вихідний кадр).
 */
import { analyzePair, type PairAnalysis, type PairReason } from './analyze'
import { gaussBlur } from './raster'
import type { TransitionKind } from './types'

const FADE_MS = 120
const SWEEP_SOFT_MS = 200
const CLEAN_SIGMA_REF = 7.5   // 6 при 1280 у прототипі → 7,5 при 1600

export interface TransitionPlan {
  kind: TransitionKind
  reason: PairReason | 'pixels_unavailable'
  durationMs: number
  width: number
  height: number
  /** Нових / стертих пікселів крейди (для журналу й прогнозу) */
  newPx: number
  gonePx: number
  /** @internal */
  _s: PlanState | null
}

interface PlanState {
  a: HTMLCanvasElement
  b: HTMLCanvasElement
  bClean: HTMLCanvasElement
  reveal: HTMLCanvasElement | null
  revealData: ImageData | null
  /** Індекси пікселів напису, впорядковані за часом появи, і їхні часи */
  order: Uint32Array | null
  times: Float32Array | null
  /** order[0..done) — повністю проявлені; [done..started) — ще проявляються */
  done: number
  started: number
  lastT: number
  eraseMs: number
  tmp: HTMLCanvasElement | null
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function sizeOf(src: CanvasImageSource): { w: number; h: number } {
  const s = src as { naturalWidth?: number; naturalHeight?: number; width?: number | { baseVal?: { value: number } }; height?: number | { baseVal?: { value: number } } }
  const w = s.naturalWidth || (typeof s.width === 'number' ? s.width : 0)
  const h = s.naturalHeight || (typeof s.height === 'number' ? s.height : 0)
  return { w, h }
}

/** «Чистий B»: під маскою — нормована згортка B поза маскою (лише в межах рамки маски із запасом). */
function cleanB(b: ImageData, mask: Uint8Array): ImageData {
  const { width: w, height: h } = b
  const out = new ImageData(new Uint8ClampedArray(b.data), w, h)
  let x0 = w, x1 = -1, y0 = h, y1 = -1
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue
    const x = i % w
    const y = (i - x) / w
    if (x < x0) x0 = x; if (x > x1) x1 = x
    if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  if (x1 < 0) return out
  const sigma = CLEAN_SIGMA_REF * (w / 1600)
  const m = Math.ceil(sigma * 4)
  const rx0 = Math.max(0, x0 - m), rx1 = Math.min(w - 1, x1 + m)
  const ry0 = Math.max(0, y0 - m), ry1 = Math.min(h - 1, y1 + m)
  const rw = rx1 - rx0 + 1
  const rh = ry1 - ry0 + 1
  const keep = new Float32Array(rw * rh)
  const ch = [new Float32Array(rw * rh), new Float32Array(rw * rh), new Float32Array(rw * rh)]
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const gi = (ry0 + y) * w + (rx0 + x)
      const li = y * rw + x
      const k = mask[gi] ? 0 : 1
      keep[li] = k
      for (let c = 0; c < 3; c++) ch[c][li] = b.data[gi * 4 + c] * k
    }
  }
  const den = gaussBlur(keep, rw, rh, sigma)
  const num = ch.map((c) => gaussBlur(c, rw, rh, sigma))
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const gi = (ry0 + y) * w + (rx0 + x)
      if (!mask[gi]) continue
      const li = y * rw + x
      const d = den[li] + 1e-4
      for (let c = 0; c < 3; c++) out.data[gi * 4 + c] = num[c][li] / d
    }
  }
  return out
}

function snapPlan(b: HTMLCanvasElement, reason: TransitionPlan['reason'], w: number, h: number): TransitionPlan {
  return {
    kind: 'snap', reason, durationMs: 0, width: w, height: h, newPx: 0, gonePx: 0,
    _s: { a: b, b, bClean: b, reveal: null, revealData: null, order: null, times: null, done: 0, started: 0, lastT: -1, eraseMs: 0, tmp: null },
  }
}

/**
 * Проаналізувати перехід між двома завантаженими фото (img з crossOrigin="anonymous" або ImageBitmap).
 * Пікселі недоступні (сховище без дозволу CORS) чи інший розмір — `snap` із причиною.
 */
export async function planTransition(
  srcA: CanvasImageSource, srcB: CanvasImageSource, opts: { signal?: AbortSignal } = {},
): Promise<TransitionPlan> {
  const { w, h } = sizeOf(srcB)
  const sa = sizeOf(srcA)
  const b = canvasOf(w, h)
  const bctx = b.getContext('2d', { willReadFrequently: true })!
  bctx.drawImage(srcB, 0, 0, w, h)
  if (sa.w !== w || sa.h !== h || !w || !h) return snapPlan(b, 'size_mismatch', w, h)
  const a = canvasOf(w, h)
  const actx = a.getContext('2d', { willReadFrequently: true })!
  actx.drawImage(srcA, 0, 0, w, h)
  let da: ImageData
  let db: ImageData
  try {
    da = actx.getImageData(0, 0, w, h)
    db = bctx.getImageData(0, 0, w, h)
  } catch {
    // полотно «забруднене» чужим доменом — аналізувати не можна, показуємо точний кадр
    return snapPlan(b, 'pixels_unavailable', w, h)
  }
  // віддаємо кадр плеєру перед важким аналізом
  await new Promise((r) => setTimeout(r, 0))
  if (opts.signal?.aborted) throw new DOMException('aborted', 'AbortError')
  const an: PairAnalysis = analyzePair(da.data, w, h, db.data, w, h)
  if (an.kind === 'snap') return snapPlan(b, an.reason, w, h)
  let bClean = b
  let reveal: HTMLCanvasElement | null = null
  let revealData: ImageData | null = null
  let order: Uint32Array | null = null
  let times: Float32Array | null = null
  if (an.revealMs && an.cleanMask) {
    bClean = canvasOf(w, h)
    bClean.getContext('2d')!.putImageData(cleanB(db, an.cleanMask), 0, 0)
    const idx: number[] = []
    for (let i = 0; i < an.revealMs.length; i++) if (an.revealMs[i] !== Infinity) idx.push(i)
    idx.sort((p, q) => an.revealMs![p] - an.revealMs![q])
    order = Uint32Array.from(idx)
    times = Float32Array.from(idx, (i) => an.revealMs![i])
    revealData = new ImageData(new Uint8ClampedArray(db.data), w, h)
    for (let i = 3; i < revealData.data.length; i += 4) revealData.data[i] = 0
    reveal = canvasOf(w, h)
  }
  return {
    kind: an.kind, reason: an.reason, durationMs: an.durationMs, width: w, height: h, newPx: an.newPx, gonePx: an.gonePx,
    _s: { a, b, bClean, reveal, revealData, order, times, done: 0, started: 0, lastT: -1, eraseMs: an.eraseMs, tmp: null },
  }
}

const smooth = (s: number) => s * s * (3 - 2 * s)

/** Оновити альфу проявлених пікселів до моменту t; повертає змінену рамку або null. */
function updateReveal(s: PlanState, t: number, w: number): [number, number, number, number] | null {
  const { order, times, revealData } = s
  if (!order || !times || !revealData) return null
  const alpha = revealData.data
  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1
  const touch = (i: number) => {
    const x = i % w
    const y = (i - x) / w
    if (x < x0) x0 = x; if (x > x1) x1 = x
    if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  if (t < s.lastT) {
    // назад (seek) — скинути все й порахувати заново
    for (let k = 0; k < s.started; k++) { alpha[order[k] * 4 + 3] = 0; touch(order[k]) }
    s.done = 0
    s.started = 0
  }
  while (s.started < order.length && times[s.started] <= t) s.started++
  for (let k = s.done; k < s.started; k++) {
    const v = Math.min(1, Math.max(0, (t - times[k]) / FADE_MS))
    const i = order[k]
    alpha[i * 4 + 3] = Math.round(v * 255)
    touch(i)
  }
  while (s.done < s.started && t - times[s.done] >= FADE_MS) s.done++
  s.lastT = t
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1]
}

/** Намалювати кадр переходу на момент tMs (у розмірі plan.width×plan.height, від точки 0,0). */
export function drawTransition(plan: TransitionPlan, tMs: number, ctx: CanvasRenderingContext2D): void {
  const s = plan._s
  if (!s) return
  const { width: w, height: h } = plan
  if (plan.kind === 'snap' || tMs >= plan.durationMs) {
    ctx.drawImage(s.b, 0, 0)
    return
  }
  const t = Math.max(0, tMs)
  ctx.drawImage(s.a, 0, 0)
  if (plan.kind === 'light_only') {
    ctx.globalAlpha = smooth(Math.min(1, t / plan.durationMs))
    ctx.drawImage(s.b, 0, 0)
    ctx.globalAlpha = 1
    return
  }
  if (s.eraseMs) {
    // губка: стовпчик x переходить у момент x/w·eraseMs, м'який край SWEEP_SOFT_MS
    const xFull = ((t - SWEEP_SOFT_MS) / s.eraseMs) * w
    const xEdge = (t / s.eraseMs) * w
    if (xFull >= w) {
      ctx.drawImage(s.bClean, 0, 0)
    } else if (xEdge > 0) {
      s.tmp ??= canvasOf(w, h)
      const tc = s.tmp.getContext('2d')!
      tc.globalCompositeOperation = 'copy'
      tc.drawImage(s.bClean, 0, 0)
      tc.globalCompositeOperation = 'destination-in'
      const g = tc.createLinearGradient(Math.max(0, xFull), 0, Math.max(1, xEdge), 0)
      g.addColorStop(0, 'rgba(0,0,0,1)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      tc.fillStyle = g
      tc.fillRect(0, 0, w, h)
      tc.globalCompositeOperation = 'source-over'
      ctx.drawImage(s.tmp, 0, 0)
    }
  } else {
    ctx.globalAlpha = smooth(Math.min(1, t / plan.durationMs))
    ctx.drawImage(s.bClean, 0, 0)
    ctx.globalAlpha = 1
  }
  if (s.reveal && s.revealData) {
    const dirty = updateReveal(s, t, w)
    if (dirty) s.reveal.getContext('2d')!.putImageData(s.revealData, 0, 0, dirty[0], dirty[1], dirty[2], dirty[3])
    ctx.drawImage(s.reveal, 0, 0)
  }
}

/** Звільнити полотна (Safari тримає їхню пам'ять довго). */
export function disposeTransition(plan: TransitionPlan): void {
  const s = plan._s
  if (!s) return
  for (const c of [s.a, s.b, s.bClean, s.reveal, s.tmp]) if (c) { c.width = 0; c.height = 0 }
  s.revealData = null
  s.order = null
  s.times = null
  plan._s = null
}
