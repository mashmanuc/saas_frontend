/**
 * Спільний розбір виразів для числової прямої (Б-184): лінійні нерівності (етап 1)
 * і метод інтервалів (етап 2) читають одну граматику.
 *
 *   вираз   := доданок (± доданок)*
 *   доданок := ±степінь ( (· | / | неявне множення) степінь )*
 *   степінь := атом (^ ціле | ² | ³)?
 *   атом    := число | √n | змінна | ( вираз )
 *
 * Значення — «розкладений» дріб: коефіцієнт · Π многочлен^кратність (від'ємна
 * кратність — знаменник). Так метод інтервалів бачить множники й кратності
 * такими, як їх записав учитель, а лінійна нерівність — розгорнутий многочлен.
 *
 * Коефіцієнти точні (`Real`: дроби й корені a·√n). Сума різних коренів
 * (`1 + √2`) — `root_sum`; сума з дробом зі змінною в знаменнику — `sum_with_fraction`.
 */
import { rational } from './rational'
import { parseNumber } from './parse'
import {
  addReal,
  divReal,
  isRational,
  isZeroReal,
  mulReal,
  negReal,
  real,
  RootSumError,
  type Real,
} from './real'
import type { NumberLineError, NumberLineOp } from './types'

export type ErrorWithoutLine = Omit<NumberLineError, 'line'>

export class ExprError extends Error {
  constructor(readonly payload: ErrorWithoutLine) {
    super(payload.code)
  }
}

export function fail(index: number, code: NumberLineError['code'], params?: Record<string, string>): never {
  throw new ExprError({ index, code, ...(params ? { params } : {}) })
}

// ── Многочлени з точними коефіцієнтами (індекс = степінь) ─────────────────────

export type Poly = Real[]

export const R0 = real(rational(0n))
export const R1 = real(rational(1n))

export function trim(p: Poly): Poly {
  const out = [...p]
  while (out.length > 1 && isZeroReal(out[out.length - 1])) out.pop()
  return out.length ? out : [R0]
}

export function degree(p: Poly): number {
  const t = trim(p)
  return t.length === 1 && isZeroReal(t[0]) ? -1 : t.length - 1
}

export function polyAdd(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length)
  const out: Poly = []
  for (let i = 0; i < n; i++) out.push(addReal(a[i] ?? R0, b[i] ?? R0))
  return trim(out)
}

export function polyMul(a: Poly, b: Poly): Poly {
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => R0)
  a.forEach((x, i) => b.forEach((y, j) => { out[i + j] = addReal(out[i + j], mulReal(x, y)) }))
  return trim(out)
}

export function polyScale(p: Poly, k: Real): Poly {
  return trim(p.map((c) => mulReal(c, k)))
}

/** Найбільший степінь, з яким вираз ще розгортаємо (захист від `(x+1)^99`). */
export const MAX_DEGREE = 12

// ── Розкладений дріб ────────────────────────────────────────────────────────

export interface Factor {
  poly: Poly
  /** > 0 — у чисельнику, < 0 — у знаменнику. */
  mult: number
}

export interface Factored {
  coef: Real
  factors: Factor[]
}

function powReal(x: Real, k: number): Real {
  let out = R1
  for (let i = 0; i < k; i++) out = mulReal(out, x)
  return out
}

/** Константні множники — у коефіцієнт; нульовий множник у знаменнику — ділення на нуль. */
function normalize(f: Factored, at: number): Factored {
  let coef = f.coef
  const factors: Factor[] = []
  for (const fac of f.factors) {
    const p = trim(fac.poly)
    if (fac.mult === 0) continue
    if (degree(p) <= 0) {
      const c = p[0]
      if (isZeroReal(c)) {
        if (fac.mult < 0) fail(at, 'division_by_zero', { text: '0' })
        return { coef: R0, factors: [] }
      }
      coef = fac.mult > 0 ? mulReal(coef, powReal(c, fac.mult)) : divReal(coef, powReal(c, -fac.mult))
      continue
    }
    factors.push({ poly: p, mult: fac.mult })
  }
  if (isZeroReal(coef)) {
    // 0 · (щось зі змінною): чисельник — нуль, знаменники лишаються (їхні нулі — поза ОДЗ).
    return { coef: R0, factors: factors.filter((x) => x.mult < 0) }
  }
  return { coef, factors }
}

export function hasDenominator(f: Factored): boolean {
  return f.factors.some((x) => x.mult < 0)
}

/** Розгорнути в многочлен (лише без знаменника). */
export function expand(f: Factored): Poly {
  let p: Poly = [f.coef]
  let deg = 0
  for (const fac of f.factors) {
    deg += degree(fac.poly) * fac.mult
    if (deg > MAX_DEGREE) fail(0, 'too_complex', { max: String(MAX_DEGREE) })
    for (let i = 0; i < fac.mult; i++) p = polyMul(p, fac.poly)
  }
  return trim(p)
}

