/**
 * Рев'ю Феї 2026-10-13 (PR saas_frontend#3): блокер 1 і пункти 3–7.
 * Кожен тест — зламаний до правки випадок із рев'ю.
 */
import { describe, expect, it } from 'vitest'
import { evaluate, parseIntervalsLine, parseLine } from '..'
import type { NumberLineData } from '../types'

const base: NumberLineData = {
  version: 1, mode: 'intervals', variable: 'x', conditions: [], combine: 'and', showAnswer: true, showHatching: true,
}
const ivAnswer = (line: string) => {
  const p = parseIntervalsLine(line)
  if (!p.ok) throw new Error(`${line}: ${'error' in p ? p.error.code : ''}`)
  const ev = evaluate({ ...base, expression: p.expression, rhs: p.rhs, op: p.op })
  if (!('answer' in ev)) throw new Error('eval')
  return ev.answer.text
}
const ivErr = (line: string) => {
  const p = parseIntervalsLine(line)
  return p.ok ? 'ok' : 'error' in p ? p.error.code : ''
}

describe('блокер 1: знаменник без дужок — не вгадуємо мовчки', () => {
  it('(x-1)/(x-2)(x+3) — просимо дужки', () => {
    expect(ivErr('(x-1)/(x-2)(x+3) ≥ 0')).toBe('ambiguous_denominator')
    expect(ivErr('(x-1)/x(x+3) > 0')).toBe('ambiguous_denominator')
    expect(ivErr('(x-1)/(x-2)^2(x+3) > 0')).toBe('ambiguous_denominator')
  })

  it('знаменник у дужках — рахуємо', () => {
    expect(ivAnswer('(x-1)/((x-2)(x+3)) ≥ 0')).toBe('x ∈ (−3; 1] ∪ (2; +∞)')
  })

  it('ділення на число і явне множення — як і раніше', () => {
    expect(ivAnswer('1/2(x+1) > 0')).toBe('x ∈ (−1; +∞)')
    const lin = parseLine('2/3x > 2')
    expect('condition' in lin && lin.condition).toMatchObject({ op: '>', value: '3' })
    expect(ivAnswer('(x-1)/(x-2)·(x+3) ≥ 0')).toBe('x ∈ [−3; 1] ∪ (2; +∞)')
  })
})

describe('п. 3: великі числа не вішають вкладку', () => {
  it('x² < 10²⁰ і 10¹⁸ — миттєво й точно', () => {
    const t0 = Date.now()
    expect(ivAnswer('x^2 < 100000000000000000000')).toBe('x ∈ (−10000000000; 10000000000)')
    expect(ivAnswer('x^2 < 1000000000000000000')).toBe('x ∈ (−1000000000; 1000000000)')
    // √(2·10³⁹) = 2·10¹⁹·√5 — канонічна форма a·√n.
    expect(ivAnswer('x^2 < 2000000000000000000000000000000000000000')).toBe(
      'x ∈ (−20000000000000000000√5; 20000000000000000000√5)')
    expect(Date.now() - t0).toBeLessThan(1500)
  })

  it('залишок — повний квадрат великого простого: 3·10000019² → 10000019√3', () => {
    // 10000019 > 10⁵ — пробне ділення його не бачить; ловить лише перевірка «залишок — квадрат».
    expect(ivAnswer('x^2 < 300001140001083')).toBe('x ∈ (−10000019√3; 10000019√3)')
  })

  it('велике просте під коренем — відмова словами, а не хвилина розкладу', () => {
    const t0 = Date.now()
    expect(ivErr('x^2 < 2305843009213693951')).toBe('too_large') // 2⁶¹ − 1, просте
    expect(Date.now() - t0).toBeLessThan(1500)
  })
})

describe('п. 4: зламані дані не валять рушій', () => {
  it('метод інтервалів: невідомий знак, points / signs не масиви', () => {
    const bad = (extra: Partial<NumberLineData>) => {
      const ev = evaluate({ ...base, ...extra } as NumberLineData)
      return 'errors' in ev ? ev.errors[0].code : 'ok'
    }
    expect(bad({ expression: '(x-1)', op: '=' as never })).toBe('not_inequality')
    expect(bad({ points: 'abc' as never, signs: ['+'], op: '>' })).toBe('no_points')
    expect(bad({ points: [{ value: '1', included: true }], signs: 'x' as never, op: '>' })).toBe('signs_count')
    expect(bad({ points: [{ value: undefined as never, included: true }], signs: ['+', '-'], op: '>' })).toBe('bad_number')
    expect(bad({ points: [{ value: '1', included: true }], signs: ['+', 'x' as never], op: '>' })).toBe('bad_data')
  })

  it('нерівності: невідомий знак, умови не масив, умова не обʼєкт', () => {
    const set = (extra: Partial<NumberLineData>) => {
      const ev = evaluate({ ...base, mode: 'set', ...extra } as NumberLineData)
      return 'errors' in ev ? ev.errors[0].code : ev.answer.text
    }
    expect(set({ conditions: [{ op: '=>' as never, value: '1' }] })).toBe('expect_op')
    expect(set({ conditions: undefined as never })).toBe('bad_data')
    expect(set({ conditions: [null as never] })).toBe('bad_number')
    expect(set({ conditions: [{ op: '>', value: undefined as never }] })).toBe('bad_number')
  })
})

describe('п. 5: кирилична «х» — це x', () => {
  it('у нерівностях і в методі інтервалів', () => {
    const lin = parseLine('2х + 3 > 7')
    expect('condition' in lin && lin.condition).toMatchObject({ op: '>', value: '2' })
    expect(ivAnswer('(х-1)(Х+2) > 0')).toBe('x ∈ (−∞; −2) ∪ (1; +∞)')
  })
})

describe('п. 6: порожня права частина — словами, а не мовчазний 0', () => {
  it('(x-1)(x+3) ≥', () => {
    expect(ivErr('(x-1)(x+3) ≥')).toBe('expect_number_after')
    expect(ivErr('(x-1)(x+3) ≥ 0')).toBe('ok')
  })
})

describe('п. 7: довгий і глибокий ввід — словами, без RangeError', () => {
  it('3000 дужок, задовгий рядок, глибокі дужки', () => {
    expect(ivErr(`${'('.repeat(3000)}x${')'.repeat(3000)} > 0`)).toBe('too_long')
    const deep = parseLine(`${'('.repeat(150)}x${')'.repeat(150)} > 0`)
    expect('error' in deep && deep.error.code).toBe('too_long')
    expect(ivErr(`${'('.repeat(25)}x${')'.repeat(25)} > 0`)).toBe('too_deep')
    expect(ivErr(`${'('.repeat(10)}x${')'.repeat(10)} > 0`)).toBe('ok')
  })
})

describe('повторне рев’ю: «−0»', () => {
  it('нуль, записаний як −0, — це 0', () => {
    const r = parseLine('x > -0')
    expect('condition' in r && r.condition).toMatchObject({ op: '>', value: '0' })
  })
})
