/**
 * Одне обчислення над застосованим входом учителя (ТЗ §2.1, інваріант 1):
 * множина розвʼязків, відповідь, назва проміжку й схематичне розміщення —
 * для дошки, PDF-знімка й опису для Інтегралика. Окремо нічого не зберігається.
 */
import { parseNumber } from './parse'
import { solveIntervals } from './intervals'
import { compareReal as compare, type Real } from './real'
import { ALL, contains, EMPTY, intersect, normalize, union, type Interval, type NumberSet, type Point } from './sets'
import {
  isConstCondition,
  isRangeCondition,
  NUMBER_LINE_MAX_CONDITIONS,
  type NumberLineCondition,
  type NumberLineData,
  type NumberLineError,
} from './types'

export type IntervalName = 'segment' | 'interval' | 'half_interval' | 'ray' | 'open_ray' | 'line'

export interface NumberLineAnswer {
  kind: 'empty' | 'point' | 'all' | 'set'
  /** Математичний запис: `x ∈ (−3; 5]`, `x = 3`, `∅`. */
  text: string
  /** Назва за підручником — лише коли відповідь є одним проміжком. */
  name?: IntervalName
}

export interface LayoutPoint {
  label: string
  /** 0..1 по ширині прямої; точки — у порядку значень, НЕ в масштабі. */
  x: number
  filled: boolean
}

/** Відрізок у координатах 0..1; 0 / 1 — до краю (±∞). */
export interface LayoutSegment {
  from: number
  to: number
}

export interface LayoutHatch {
  condition: number
  segments: LayoutSegment[]
}

/** Метод інтервалів: знак виразу на проміжку між сусідніми точками (0..1, як відрізки). */
export interface LayoutSign {
  from: number
  to: number
  sign: '+' | '-'
}

export interface NumberLineLayout {
  points: LayoutPoint[]
  hatches: LayoutHatch[]
  /** Результат (виділено кольором); точки результату — серед `points`. */
  result: LayoutSegment[]
  /** Лише метод інтервалів. */
  signs?: LayoutSign[]
}

export type NumberLineEvaluation =
  | { ok: true; set: NumberSet; answer: NumberLineAnswer; layout: NumberLineLayout }
  | { ok: false; errors: NumberLineError[] }

/** Типографський мінус для підписів і відповіді. */
export function displayNumber(label: string): string {
  return label.replace(/^-/, '−').replace(/sqrt\s*\(?\s*(\d+)\s*\)?/gi, '√$1').replace(/\*/g, '·')
}

interface ResolvedCondition {
  set: NumberSet
  /** Межі з тим, чи включені вони умовою. */
  bounds: Array<{ point: Point; included: boolean }>
}

function resolve(c: NumberLineCondition, canon: (raw: string, line: number) => Point | NumberLineError, line: number):
  ResolvedCondition | NumberLineError {
  if (isConstCondition(c)) return { set: c.holds ? ALL : EMPTY, bounds: [] }
  if (isRangeCondition(c)) {
    const a = canon(c.from, line)
    if (!('value' in a)) return a
    const b = canon(c.to, line)
    if (!('value' in b)) return b
    return {
      set: normalize([{ lo: a, loClosed: c.fromIncluded, hi: b, hiClosed: c.toIncluded }]),
      bounds: [{ point: a, included: c.fromIncluded }, { point: b, included: c.toIncluded }],
    }
  }
  const p = canon(c.value, line)
  if (!('value' in p)) return p
  const iv = (lo: Point | null, loClosed: boolean, hi: Point | null, hiClosed: boolean): Interval => ({ lo, loClosed, hi, hiClosed })
  switch (c.op) {
    case '<': return { set: [iv(null, false, p, false)], bounds: [{ point: p, included: false }] }
    case '<=': return { set: [iv(null, false, p, true)], bounds: [{ point: p, included: true }] }
    case '>': return { set: [iv(p, false, null, false)], bounds: [{ point: p, included: false }] }
    case '>=': return { set: [iv(p, true, null, false)], bounds: [{ point: p, included: true }] }
    case '=': return { set: [iv(p, true, p, true)], bounds: [{ point: p, included: true }] }
    case '!=': return {
      set: [iv(null, false, p, false), iv(p, false, null, false)],
      bounds: [{ point: p, included: false }],
    }
  }
}

