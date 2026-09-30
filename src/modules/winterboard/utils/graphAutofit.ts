// Автопідбір вікна графіка під функцію (TZ_GRAPH_VIEWPORT_AUTOFIT_2026-09-22).
//
// Навіщо: вікно за замовчуванням y ≈ −20…20 — для x³ − 9x² − 216x (екстремуми
// 756 і −2160) крива лежала поза ним, і вчитель бачив порожню сітку.
//
// Лише обчислення (семплування + бісекція), без LLM і бекенду. Результат —
// МАТЕМАТИЧНИЙ діапазон; пікселі з нього рахує рушій за реальним розміром
// полотна (тож один і той самий запис однаково виглядає на різних екранах).

import { GraphCalc } from '../vendor/graph_calculator/graph-calculator.js'

export interface GraphFit {
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

type Fn = (x: number) => number

const SEARCH = 60          // особливі точки шукаємо в [−SEARCH, SEARCH]
const SAMPLES = 6000
const MAX_FEATURES = 7     // найближчі до 0 — щоб sin x не розтягнув вікно на десятки періодів
const MARGIN = 0.15
const FALLBACK_X: [number, number] = [-10, 10]
const Y_LOW_Q = 0.02
const Y_HIGH_Q = 0.98

// Будь-які помилки обчислення (log від'ємного, ділення на 0) — «немає значення».
const safe = (f: Fn): Fn => (x) => {
  let y: number
  try { y = f(x) } catch { return NaN }
  return Number.isFinite(y) ? y : NaN
}

/** Зміна знаку між a і b — справжній нуль, а не розрив (полюс між ними). */
function isCrossing(g: Fn, x0: number, x1: number, a: number, b: number): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  if (a === 0 || b === 0) return true
  if ((a < 0) === (b < 0)) return false
  const m = g((x0 + x1) / 2)
  if (!Number.isFinite(m)) return false
  // Біля полюса значення посередині вибухає; біля нуля — лишається між a і b.
  return Math.abs(m) <= Math.max(Math.abs(a), Math.abs(b)) * 1.5
}

function bisect(g: Fn, x0: number, x1: number): number {
  let lo = x0, hi = x1, glo = g(lo)
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const gm = g(mid)
    if (!Number.isFinite(gm) || gm === 0) return mid
    if ((gm < 0) === (glo < 0)) { lo = mid; glo = gm } else { hi = mid }
  }
  return (lo + hi) / 2
}

/** Нулі, екстремуми й перегини f у [−SEARCH, SEARCH]. */
function features(f: Fn): number[] {
  const h = 1e-4
  const d1: Fn = (x) => (f(x + h) - f(x - h)) / (2 * h)
  const d2: Fn = (x) => (f(x + h) - 2 * f(x) + f(x - h)) / (h * h)
  // Перетин з віссю y — теж особлива точка (e^x: видно (0, 1)).
  const out: number[] = Number.isFinite(f(0)) ? [0] : []
  const step = (2 * SEARCH) / SAMPLES
  for (const g of [f, d1, d2]) {
    let px = -SEARCH, pv = g(px)
    for (let i = 1; i <= SAMPLES; i++) {
      const x = -SEARCH + i * step
      const v = g(x)
      if (isCrossing(g, px, x, pv, v)) {
        const r = pv === 0 ? px : v === 0 ? x : bisect(g, px, x)
        // Бісекція біля полюса (1/x, tg x) збігається до самого полюса, де |g|
        // лише росте; справжній нуль має |g(r)| не більше за значення на кінцях.
        const gr = g(r)
        const ok = Number.isFinite(gr) && Math.abs(gr) <= Math.min(Math.abs(pv), Math.abs(v)) + 1e-9
        if (ok && Number.isFinite(f(r))) out.push(r)
      }
      px = x; pv = v
    }
  }
  // Дублікати (нуль і перегин у тій самій точці, сусідні вибірки) — одна точка.
  out.sort((a, b) => a - b)
  const uniq: number[] = []
  for (const x of out) if (!uniq.length || Math.abs(x - uniq[uniq.length - 1]) > step * 2) uniq.push(x)
  return uniq
}

