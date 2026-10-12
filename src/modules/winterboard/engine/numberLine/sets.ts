/**
 * Множини на прямій (ТЗ §2.2 `sets`): обʼєднання проміжків із відкритими /
 * закритими кінцями й ±∞. Точка — вироджений закритий проміжок [a; a].
 * Порівняння — лише точне (rational.compare).
 */
import { compare, type Rational } from './rational'

export interface Point {
  value: Rational
  label: string
}

/** `null` — нескінченність з відповідного боку. */
export interface Interval {
  lo: Point | null
  loClosed: boolean
  hi: Point | null
  hiClosed: boolean
}

/** Нормалізована множина: проміжки відсортовані, не перетинаються й не дотикаються. */
export type NumberSet = Interval[]

export const ALL: NumberSet = [{ lo: null, loClosed: false, hi: null, hiClosed: false }]
export const EMPTY: NumberSet = []

function cmpLo(a: Interval, b: Interval): number {
  if (a.lo === null) return b.lo === null ? 0 : -1
  if (b.lo === null) return 1
  const c = compare(a.lo.value, b.lo.value)
  if (c !== 0) return c
  return a.loClosed === b.loClosed ? 0 : a.loClosed ? -1 : 1
}

function isEmptyInterval(iv: Interval): boolean {
  if (iv.lo === null || iv.hi === null) return false
  const c = compare(iv.lo.value, iv.hi.value)
  return c > 0 || (c === 0 && !(iv.loClosed && iv.hiClosed))
}

/** Чи покриває `a` (що починається не пізніше) початок `b` або дотикається до нього без дірки. */
function touches(a: Interval, b: Interval): boolean {
  if (a.hi === null || b.lo === null) return true
  const c = compare(a.hi.value, b.lo.value)
  if (c > 0) return true
  if (c < 0) return false
  return a.hiClosed || b.loClosed
}

function maxHi(a: Interval, b: Interval): Pick<Interval, 'hi' | 'hiClosed'> {
  if (a.hi === null || b.hi === null) return { hi: null, hiClosed: false }
  const c = compare(a.hi.value, b.hi.value)
  if (c > 0) return { hi: a.hi, hiClosed: a.hiClosed }
  if (c < 0) return { hi: b.hi, hiClosed: b.hiClosed }
  return { hi: a.hi, hiClosed: a.hiClosed || b.hiClosed }
}

export function normalize(intervals: Interval[]): NumberSet {
  const list = intervals.filter((iv) => !isEmptyInterval(iv)).sort(cmpLo)
  const out: Interval[] = []
  for (const iv of list) {
    const last = out[out.length - 1]
    if (last && touches(last, iv)) {
      out[out.length - 1] = { lo: last.lo, loClosed: last.loClosed, ...maxHi(last, iv) }
    } else {
      out.push({ ...iv })
    }
  }
  return out
}

export function union(a: NumberSet, b: NumberSet): NumberSet {
  return normalize([...a, ...b])
}

function intersectIntervals(a: Interval, b: Interval): Interval {
  // Більший нижній кінець.
  let lo = a.lo
  let loClosed = a.loClosed
  if (a.lo === null || (b.lo !== null && compare(b.lo.value, a.lo.value) > 0)) {
    lo = b.lo
    loClosed = b.loClosed
  } else if (b.lo !== null && compare(b.lo.value, a.lo.value) === 0) {
    loClosed = a.loClosed && b.loClosed
  }
  // Менший верхній кінець.
  let hi = a.hi
  let hiClosed = a.hiClosed
  if (a.hi === null || (b.hi !== null && compare(b.hi.value, a.hi.value) < 0)) {
    hi = b.hi
    hiClosed = b.hiClosed
  } else if (b.hi !== null && compare(b.hi.value, a.hi.value) === 0) {
    hiClosed = a.hiClosed && b.hiClosed
  }
  return { lo, loClosed, hi, hiClosed }
}

export function intersect(a: NumberSet, b: NumberSet): NumberSet {
  const out: Interval[] = []
  for (const x of a) for (const y of b) out.push(intersectIntervals(x, y))
  return normalize(out)
}

export function contains(set: NumberSet, v: Rational): boolean {
  return set.some((iv) => {
    if (iv.lo !== null) {
      const c = compare(v, iv.lo.value)
      if (c < 0 || (c === 0 && !iv.loClosed)) return false
    }
    if (iv.hi !== null) {
      const c = compare(v, iv.hi.value)
      if (c > 0 || (c === 0 && !iv.hiClosed)) return false
    }
    return true
  })
}
