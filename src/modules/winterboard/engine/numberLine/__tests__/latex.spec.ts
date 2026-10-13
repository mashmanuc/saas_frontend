/**
 * ТЗ «Числова пряма — один рядок + KaTeX» §4.2, §7: LaTeX будується з розбору, у порядку вчителя;
 * відповідь — з множини; рядок, який розбір не прийняв, — null (показується звичайним текстом).
 */
import { describe, expect, it } from 'vitest'
import { defaultNumberLineData, evaluate, formulaParts, inequalityLatex, numberLatex, statementLatex, type NumberLineData } from '..'

describe('будівник LaTeX — приклади з ТЗ §7', () => {
  it.each([
    ['x − 7 ≥ 7', 'x - 7 \\ge 7'],
    ['√(x−1) ≥ 7', '\\sqrt{x - 1} \\ge 7'],
    ['(x−1)(x+3)/(x−2) ≥ 0', '\\frac{\\left(x - 1\\right)\\left(x + 3\\right)}{x - 2} \\ge 0'],
    ['−1 < 2x + 1 ≤ 5', '-1 < 2x + 1 \\le 5'],
    ['2,5x ≤ 1', '2{,}5x \\le 1'],
  ])('%s', (q, tex) => {
    expect(inequalityLatex(q)).toBe(tex)
  })

  it('², ³, неявне множення, 1/√x, кирилична х, ≠ і =', () => {
    expect(inequalityLatex('x² − 4 < 0')).toBe('x^{2} - 4 < 0')
    expect(inequalityLatex('1/√x > 1')).toBe('\\frac{1}{\\sqrt{x}} > 1')
    expect(inequalityLatex('2√x < x')).toBe('2\\sqrt{x} < x')
    expect(inequalityLatex('х^2 < 3')).toBe('x^{2} < 3')
    expect(inequalityLatex('x ≠ 1')).toBe('x \\ne 1')
    expect(inequalityLatex('2 · 3x > 1')).toBe('2 \\cdot 3x > 1')
  })

  it('розбір не прийняв — null, формули ніхто не вгадує', () => {
    for (const q of ['x >', '(x − 1 > 0', 'abc', 'x > 1 ;', '', 'x @ 2']) expect(inequalityLatex(q)).toBeNull()
  })

  it('числа межі: дроби, корені, десяткова кома, ≈', () => {
    expect(numberLatex('−1/3')).toBe('-\\frac{1}{3}')
    expect(numberLatex('√3/2')).toBe('\\frac{\\sqrt{3}}{2}')
    expect(numberLatex('2,5')).toBe('2{,}5')
    expect(numberLatex('(1 − √5)/2')).toBe('\\frac{1 - \\sqrt{5}}{2}')
    expect(numberLatex('≈1,32')).toBe('\\approx 1{,}32')
    expect(numberLatex('x')).toBeNull()
  })

  it('рядок ОДЗ у нашому записі', () => {
    expect(statementLatex('x ≥ −1')).toBe('x \\ge -1')
    expect(statementLatex('x ≠ 2, x ≠ −3')).toBe('x \\ne 2,\\; x \\ne -3')
    expect(statementLatex('x ∈ [−2; 2]')).toBe('x \\in [-2; 2]')
    expect(statementLatex('щось інше')).toBeNull()
  })
})

describe('відповідь і підписи — з множини, не з тексту', () => {
  const set = (conditions: NumberLineData['conditions'], combine: 'and' | 'or' = 'and'): NumberLineData =>
    ({ ...defaultNumberLineData(), conditions, combine })
  const ev = (d: NumberLineData) => { const e = evaluate(d); if (!('layout' in e)) throw new Error('eval'); return e }

  it('проміжок, обʼєднання, точка, корені', () => {
    expect(ev(set([{ op: '>=', value: '14' }])).answer.tex).toBe('x \\in [14; +\\infty)')
    expect(ev(set([{ op: '<', value: '-2' }, { op: '>', value: '√2' }], 'or')).answer.tex).toBe('x \\in (-\\infty; -2) \\cup (\\sqrt{2}; +\\infty)')
    expect(ev(set([{ op: '=', value: '3' }])).answer.tex).toBe('x = 3')
    expect(ev(set([{ op: '>=', value: '-1/3' }])).layout.points[0].tex).toBe('-\\frac{1}{3}')
  })

  it('межі сервера — його latex; неточні — ≈', () => {
    const d: NumberLineData = { ...defaultNumberLineData(), mode: 'solved', inequality: 'x^3 - x - 1 > 0', result: {
      ok: true, points: [], domain: null, answer: '',
      intervals: [{ from: { latex: '\\sqrt[3]{…}', approx: 1.3247, exact: false, closed: false, text: null }, to: null }],
    } }
    const e = ev(d)
    expect(e.answer.tex).toBe('x \\in (\\approx 1{,}32; +\\infty)')
    expect(e.layout.points[0].tex).toBe('\\approx 1{,}32')
    const exact: NumberLineData = { ...d, result: { ...d.result!, intervals: [{ from: { latex: '1 + \\sqrt{2}', approx: 2.414, exact: true, closed: true, text: '1 + √2' }, to: null }] } }
    expect(ev(exact).answer.tex).toBe('x \\in [1 + \\sqrt{2}; +\\infty)')
  })

  it('формула частинами: рядок — частина, як записав учитель', () => {
    expect(formulaParts(set([{ op: '>', value: '2', source: '2x + 3 > 7' }, { op: '<=', value: '4' }])))
      .toEqual([{ text: '2x + 3 > 7', tex: '2x + 3 > 7' }, { text: 'x ≤ 4', tex: 'x \\le 4' }])
    expect(formulaParts({ ...defaultNumberLineData(), mode: 'intervals', expression: '(x-1)/(x-2)', op: '>=', rhs: '0' })[0].tex)
      .toBe('\\frac{x - 1}{x - 2} \\ge 0')
  })
})
