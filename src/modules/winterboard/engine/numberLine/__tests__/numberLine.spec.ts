/**
 * Рушій числової прямої (Б-184, ТЗ §4): таблиця випадків + інваріанти.
 * Кожен випадок — від рядків учителя до відповіді, як на дошці.
 */
import { describe, expect, it } from 'vitest'
import {
  conditionToText,
  defaultNumberLineData,
  evaluate,
  parseLine,
  parseLines,
  type NumberLineData,
} from '../index'

function run(lines: string[], combine: 'and' | 'or' = 'and') {
  const p = parseLines(lines)
  if ('errors' in p) throw new Error(`parse failed: ${JSON.stringify(p.errors)}`)
  const data: NumberLineData = { ...defaultNumberLineData(), conditions: p.conditions, variable: p.variable, combine }
  const ev = evaluate(data)
  if ('errors' in ev) throw new Error(`evaluate failed: ${JSON.stringify(ev.errors)}`)
  return ev
}

const answer = (lines: string[], combine: 'and' | 'or' = 'and') => run(lines, combine).answer

describe('відповідь: таблиця випадків', () => {
  it.each<[string[], 'and' | 'or', string, string | undefined]>([
    // прості
    [['x > 3'], 'and', 'x ∈ (3; +∞)', 'open_ray'],
    [['x >= 3'], 'and', 'x ∈ [3; +∞)', 'ray'],
    [['x ≥ 3'], 'and', 'x ∈ [3; +∞)', 'ray'],
    [['x < -2'], 'and', 'x ∈ (−∞; −2)', 'open_ray'],
    [['x ≤ -2'], 'and', 'x ∈ (−∞; −2]', 'ray'],
    [['3 < x'], 'and', 'x ∈ (3; +∞)', 'open_ray'],
    [['-2 ≥ x'], 'and', 'x ∈ (−∞; −2]', 'ray'],
    [['x = 3'], 'and', 'x = 3', undefined],
    [['x ≠ 1'], 'and', 'x ∈ (−∞; 1) ∪ (1; +∞)', undefined],
    [['x != 1'], 'and', 'x ∈ (−∞; 1) ∪ (1; +∞)', undefined],
    // подвійні
    [['-3 < x ≤ 5'], 'and', 'x ∈ (−3; 5]', 'half_interval'],
    [['-3 ≤ x ≤ 5'], 'and', 'x ∈ [−3; 5]', 'segment'],
    [['-3 < x < 5'], 'and', 'x ∈ (−3; 5)', 'interval'],
    [['5 > x ≥ -3'], 'and', 'x ∈ [−3; 5)', 'half_interval'],
    [['5 < x < 3'], 'and', '∅', undefined],
    [['3 ≤ x ≤ 3'], 'and', 'x = 3', undefined],
    [['3 < x ≤ 3'], 'and', '∅', undefined],
    // системи
    [['x > 1', 'x ≤ 4'], 'and', 'x ∈ (1; 4]', 'half_interval'],
    [['x > 1', 'x > 4'], 'and', 'x ∈ (4; +∞)', 'open_ray'],
    [['x < 3', 'x ≥ 3'], 'and', '∅', undefined],
    [['x ≤ 3', 'x ≥ 3'], 'and', 'x = 3', undefined],
    [['x < 3', 'x > 5'], 'and', '∅', undefined],
    [['x > -1', 'x < 2', 'x ≠ 0'], 'and', 'x ∈ (−1; 0) ∪ (0; 2)', undefined],
    [['-3 < x ≤ 5', 'x ≥ 0'], 'and', 'x ∈ [0; 5]', 'segment'],
    // спільний кінець різної строгості — перетин бере строгішу
    [['x ≥ 3', 'x > 3'], 'and', 'x ∈ (3; +∞)', 'open_ray'],
    [['3 ≤ x ≤ 5', 'x ≥ 3'], 'and', 'x ∈ [3; 5]', 'segment'],
    [['x ≤ 5', 'x < 5'], 'and', 'x ∈ (−∞; 5)', 'open_ray'],
    [['-1 ≤ x ≤ 5', 'x ≤ 5'], 'and', 'x ∈ [−1; 5]', 'segment'],
    // сукупності
    [['x < 3', 'x ≥ 3'], 'or', 'x ∈ (−∞; +∞)', 'line'],
    [['x < 3', 'x > 3'], 'or', 'x ∈ (−∞; 3) ∪ (3; +∞)', undefined],
    [['x < 1', 'x > 4'], 'or', 'x ∈ (−∞; 1) ∪ (4; +∞)', undefined],
    [['x ≤ 1', 'x ≥ 1'], 'or', 'x ∈ (−∞; +∞)', 'line'],
    [['x < 0', 'x < 5'], 'or', 'x ∈ (−∞; 5)', 'open_ray'],
    [['x = 1', 'x = 2'], 'or', 'x ∈ {1} ∪ {2}', undefined],
    [['x < 0', 'x = 2'], 'or', 'x ∈ (−∞; 0) ∪ {2}', undefined],
    [['x ≤ 0', '0 < x < 1'], 'or', 'x ∈ (−∞; 1)', 'open_ray'],
    // дроби й десяткові
    [['x > 2,5'], 'and', 'x ∈ (2,5; +∞)', 'open_ray'],
    [['x > 2.5'], 'and', 'x ∈ (2.5; +∞)', 'open_ray'],
    [['x ≥ -1/3'], 'and', 'x ∈ [−1/3; +∞)', 'ray'],
    [['x > 0,5', 'x ≤ 1/2'], 'and', '∅', undefined],
    [['x ≥ 0,5', 'x ≤ 1/2'], 'and', 'x = 0,5', undefined],
    [['x ≥ -1/3', 'x ≤ -0,33'], 'and', 'x ∈ [−1/3; −0,33]', 'segment'],
    [['x > 1/3', 'x < 0,3333333333'], 'and', '∅', undefined],
    [['x < 1/3', 'x > 0,3333333333'], 'and', 'x ∈ (0,3333333333; 1/3)', 'interval'],
    [['x > −4'], 'and', 'x ∈ (−4; +∞)', 'open_ray'],
  ])('%j (%s) → %s', (lines, combine, text, name) => {
    const a = answer(lines, combine)
    expect(a.text).toBe(text)
    expect(a.name).toBe(name)
  })

  it('інша змінна працює: y ≤ 7', () => {
    expect(answer(['y ≤ 7']).text).toBe('y ∈ (−∞; 7]')
  })

  it('порожній набір умов — ∅', () => {
    const ev = evaluate(defaultNumberLineData())
    expect(ev.ok && ev.answer.kind).toBe('empty')
  })
})

