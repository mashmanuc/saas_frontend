/**
 * Одне обчислення над застосованим входом учителя (ТЗ §2.1, інваріант 1):
 * множина розвʼязків, відповідь, назва проміжку й схематичне розміщення —
 * для дошки, PDF-знімка й опису для Інтегралика. Окремо нічого не зберігається.
 */
import { conditionToText, parseNumber } from './parse'
import { denominatorHoles, solveIntervals } from './intervals'
import { inequalityLatex, numberLatex } from './latex'
import { compareReal as compare, type Real } from './real'
import { ALL, contains, EMPTY, intersect, normalize, union, type Interval, type NumberSet, type Point } from './sets'
import {
  isConstCondition,
  isRangeCondition,
  NUMBER_LINE_MAX_CONDITIONS,
  type NumberLineCondition,
  type NumberLineData,
  type NumberLineError,
  type SolverBound,
} from './types'

export type IntervalName = 'segment' | 'interval' | 'half_interval' | 'ray' | 'open_ray' | 'line'

export interface NumberLineAnswer {
  kind: 'empty' | 'point' | 'all' | 'set'
  /** Математичний запис: `x ∈ (−3; 5]`, `x = 3`, `∅`. */
  text: string
  /** Назва за підручником — лише коли відповідь є одним проміжком. */
  name?: IntervalName
  /** Той самий запис у LaTeX — з множини й меж, не з тексту (ТЗ KaTeX §4.2); немає — показати `text`. */
  tex?: string
}

export interface LayoutPoint {
  label: string
  /** Підпис у LaTeX (`\frac{\sqrt{3}}{2}`); немає — показати `label`. */
  tex?: string
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
  | {
    ok: true
    set: NumberSet
    answer: NumberLineAnswer
    layout: NumberLineLayout
    /** Рядок «ОДЗ» (`x ≠ 2`, `x ≥ −1`): знаменник чи корінь зі змінною — однаково для всіх способів. */
    domain: string | null
  }
  | { ok: false; errors: NumberLineError[] }

/** Що бачить учитель у заголовку картки — лише від того, що він увів (ТЗ «один рядок» §1). */
export type NumberLineKind = 'inequality' | 'system' | 'union' | 'intervals'

export function numberLineKind(data: NumberLineData): NumberLineKind {
  if (data.mode === 'intervals') return 'intervals'
  if (data.mode === 'solved') return 'inequality'
  const n = Array.isArray(data.conditions) ? data.conditions.length : 0
  return n <= 1 ? 'inequality' : data.combine === 'or' ? 'union' : 'system'
}

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
    // Невідомий знак у збережених даних — помилка словами, а не TypeError (рев'ю 2026-10-13, п. 4).
    default: return { line, index: 0, code: 'expect_op' }
  }
}

/**
 * Шматок відповіді для запису: межі вже підписані (`−3`, `√2`, `≈1,32`), null — ±∞.
 * Один форматер для всіх способів (рушій на сторінці, метод інтервалів, сервер) — однаковий
 * вхід дає однаковий рядок відповіді й назву проміжку (ТЗ «один рядок» §1).
 */
export interface AnswerPiece {
  lo: string | null
  loClosed: boolean
  hi: string | null
  hiClosed: boolean
  /** Ізольована точка (`{2}`). */
  point: boolean
  /** Межі в LaTeX (сервер дає свій `latex`); немає — з підпису (`numberLatex`). */
  loTex?: string | null
  hiTex?: string | null
}

function fmtPiece(p: AnswerPiece): string {
  if (p.point) return `{${p.lo}}`
  return `${p.lo !== null && p.loClosed ? '[' : '('}${p.lo ?? '−∞'}; ${p.hi ?? '+∞'}${p.hi !== null && p.hiClosed ? ']' : ')'}`
}

function nameOf(p: AnswerPiece): IntervalName {
  if (p.lo === null && p.hi === null) return 'line'
  if (p.lo === null) return p.hiClosed ? 'ray' : 'open_ray'
  if (p.hi === null) return p.loClosed ? 'ray' : 'open_ray'
  if (p.loClosed && p.hiClosed) return 'segment'
  if (!p.loClosed && !p.hiClosed) return 'interval'
  return 'half_interval'
}

function boundTex(label: string | null, tex: string | null | undefined, inf: string): string | null {
  if (label === null) return inf
  return tex ?? numberLatex(label)
}

