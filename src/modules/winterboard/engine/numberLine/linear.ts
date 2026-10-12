/**
 * Лінійні нерівності (Б-184): `2x + 3 > 7`, `3(x − 1) ≤ x + 5`, `x/2 − 1 ≥ 0`,
 * подвійні `−1 < 2x + 1 ≤ 5` → умова контракту `x ⋚ a` / `a < x < b`.
 *
 * Розвʼязок точний (раціональні числа, без плаваючої коми). Ділення на
 * відʼємний коефіцієнт перевертає знак. Запис учителя зберігається в `source`,
 * щоб формула на картці лишалась такою, як він написав.
 *
 * Нелінійне (x·x, ділення на x) — не тут: це метод інтервалів (етап 2).
 */
import {
  add,
  div,
  isZero,
  mul,
  neg,
  rational,
  sub,
  toLabel,
  type Rational,
} from './rational'
import { parseNumber } from './parse'
import type { NumberLineCondition, NumberLineError, NumberLineOp } from './types'

type ErrorWithoutLine = Omit<NumberLineError, 'line'>

export type LinearResult =
  | { ok: true; condition: NumberLineCondition; variable: string }
  | { ok: false; error: ErrorWithoutLine }

/** a·x + b */
interface Lin {
  a: Rational
  b: Rational
}

type Tok =
  | { kind: 'num'; value: Rational; start: number }
  | { kind: 'var'; name: string; start: number }
  | { kind: 'sym'; ch: '+' | '-' | '*' | '/' | '(' | ')'; start: number }
  | { kind: 'op'; op: NumberLineOp; start: number }

const OPS: Array<[string, NumberLineOp]> = [
  ['<=', '<='], ['=<', '<='], ['≤', '<='], ['⩽', '<='],
  ['>=', '>='], ['=>', '>='], ['≥', '>='], ['⩾', '>='],
  ['!=', '!='], ['<>', '!='], ['≠', '!='],
  ['<', '<'], ['>', '>'], ['=', '='],
]

const FLIP: Record<NumberLineOp, NumberLineOp> = {
  '<': '>', '<=': '>=', '>': '<', '>=': '<=', '!=': '!=', '=': '=',
}

const DISPLAY: Record<NumberLineOp, string> = {
  '<': '<', '<=': '≤', '>': '>', '>=': '≥', '!=': '≠', '=': '=',
}

class LinearError extends Error {
  constructor(readonly payload: ErrorWithoutLine) {
    super(payload.code)
  }
}

function fail(index: number, code: NumberLineError['code'], params?: Record<string, string>): never {
  throw new LinearError({ index, code, ...(params ? { params } : {}) })
}

function tokenize(line: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (/\s/.test(ch)) { i++; continue }
    if (ch === '√' || /^sqrt/i.test(line.slice(i))) fail(i, 'roots_not_supported')
    const op = OPS.find(([p]) => line.startsWith(p, i))
    if (op) {
      toks.push({ kind: 'op', op: op[1], start: i })
      i += op[0].length
      continue
    }
    if (/[0-9]/.test(ch)) {
      const text = (/^\d+(?:[.,]\d+)?/.exec(line.slice(i)) as RegExpExecArray)[0]
      const n = parseNumber(text, i)
      if ('error' in n) fail(i, n.error.code, n.error.params)
      toks.push({ kind: 'num', value: n.value, start: i })
      i += text.length
      continue
    }
    if (/[a-zA-Z]/.test(ch)) {
      toks.push({ kind: 'var', name: ch, start: i })
      i++
      continue
    }
    if (/[−–—]/.test(ch)) { toks.push({ kind: 'sym', ch: '-', start: i }); i++; continue }
    if ('·×'.includes(ch)) { toks.push({ kind: 'sym', ch: '*', start: i }); i++; continue }
    if (ch === ':') { toks.push({ kind: 'sym', ch: '/', start: i }); i++; continue }
    if ('+-*/()'.includes(ch)) {
      toks.push({ kind: 'sym', ch: ch as '+' | '-' | '*' | '/' | '(' | ')', start: i })
      i++
      continue
    }
    fail(i, 'unexpected_char', { char: ch })
  }
  return toks
}

const ZERO = rational(0n)
const ONE = rational(1n)

/** Рекурсивний спуск по одному боку нерівності. */
class Side {
  pos = 0
  variable: string | null = null

  constructor(private readonly toks: Tok[], private readonly end: number, private readonly endIndex: number) {}

  private peek(): Tok | undefined {
    return this.pos < this.end ? this.toks[this.pos] : undefined
  }

  private at(): number {
    return this.peek()?.start ?? this.endIndex
  }

  parse(): Lin {
    const v = this.expr()
    const t = this.peek()
    if (t) fail(t.start, t.kind === 'sym' && t.ch === ')' ? 'unbalanced_paren' : 'unexpected_char', { char: t.kind === 'sym' ? t.ch : '' })
    return v
  }

