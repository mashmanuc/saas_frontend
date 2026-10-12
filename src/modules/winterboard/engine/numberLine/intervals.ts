/**
 * Метод інтервалів (Б-184, етап 2; ТЗ §1.5, §2.2 `intervals`).
 *
 * Вираз: учитель пише добуток / частку, `(x-1)(x+3)/(x-2) ≥ 0`. Дошка знаходить
 * нулі множників із кратністю, нулі знаменника — завжди виколоті, знаки на
 * проміжках (парна кратність — знак не змінюється), відповідь — обʼєднанням.
 * Ненульова права частина (`x² > 4`) — лише для многочленів: переносимо вліво.
 * Квадратні множники розкладаємо самі (D < 0 — знак сталий), вищі степені —
 * через раціональні корені; не вийшло — просимо розкласти словами.
 *
 * Вручну: учитель ставить точки (зафарбовані / виколоті) і знаки — дошка лише
 * малює й записує відповідь за цими знаками.
 *
 * Усе точно: дроби й корені a·√n (`real.ts`), жодних допусків.
 */
import { rational, type Rational } from './rational'
import { parseNumber } from './parse'
import {
  addReal,
  compareReal,
  divReal,
  fromRational,
  isRational,
  isZeroReal,
  mulReal,
  negReal,
  realLabel,
  sign,
  sqrtRational,
  subReal,
  type Real,
} from './real'
import {
  degree,
  ExprError,
  fAdd,
  fail,
  fNeg,
  guardRoots,
  hasDenominator,
  opIndexes,
  parseExpr,
  R0,
  tokenize,
  type ErrorWithoutLine,
  type Factored,
  type Poly,
  type Tok,
  type VarScope,
} from './expr'
import { contains, normalize, type Interval, type NumberSet, type Point } from './sets'
import type { IntervalsOp, IntervalsPoint, NumberLineData, NumberLineError, NumberLineOp } from './types'

// ── Розбір рядка «вираз ⋚ права частина» ────────────────────────────────────

export type ParsedIntervalsLine =
  | { ok: true; expression: string; rhs: string; op: IntervalsOp; variable: string }
  | { ok: false; error: ErrorWithoutLine }

const INTERVAL_OPS: ReadonlySet<NumberLineOp> = new Set(['<', '<=', '>', '>='])

/** `(x-1)(x+3)/(x-2) ≥ 0` → вираз, знак, права частина. Перевіряє все, що перевіряє рушій. */
export function parseIntervalsLine(line: string): ParsedIntervalsLine {
  try {
    const toks = tokenize(line)
    const ops = opIndexes(toks)
    if (ops.length !== 1) {
      fail(ops.length ? toks[ops[1]].start : line.length, ops.length ? 'trailing' : 'not_inequality')
    }
    const k = ops[0]
    const opTok = toks[k] as Extract<Tok, { kind: 'op' }>
    if (!INTERVAL_OPS.has(opTok.op)) fail(opTok.start, 'not_inequality')
    const expression = line.slice(0, opTok.start).trim()
    const after = toks[k + 1]?.start ?? line.length
    const rhs = line.slice(after).trim()
    const a = analyze(expression, rhs)
    return { ok: true, expression, rhs: rhs || '0', op: opTok.op as IntervalsOp, variable: a.variable }
  } catch (e) {
    if (e instanceof ExprError) return { ok: false, error: e.payload }
    throw e
  }
}

// ── Аналіз виразу: нулі, кратності, знак праворуч ───────────────────────────

interface Zero {
  value: Real
  /** Сумарна кратність у чисельнику. */
  num: number
  /** Сумарна кратність у знаменнику (> 0 — точка поза ОДЗ, завжди виколота). */
  den: number
}

interface Analysis {
  variable: string
  zeros: Zero[]
  /** Знак виразу праворуч від усіх нулів; 0 — чисельник тотожно нуль. */
  signAtInfinity: -1 | 0 | 1
}