function fmtInterval(iv: Interval): string {
  if (iv.lo && iv.hi && compare(iv.lo.value, iv.hi.value) === 0) return `{${displayNumber(iv.lo.label)}}`
  const lo = iv.lo ? displayNumber(iv.lo.label) : '−∞'
  const hi = iv.hi ? displayNumber(iv.hi.label) : '+∞'
  return `${iv.lo && iv.loClosed ? '[' : '('}${lo}; ${hi}${iv.hi && iv.hiClosed ? ']' : ')'}`
}

function nameOf(iv: Interval): IntervalName {
  if (!iv.lo && !iv.hi) return 'line'
  if (!iv.lo) return iv.hiClosed ? 'ray' : 'open_ray'
  if (!iv.hi) return iv.loClosed ? 'ray' : 'open_ray'
  if (iv.loClosed && iv.hiClosed) return 'segment'
  if (!iv.loClosed && !iv.hiClosed) return 'interval'
  return 'half_interval'
}

export function formatAnswer(set: NumberSet, variable: string): NumberLineAnswer {
  if (set.length === 0) return { kind: 'empty', text: '∅' }
  if (set.length === 1) {
    const iv = set[0]
    if (!iv.lo && !iv.hi) return { kind: 'all', text: `${variable} ∈ (−∞; +∞)`, name: 'line' }
    if (iv.lo && iv.hi && compare(iv.lo.value, iv.hi.value) === 0) {
      return { kind: 'point', text: `${variable} = ${displayNumber(iv.lo.label)}` }
    }
    return { kind: 'set', text: `${variable} ∈ ${fmtInterval(iv)}`, name: nameOf(iv) }
  }
  return { kind: 'set', text: `${variable} ∈ ${set.map(fmtInterval).join(' ∪ ')}` }
}

const MARGIN = 0.18

export function evaluate(data: NumberLineData): NumberLineEvaluation {
  if (data.mode === 'intervals') return evaluateIntervals(data)
  const errors: NumberLineError[] = []
  if (data.conditions.length > NUMBER_LINE_MAX_CONDITIONS) {
    return { ok: false, errors: [{ line: NUMBER_LINE_MAX_CONDITIONS, index: 0, code: 'too_many_conditions', params: { max: String(NUMBER_LINE_MAX_CONDITIONS) } }] }
  }

  // Одна точка на одне значення: `0,5` і `1/2` — одна точка (підпис — як уперше записано).
  const canonPoints: Point[] = []
  const canon = (raw: string, line: number): Point | NumberLineError => {
    const n = parseNumber(raw)
    if ('error' in n) return { ...n.error, line }
    const existing = canonPoints.find((p) => compare(p.value, n.value) === 0)
    if (existing) return existing
    const p: Point = { value: n.value, label: n.label }
    canonPoints.push(p)
    return p
  }

  const resolved: ResolvedCondition[] = []
  data.conditions.forEach((c, line) => {
    const r = resolve(c, canon, line)
    if ('code' in r) errors.push(r)
    else resolved.push(r)
  })
  if (errors.length) return { ok: false, errors }

  let set: NumberSet
  if (resolved.length === 0) set = EMPTY
  else if (data.combine === 'or') set = resolved.reduce<NumberSet>((acc, r) => union(acc, r.set), EMPTY)
  else set = resolved.reduce<NumberSet>((acc, r) => intersect(acc, r.set), ALL)

  return { ok: true, set, answer: formatAnswer(set, data.variable), layout: layout(resolved, set, canonPoints) }
}