describe('точність: жодних допусків (інваріант 3а)', () => {
  it('0,5 і 1/2 — одна точка', () => {
    expect(run(['x > 0,5', 'x < 1/2'], 'or').layout.points).toHaveLength(1)
  })
  it('1/3 і 0,3333333333 — дві різні точки', () => {
    const pts = run(['x > 1/3', 'x < 0,3333333333'], 'or').layout.points
    expect(pts.map((p) => p.label)).toEqual(['0,3333333333', '1/3'])
  })
  it('−1/3 і −0,33 — дві точки, −1/3 лівіше', () => {
    const pts = run(['x ≥ -1/3', 'x ≤ -0,33']).layout.points
    expect(pts.map((p) => p.label)).toEqual(['−1/3', '−0,33'])
  })
  it('великі числа без втрати точності', () => {
    expect(answer(['x > 12345678901234567890', 'x < 12345678901234567891']).text)
      .toBe('x ∈ (12345678901234567890; 12345678901234567891)')
    expect(answer(['x > 12345678901234567890', 'x < 12345678901234567890,0000001']).kind).toBe('set')
  })
})

describe('рисунок: строга — виколота, нестрога — зафарбована (інваріант 2)', () => {
  const filled = (lines: string[], combine: 'and' | 'or' = 'and') =>
    Object.fromEntries(run(lines, combine).layout.points.map((p) => [p.label, p.filled]))

  it('x > 3 — виколота', () => expect(filled(['x > 3'])).toEqual({ 3: false }))
  it('x ≥ 3 — зафарбована', () => expect(filled(['x ≥ 3'])).toEqual({ 3: true }))
  it('x ≠ 1 — виколота', () => expect(filled(['x ≠ 1'])).toEqual({ 1: false }))
  it('−3 < x ≤ 5', () => expect(filled(['-3 < x ≤ 5'])).toEqual({ '−3': false, 5: true }))
  it('система поза відповіддю: x ≤ 3 і x ≥ 5 — обидві зафарбовані (як у своїх умовах)', () => {
    expect(filled(['x ≤ 3', 'x ≥ 5'])).toEqual({ 3: true, 5: true })
  })
  it('система: x > 1 і x ≥ 4 — 1 виколота поза відповіддю, 4 у відповіді', () => {
    expect(filled(['x > 1', 'x ≥ 4'])).toEqual({ 1: false, 4: true })
  })
  it('система: x ≥ 1 і x > 4 — межа відповіді 4 виколота, 1 зафарбована', () => {
    expect(filled(['x ≥ 1', 'x > 4'])).toEqual({ 1: true, 4: false })
  })
  it('сукупність x < 3 або x ≥ 3 — точка 3 у відповіді', () => {
    expect(filled(['x < 3', 'x ≥ 3'], 'or')).toEqual({ 3: true })
  })
})

