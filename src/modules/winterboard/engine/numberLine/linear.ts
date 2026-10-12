/**
 * Лінійні нерівності (Б-184): `2x + 3 > 7`, `3(x − 1) ≤ x + 5`, `x/2 − 1 ≥ 0`,
 * подвійні `−1 < 2x + 1 ≤ 5` → умова контракту `x ⋚ a` / `a < x < b`.
 *
 * Розвʼязок точний (дроби й корені a·√n, без плаваючої коми). Ділення на
 * відʼємний коефіцієнт перевертає знак. Запис учителя зберігається в `source`,
 * щоб формула на картці лишалась такою, як він написав.
 *
 * Граматика — спільна з методом інтервалів (`expr.ts`). Нелінійне (x·x,
 * ділення на x) — не тут: це метод інтервалів (етап 2).
 */
import {
  ExprError,
  degree,
  expand,
  fail,
  guardRoots,
  hasDenominator,
  opIndexes,
  parseExpr,
  R0,
  tokenize,
  type ErrorWithoutLine,
  type Tok,
  type VarScope,
} from './expr'
import {
  compareReal,
  divReal,
  isRational,
  isZeroReal,
  realLabel,
  sign,
  subReal,
  type Real,
} from './real'
import { toLabel } from './rational'
import type { NumberLineCondition, NumberLineOp } from './types'

export type LinearResult =
  | { ok: true; condition: NumberLineCondition; variable: string }
  | { ok: false; error: ErrorWithoutLine }

/** a·x + b */
interface Lin {
  a: Real
  b: Real
}

const FLIP: Record<NumberLineOp, NumberLineOp> = {
  '<': '>', '<=': '>=', '>': '<', '>=': '<=', '!=': '!=', '=': '=',
}

const DISPLAY: Record<NumberLineOp, string> = {
  '<': '<', '<=': '≤', '>': '>', '>=': '≥', '!=': '≠', '=': '=',
}

/** Одна частина нерівності → a·x + b; змінна в знаменнику чи x² — не лінійне. */
function side(toks: Tok[], from: number, to: number, endIndex: number, scope: VarScope): Lin & { hasVar: boolean } {
  const f = parseExpr(toks, from, to, endIndex, scope)
  const at = toks[from]?.start ?? endIndex
  if (hasDenominator(f)) fail(at, 'not_linear')
  const p = expand(f)
  if (degree(p) > 1) fail(at, 'not_linear')
  const usedVar = toks.slice(from, to).some((t) => t.kind === 'var')
  return { a: p[1] ?? R0, b: p[0] ?? R0, hasVar: usedVar }
}

/** Числова нерівність `l ⋚ r` — правильна чи ні. */
function holds(l: Real, op: NumberLineOp, r: Real): boolean {
  const c = compareReal(l, r)
  switch (op) {
    case '<': return c < 0
    case '<=': return c <= 0
    case '>': return c > 0
    case '>=': return c >= 0
    case '!=': return c !== 0
    case '=': return c === 0
  }
}

/** a·x ⋚ c, a ≠ 0 → x ⋚ c/a (знак перевертається для a < 0). */
function isolate(a: Real, op: NumberLineOp, c: Real): { op: NumberLineOp; value: Real } {
  return { op: sign(a) < 0 ? FLIP[op] : op, value: divReal(c, a) }
}

/**
 * Запис межі для контракту. Учитель писав десяткові (`0,5x > 1`) — і відповідь
 * десятковим, якщо вона скінченний десятковий дріб; інакше — звичайний дріб.
 */
function labeler(line: string): (x: Real) => string {
  const decimal = /\d[.,]\d/.test(line) && !line.includes('/') && !line.includes(':')
  const sep = line.includes(',') ? ',' : '.'
  return (x) => {
    if (!isRational(x)) return realLabel(x)
    const r = x.q
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
    const opIdx = opIndexes(toks)
    if (opIdx.length === 0) fail(line.length, 'expect_op')
    if (opIdx.length > 2) fail(toks[opIdx[2]].start, 'trailing')
    const end = line.length
    const nextStart = (i: number) => toks[i]?.start ?? end
    const scope: VarScope = { name: null }

    if (opIdx.length === 1) {
      const k = opIdx[0]
      const op = (toks[k] as Extract<Tok, { kind: 'op' }>).op
      const left = side(toks, 0, k, toks[k].start, scope)
      const right = side(toks, k + 1, toks.length, nextStart(k + 1), scope)
      const variable = scope.name
      if (!variable) fail(0, 'no_variable')
      // (aL − aR)·x ⋚ bR − bL
      const { a, c } = guardRoots(toks[k].start, () => ({
        a: subReal(left.a, right.a),
        c: subReal(right.b, left.b),
      }))
      // Коефіцієнт 0: 0·x = 0 при будь-якому x → лишається числова нерівність 0 ⋚ c.
      if (isZeroReal(a)) {
        return {
          ok: true,
          variable,
          condition: { holds: holds(R0, op, c), reduced: `0 ${DISPLAY[op]} ${label(c)}`, source },
        }
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
    const L = side(toks, 0, k1, toks[k1].start, scope)
    const M = side(toks, k1 + 1, k2, toks[k2].start, scope)
    const R = side(toks, k2 + 1, toks.length, nextStart(k2 + 1), scope)
    if (L.hasVar || R.hasVar) fail(toks[k1].start, 'variable_twice')
    if (!M.hasVar || !scope.name) fail(toks[k1].start, 'no_variable')
    const variable = scope.name
    // Коефіцієнт 0 посередині: L ⋚ b ⋚ R — числова подвійна нерівність.
    if (isZeroReal(M.a)) {
      const b = M.b
      return {
        ok: true,
        variable,
        condition: {
          holds: holds(L.b, op1, b) && holds(b, op2, R.b),
          reduced: `${label(L.b)} ${DISPLAY[op1]} ${label(b)} ${DISPLAY[op2]} ${label(R.b)}`,
          source,
        },
      }
    }
    // L ⋚ a·x + b ⋚ R → (L − b)/a ⋚ x ⋚ (R − b)/a; для a < 0 межі міняються місцями.
    let { lo, hi } = guardRoots(toks[k1].start, () => ({
      lo: divReal(subReal(L.b, M.b), M.a),
      hi: divReal(subReal(R.b, M.b), M.a),
    }))
    // Нормалізуємо до «менший < x < більший».
    let loIncl = less ? op1 === '<=' : op2 === '>='
    let hiIncl = less ? op2 === '<=' : op1 === '>='
    if (greater) [lo, hi] = [hi, lo]
    if (sign(M.a) < 0) {
      ;[lo, hi] = [hi, lo]
      ;[loIncl, hiIncl] = [hiIncl, loIncl]
    }
    return {
      ok: true,
      variable,
      condition: { from: label(lo), fromIncluded: loIncl, to: label(hi), toIncluded: hiIncl, source },
    }
  } catch (e) {
    if (e instanceof ExprError) {
      const variable = /[a-zA-Z]/.exec(line.replace(/sqrt/gi, ''))?.[0] ?? 'x'
      // Дріб зі змінною в знаменнику в лінійній нерівності — теж «не лінійна».
      const p = e.payload.code === 'sum_with_fraction' ? { ...e.payload, code: 'not_linear' as const } : e.payload
      return { ok: false, error: p.code === 'not_linear' ? { ...p, params: { variable, ...(p.params ?? {}) } } : p }
    }
    throw e
  }
}
