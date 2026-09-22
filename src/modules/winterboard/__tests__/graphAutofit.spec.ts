/**
 * Автопідбір вікна графіка (TZ_GRAPH_VIEWPORT_AUTOFIT_2026-09-22 §3.2, §5.6).
 * Приклад власника: x³ − 9x² − 216x (урок «Похідна», прод 2026-09-22) —
 * екстремуми f(−6)=756, f(12)=−2160 лежали поза вікном y ≈ −20…20.
 */
import { describe, expect, it } from 'vitest'
import { autofitExpressions, type GraphFit } from '../utils/graphAutofit'

const inX = (f: GraphFit, x: number) => f.xMin <= x && x <= f.xMax
const inY = (f: GraphFit, y: number) => f.yMin <= y && y <= f.yMax

describe('autofitExpressions', () => {
  it('x³ − 9x² − 216x: обидва екстремуми й усі нулі у вікні', () => {
    const f = autofitExpressions(['y = x^3 - 9*x^2 - 216*x'])!
    for (const x of [-6, 12, 0, -10.9, 19.9]) expect(inX(f, x)).toBe(true)
    expect(inY(f, 756)).toBe(true)
    expect(inY(f, -2160)).toBe(true)
    // вікно не роздуте на весь пошуковий діапазон
    expect(f.xMax - f.xMin).toBeLessThan(60)
  })

  it('sin x: кілька півперіодів довкола нуля, не десятки періодів', () => {
    const f = autofitExpressions(['y = sin(x)'])!
    expect(inX(f, -Math.PI / 2) && inX(f, Math.PI / 2)).toBe(true)
    expect(f.xMax - f.xMin).toBeLessThan(6 * Math.PI)
    expect(inY(f, 1) && inY(f, -1)).toBe(true)
    expect(f.yMax).toBeLessThan(3)
  })

  it('1/x: обидві гілки, y не обрізано до нуля й не роздуто асимптотою', () => {
    const f = autofitExpressions(['y = 1/x'])!
    expect(inX(f, -5) && inX(f, 5)).toBe(true)
    expect(f.yMax).toBeGreaterThan(1)
    expect(f.yMin).toBeLessThan(-1)
    expect(f.yMax).toBeLessThan(100)
  })

  it('e^x: видно точку (0, 1) і зростання', () => {
    const f = autofitExpressions(['y = exp(x)'])!
    expect(inX(f, 0) && inY(f, 1)).toBe(true)
    expect(Number.isFinite(f.yMax) && f.yMax > 1).toBe(true)
  })

  it('x² − 4: нулі ±2 і вершина (0, −4), вікно не порожнє', () => {
    const f = autofitExpressions(['y = x^2 - 4'])!
    expect(inX(f, -2) && inX(f, 2)).toBe(true)
    expect(inY(f, -4)).toBe(true)
    expect(f.xMax - f.xMin).toBeLessThan(20)
  })

  it('картка похідної: x₀ і P = (x₀, f(x₀)) у вікні', () => {
    const f = autofitExpressions(['y = x^3 - 9*x^2 - 216*x'], {}, [1])!
    expect(inX(f, 1)).toBe(true)
    expect(inY(f, -224)).toBe(true)
  })

  it('параметри беруться з поточних значень', () => {
    const f = autofitExpressions(['y = a*x^2 - 4'], { a: 100 })!
    expect(inX(f, 0.2) && inX(f, -0.2)).toBe(true)   // нулі ±0.2
    expect(inY(f, -4)).toBe(true)
  })

  it('немає явних функцій (коло, порожньо) → null, вікно не чіпаємо', () => {
    expect(autofitExpressions(['x^2 + y^2 = 9'])).toBeNull()
    expect(autofitExpressions(['', '  '])).toBeNull()
  })
})
