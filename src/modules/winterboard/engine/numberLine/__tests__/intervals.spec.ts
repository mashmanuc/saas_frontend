/**
 * Б-184 · етап 2 — метод інтервалів (ТЗ §1.5, §2.2, §4).
 * Нулі множників із кратністю; нулі знаменника — завжди виколоті; парна кратність —
 * знак не змінюється; відповідь — обʼєднанням. Вручну — дошка лише малює.
 */
import { describe, expect, it } from 'vitest'
import { evaluate, parseIntervalsLine } from '..'
import type { IntervalsOp, IntervalsPoint, NumberLineData } from '../types'

const base: NumberLineData = {
  version: 1, mode: 'intervals', variable: 'x', conditions: [], combine: 'and', showAnswer: true, showHatching: true,
}

function solve(line: string) {
  const p = parseIntervalsLine(line)
  if (!p.ok) throw new Error(`${line}: ${'error' in p ? p.error.code : ''}`)
  const ev = evaluate({ ...base, expression: p.expression, rhs: p.rhs, op: p.op, variable: p.variable })
  if (!('layout' in ev)) throw new Error(`${line}: eval ${JSON.stringify(ev)}`)
  return ev
}
const answer = (line: string) => solve(line).answer.text
const signs = (line: string) => solve(line).layout.signs?.map((s) => s.sign).join('')
const points = (line: string) => solve(line).layout.points.map((p) => `${p.label}${p.filled ? '●' : '○'}`).join(' ')
const err = (line: string) => {
  const p = parseIntervalsLine(line)
  if (p.ok) throw new Error(`${line}: очікував помилку`)
  return 'error' in p ? p.error.code : ''
}

describe('приклад із ТЗ', () => {
  it('(x-1)(x+3)/(x-2) ≥ 0 → x ∈ [−3; 1] ∪ (2; +∞)', () => {
    const line = '(x-1)(x+3)/(x-2) ≥ 0'
    expect(answer(line)).toBe('x ∈ [−3; 1] ∪ (2; +∞)')
    expect(signs(line)).toBe('-+-+')
    // Нуль знаменника — виколотий навіть у нестрогій.
    expect(points(line)).toBe('−3● 1● 2○')
  })
})

describe('знаки й кратність', () => {
  it.each([
    ['(x-1)(x+2) > 0', 'x ∈ (−∞; −2) ∪ (1; +∞)', '+-+'],
    ['(x-1)(x+2) < 0', 'x ∈ (−2; 1)', '+-+'],
    ['(x-1)(x+2) ≤ 0', 'x ∈ [−2; 1]', '+-+'],
    ['(x-3)/(x+1) < 0', 'x ∈ (−1; 3)', '+-+'],
    ['(x-3)/(x+1) ≥ 0', 'x ∈ (−∞; −1) ∪ [3; +∞)', '+-+'],
    ['x(x-4) ≤ 0', 'x ∈ [0; 4]', '+-+'],
    ['-(x-1)(x+2) > 0', 'x ∈ (−2; 1)', '-+-'],
    ['(3 - x)(x + 1) ≥ 0', 'x ∈ [−1; 3]', '-+-'],
    ['(2x - 1)(x + 3) < 0', 'x ∈ (−3; 1/2)', '+-+'],
  ])('%s → %s', (line, ans, sg) => {
    expect(answer(line)).toBe(ans)
    expect(signs(line)).toBe(sg)
  })

  it('парна кратність — знак не змінюється', () => {
    expect(signs('(x-1)^2(x+2) > 0')).toBe('-++')
    expect(answer('(x-1)^2(x+2) > 0')).toBe('x ∈ (−2; 1) ∪ (1; +∞)')
    expect(answer('(x-1)²(x+2) ≥ 0')).toBe('x ∈ [−2; +∞)')
    expect(answer('(x-1)^2(x+2) ≤ 0')).toBe('x ∈ (−∞; −2] ∪ {1}')
    expect(answer('(x-1)^2 < 0')).toBe('∅')
    expect(answer('(x-1)^2 ≤ 0')).toBe('x = 1')
    expect(answer('(x-1)^2 > 0')).toBe('x ∈ (−∞; 1) ∪ (1; +∞)')
  })

  it('однаковий множник у кількох місцях — кратності складаються', () => {
    expect(signs('(x-1)(x+2)(x-1) > 0')).toBe('-++')
    expect(signs('x·x·x > 0')).toBe('-+')
  })

  it('спільний нуль чисельника й знаменника — виколотий', () => {
    expect(points('(x-1)(x+2)/(x-1) ≥ 0')).toBe('−2● 1○')
    expect(answer('(x-1)(x+2)/(x-1) ≥ 0')).toBe('x ∈ [−2; 1) ∪ (1; +∞)')
  })

  it('знаменник парного степеня', () => {
    expect(answer('(x+3)/(x-2)^2 ≥ 0')).toBe('x ∈ [−3; 2) ∪ (2; +∞)')
  })
})

