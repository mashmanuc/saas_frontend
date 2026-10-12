/**
 * Б-184 · етап 1б — корені виду a·√n (ТЗ §2.2, §4).
 * Порівняння точне: за знаком і за a²·n у раціональних числах, без жодних допусків.
 * `1 + √2` у цій формі не виражається — відмова словами.
 */
import { describe, expect, it } from 'vitest'
import { evaluate, parseLine, parseLines, parseNumber } from '..'
import { compareReal, real, realLabel } from '../real'
import { rational } from '../rational'
import type { NumberLineData } from '../types'

const num = (s: string) => {
  const r = parseNumber(s)
  if ('error' in r) throw new Error(`${s}: ${r.error.code}`)
  return r.value
}
const cmp = (a: string, b: string) => compareReal(num(a), num(b))

const data = (lines: string[], combine: 'and' | 'or' = 'and'): NumberLineData => {
  const p = parseLines(lines)
  if ('errors' in p) throw new Error(JSON.stringify(p.errors))
  return { version: 1, mode: 'set', variable: p.variable, conditions: p.conditions, combine, showAnswer: true, showHatching: true }
}
const answer = (lines: string[], combine: 'and' | 'or' = 'and') => {
  const ev = evaluate(data(lines, combine))
  if (!('answer' in ev)) throw new Error('eval')
  return ev.answer.text
}

describe('запис кореня', () => {
  it.each([
    ['√3', '√3'], ['2√5', '2√5'], ['-√3', '-√3'], ['√12', '2√3'], ['√(12)', '2√3'], ['sqrt(5)', '√5'],
    ['2sqrt(5)', '2√5'], ['√3/2', '√3/2'], ['-3√2/4', '-3√2/4'], ['√4', '2'], ['√0', '0'], ['1/2√8', '√2'],
    ['2·√3', '2√3'], ['0,5√2', '√2/2'],
  ])('%s → %s', (raw, canon) => {
    expect(realLabel(num(raw))).toBe(canon)
  })

  it('не корінь виду a·√n — словами', () => {
    for (const s of ['√-3', '√x', '1+√2']) {
      const r = parseNumber(s)
      expect('error' in r && r.error.code).toBe('root_form')
    }
    const big = parseNumber('√1234567890')
    expect('error' in big && big.error.code).toBe('bad_number')
  })
})

describe('точне порівняння (ТЗ §4)', () => {
  it('√2 між 1,41 і 1,42 — і не дорівнює жодному', () => {
    expect(cmp('√2', '1,41')).toBe(1)
    expect(cmp('√2', '1,42')).toBe(-1)
    expect(cmp('√2', '1,4142135623')).toBe(1)
    expect(cmp('√2', '1,4142135624')).toBe(-1)
  })

  it('√12 = 2√3 — одна точка', () => {
    expect(cmp('√12', '2√3')).toBe(0)
    expect(answer(['x > √12', 'x ≥ 2√3'])).toBe('x ∈ (√12; +∞)')
  })

  it('−√3 проти −1,7: −√3 лівіше', () => {
    expect(cmp('-√3', '-1,7')).toBe(-1)
    expect(cmp('-√3', '-1,8')).toBe(1)
  })

  it('різні корені й знаки', () => {
    expect(cmp('√3', '√2')).toBe(1)
    expect(cmp('2√2', '√8')).toBe(0)
    expect(cmp('√5', '2')).toBe(1)
    expect(cmp('-√5', '-2')).toBe(-1)
    expect(cmp('-√2', '√2')).toBe(-1)
    expect(cmp('0', '-√2')).toBe(1)
    expect(compareReal(real(rational(3n, 2n), 1n), real(rational(1n), 2n))).toBe(1) // 1,5 > √2
  })
})

describe('корені в нерівностях', () => {
  it('прості, подвійні, системи', () => {
    expect(answer(['x > √3'])).toBe('x ∈ (√3; +∞)')
    expect(answer(['-√2 < x ≤ √2'])).toBe('x ∈ (−√2; √2]')
    expect(answer(['x ≥ -√3', 'x < -1,7'])).toBe('x ∈ [−√3; −1,7)')
    expect(answer(['x ≥ -√3', 'x < -1,8'])).toBe('∅')
    expect(answer(['x ≤ √2', 'x ≥ √2'])).toBe('x = √2')
  })

  it('лінійні з коренями: 2x > √3 → x > √3/2; √2·x ≤ 2 → x ≤ √2', () => {
    const a = parseLine('2x > √3')
    expect('condition' in a && a.condition).toMatchObject({ op: '>', value: '√3/2' })
    const b = parseLine('√2x ≤ 2')
    expect('condition' in b && b.condition).toMatchObject({ op: '<=', value: '√2' })
    const c = parseLine('-√3 x < 3')
    expect('condition' in c && c.condition).toMatchObject({ op: '>', value: '-√3' })
  })

  it('1 + √2 — відмова словами (сума різних коренів)', () => {
    for (const line of ['x > 1 + √2', 'x - 1 > √2', 'x + √2 > √3']) {
      const r = parseLine(line)
      expect('error' in r && r.error.code).toBe('root_sum')
    }
  })

  it('однакові корені додаються: x + √2 > 3√2 → x > 2√2', () => {
    const r = parseLine('x + √2 > 3√2')
    expect('condition' in r && r.condition).toMatchObject({ op: '>', value: '2√2' })
  })
})
