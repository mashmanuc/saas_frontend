/**
 * Контракт вікна графіка з бекендом (FIRST USER GATE 2026-09-23, блокер №1).
 *
 * `WBGraphCalculatorViewportSerializer` (backend/apps/winterboard/api/serializers.py)
 * до 2026-09-23 вимагав `scale` у межах 1…1000. З FE-коміту `07717000` новий
 * графік ішов як `{cx, cy, fit}` без `scale` → POST /replay/batch/ = 400 →
 * opsSync тримав op «у дорозі», і з першого графіка від Інтегралика урок у
 * вкладці не зберігався взагалі. Вчитель бачив лише вічне «Збереження…».
 *
 * Бекенд уже приймає й без `scale`, але FE пише форму, яку розуміє і старий
 * бекенд: `scale` є ЗАВЖДИ і скінченний. Сторож тут, бо зелені FE-тести
 * `07717000` цього не ловили — вони перевіряли лише малювання.
 */
import { describe, expect, it } from 'vitest'
import { GraphViewportIO } from '../vendor/graph_calculator/graph-calculator.js'
import { graphViewportFor } from '../utils/graphAutofit'

/** Межі бекенда після 2026-09-23 = діапазон рушія. */
const BE_SCALE_MIN = 1e-4
const BE_SCALE_MAX = 1e5

function expectBackendCompatible(vp: Record<string, unknown>) {
  expect(Number.isFinite(vp.cx as number)).toBe(true)
  expect(Number.isFinite(vp.cy as number)).toBe(true)
  expect(typeof vp.scale).toBe('number')
  expect(Number.isFinite(vp.scale as number)).toBe(true)
  expect(vp.scale as number).toBeGreaterThanOrEqual(BE_SCALE_MIN)
  expect(vp.scale as number).toBeLessThanOrEqual(BE_SCALE_MAX)
}

describe('вікно графіка завжди має `scale` — інакше бекенд відхилить op', () => {
  it.each([
    [['x^2'], {}],
    [['sin(x)'], {}],
    [['1/x'], {}],
    [['x^3 - 1000'], {}],
    [['a*x^2'], { a: { value: 3 } }],
    [[], {}],
  ])('graphViewportFor(%j)', (srcs, params) => {
    expectBackendCompatible(graphViewportFor(srcs as string[], params as Record<string, unknown>))
  })

  it('writeViewport у режимі вписування (fit) теж пише scale', () => {
    const fit = { xMin: -5, xMax: 5, yMin: -3.6, yMax: 27.6 }
    const vp = GraphViewportIO.writeViewport({ cx: 0, cy: 12, scaleX: 38, scaleY: 38 }, fit)
    expect(vp.fit).toEqual(fit)
    expectBackendCompatible(vp)
  })

  it('writeViewport: однаковий і різний масштаб осей', () => {
    expectBackendCompatible(GraphViewportIO.writeViewport({ cx: 0, cy: 0, scaleX: 38, scaleY: 38 }))
    expectBackendCompatible(GraphViewportIO.writeViewport({ cx: 0, cy: 0, scaleX: 0.32, scaleY: 0.24 }))
  })
})