/** Шматок у LaTeX; null — якщо якусь межу не вдалося записати (тоді вся відповідь — текстом). */
function pieceTex(p: AnswerPiece): string | null {
  const lo = boundTex(p.lo, p.loTex, '-\\infty')
  if (p.point) return lo === null ? null : `\\{${lo}\\}`
  const hi = boundTex(p.hi, p.hiTex, '+\\infty')
  if (lo === null || hi === null) return null
  return `${p.lo !== null && p.loClosed ? '[' : '('}${lo}; ${hi}${p.hi !== null && p.hiClosed ? ']' : ')'}`
}

function withTex(a: NumberLineAnswer, tex: string | null): NumberLineAnswer {
  return tex === null ? a : { ...a, tex }
}

/** Шматки в порядку зліва направо → `x ∈ [−1; 3)` з назвою, `x = 3`, `∅`. */
export function answerFromPieces(pieces: AnswerPiece[], variable: string): NumberLineAnswer {
  if (pieces.length === 0) return { kind: 'empty', text: '∅', tex: '\\varnothing' }
  if (pieces.length === 1) {
    const p = pieces[0]
    if (p.point) {
      const t = boundTex(p.lo, p.loTex, '')
      return withTex({ kind: 'point', text: `${variable} = ${p.lo}` }, t === null ? null : `${variable} = ${t}`)
    }
    if (p.lo === null && p.hi === null) {
      return { kind: 'all', text: `${variable} ∈ (−∞; +∞)`, name: 'line', tex: `${variable} \\in (-\\infty; +\\infty)` }
    }
    const t = pieceTex(p)
    return withTex({ kind: 'set', text: `${variable} ∈ ${fmtPiece(p)}`, name: nameOf(p) }, t === null ? null : `${variable} \\in ${t}`)
  }
  const texs = pieces.map(pieceTex)
  const tex = texs.every((x) => x !== null) ? `${variable} \\in ${texs.join(' \\cup ')}` : null
  return withTex({ kind: 'set', text: `${variable} ∈ ${pieces.map(fmtPiece).join(' ∪ ')}` }, tex)
}

export function formatAnswer(set: NumberSet, variable: string): NumberLineAnswer {
  return answerFromPieces(set.map((iv: Interval) => ({
    lo: iv.lo ? displayNumber(iv.lo.label) : null,
    loClosed: iv.loClosed,
    hi: iv.hi ? displayNumber(iv.hi.label) : null,
    hiClosed: iv.hiClosed,
    point: !!(iv.lo && iv.hi && compare(iv.lo.value, iv.hi.value) === 0),
  })), variable)
}

function withPointTex(p: LayoutPoint): LayoutPoint {
  const tex = numberLatex(p.label)
  return tex === null ? p : { ...p, tex }
}

/** «ОДЗ» з нулів знаменника: `x ≠ 2, x ≠ −3`. */
function holesText(holes: Point[], variable: string): string | null {
  return holes.length ? holes.map((p) => `${variable} ≠ ${displayNumber(p.label)}`).join(', ') : null
}

const MARGIN = 0.18

export function evaluate(input: NumberLineData): NumberLineEvaluation {
  if (input.mode === 'intervals') return evaluateIntervals(input)
  if (input.mode === 'solved') return evaluateSolved(input)
  // Дані з дошки / від Інтегралика — форму не гарантовано: зіпсоване — помилка, а не мовчазне ∅.
  if (!Array.isArray(input.conditions)) return { ok: false, errors: [{ line: 0, index: 0, code: 'bad_data' }] }
  const data = input
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
    if (!c || typeof c !== 'object') {
      errors.push({ line, index: 0, code: 'bad_number', params: { text: String(c) } })
      return
    }
    const r = resolve(c, canon, line)
    if ('code' in r) errors.push(r)
    else resolved.push(r)
  })
  if (errors.length) return { ok: false, errors }

  let set: NumberSet
  if (resolved.length === 0) set = EMPTY
  else if (data.combine === 'or') set = resolved.reduce<NumberSet>((acc, r) => union(acc, r.set), EMPTY)
  else set = resolved.reduce<NumberSet>((acc, r) => intersect(acc, r.set), ALL)

  // Лінійні нерівності, системи й сукупності — без знаменників і коренів зі змінною: ОДЗ немає.
  return { ok: true, set, answer: formatAnswer(set, data.variable), layout: layout(resolved, set, canonPoints), domain: null }
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
    return withPointTex({ label: displayNumber(p.label), x: xOf(p.value), filled })
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

/**
 * Формула картки частинами — як записав учитель (ТЗ KaTeX §4.2): рядок (умова) → `{ text, tex }`;
 * `tex` null — розбір не прийняв, показати `text`. Частини поєднує картка (і / або — через i18n).
 */
