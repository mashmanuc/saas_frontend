/**
 * asciiMathToLatex — ascii→LaTeX конверсія (ТЗ 2026-07-21 P0-B).
 *
 * Кейси включають усі CALCULUS_EXPR_PRESETS з constants/calculusDefaults.ts.
 * Справжній vendor GraphCalc.parse (без моків) — та сама траса, що в проді.
 */
import { describe, expect, it } from 'vitest'
import { asciiMathToLatex } from '../utils/asciiMathToLatex'

describe('asciiMathToLatex — пресети calculusDefaults', () => {
  it('x^2 (дефолтний вираз картки)', () => {
    expect(asciiMathToLatex('x^2')).toBe('x^{2}')
  })

  it('x^3 - 3*x', () => {
    expect(asciiMathToLatex('x^3 - 3*x')).toBe('x^{3}-3\\cdot x')
  })

  it('sin(x) / cos(x) — trig як \\sin', () => {
    expect(asciiMathToLatex('sin(x)')).toBe('\\sin\\left(x\\right)')
    expect(asciiMathToLatex('cos(x)')).toBe('\\cos\\left(x\\right)')
  })

  it('exp(x)', () => {
    expect(asciiMathToLatex('exp(x)')).toBe('\\exp\\left(x\\right)')
  })

  it('1/(1 + x^2) — дріб як \\frac', () => {
    expect(asciiMathToLatex('1/(1 + x^2)')).toBe('\\frac{1}{1+x^{2}}')
  })

  it('sqrt(x) — корінь', () => {
    expect(asciiMathToLatex('sqrt(x)')).toBe('\\sqrt{x}')
  })

  it('abs(x) — модуль', () => {
    expect(asciiMathToLatex('abs(x)')).toBe('\\left|x\\right|')
  })
})

describe('asciiMathToLatex — загальні форми', () => {
  it('рівняння y = f(x)', () => {
    expect(asciiMathToLatex('y = x^2')).toBe('y=x^{2}')
  })

  it('неявне множення 2x → 2·x', () => {
    expect(asciiMathToLatex('2x')).toBe('2\\cdot x')
  })

  it('грецькі літери: pi → \\pi', () => {
    expect(asciiMathToLatex('pi*x')).toBe('\\pi \\cdot x')
  })

  it('унарний мінус зі степенем: -x^2 = -(x²)', () => {
    expect(asciiMathToLatex('-x^2')).toBe('-\\left(x^{2}\\right)')
  })

  it('поліном зі скріншота власника: 3x^2-4x+1', () => {
    expect(asciiMathToLatex('3x^2-4x+1')).toBe('3\\cdot x^{2}-4\\cdot x+1')
  })

  it('невалідний вираз (3x^^2) → THROW (fallback — на caller-і)', () => {
    expect(() => asciiMathToLatex('3x^^2')).toThrow()
    expect(() => asciiMathToLatex('')).toThrow()
  })
})