function analyze(expression: string, rhs: string): Analysis {
  const toks = tokenize(`${expression} > ${rhs || '0'}`)
  const k = opIndexes(toks)[0]
  const scope: VarScope = { name: null }
  const left = parseExpr(toks, 0, k, toks[k].start, scope)
  const right = parseExpr(toks, k + 1, toks.length, expression.length + 3, scope)
  if (!scope.name) fail(0, 'no_variable')

  // Права частина ненульова — переносимо вліво (лише многочлени: інакше спільний знаменник — крок учителя).
  let f: Factored = left
  const rightIsZero = isZeroReal(right.coef) && !hasDenominator(right)
  if (!rightIsZero) {
    if (hasDenominator(left) || hasDenominator(right)) fail(toks[k].start, 'rhs_not_zero')
    f = guardRoots(toks[k].start, () => fAdd(left, fNeg(right), toks[k].start))
  }

  const zeros: Zero[] = []
  const addZero = (value: Real, mult: number) => {
    const z = zeros.find((x) => compareReal(x.value, value) === 0)
    const entry = z ?? { value, num: 0, den: 0 }
    if (!z) zeros.push(entry)
    if (mult > 0) entry.num += mult
    else entry.den += -mult
  }

  let s: -1 | 0 | 1 = sign(f.coef)
  for (const fac of f.factors) {
    const { roots, lead } = guardRoots(0, () => factorRoots(fac.poly))
    for (const r of roots) addZero(r.value, r.mult * fac.mult)
    if (Math.abs(fac.mult) % 2 === 1) s = (s * lead) as -1 | 0 | 1
  }
  zeros.sort((a, b) => compareReal(a.value, b.value))
  return { variable: scope.name, zeros, signAtInfinity: s }
}

// ── Корені многочлена ──────────────────────────────────────────────────────

interface Root {
  value: Real
  mult: number
}

function allRational(p: Poly): boolean {
  return p.every(isRational)
}

/** Корені многочлена з кратністю + знак старшого коефіцієнта. */
function factorRoots(poly: Poly): { roots: Root[]; lead: -1 | 1 } {
  const deg = degree(poly)
  const lead = sign(poly[deg]) as -1 | 1
  const roots: Root[] = []
  const push = (value: Real, mult: number) => {
    const r = roots.find((x) => compareReal(x.value, value) === 0)
    if (r) r.mult += mult
    else roots.push({ value, mult })
  }

  let p = poly.slice(0, deg + 1)
  // x^k: нульові молодші коефіцієнти.
  let k = 0
  while (degree(p) > 0 && isZeroReal(p[0])) {
    p = p.slice(1)
    k++
  }
  if (k) push(R0, k)

  while (degree(p) >= 3) {
    if (!allRational(p)) fail(0, 'cannot_factor')
    const r = rationalRoot(p.map((c) => c.q))
    if (!r) fail(0, 'cannot_factor')
    push(fromRational(r), 1)
    p = syntheticDivide(p, fromRational(r))
  }
  const d = degree(p)
  if (d === 1) {
    push(divReal(negReal(p[0]), p[1]), 1)
  } else if (d === 2) {
    for (const r of quadraticRoots(p)) push(r.value, r.mult)
  }
  return { roots, lead }
}

/** ax² + bx + c: D < 0 — нулів немає; D = 0 — подвійний; D > 0 — два (у формі a·√n). */
function quadraticRoots(p: Poly): Root[] {
  const [c, b, a] = p
  if (!allRational(p)) {
    // x² − 3 з ірраціональними коефіцієнтами — лише без b: x² = −c/a.
    if (!isZeroReal(b)) fail(0, 'cannot_factor')
  }
  const two = fromRational(rational(2n))
  const four = fromRational(rational(4n))
  if (isZeroReal(b)) {
    // ax² + c: x² = −c/a.
    const t = divReal(negReal(c), a)
    if (!isRational(t)) fail(0, 'cannot_factor')
    const sgn = sign(t)
    if (sgn < 0) return []
    if (sgn === 0) return [{ value: R0, mult: 2 }]
    const s = sqrtRational(t.q) as Real
    return [{ value: negReal(s), mult: 1 }, { value: s, mult: 1 }]
  }
  const D = subReal(mulReal(b, b), mulReal(four, mulReal(a, c)))
  const sgn = sign(D)
  if (sgn < 0) return []
  const twoA = mulReal(two, a)
  if (sgn === 0) return [{ value: divReal(negReal(b), twoA), mult: 2 }]
  const s = sqrtRational(D.q) as Real
  // (−b ± √D)/2a: при b ≠ 0 і ірраціональному √D — це 1 ± √2, не форма a·√n.
  const r1 = divReal(addReal(negReal(b), s), twoA)
  const r2 = divReal(subReal(negReal(b), s), twoA)
  return [{ value: r1, mult: 1 }, { value: r2, mult: 1 }]
}