function layout(resolved: ResolvedCondition[], set: NumberSet, points: Point[]): NumberLineLayout {
  const sorted = [...points].sort((a, b) => compare(a.value, b.value))
  const n = sorted.length
  const xOf = (v: Real): number => {
    const i = sorted.findIndex((p) => compare(p.value, v) === 0)
    return n === 1 ? 0.5 : MARGIN + ((1 - 2 * MARGIN) * i) / (n - 1)
  }
  const seg = (iv: Interval): LayoutSegment => ({
    from: iv.lo ? xOf(iv.lo.value) : 0,
    to: iv.hi ? xOf(iv.hi.value) : 1,
  })
  const isEndOfResult = (v: Real) =>
    set.some((iv) => (iv.lo && compare(iv.lo.value, v) === 0) || (iv.hi && compare(iv.hi.value, v) === 0))

  const layoutPoints: LayoutPoint[] = sorted.map((p) => {
    let filled: boolean
    if (contains(set, p.value)) filled = true
    else if (isEndOfResult(p.value)) filled = false
    // Точка поза відповіддю: як у своїй умові (нестрога — зафарбована, строга — виколота).
    else filled = resolved.some((r) => r.bounds.some((b) => b.included && compare(b.point.value, p.value) === 0))
    return { label: displayNumber(p.label), x: xOf(p.value), filled }
  })

  const hatches: LayoutHatch[] = resolved.map((r, condition) => ({
    condition,
    segments: r.set
      .filter((iv) => !(iv.lo && iv.hi && compare(iv.lo.value, iv.hi.value) === 0))
      .map(seg),
  }))

  const result = set
    .filter((iv) => !(iv.lo && iv.hi && compare(iv.lo.value, iv.hi.value) === 0))
    .map(seg)

  return { points: layoutPoints, hatches, result }
}

const OP_TEXT: Record<string, string> = { '<': '<', '<=': '≤', '>': '>', '>=': '≥' }

/** Формула методу інтервалів так, як її бачить учитель: `(x-1)(x+3)/(x-2) ≥ 0`. */
export function intervalsFormula(data: NumberLineData): string {
  const op = OP_TEXT[data.op ?? '>']
  if (data.expression && data.expression.trim()) return `${data.expression} ${op} ${data.rhs ?? '0'}`
  return `f(${data.variable || 'x'}) ${op} 0`
}

/** Метод інтервалів: точки рівномірно в порядку значень, знаки над проміжками. */
function evaluateIntervals(data: NumberLineData): NumberLineEvaluation {
  const r = solveIntervals(data)
  if ('errors' in r) return { ok: false, errors: r.errors }
  const n = r.points.length
  const xs = r.points.map((_, i) => (n === 1 ? 0.5 : MARGIN + ((1 - 2 * MARGIN) * i) / (n - 1)))
  const xOf = (v: Real): number => xs[r.points.findIndex((p) => compare(p.point.value, v) === 0)]
  const seg = (iv: Interval): LayoutSegment => ({ from: iv.lo ? xOf(iv.lo.value) : 0, to: iv.hi ? xOf(iv.hi.value) : 1 })
  const result = r.set
    .filter((iv) => !(iv.lo && iv.hi && compare(iv.lo.value, iv.hi.value) === 0))
    .map(seg)
  const bounds = [0, ...xs, 1]
  return {
    ok: true,
    set: r.set,
    answer: formatAnswer(r.set, r.variable),
    layout: {
      points: r.points.map((p, i) => ({ label: displayNumber(p.point.label), x: xs[i], filled: p.filled })),
      hatches: [{ condition: 0, segments: result }],
      result,
      signs: r.signs.map((sign, i) => ({ from: bounds[i], to: bounds[i + 1], sign })),
    },
  }
}

/** Опис для Інтегралика («що на прямій»): умови й відповідь з того самого обчислення. */
export function describeNumberLine(data: NumberLineData, conditionTexts: string[]): string {
  const ev = evaluate(data)
  if (data.mode === 'intervals') {
    const what = intervalsFormula(data)
    if (!('answer' in ev)) return `числова пряма — метод інтервалів: ${what} (є помилка у вводі)`
    const ans = ev.answer.kind === 'empty' ? 'розвʼязків немає (∅)' : ev.answer.text
    const sg = ev.layout.signs?.map((s) => s.sign).join(' ') ?? ''
    return `числова пряма — метод інтервалів: ${what}; знаки на проміжках: ${sg}; відповідь: ${ans}`
  }
  const joiner = data.combine === 'or' ? ' або ' : ' і '
  const conds = conditionTexts.join(joiner) || 'умов немає'
  if (!('answer' in ev)) return `числова пряма: ${conds} (є помилка у вводі)`
  const kind = data.conditions.length > 1 ? (data.combine === 'or' ? 'сукупність' : 'система') : 'нерівність'
  const ans = ev.answer.kind === 'empty' ? 'розвʼязків немає (∅)' : ev.answer.text
  return `числова пряма — ${kind}: ${conds}; відповідь: ${ans}`
}