describe('квадратні й вищі множники', () => {
  it('x² > 4 і x² - 5x + 6 ≤ 0 (права частина ненульова — переносимо)', () => {
    expect(answer('x² > 4')).toBe('x ∈ (−∞; −2) ∪ (2; +∞)')
    expect(answer('x^2 - 5x + 6 ≤ 0')).toBe('x ∈ [2; 3]')
    expect(answer('x^2 ≥ x')).toBe('x ∈ (−∞; 0] ∪ [1; +∞)')
  })

  it('D < 0 — знак сталий; D = 0 — подвійний нуль', () => {
    expect(answer('(x^2 + 1)(x - 3) < 0')).toBe('x ∈ (−∞; 3)')
    expect(answer('x^2 + x + 1 > 0')).toBe('x ∈ (−∞; +∞)')
    expect(answer('-(x^2 + 1) > 0')).toBe('∅')
    expect(answer('x^2 - 6x + 9 > 0')).toBe('x ∈ (−∞; 3) ∪ (3; +∞)')
  })

  it('корені у формі a·√n: x² < 3 → (−√3; √3)', () => {
    expect(answer('x^2 < 3')).toBe('x ∈ (−√3; √3)')
    expect(answer('(x^2 - 2)(x - 1) ≥ 0')).toBe('x ∈ [−√2; 1] ∪ [√2; +∞)')
    expect(answer('(x - √3)(x + 1) < 0')).toBe('x ∈ (−1; √3)')
  })

  it('кубічні — через раціональні корені', () => {
    expect(answer('x^3 - x > 0')).toBe('x ∈ (−1; 0) ∪ (1; +∞)')
    expect(answer('x^3 - 6x^2 + 11x - 6 ≤ 0')).toBe('x ∈ (−∞; 1] ∪ [2; 3]')
    expect(answer('2x^3 - x^2 - 2x + 1 < 0')).toBe('x ∈ (−∞; −1) ∪ (1/2; 1)')
  })

  it('тотожний нуль: x - x ≥ 0 → усі числа; x - x > 0 → ∅', () => {
    expect(answer('x - x ≥ 0')).toBe('x ∈ (−∞; +∞)')
    expect(answer('x - x > 0')).toBe('∅')
  })
})

describe('відмови словами', () => {
  it.each([
    ['x^2 - 2x - 1 > 0', 'root_sum'],
    ['x^3 - 2 > 0', 'cannot_factor'],
    ['1/(x-1) > 1', 'rhs_not_zero'],
    ['(x-1)(x+2) = 0', 'not_inequality'],
    ['(x-1)(x+2) ≠ 0', 'not_inequality'],
    ['(x-1)(x+2)', 'not_inequality'],
    ['(x-1 > 0', 'unbalanced_paren'],
    ['x^20 > 0', 'bad_power'],
    ['5 > 0', 'no_variable'],
    ['x/(x-x) > 0', 'division_by_zero'],
    ['1 < x < 2', 'trailing'],
  ])('%s → %s', (line, code) => {
    expect(err(line)).toBe(code)
  })
})

describe('вручну: учитель ставить точки й знаки', () => {
  const manual = (points: IntervalsPoint[], sg: Array<'+' | '-'>, op: IntervalsOp) =>
    evaluate({ ...base, points, signs: sg, op })

  it('дошка малює за знаками вчителя, точки — як поставив', () => {
    const ev = manual([{ value: '-3', included: true }, { value: '1', included: true }, { value: '2', included: false }], ['-', '+', '-', '+'], '>=')
    if (!('layout' in ev)) throw new Error('eval')
    expect(ev.answer.text).toBe('x ∈ [−3; 1] ∪ (2; +∞)')
    expect(ev.layout.points.map((p) => p.filled)).toEqual([true, true, false])
    expect(ev.layout.signs?.map((s) => s.sign)).toEqual(['-', '+', '-', '+'])
  })

  it('точки в будь-якому порядку — стають за значенням', () => {
    const ev = manual([{ value: '2', included: false }, { value: '-1/2', included: false }], ['+', '-', '+'], '<')
    if (!('answer' in ev)) throw new Error('eval')
    expect(ev.answer.text).toBe('x ∈ (−1/2; 2)')
  })

  it('помилки: число, повтор, кількість знаків, без точок', () => {
    const e = (pts: IntervalsPoint[], sg: Array<'+' | '-'>) => {
      const ev = manual(pts, sg, '>')
      return 'errors' in ev ? ev.errors.map((x) => `${x.line}:${x.code}`).join(',') : 'ok'
    }
    expect(e([{ value: 'abc', included: false }], ['+', '-'])).toBe('0:bad_number')
    expect(e([{ value: '1', included: false }, { value: '1,0', included: false }], ['+', '-', '+'])).toBe('1:duplicate_point')
    expect(e([{ value: '1', included: false }], ['+'])).toBe('0:signs_count')
    expect(e([], ['+'])).toBe('0:no_points')
  })
})