const MAX_CANDIDATE = 1_000_000n

function divisors(n: bigint): bigint[] {
  const a = n < 0n ? -n : n
  if (a === 0n || a > MAX_CANDIDATE) return []
  const out: bigint[] = []
  for (let d = 1n; d * d <= a; d++) {
    if (a % d === 0n) {
      out.push(d)
      if (d * d !== a) out.push(a / d)
    }
  }
  return out
}

/** Раціональний корінь за теоремою (±p/q, p | a₀, q | aₙ) або null. */
function rationalRoot(coeffs: Rational[]): Rational | null {
  const lcm = coeffs.reduce((acc, c) => (acc * c.d) / gcd(acc, c.d), 1n)
  const ints = coeffs.map((c) => (c.n * lcm) / c.d)
  const a0 = ints[0]
  const an = ints[ints.length - 1]
  for (const p of divisors(a0)) {
    for (const q of divisors(an)) {
      for (const cand of [rational(p, q), rational(-p, q)]) {
        if (isZeroReal(evalPoly(coeffs, cand))) return cand
      }
    }
  }
  return null
}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a
  b = b < 0n ? -b : b
  while (b) [a, b] = [b, a % b]
  return a || 1n
}

function evalPoly(coeffs: Rational[], x: Rational): Real {
  let acc = R0
  for (let i = coeffs.length - 1; i >= 0; i--) {
    acc = addReal(mulReal(acc, fromRational(x)), fromRational(coeffs[i]))
  }
  return acc
}

/** p(x) / (x − r) за схемою Горнера (r — корінь). */
function syntheticDivide(p: Poly, r: Real): Poly {
  const out: Real[] = []
  let carry = R0
  for (let i = p.length - 1; i >= 1; i--) {
    carry = addReal(p[i], mulReal(carry, r))
    out.unshift(carry)
  }
  return out
}

// ── Множина розвʼязків і рисунок ───────────────────────────────────────────

/** Знак на проміжках зліва направо: k нулів → k + 1 знак. */
function signsFromRight(zeros: Zero[], atInfinity: -1 | 1): Array<-1 | 1> {
  const out: Array<-1 | 1> = new Array(zeros.length + 1)
  out[zeros.length] = atInfinity
  for (let i = zeros.length - 1; i >= 0; i--) {
    const odd = (zeros[i].num + zeros[i].den) % 2 === 1
    out[i] = (odd ? -out[i + 1] : out[i + 1]) as -1 | 1
  }
  return out
}

const wants = (op: IntervalsOp): -1 | 1 => (op === '>' || op === '>=' ? 1 : -1)
const strict = (op: IntervalsOp) => op === '<' || op === '>'

function pointOf(value: Real, label?: string): Point {
  return { value, label: label ?? realLabel(value) }
}

function openBetween(lo: Point | null, hi: Point | null): Interval {
  return { lo, loClosed: false, hi, hiClosed: false }
}

export interface IntervalsResult {
  set: NumberSet
  variable: string
  /** Точки в порядку значень і чи зафарбовані вони. */
  points: Array<{ point: Point; filled: boolean }>
  /** Знак на кожному проміжку (k + 1); порожньо, якщо вираз тотожно нуль. */
  signs: Array<'+' | '-'>
}