describe('розміщення: схематичне, у порядку значень', () => {
  it('одна точка — посередині', () => {
    expect(run(['x > 100']).layout.points[0].x).toBe(0.5)
  })
  it('точки рівномірно, не в масштабі', () => {
    const xs = run(['x > -1000', 'x < 1', 'x ≠ 2'], 'and').layout.points.map((p) => p.x)
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 10)
  })
  it('штрихування — своє для кожної умови, до краю для ∞', () => {
    const l = run(['x > 1', 'x ≤ 4']).layout
    expect(l.hatches).toHaveLength(2)
    expect(l.hatches[0].segments[0].to).toBe(1)
    expect(l.hatches[1].segments[0].from).toBe(0)
    expect(l.result).toEqual([{ from: l.points[0].x, to: l.points[1].x }])
  })
  it('x ≠ 1 — штрихування двома відрізками', () => {
    expect(run(['x ≠ 1']).layout.hatches[0].segments).toHaveLength(2)
  })
})

describe('розбір: помилки словами й з місцем (інваріант 3)', () => {
  it.each<[string, string]>([
    ['', 'empty'],
    ['x >', 'expect_number_after'],
    ['x > abc', 'unexpected_char'],
    ['x 3', 'expect_op'],
    ['3 > 4', 'no_variable'],
    ['x > y', 'variable_twice'],
    ['x > 1/0', 'division_by_zero'],
    ['x > 1 + √2', 'root_sum'],
    ['x > √x', 'root_form'],
    ['x > √-3', 'root_form'],
    ['1 < x > 5', 'mixed_direction'],
    ['1 = x < 5', 'eq_in_range'],
    ['x > 1,2,3', 'bad_number'],
    ['x > #', 'unexpected_char'],
    ['xy > 1', 'unexpected_char'],
    ['1 < x < 2 < 3', 'trailing'],
  ])('%j → %s', (line, code) => {
    const r = parseLine(line)
    expect(r.ok).toBe(false)
    if ('error' in r) expect(r.error.code).toBe(code)
  })

  it('після «>» очікую число — з позицією в кінці рядка', () => {
    const r = parseLine('x >')
    expect('error' in r && r.error).toMatchObject({ code: 'expect_number_after', index: 3, params: { op: '>' } })
  })

  it('помилки — по кожному рядку окремо, правильні рядки не губляться', () => {
    const r = parseLines(['x > 1', 'x >', 'y < 2'])
    expect(r.ok).toBe(false)
    if ('errors' in r) expect(r.errors.map((e) => [e.line, e.code])).toEqual([[1, 'expect_number_after'], [2, 'other_variable']])
  })

  it('невалідне число в збережених даних — помилка, а не «приблизна» пряма', () => {
    const ev = evaluate({ ...defaultNumberLineData(), conditions: [{ op: '>', value: '1,2,3' }] })
    expect(ev.ok).toBe(false)
  })
})

describe('текст рядка ↔ умова', () => {
  it.each(['x > 3', 'x ≤ −2', '−3 < x ≤ 5', 'x ≠ 1', 'x = 2,5', '-1/3 ≤ x < 4'])('%s повертається тим самим', (line) => {
    const r = parseLine(line)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const again = parseLine(conditionToText(r.condition, r.variable))
    expect(again.ok && again.condition).toEqual(r.condition)
  })
})