function fromPoly(p: Poly, at: number): Factored {
  return normalize({ coef: R1, factors: [{ poly: p, mult: 1 }] }, at)
}

function fMul(a: Factored, b: Factored, at: number): Factored {
  return normalize({ coef: mulReal(a.coef, b.coef), factors: [...a.factors, ...b.factors] }, at)
}

function fDiv(a: Factored, b: Factored, at: number): Factored {
  if (isZeroReal(b.coef)) fail(at, 'division_by_zero', { text: '0' })
  return normalize({
    coef: divReal(a.coef, b.coef),
    factors: [...a.factors, ...b.factors.map((x) => ({ poly: x.poly, mult: -x.mult }))],
  }, at)
}

function fPow(a: Factored, k: number, at: number): Factored {
  return normalize({ coef: powReal(a.coef, k), factors: a.factors.map((x) => ({ poly: x.poly, mult: x.mult * k })) }, at)
}

export function fNeg(a: Factored): Factored {
  return { coef: negReal(a.coef), factors: a.factors }
}

export function fAdd(a: Factored, b: Factored, at: number): Factored {
  if (isZeroReal(a.coef) && !hasDenominator(a)) return b
  if (isZeroReal(b.coef) && !hasDenominator(b)) return a
  if (hasDenominator(a) || hasDenominator(b)) fail(at, 'sum_with_fraction')
  return fromPoly(polyAdd(expand(a), expand(b)), at)
}

// ── Токени ─────────────────────────────────────────────────────────────────

export type Tok =
  | { kind: 'num'; value: Real; root: boolean; start: number }
  | { kind: 'var'; name: string; start: number }
  | { kind: 'sym'; ch: '+' | '-' | '*' | '/' | '(' | ')' | '^'; start: number }
  | { kind: 'op'; op: NumberLineOp; start: number }

const OPS: Array<[string, NumberLineOp]> = [
  ['<=', '<='], ['=<', '<='], ['≤', '<='], ['⩽', '<='],
  ['>=', '>='], ['=>', '>='], ['≥', '>='], ['⩾', '>='],
  ['!=', '!='], ['<>', '!='], ['≠', '!='],
  ['<', '<'], ['>', '>'], ['=', '='],
]

const SUPERSCRIPT: Record<string, string> = { '²': '2', '³': '3', '⁴': '4' }

export function tokenize(line: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (/\s/.test(ch)) { i++; continue }
    const op = OPS.find(([p]) => line.startsWith(p, i))
    if (op) {
      toks.push({ kind: 'op', op: op[1], start: i })
      i += op[0].length
      continue
    }
    // Корінь: `√3`, `√(12)`, `sqrt(5)` — лише з числа (корінь зі змінної — не етап 1б).
    const root = /^(?:√|sqrt)\s*(?:\(\s*(\d+)\s*\)|(\d+))/i.exec(line.slice(i))
    if (root) {
      const n = parseNumber(`√${root[1] ?? root[2]}`, i)
      if ('error' in n) fail(i, n.error.code, n.error.params)
      toks.push({ kind: 'num', value: n.value, root: true, start: i })
      i += root[0].length
      continue
    }
    if (ch === '√' || /^sqrt/i.test(line.slice(i))) fail(i, 'root_form', { text: line.slice(i).trim() })
    if (/[0-9]/.test(ch)) {
      const text = (/^\d+(?:[.,]\d+)?/.exec(line.slice(i)) as RegExpExecArray)[0]
      const n = parseNumber(text, i)
      if ('error' in n) fail(i, n.error.code, n.error.params)
      toks.push({ kind: 'num', value: n.value, root: false, start: i })
      i += text.length
      continue
    }
    if (/[a-zA-Z]/.test(ch)) {
      toks.push({ kind: 'var', name: ch, start: i })
      i++
      continue
    }
    if (SUPERSCRIPT[ch]) {
      toks.push({ kind: 'sym', ch: '^', start: i })
      toks.push({ kind: 'num', value: real(rational(BigInt(SUPERSCRIPT[ch]))), root: false, start: i })
      i++
      continue
    }
    if (/[−–—]/.test(ch)) { toks.push({ kind: 'sym', ch: '-', start: i }); i++; continue }
    if ('·×'.includes(ch)) { toks.push({ kind: 'sym', ch: '*', start: i }); i++; continue }
    if (ch === ':') { toks.push({ kind: 'sym', ch: '/', start: i }); i++; continue }
    if ('+-*/()^'.includes(ch)) {
      toks.push({ kind: 'sym', ch: ch as '+' | '-' | '*' | '/' | '(' | ')' | '^', start: i })
      i++
      continue
    }
    fail(i, 'unexpected_char', { char: ch })
  }
  return toks
}

