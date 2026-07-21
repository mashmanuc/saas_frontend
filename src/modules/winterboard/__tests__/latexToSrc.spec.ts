/**
 * latexToSrc — LaTeX→ascii порт з mq-adapter (MathQuill-блок, §0.1).
 *
 * Найважливіше — roundtrip: src → asciiMathToLatex → latexToSrc → результат
 * має бути МАТЕМАТИЧНО еквівалентний оригіналу (звіряємо значеннями через
 * справжній vendor GraphCalc.parse+evalAst, а не текстуально — дужки можуть
 * відрізнятись, семантика ні).
 */
import { describe, expect, it } from 'vitest'
import { latexToSrc } from '../utils/latexToSrc'
import { asciiMathToLatex } from '../utils/asciiMathToLatex'
import { GraphCalc } from '../vendor/graph_calculator/graph-calculator.js'

describe('latexToSrc — базові конструкції (1:1 з mq-adapter)', () => {
  it('дріб \\frac', () => {
    expect(latexToSrc('\\frac{1}{x}')).toBe('((1)/(x))')
  })

  it('степінь ^{...}', () => {
    expect(latexToSrc('x^{2}')).toBe('x^(2)')
  })

  it('корінь і кубічний корінь', () => {
    expect(latexToSrc('\\sqrt{x}')).toBe('sqrt(x)')
    expect(latexToSrc('\\sqrt[3]{x}')).toBe('((x)^(1/(3)))')
  })

  it('\\cdot і \\times → * (пробіл після — поведінка донора 1:1; двигун його ігнорує)', () => {
    expect(latexToSrc('3\\cdot x')).toBe('3* x')
    expect(latexToSrc('3\\times x')).toBe('3* x')
  })

  it('модуль \\left|..\\right| → abs()', () => {
    expect(latexToSrc('\\left|x\\right|')).toBe('abs(x)')
  })

  it('тригонометрія і arc-функції (arcsin → asin)', () => {
    expect(latexToSrc('\\sin\\left(x\\right)')).toBe('sin(x)')
    expect(latexToSrc('\\arcsin\\left(x\\right)')).toBe('asin(x)')
  })

  it('грецькі: \\pi → pi', () => {
    expect(latexToSrc('\\pi')).toBe('pi')
  })

  it('нерівності: \\le \\ge (пробіл — донор 1:1)', () => {
    expect(latexToSrc('y\\le x')).toBe('y<= x')
    expect(latexToSrc('y\\ge x')).toBe('y>= x')
  })

  it('рівняння з поліномом (кейс зі скріншота власника)', () => {
    expect(latexToSrc('y=3\\cdot x^{2}-4\\cdot x+1')).toBe('y=3* x^(2)-4* x+1')
  })
})

describe('latexToSrc — roundtrip src → LaTeX → src (семантична еквівалентність)', () => {
  // Значення функцій звіряємо через справжній двигун у кількох точках.
  const SAMPLES = [-2.3, -1, -0.4, 0.6, 1, 2.7]

  function evalSrc(src: string, x: number): number {
    const ast = GraphCalc.parse(src) as never
    return GraphCalc.evalAst(ast, { x }) as number
  }

  const PRESETS = [
    'x^2',
    'x^3 - 3*x',
    'sin(x)',
    'cos(x)',
    'exp(x)',
    '1/(1 + x^2)',
    'sqrt(abs(x))', // sqrt(x) на від'ємних дає NaN — беремо abs для звірки значень
    'abs(x)',
    '3x^2-4x+1',
    'pi*x',
    '-x^2',
  ]

  for (const src of PRESETS) {
    it(`roundtrip: ${src}`, () => {
      const back = latexToSrc(asciiMathToLatex(src))
      for (const x of SAMPLES) {
        const a = evalSrc(src, x)
        const b = evalSrc(back, x)
        expect(b).toBeCloseTo(a, 10)
      }
    })
  }

  it('roundtrip рівняння: y = x^2 лишається рівнянням', () => {
    const back = latexToSrc(asciiMathToLatex('y = x^2'))
    const c = GraphCalc.classify(back, []) as { kind: string }
    expect(c.kind).toBe('explicitY')
  })

  it('roundtrip implicit: коло лишається implicit', () => {
    const back = latexToSrc(asciiMathToLatex('(x)^2 + (y)^2 = 4'))
    const c = GraphCalc.classify(back, []) as { kind: string }
    expect(c.kind).toBe('implicit')
  })
})
