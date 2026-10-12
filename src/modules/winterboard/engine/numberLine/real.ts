/**
 * Точні числа виду `a·√n` (ТЗ §2.2, етап 1б): `a` — раціональне, `n` — натуральне
 * без квадратів (`√12` → `2√3`). Раціональне число — це `n = 1`.
 *
 * Порівняння точне — за знаком і за `a²·n` у раціональних числах; жодних допусків
 * (`√2` і `1,41` — різні точки). Сума різних коренів (`1 + √2`) у цій формі не
 * виражається — `add` кидає `RootSumError`, викликач відмовляє словами.
 */
import { add, compare, div, isZero, mul, neg, rational, toLabel, type Rational } from './rational'

export interface Real {
  /** Коефіцієнт `a`. */
  readonly q: Rational
  /** Підкореневе без квадратів; 1 — раціональне число. Для нуля — 1. */
  readonly n: bigint
}

export class RootSumError extends Error {
  constructor() {
    super('root_sum')
  }
}

const ONE_Q = rational(1n)

/** n = s²·m, m без квадратів → [s, m]. */
function extractSquares(n: bigint): [bigint, bigint] {
  let s = 1n
  let m = n
  for (let p = 2n; p * p <= m; p += p === 2n ? 1n : 2n) {
    while (m % (p * p) === 0n) {
      m /= p * p
      s *= p
    }
  }
  return [s, m]
}

/** `q·√n` у канонічній формі. */
export function real(q: Rational, n: bigint = 1n): Real {
  if (n < 0n) throw new RangeError('negative radicand')
  if (isZero(q) || n === 0n) return { q: rational(0n), n: 1n }
  const [s, m] = extractSquares(n)
  return { q: mul(q, rational(s)), n: m }
}

export function fromRational(q: Rational): Real {
  return real(q, 1n)
}

export function isRational(x: Real): boolean {
  return x.n === 1n
}

export function sign(x: Real): -1 | 0 | 1 {
  return x.q.n === 0n ? 0 : x.q.n > 0n ? 1 : -1
}

export function isZeroReal(x: Real): boolean {
  return x.q.n === 0n
}

/** Точне порівняння: спершу знак, далі `a²·n` (для відʼємних — навпаки). */
export function compareReal(x: Real, y: Real): -1 | 0 | 1 {
  const sx = sign(x)
  const sy = sign(y)
  if (sx !== sy) return sx < sy ? -1 : 1
  if (sx === 0) return 0
  const ax = mul(mul(x.q, x.q), rational(x.n))
  const ay = mul(mul(y.q, y.q), rational(y.n))
  const c = compare(ax, ay)
  return (sx > 0 ? c : -c) as -1 | 0 | 1
}

export function negReal(x: Real): Real {
  return { q: neg(x.q), n: x.n }
}

/** Сума лише однакових коренів (або з нулем); інакше — `RootSumError`. */
export function addReal(x: Real, y: Real): Real {
  if (isZeroReal(x)) return y
  if (isZeroReal(y)) return x
  if (x.n !== y.n) throw new RootSumError()
  return real(add(x.q, y.q), x.n)
}

export function subReal(x: Real, y: Real): Real {
  return addReal(x, negReal(y))
}

export function mulReal(x: Real, y: Real): Real {
  return real(mul(x.q, y.q), x.n * y.n)
}

/** y ≠ 0 — перевіряє викликач. x / (a√n) = x·√n / (a·n). */
export function divReal(x: Real, y: Real): Real {
  return mulReal(x, real(div(ONE_Q, mul(y.q, rational(y.n))), y.n))
}

/** √q для раціонального q ≥ 0: √(p/d) = √(p·d)/d. null — якщо q < 0. */
export function sqrtRational(q: Rational): Real | null {
  if (q.n < 0n) return null
  return real(rational(1n, q.d), q.n * q.d)
}

/** Корінь цілого степеня 2 з `Real` (лише раціонального). */
export function sqrtReal(x: Real): Real | null {
  return isRational(x) ? sqrtRational(x.q) : null
}

/**
 * Канонічний запис для контракту й підпису: `3`, `-1/3`, `√3`, `-2√5`, `√3/2`, `-3√2/4`.
 * Такий запис читає `parseNumber`.
 */
export function realLabel(x: Real): string {
  if (x.n === 1n) return toLabel(x.q)
  const negative = x.q.n < 0n
  const num = negative ? -x.q.n : x.q.n
  const coef = num === 1n ? '' : `${num}`
  const den = x.q.d === 1n ? '' : `/${x.q.d}`
  return `${negative ? '-' : ''}${coef}√${x.n}${den}`
}