export function formulaParts(data: NumberLineData): Array<{ text: string; tex: string | null }> {
  const one = (text: string) => ({ text, tex: inequalityLatex(text) })
  if (data.mode === 'intervals') return [one(intervalsFormula(data))]
  if (data.mode === 'solved') return data.inequality ? [one(String(data.inequality))] : []
  const v = data.variable || 'x'
  return (Array.isArray(data.conditions) ? data.conditions : []).map((c) => one(conditionToText(c, v)))
}

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
    domain: holesText(r.holes, r.variable),
    layout: {
      points: r.points.map((p, i) => withPointTex({ label: displayNumber(p.point.label), x: xs[i], filled: p.filled })),
      hatches: [{ condition: 0, segments: result }],
      result,
      signs: r.signs.map((sign, i) => ({ from: bounds[i], to: bounds[i + 1], sign })),
    },
  }
}

/** Межа сервера в LaTeX: точна — його `latex`; громіздка — `\approx 1{,}32`. */
export function solverBoundTex(b: SolverBound): string | null {
  if (b.exact && typeof b.latex === 'string' && b.latex) return b.latex
  return numberLatex(solverBoundLabel(b))
}

/** Підпис межі розвʼязувача: точний запис або «≈1,32» (ТЗ розвʼязувача §5.3). */
export function solverBoundLabel(b: SolverBound): string {
  if (b.exact && b.text) return b.text
  return `≈${b.approx.toFixed(2).replace('.', ',').replace('-', '−')}`
}

/**
 * Режим «Розвʼязати»: рисунок — лише зі збереженого `result` (ТЗ §5.1: межа на рисунку = межа з
 * сервера, без перерахунку). Точки рівномірно в порядку `approx`; однакова межа (кінець двох
 * проміжків) — одна точка; зафарбована, лише якщо входить у відповідь.
 */
function evaluateSolved(data: NumberLineData): NumberLineEvaluation {
  const r = data.result
  if (!r || r.ok !== true || !Array.isArray(r.intervals) || !Array.isArray(r.points)) {
    return { ok: false, errors: [{ line: 0, index: 0, code: 'bad_data' }] }
  }
  const all: SolverBound[] = []
  for (const iv of r.intervals) {
    if (iv.from) all.push(iv.from)
    if (iv.to) all.push(iv.to)
  }
  all.push(...r.points)
  const uniq: SolverBound[] = []
  for (const b of [...all].sort((a, c) => a.approx - c.approx)) {
    const same = uniq.find((u) => u.latex === b.latex)
    if (same) same.closed = same.closed || b.closed
    else uniq.push({ ...b })
  }
  const n = uniq.length
  const xs = uniq.map((_, i) => (n === 1 ? 0.5 : MARGIN + ((1 - 2 * MARGIN) * i) / (n - 1)))
  const xOf = (b: SolverBound) => xs[uniq.findIndex((u) => u.latex === b.latex)]
  const result: LayoutSegment[] = r.intervals.map((iv) => ({ from: iv.from ? xOf(iv.from) : 0, to: iv.to ? xOf(iv.to) : 1 }))
  // Відповідь — тим самим форматером, що й на сторінці (назва проміжку теж), з меж сервера.
  const pieces: Array<AnswerPiece & { at: number }> = [
    ...r.intervals.map((iv) => ({
      lo: iv.from ? solverBoundLabel(iv.from) : null,
      loClosed: !!iv.from?.closed,
      hi: iv.to ? solverBoundLabel(iv.to) : null,
      hiClosed: !!iv.to?.closed,
      point: false,
      loTex: iv.from ? solverBoundTex(iv.from) : null,
      hiTex: iv.to ? solverBoundTex(iv.to) : null,
      at: iv.from ? iv.from.approx : -Infinity,
    })),
    ...r.points.map((b) => ({
      lo: solverBoundLabel(b), loClosed: true, hi: solverBoundLabel(b), hiClosed: true, point: true,
      loTex: solverBoundTex(b), hiTex: solverBoundTex(b), at: b.approx,
    })),
  ].sort((a, b) => a.at - b.at)
  const variable = data.variable || 'x'
  // ОДЗ: від сервера (корені, скорочення); інакше — нулі знаменника, якщо рядок розбирає рушій.
  const holes = r.domain ? null : denominatorHoles(String(data.inequality ?? ''))
  return {
    ok: true,
    // Множина живе на сервері (контракт), рушій її не перераховує — тут лише рисунок і відповідь.
    set: [],
    answer: answerFromPieces(pieces, variable),
    domain: r.domain || holesText(holes ?? [], variable),
    layout: {
      points: uniq.map((b, i) => ({ label: solverBoundLabel(b), tex: solverBoundTex(b) ?? undefined, x: xs[i], filled: b.closed })),
      hatches: [{ condition: 0, segments: result }],
      result,
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
