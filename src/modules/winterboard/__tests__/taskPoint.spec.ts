/**
 * x₀ з умови задачі (прод 2026-09-22: «похідна … у точці x₀ = 3» → картка
 * стояла в x₀ = 1). Запис у банку буває і LaTeX, і Юнікодом.
 */
import { describe, expect, it } from 'vitest'
import { extractX0 } from '../utils/taskPoint'

describe('extractX0', () => {
  it('кейс зі скріну власника (LaTeX)', () => {
    expect(extractX0('Знайдіть значення похідної функції $f(x) = 3x^3 - 4x^2 + 2x$ у точці $x_0 = 3$.')).toBe(3)
  })

  it('різні записи індексу', () => {
    expect(extractX0('у точці x₀ = -1')).toBe(-1)
    expect(extractX0('у точці $x_{0}=2$')).toBe(2)
    expect(extractX0('в точці x0 = 5')).toBe(5)
  })

  it('мінус-знак Юнікоду, десяткова кома, дріб', () => {
    expect(extractX0('у точці $x_0 = −2$')).toBe(-2)
    expect(extractX0('у точці x₀ = 0,5')).toBe(0.5)
    expect(extractX0('у точці $x_0 = \\frac{1}{2}$')).toBe(0.5)
    expect(extractX0('у точці $x_0 = -\\dfrac{3}{4}$')).toBe(-0.75)
  })

  it('без індексу: «у точці x = 2», «з абсцисою 4»', () => {
    expect(extractX0('Знайдіть f′(x) у точці $x = 2$')).toBe(2)
    expect(extractX0('дотична в точці з абсцисою 4')).toBe(4)
  })

  it('функція x₀ не плутає: x^2 + 10, 20x — не точка', () => {
    expect(extractX0('Знайдіть точку мінімуму функції $f(x)=x^3+15x^2-72x$.')).toBeNull()
    expect(extractX0('$f(x) = 20x$')).toBeNull()
  })

  it('значення похідної в точці: f′(1), y′(-2), f^{\\prime}(3)', () => {
    expect(extractX0('$f(x) = x^2 + 10$, знайдіть f′(1)')).toBe(1)
    expect(extractX0("Обчисліть y'(-2)")).toBe(-2)
    expect(extractX0('Знайдіть $f^{\\prime}(3)$')).toBe(3)
    expect(extractX0("Знайдіть $f'(x)$")).toBeNull()
  })

  it('порожньо', () => {
    expect(extractX0('')).toBeNull()
    expect(extractX0(undefined)).toBeNull()
  })
})
