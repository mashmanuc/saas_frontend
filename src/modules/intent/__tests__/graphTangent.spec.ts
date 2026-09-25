// Дотична й перевірка виразу — рушієм, що малює графік.
//
// Власник 2026-09-25: Інтегралик поклав у графік `(2*x-2)'(2)*(x-2)+(2^2-2*2)`
// — штрих похідної рушій не знає, крива не намалювалась, а в чаті стояло
// «✓ Додаю криву». Тепер дотичну рахує дошка, а кожен вираз перед записом
// перевіряє сам рушій.
import { describe, expect, it } from 'vitest'

import { engineRejects, lineSrc, tangentLine } from '../graphTangent'

describe('дотична рахується дошкою', () => {
  it('випадок власника: x^2-2*x у точці 2 → 2*x-4', () => {
    const t = tangentLine('x^2-2*x', 2)

    expect(t.src).toBe('2*x-4')
    expect(t.k).toBe(2)
    expect(t.y0).toBe(0)
  })

  it('запис «y = …» теж приймається', () => {
    expect(tangentLine('y = x^2', 1).src).toBe('2*x-1')
  })

  it('горизонтальна дотична — просто число', () => {
    expect(tangentLine('x^2', 0).src).toBe('0')
  })

  it('дотична враховує повзунки, які зараз видно', () => {
    // y = a*x^2 при a = 3, x0 = 1 → k = 6, b = -3
    expect(tangentLine('a*x^2', 1, { a: 3 }).src).toBe('6*x-3')
  })

  it('тригонометрія: sin(x) у нулі → x', () => {
    expect(tangentLine('sin(x)', 0).src).toBe('x')
  })

  it('там, де функція не визначена, дотичної немає — і так і кажемо', () => {
    expect(() => tangentLine('sqrt(x)', -1)).toThrow(/не визначена/)
  })

  it('розрив у самій точці (1/x у нулі) — «не визначена», а не хибний «злам»', () => {
    // Сусіди визначені, сама точка — ні. Без окремої перевірки точки
    // людина отримала б неправдиву причину.
    expect(() => tangentLine('1/x', 0)).toThrow(/не визначена/)
  })

  it('злам (|x| у нулі) — дотичної немає', () => {
    expect(() => tangentLine('abs(x)', 0)).toThrow(/злам/)
  })

  it('запис, якого рушій не знає, дає людську відмову', () => {
    expect(() => tangentLine("(2*x-2)'(2)", 2)).toThrow(/не розуміє/)
  })
})

describe('перевірка виразу рушієм перед записом', () => {
  it('запис власника зі штрихом похідної відхиляється', () => {
    expect(engineRejects("(2*x-2)'(2)*(x-2)+(2^2-2*2)")).not.toBeNull()
  })

  it('звичайні вирази проходять', () => {
    for (const src of ['2*x-4', 'y = x^2 - 2*x', 'sin(x)', 'sqrt(x+1)']) {
      expect(engineRejects(src), src).toBeNull()
    }
  })

  it('мала вільна літера — повзунок, а не помилка', () => {
    expect(engineRejects('a*x^2')).toBeNull()
  })
})

describe('запис прямої', () => {
  it('без «1*x», «+-» і «+0»', () => {
    expect(lineSrc(1, 0)).toBe('x')
    expect(lineSrc(-1, 2)).toBe('-x+2')
    expect(lineSrc(2, -4)).toBe('2*x-4')
    expect(lineSrc(0.5, 0)).toBe('0.5*x')
    expect(lineSrc(0, -3)).toBe('-3')
  })
})
