/**
 * Б-184 · лінійні нерівності: учитель пише `2x + 3 > 7`, рушій розвʼязує точно.
 * Знак перевертається при діленні на відʼємне; запис учителя — у `source`.
 */
import { describe, expect, it } from 'vitest'
import { conditionToText, evaluate, parseLine, parseLines } from '..'

const cond = (line: string) => {
  const r = parseLine(line)
  if ('error' in r) throw new Error(`${line}: ${r.error.code}`)
  return r.condition
}
const err = (line: string) => {
  const r = parseLine(line)
  if (!('error' in r)) throw new Error(`${line}: очікував помилку`)
  return r.error
}

describe('розвʼязок', () => {
  it.each([
    ['2x + 3 > 7', '>', '2'],
    ['3(x − 1) ≤ x + 5', '<=', '4'],
    ['x/2 − 1 ≥ 0', '>=', '2'],
    ['2x = 3x - 1', '=', '1'],
    ['3x ≠ 1', '!=', '1/3'],
    ['5 - x < 2', '>', '3'],
    ['−2x + 4 < 0', '>', '2'],
    ['-(x - 4) >= 0', '<=', '4'],
    ['(x + 1)·2 > x', '>', '-2'],
    ['2 * x : 4 < 1', '<', '2'],
    ['7 < 2x + 3', '>', '2'],
  ])('%s → x %s %s', (line, op, value) => {
    expect(cond(line)).toEqual({ op, value, source: line })
  })

  it('ділення на відʼємне перевертає знак, нестрогий лишається нестрогим', () => {
    expect(cond('-3x ≥ 6')).toMatchObject({ op: '<=', value: '-2' })
    expect(cond('-3x > 6')).toMatchObject({ op: '<', value: '-2' })
  })

  it('точний дріб, без округлення', () => {
    expect(cond('3x < 1')).toMatchObject({ value: '1/3' })
    expect(cond('6x > -4')).toMatchObject({ value: '-2/3' })
  })

  it('учитель писав десяткові — відповідь десятковим, якщо вона скінченна', () => {
    expect(cond('x + 0,5 ≥ 1')).toMatchObject({ value: '0,5' })
    expect(cond('0.2x < 1')).toMatchObject({ value: '5' })
    expect(cond('0,3x < 1')).toMatchObject({ value: '10/3' })
    expect(cond('x - 1,25 < 0')).toMatchObject({ value: '1,25' })
    expect(cond('-x > 0,5')).toMatchObject({ op: '<', value: '-0,5' })
  })

  it('подвійна: -1 < 2x + 1 ≤ 5 → -1 < x ≤ 2', () => {
    expect(cond('-1 < 2x + 1 ≤ 5')).toEqual({ from: '-1', fromIncluded: false, to: '2', toIncluded: true, source: '-1 < 2x + 1 ≤ 5' })
  })

  it('подвійна з відʼємним коефіцієнтом — межі й строгість міняються місцями', () => {
    expect(cond('-1 < -2x + 1 ≤ 5')).toMatchObject({ from: '-2', fromIncluded: true, to: '1', toIncluded: false })
    expect(cond('5 > -2x + 1 ≥ -3')).toMatchObject({ from: '-2', fromIncluded: false, to: '2', toIncluded: true })
  })

  it('простий запис не чіпається (без source)', () => {
    expect(cond('x > 3')).toEqual({ op: '>', value: '3' })
    expect(cond('-3 < x ≤ 5')).toEqual({ from: '-3', fromIncluded: false, to: '5', toIncluded: true })
  })
})

describe('відмови словами', () => {
  it('нелінійне — до методу інтервалів', () => {
    expect(err('x·x > 1').code).toBe('not_linear')
    expect(err('x(x + 1) > 0').code).toBe('not_linear')
    expect(err('1/x > 2').code).toBe('not_linear')
    expect(err('x·x > 1').params).toMatchObject({ variable: 'x' })
  })

  it('змінна скоротилась', () => {
    expect(err('2x > 2x - 1')).toMatchObject({ code: 'always_true', params: { text: '0 > -1' } })
    expect(err('2x > 2x + 1')).toMatchObject({ code: 'never_true', params: { text: '0 > 1' } })
  })

  it('дужки, ділення на нуль, корені', () => {
    expect(err('2(x + 1 > 3').code).toBe('unbalanced_paren')
    expect(err('x/0 > 1').code).toBe('division_by_zero')
    expect(err('2x > √3').code).toBe('roots_not_supported')
  })

  it('зламаний простий запис лишає свою помилку', () => {
    expect(err('x <').code).toBe('expect_number_after')
  })
})

describe('через увесь рушій', () => {
  it('система лінійних: відповідь і текст для поля', () => {
    const p = parseLines(['2x + 3 > 7', '3(x − 1) ≤ x + 5'])
    if (!p.ok) throw new Error('parse')
    const ev = evaluate({ version: 1, mode: 'set', variable: p.variable, conditions: p.conditions, combine: 'and', showAnswer: true, showHatching: true })
    if (!('answer' in ev)) throw new Error('eval')
    expect(ev.answer.text).toBe('x ∈ (2; 4]')
    expect(p.conditions.map((c) => conditionToText(c, 'x'))).toEqual(['2x + 3 > 7', '3(x − 1) ≤ x + 5'])
  })
})