  private expr(): Lin {
    let acc = this.term()
    for (;;) {
      const t = this.peek()
      if (!t || t.kind !== 'sym' || (t.ch !== '+' && t.ch !== '-')) return acc
      this.pos++
      const rhs = this.term()
      acc = t.ch === '+'
        ? { a: add(acc.a, rhs.a), b: add(acc.b, rhs.b) }
        : { a: sub(acc.a, rhs.a), b: sub(acc.b, rhs.b) }
    }
  }

  private term(): Lin {
    let acc = this.unary()
    for (;;) {
      const t = this.peek()
      if (!t) return acc
      if (t.kind === 'sym' && t.ch === '*') {
        this.pos++
        acc = this.times(acc, this.unary(), t.start)
      } else if (t.kind === 'sym' && t.ch === '/') {
        this.pos++
        acc = this.divide(acc, this.unary(), t.start)
      } else if (t.kind === 'var' || (t.kind === 'sym' && t.ch === '(') || (t.kind === 'num' && this.prevIsCloser())) {
        // Неявне множення: 2x, 3(x − 1), (x + 1)2.
        acc = this.times(acc, this.factor(), t.start)
      } else {
        return acc
      }
    }
  }

  private prevIsCloser(): boolean {
    const prev = this.toks[this.pos - 1]
    return !!prev && prev.kind === 'sym' && prev.ch === ')'
  }

  private unary(): Lin {
    const t = this.peek()
    if (t && t.kind === 'sym' && (t.ch === '-' || t.ch === '+')) {
      this.pos++
      const v = this.unary()
      return t.ch === '-' ? { a: neg(v.a), b: neg(v.b) } : v
    }
    return this.factor()
  }

  private factor(): Lin {
    const t = this.peek()
    if (!t) fail(this.endIndex, 'bad_number', { text: '' })
    if (t.kind === 'num') {
      this.pos++
      return { a: ZERO, b: t.value }
    }
    if (t.kind === 'var') {
      if (this.variable && this.variable !== t.name) fail(t.start, 'unexpected_char', { char: t.name })
      this.variable = t.name
      this.pos++
      return { a: ONE, b: ZERO }
    }
    if (t.kind === 'sym' && t.ch === '(') {
      this.pos++
      const v = this.expr()
      const close = this.peek()
      if (!close || close.kind !== 'sym' || close.ch !== ')') fail(t.start, 'unbalanced_paren')
      this.pos++
      return v
    }
    if (t.kind === 'sym' && t.ch === ')') fail(t.start, 'unbalanced_paren')
    fail(t.start, 'bad_number', { text: t.kind === 'sym' ? t.ch : '' })
  }

  private times(l: Lin, r: Lin, at: number): Lin {
    if (!isZero(l.a) && !isZero(r.a)) fail(at, 'not_linear')
    return {
      a: add(mul(l.a, r.b), mul(r.a, l.b)),
      b: mul(l.b, r.b),
    }
  }

  private divide(l: Lin, r: Lin, at: number): Lin {
    if (!isZero(r.a)) fail(at, 'not_linear')
    if (isZero(r.b)) fail(at, 'division_by_zero', { text: '0' })
    return { a: div(l.a, r.b), b: div(l.b, r.b) }
  }

  get atEnd(): number {
    return this.at()
  }
}

function side(toks: Tok[], from: number, to: number, endIndex: number): { lin: Lin; variable: string | null } {
  if (from >= to) fail(endIndex, 'bad_number', { text: '' })
  const slice = toks.slice(from, to)
  const s = new Side(slice, slice.length, endIndex)
  return { lin: s.parse(), variable: s.variable }
}

function holds(op: NumberLineOp, c: Rational): boolean {
  // 0 ⋚ c
  const sign = c.n === 0n ? 0 : c.n > 0n ? 1 : -1
  switch (op) {
    case '<': return 0 < sign
    case '<=': return 0 <= sign
    case '>': return 0 > sign
    case '>=': return 0 >= sign
    case '!=': return sign !== 0
    case '=': return sign === 0
  }
}

/** a·x ⋚ c, a ≠ 0 → x ⋚ c/a (знак перевертається для a < 0). */
function isolate(a: Rational, op: NumberLineOp, c: Rational): { op: NumberLineOp; value: Rational } {
  return { op: a.n < 0n ? FLIP[op] : op, value: div(c, a) }
}

/**
 * Запис межі для контракту. Учитель писав десяткові (`0,5x > 1`) — і відповідь
 * десятковим, якщо вона скінченний десятковий дріб; інакше — звичайний дріб.
 */
