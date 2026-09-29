/**
 * Калькулятор графіків «як у Desmos» (власник 2026-09-29, «так»): звичне для вчителів введення розуміє
 * сам рушій. Як і R9 (·×− → *-), це безпечна нормалізація ВВОДУ до розбору (§4.9 CORE-ARITH): AST той самий,
 * непарна «|» — як і раніше «Невідомий символ».
 */
import { describe, it, expect } from 'vitest'
import { GraphCalc, GraphCalculator } from '../vendor/graph_calculator/graph-calculator.js'

type Classified = { kind: string; error?: string }
const classify = (src: string, params: string[] = []): Classified =>
  (GraphCalc as unknown as { classify: (s: string, p: string[]) => Classified }).classify(src, params)

describe('рушій: |x| — модуль (як Desmos)', () => {
  it.each([
    ['y = |x|', 'explicitY'],
    ['y = 2|x|', 'explicitY'],
    ['y = ||x| - 1|', 'explicitY'],
    ['|x| + |y| = 1', 'implicit'],
  ])('%s → %s', (src, kind) => {
    expect(classify(src).kind).toBe(kind)
  })

  it('та сама формула, що й abs(x): однакові значення', () => {
    const env = { x: -3, y: 0 } as Record<string, number>
    // explicitY: у `ast` уже права частина
    const a = classify('y = |x - 1|') as { ast?: unknown }
    const b = classify('y = abs(x - 1)') as { ast?: unknown }
    const evalAst = (GraphCalc as unknown as { evalAst: (n: unknown, e: Record<string, number>) => number }).evalAst
    expect(evalAst(a.ast, env)).toBe(4)
    expect(evalAst(a.ast, env)).toBe(evalAst(b.ast, env))
  })

  it('непарна риска — зрозуміла помилка, а не мовчазна нісенітниця', () => {
    const c = classify('y = |x')
    expect(c.kind).toBe('invalid')
    expect(c.error).toMatch(/«\|»/)
  })
})

describe('рушій: функція без дужок (sin x) — як Desmos', () => {
  it.each([
    'y = sin x', 'y = sin 2x', 'y = sin x^2', 'y = sinx', 'y = cos x + 1', 'y = a sin x', 'y = asin x', 'y = ln x',
  ])('%s малюється', (src) => {
    expect(classify(src, ['a']).kind).toBe('explicitY')
  })

  it('з дужками й решта — як було', () => {
    expect(classify('y = sin(x)').kind).toBe('explicitY')
    expect(classify('x^2 + y^2 = 9').kind).toBe('implicit')
    expect(classify('(1, 2)').kind).toBe('point')
    expect(classify('y = x^2 y = x^3').kind).toBe('invalid')
  })
})

describe('рушій: новий рядок на позицію (Enter і вставка — під поточним)', () => {
  // Сам список рядків, без полотна: метод рушія на мінімальному «this»
  const add = (GraphCalculator as unknown as { prototype: { addExpression: (...a: unknown[]) => unknown } })
    .prototype.addExpression
  const list = (ids: string[]) => ({
    expressions: ids.map((id) => ({ id, src: id })) as Array<{ id: string; src: string }>,
    palette: ['#c00', '#0c0'],
    _reclassifyAll() {},
    _scheduleRender() {},
  })

  it('index — рядок стає саме туди', () => {
    const t = list(['a', 'b', 'c'])
    add.call(t, 'y = x', 'n', 1)
    expect(t.expressions.map((e) => e.id)).toEqual(['a', 'n', 'b', 'c'])
  })

  it('без index або поза межами — у кінець, як і було', () => {
    const t = list(['a', 'b'])
    add.call(t, '', 'n1')
    add.call(t, '', 'n2', 99)
    add.call(t, '', 'n3', -1)
    expect(t.expressions.map((e) => e.id)).toEqual(['a', 'b', 'n1', 'n2', 'n3'])
  })
})