function quantile(sorted: number[], q: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))
  return sorted[i]
}

/**
 * Діапазон, у якому видно особливі точки всіх явних функцій `y = f(x)`.
 * `params` — поточні значення параметрів (a, b…); `extraX` — точки, які
 * мусять потрапити у вікно (x₀ картки похідної). null — нема явних функцій.
 */
export function autofitExpressions(
  srcs: string[],
  params: Record<string, number> = {},
  extraX: number[] = [],
): GraphFit | null {
  const paramNames = Object.keys(params)
  const fns: Fn[] = []
  for (const src of srcs) {
    if (!src || !src.trim()) continue
    let c: { kind: string; ast?: unknown }
    try { c = GraphCalc.classify(src, paramNames) as { kind: string; ast?: unknown } } catch { continue }
    if (c.kind !== 'explicitY' || !c.ast) continue
    const ast = c.ast
    fns.push(safe((x) => GraphCalc.evalAst(ast, { ...params, x }) as number))
  }
  if (!fns.length) return null

  // ── x ──
  const pts: number[] = []
  for (const f of fns) {
    const fs = features(f).sort((a, b) => Math.abs(a) - Math.abs(b)).slice(0, MAX_FEATURES)
    pts.push(...fs)
  }
  for (const x of extraX) if (Number.isFinite(x)) pts.push(x)

  let xMin: number, xMax: number
  if (!pts.length) {
    [xMin, xMax] = FALLBACK_X
  } else {
    xMin = Math.min(...pts); xMax = Math.max(...pts)
    if (xMax - xMin < 2) {                  // одна точка (вершина x²) — вікно довкола неї
      const c = (xMin + xMax) / 2
      xMin = c - 5; xMax = c + 5
    } else {
      const pad = (xMax - xMin) * MARGIN
      xMin -= pad; xMax += pad
    }
  }

  // ── y ── значення в особливих точках видно завжди; решта — без викидів
  // біля асимптот (квантиль, не max).
  const must: number[] = []
  const samples: number[] = []
  for (const f of fns) {
    for (const x of pts) { const y = f(x); if (Number.isFinite(y)) must.push(y) }
    const n = 800
    for (let i = 0; i <= n; i++) {
      const y = f(xMin + ((xMax - xMin) * i) / n)
      if (Number.isFinite(y)) samples.push(y)
    }
  }
  if (!samples.length && !must.length) return null
  samples.sort((a, b) => a - b)
  let yMin = Math.min(...must, samples.length ? quantile(samples, Y_LOW_Q) : Infinity)
  let yMax = Math.max(...must, samples.length ? quantile(samples, Y_HIGH_Q) : -Infinity)
  if (yMax - yMin < 1e-9) { yMin -= 1; yMax += 1 }
  const padY = (yMax - yMin) * MARGIN
  yMin -= padY; yMax += padY

  // 6 значущих цифр — межі читабельні в op-і, точність для вікна зайва.
  return { xMin: round(xMin), xMax: round(xMax), yMin: round(yMin), yMax: round(yMax) }
}

const round = (n: number) => Number(n.toPrecision(6))

const INTEGRAL_SAMPLES = 400
const INTEGRAL_X_MARGIN = 0.15
const INTEGRAL_MIN_X_PAD = 0.5
const INTEGRAL_FAR_MARGIN = 0.12    // поле з боку кривої
const INTEGRAL_AXIS_MARGIN = 0.06   // смужка по той бік осі — щоб підписи осі x не сідали на край

