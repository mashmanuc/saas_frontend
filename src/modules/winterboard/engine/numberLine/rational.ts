/**
 * Точні раціональні числа для числової прямої (Б-184, ТЗ §2.2).
 *
 * ⚠️ Без чисел із плаваючою комою: дві точки рівні, лише якщо рівні ТОЧНО
 * (`0,5` і `1/2` — одна точка, `1/3` і `0,3333333333` — дві). Допуск злив би
 * дві різні точки й змінив би відповідь (інваріант 3а).
 */

export interface Rational {
  /** Чисельник зі знаком. */
  readonly n: bigint
  /** Знаменник, завжди > 0; дріб нескоротний. */
  readonly d: bigint
}

function abs(v: bigint): bigint {
  return v < 0n ? -v : v
}

function gcd(a: bigint, b: bigint): bigint {
  a = abs(a)
  b = abs(b)
  while (b !== 0n) {
    const t = a % b
    a = b
    b = t
  }
  return a
}

export function rational(n: bigint, d: bigint = 1n): Rational {
  if (d === 0n) throw new RangeError('denominator is zero')
  if (d < 0n) {
    n = -n
    d = -d
  }
  const g = gcd(n, d) || 1n
  return { n: n / g, d: d / g }
}

/** −1, 0, 1 — як a порівнюється з b. */
export function compare(a: Rational, b: Rational): -1 | 0 | 1 {
  const l = a.n * b.d
  const r = b.n * a.d
  return l < r ? -1 : l > r ? 1 : 0
}

export function equals(a: Rational, b: Rational): boolean {
  return compare(a, b) === 0
}