// ── Розбір ─────────────────────────────────────────────────────────────────

/** Спільна змінна для всіх частин рядка. */
export interface VarScope {
  name: string | null
}

/** Рекурсивний спуск по відрізку токенів [from, to). */
export function parseExpr(toks: Tok[], from: number, to: number, endIndex: number, scope: VarScope): Factored {
  if (from >= to) fail(endIndex, 'bad_number', { text: '' })
  let pos = from
  const peek = (): Tok | undefined => (pos < to ? toks[pos] : undefined)

  const expr = (): Factored => {
    let acc = term()
    for (;;) {
      const t = peek()
      if (!t || t.kind !== 'sym' || (t.ch !== '+' && t.ch !== '-')) return acc
      pos++
      const rhs = term()
      acc = fAdd(acc, t.ch === '+' ? rhs : fNeg(rhs), t.start)
    }
  }

  const term = (): Factored => {
    let acc = unary()
    for (;;) {
      const t = peek()
      if (!t) return acc
      if (t.kind === 'sym' && t.ch === '*') {
        pos++
        acc = fMul(acc, unary(), t.start)
      } else if (t.kind === 'sym' && t.ch === '/') {
        pos++
        acc = fDiv(acc, unary(), t.start)
      } else if (
        t.kind === 'var' ||
        (t.kind === 'sym' && t.ch === '(') ||
        (t.kind === 'num' && (t.root || prevIsCloser()))
      ) {
        // Неявне множення: 2x, 3(x − 1), (x + 1)(x − 2), 2√3, (x + 1)2.
        acc = fMul(acc, power(), t.start)
      } else {
        return acc
      }
    }
  }

  const prevIsCloser = (): boolean => {
    const prev = toks[pos - 1]
    return !!prev && prev.kind === 'sym' && prev.ch === ')'
  }

  const unary = (): Factored => {
    const t = peek()
    if (t && t.kind === 'sym' && (t.ch === '-' || t.ch === '+')) {
      pos++
      const v = unary()
      return t.ch === '-' ? fNeg(v) : v
    }
    return power()
  }

  const power = (): Factored => {
    const base = atom()
    const t = peek()
    if (!t || t.kind !== 'sym' || t.ch !== '^') return base
    pos++
    const e = peek()
    if (!e || e.kind !== 'num' || e.root || !isRational(e.value) || e.value.q.d !== 1n || e.value.q.n < 0n || e.value.q.n > BigInt(MAX_DEGREE)) {
      fail(t.start, 'bad_power', { max: String(MAX_DEGREE) })
    }
    pos++
    return fPow(base, Number(e.value.q.n), t.start)
  }

  const atom = (): Factored => {
    const t = peek()
    if (!t) fail(endIndex, 'bad_number', { text: '' })
    if (t.kind === 'num') {
      pos++
      return { coef: t.value, factors: [] }
    }
    if (t.kind === 'var') {
      if (scope.name && scope.name !== t.name) fail(t.start, 'unexpected_char', { char: t.name })
      scope.name = t.name
      pos++
      return { coef: R1, factors: [{ poly: [R0, R1], mult: 1 }] }
    }
    if (t.kind === 'sym' && t.ch === '(') {
      pos++
      const v = expr()
      const close = peek()
      if (!close || close.kind !== 'sym' || close.ch !== ')') fail(t.start, 'unbalanced_paren')
      pos++
      return v
    }
    if (t.kind === 'sym' && t.ch === ')') fail(t.start, 'unbalanced_paren')
    if (t.kind === 'op') fail(t.start, 'bad_number', { text: '' })
    fail(t.start, 'bad_number', { text: t.kind === 'sym' ? t.ch : '' })
  }

  try {
    const v = expr()
    const rest = peek()
    if (rest) {
      fail(rest.start, rest.kind === 'sym' && rest.ch === ')' ? 'unbalanced_paren' : 'unexpected_char', {
        char: rest.kind === 'sym' ? rest.ch : rest.kind === 'var' ? rest.name : '',
      })
    }
    return v
  } catch (e) {
    if (e instanceof RootSumError) fail(from < toks.length ? toks[from].start : endIndex, 'root_sum')
    throw e
  }
}

/** Індекси знаків порівняння в рядку. */
export function opIndexes(toks: Tok[]): number[] {
  return toks.map((t, i) => (t.kind === 'op' ? i : -1)).filter((i) => i >= 0)
}

/** Перехопити RootSumError поза parseExpr (віднімання частин, корені рівнянь). */
export function guardRoots<T>(at: number, fn: () => T): T {
  try {
    return fn()
  } catch (e) {
    if (e instanceof RootSumError) fail(at, 'root_sum')
    throw e
  }
}