/**
 * Вікно картки ІНТЕГРАЛА (власник 2026-09-30, «так, роби»): лише [a, b] і по Y від осі.
 *
 * `autofitExpressions` для e^x на [0,1; 10,97] брав Y по всьому вікну з полями — до
 * x ≈ 12,6, де e^x ≈ 300 000, хоча в b лише ~58 000 — і додавав поле нижче нуля: пів
 * картки порожні, крива до x ≈ 8 злилась з віссю. Площа інтеграла рахується від осі x,
 * тож нуль у вікні завжди; решта — значення f на самому [a, b] (квантиль — проти вибуху
 * біля полюса, значення на кінцях — завжди).
 */
export function autofitIntegral(src: string, a: number, b: number): GraphFit | null {
  if (!src || !src.trim() || !Number.isFinite(a) || !Number.isFinite(b)) return null
  let c: { kind: string; ast?: unknown }
  try { c = GraphCalc.classify(src, []) as { kind: string; ast?: unknown } } catch { return null }
  if (c.kind !== 'explicitY' || !c.ast) return null
  const ast = c.ast
  const f = safe((x) => GraphCalc.evalAst(ast, { x }) as number)

  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  const span = hi - lo
  const values: number[] = []
  for (let i = 0; i <= INTEGRAL_SAMPLES; i++) {
    const y = f(span ? lo + (span * i) / INTEGRAL_SAMPLES : lo)
    if (Number.isFinite(y)) values.push(y)
  }
  if (!values.length) return null
  values.sort((p, q) => p - q)
  const ends = [f(lo), f(hi)].filter((y) => Number.isFinite(y))
  const yLow = Math.min(0, ...ends, quantile(values, Y_LOW_Q))
  const yHigh = Math.max(0, ...ends, quantile(values, Y_HIGH_Q))
  const ySpan = yHigh - yLow || 1
  const padX = Math.max(span * INTEGRAL_X_MARGIN, INTEGRAL_MIN_X_PAD)
  return {
    xMin: round(lo - padX),
    xMax: round(hi + padX),
    yMin: round(yLow - ySpan * (yLow < 0 ? INTEGRAL_FAR_MARGIN : INTEGRAL_AXIS_MARGIN)),
    yMax: round(yHigh + ySpan * (yHigh > 0 ? INTEGRAL_FAR_MARGIN : INTEGRAL_AXIS_MARGIN)),
  }
}

/** Значення параметрів зі стану графка: `{a: {value, min, max, step}}` або `{a: 3}`. */
export function paramValuesOf(params: Record<string, unknown> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, p] of Object.entries(params || {})) {
    const v = p && typeof p === 'object' ? (p as { value?: unknown }).value : p
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
  }
  return out
}

const DEFAULT_VIEWPORT = { cx: 0, cy: 0, scale: 38 }

/** Вікно нового графка: вписаний діапазон або (нема явних функцій) — старе
 *  типове `{cx: 0, cy: 0, scale: 38}`.
 *
 *  ⚠️ `scale` поруч із `fit` — ОБОВ'ЯЗКОВО. 2026-09-22…23 тут повертався
 *  `{cx, cy, fit}` без `scale`, бекенд (`WBGraphCalculatorViewportSerializer`)
 *  такий op відхиляв (400), клієнт тримав його «у дорозі», і з першого графіка
 *  від Інтегралика урок у вкладці не зберігався взагалі (FIRST USER GATE
 *  2026-09-23, блокер №1). Бекенд тепер приймає й без `scale`, але пишемо
 *  форму, яку розуміє і старий бекенд, і старі читачі. Рушій при монтуванні
 *  однаково перераховує масштаб з `fit` під справжню рамку. */
export function graphViewportFor(
  srcs: string[],
  params: Record<string, unknown> | null | undefined,
): { cx: number; cy: number; scale: number; fit?: GraphFit } {
  const fit = autofitExpressions(srcs, paramValuesOf(params))
  if (!fit) return { ...DEFAULT_VIEWPORT }
  return {
    cx: round((fit.xMin + fit.xMax) / 2),
    cy: round((fit.yMin + fit.yMax) / 2),
    scale: DEFAULT_VIEWPORT.scale,
    fit,
  }
}