/** Режим «вираз». */
export function solveExpression(expression: string, rhs: string, op: IntervalsOp): IntervalsResult {
  const a = analyze(expression, rhs)
  const pts = a.zeros.map((z) => pointOf(z.value))

  if (a.signAtInfinity === 0) {
    // Чисельник тотожно нуль: 0 ⋚ 0 — для ≥ / ≤ уся ОДЗ, для > / < — ∅.
    const set: NumberSet = strict(op)
      ? []
      : normalize(pts.length ? pts.map((p, i) => openBetween(i ? pts[i - 1] : null, p)).concat([openBetween(pts[pts.length - 1], null)]) : [openBetween(null, null)])
    return { set, variable: a.variable, points: pts.map((point) => ({ point, filled: false })), signs: [] }
  }

  const signs = signsFromRight(a.zeros, a.signAtInfinity)
  const target = wants(op)
  const parts: Interval[] = []
  signs.forEach((sg, i) => {
    if (sg === target) parts.push(openBetween(i ? pts[i - 1] : null, i < pts.length ? pts[i] : null))
  })
  if (!strict(op)) {
    // Нулі чисельника (не знаменника) — розвʼязки нестрогої нерівності.
    a.zeros.forEach((z, i) => {
      if (z.num > 0 && z.den === 0) parts.push({ lo: pts[i], loClosed: true, hi: pts[i], hiClosed: true })
    })
  }
  const set = normalize(parts)
  return {
    set,
    variable: a.variable,
    points: pts.map((point) => ({ point, filled: contains(set, point.value) })),
    signs: signs.map((x) => (x > 0 ? '+' : '-')),
  }
}

/** Режим «вручну»: точки й знаки — від учителя, дошка лише малює. */
export function solveManual(points: IntervalsPoint[], signs: Array<'+' | '-'>, op: IntervalsOp, variable: string):
  IntervalsResult | { errors: NumberLineError[] } {
  if (!points.length) return { errors: [{ line: 0, index: 0, code: 'no_points' }] }
  const parsed: Array<{ point: Point; included: boolean }> = []
  const errors: NumberLineError[] = []
  points.forEach((p, line) => {
    const n = parseNumber(p.value)
    if ('error' in n) {
      errors.push({ ...n.error, line })
      return
    }
    if (parsed.some((x) => compareReal(x.point.value, n.value) === 0)) {
      errors.push({ line, index: 0, code: 'duplicate_point', params: { text: p.value } })
      return
    }
    parsed.push({ point: pointOf(n.value, n.label), included: p.included })
  })
  if (errors.length) return { errors }
  if (signs.length !== parsed.length + 1) return { errors: [{ line: 0, index: 0, code: 'signs_count' }] }
  parsed.sort((a, b) => compareReal(a.point.value, b.point.value))
  const pts = parsed.map((x) => x.point)
  const target = wants(op) > 0 ? '+' : '-'
  const parts: Interval[] = []
  signs.forEach((sg, i) => {
    if (sg === target) parts.push(openBetween(i ? pts[i - 1] : null, i < pts.length ? pts[i] : null))
  })
  parsed.forEach((x) => {
    if (x.included) parts.push({ lo: x.point, loClosed: true, hi: x.point, hiClosed: true })
  })
  return { set: normalize(parts), variable, points: parsed.map((x) => ({ point: x.point, filled: x.included })), signs }
}

/** Розвʼязати дані режиму 'intervals' — для evaluate(). */
export function solveIntervals(data: NumberLineData): IntervalsResult | { errors: NumberLineError[] } {
  const op = data.op ?? '>'
  if (data.expression !== undefined && data.expression.trim()) {
    try {
      return solveExpression(data.expression, data.rhs ?? '0', op)
    } catch (e) {
      if (e instanceof ExprError) return { errors: [{ ...e.payload, line: 0 }] }
      throw e
    }
  }
  return solveManual(data.points ?? [], data.signs ?? [], op, data.variable || 'x')
}