function labeler(line: string): (r: Rational) => string {
  const decimal = /\d[.,]\d/.test(line) && !line.includes('/') && !line.includes(':')
  const sep = line.includes(',') ? ',' : '.'
  return (r) => {
    if (!decimal || r.d === 1n) return toLabel(r)
    let d = r.d
    let k = 0
    while (d % 10n === 0n) { d /= 10n; k++ }
    while (d % 2n === 0n) { d /= 2n; k++ }
    while (d % 5n === 0n) { d /= 5n; k++ }
    if (d !== 1n) return toLabel(r)
    const scaled = (r.n < 0n ? -r.n : r.n) * 10n ** BigInt(k) / r.d
    const digits = scaled.toString().padStart(k + 1, '0')
    const text = `${digits.slice(0, -k)}${sep}${digits.slice(-k)}`
    return r.n < 0n ? `-${text}` : text
  }
}

/** Рядок учителя → умова, якщо це лінійна нерівність (не простий запис `x > 3`). */
export function parseLinear(line: string): LinearResult {
  const source = line.trim().replace(/\s+/g, ' ')
  const label = labeler(line)
  try {
    const toks = tokenize(line)
    const opIdx = toks.map((t, i) => (t.kind === 'op' ? i : -1)).filter((i) => i >= 0)
    if (opIdx.length === 0) fail(line.length, 'expect_op')
    if (opIdx.length > 2) fail(toks[opIdx[2]].start, 'trailing')
    const end = line.length
    const nextStart = (i: number) => toks[i]?.start ?? end

    if (opIdx.length === 1) {
      const k = opIdx[0]
      const op = (toks[k] as Extract<Tok, { kind: 'op' }>).op
      const left = side(toks, 0, k, toks[k].start)
      const right = side(toks, k + 1, toks.length, nextStart(k + 1))
      if (left.variable && right.variable && left.variable !== right.variable) fail(toks[k].start, 'variable_twice')
      const variable = left.variable ?? right.variable
      if (!variable) fail(0, 'no_variable')
      // (aL − aR)·x ⋚ bR − bL
      const a = sub(left.lin.a, right.lin.a)
      const c = sub(right.lin.b, left.lin.b)
      if (isZero(a)) {
        const text = `0 ${DISPLAY[op]} ${toLabel(c)}`
        fail(0, holds(op, c) ? 'always_true' : 'never_true', { text, variable })
      }
      const r = isolate(a, op, c)
      return { ok: true, variable, condition: { op: r.op, value: label(r.value), source } }
    }

    // Подвійна: L ⋚ M ⋚ R, змінна лише посередині.
    const [k1, k2] = opIdx
    const op1 = (toks[k1] as Extract<Tok, { kind: 'op' }>).op
    const op2 = (toks[k2] as Extract<Tok, { kind: 'op' }>).op
    if ([op1, op2].some((o) => o === '=' || o === '!=')) {
      fail((op1 === '=' || op1 === '!=' ? toks[k1] : toks[k2]).start, 'eq_in_range')
    }
    const less = [op1, op2].every((o) => o === '<' || o === '<=')
    const greater = [op1, op2].every((o) => o === '>' || o === '>=')
    if (!less && !greater) fail(toks[k2].start, 'mixed_direction')
    const L = side(toks, 0, k1, toks[k1].start)
    const M = side(toks, k1 + 1, k2, toks[k2].start)
    const R = side(toks, k2 + 1, toks.length, nextStart(k2 + 1))
    if (L.variable || R.variable) fail(toks[k1].start, 'variable_twice')
    if (!M.variable) fail(toks[k1].start, 'no_variable')
    if (isZero(M.lin.a)) fail(toks[k1].start, 'no_variable')
    // L ⋚ a·x + b ⋚ R → (L − b)/a ⋚ x ⋚ (R − b)/a; для a < 0 межі міняються місцями.
    let lo = div(sub(L.lin.b, M.lin.b), M.lin.a)
    let hi = div(sub(R.lin.b, M.lin.b), M.lin.a)
    // Нормалізуємо до «менший < x < більший».
    let loIncl = less ? op1 === '<=' : op2 === '>='
    let hiIncl = less ? op2 === '<=' : op1 === '>='
    if (greater) [lo, hi] = [hi, lo]
    if (M.lin.a.n < 0n) {
      ;[lo, hi] = [hi, lo]
      ;[loIncl, hiIncl] = [hiIncl, loIncl]
    }
    return {
      ok: true,
      variable: M.variable,
      condition: { from: label(lo), fromIncluded: loIncl, to: label(hi), toIncluded: hiIncl, source },
    }
  } catch (e) {
    if (e instanceof LinearError) {
      const variable = /[a-zA-Z]/.exec(line.replace(/sqrt/gi, ''))?.[0] ?? 'x'
      const p = e.payload
      return { ok: false, error: p.code === 'not_linear' ? { ...p, params: { variable, ...(p.params ?? {}) } } : p }
    }
    throw e
  }
}
