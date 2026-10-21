import { describe, expect, it } from 'vitest'
import { buildTaskCompanion, matchesTaskCompanion, taskNumberLine } from '../taskCompanion'
import { hasAvailableCompanions, resolveCompanions } from '../capabilityRegistry'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../../board/state/boardStore'

const line = { version: 1, mode: 'set', variable: 'x', conditions: [{ op: '>', value: '-11', source: 'x+5>-6' }], combine: 'and', showAnswer: true, showHatching: true }
const solved = { ...line, mode: 'solved', conditions: [], inequality: 'x^2<2',
  result: { ok: true, domain: null, answer: 'x ∈ (−√2; √2)', points: [], intervals: [{
    from: { latex: '-\\sqrt{2}', approx: -Math.sqrt(2), exact: true, closed: false, text: '-√2' },
    to: { latex: '\\sqrt{2}', approx: Math.sqrt(2), exact: true, closed: false, text: '√2' },
  }] } }
const resolutions = [
  { rendererType: 'number_line', intent: 'show_number_line', data: { number_line: line } },
  { rendererType: 'graph_calculator', intent: 'show_graph', data: { equations: ['x^2-4'] } },
  { rendererType: 'number_line', intent: 'show_number_line', data: { number_line: solved } },
]

describe('Жива побудова саме для умови задачі', () => {
  it.each([0, 1, 2])('штатні add/undo/redo й JSON-гідратація, об’єкт %s', (topicIndex) => {
    setActivePinia(createPinia())
    const store = useWBStore()
    store.pages = [{ id: 'page-1', name: 'Сторінка 1', width: 1920, height: 1080, strokes: [], assets: [] }]
    store.currentPageIndex = 0
    const resolution = resolutions[topicIndex]
    const asset = buildTaskCompanion(resolution, 800, 24, 'live')!
    store.addAsset(asset, 'page-1')
    expect(store.pages[0].assets).toHaveLength(1)
    store.undo(); expect(store.pages[0].assets).toHaveLength(0)
    store.redo(); expect(store.pages[0].assets).toHaveLength(1)
    store.pages = JSON.parse(JSON.stringify(store.pages))
    expect(matchesTaskCompanion(store.pages[0].assets[0], resolution)).toBe(true)
    expect([store.pages[0].width, store.pages[0].height]).toEqual([1920, 1080])
  })

  it('друга задача не отримує чужого графіка; повтор після JSON/reload знаходить свій', () => {
    const a = { rendererType: 'graph_calculator', intent: 'show_graph', data: { equations: ['x^2-4'] } }
    const b = { ...a, data: { equations: ['2*x+5'] } }
    const asset = buildTaskCompanion(a, 50, 50, 'a')!
    expect(matchesTaskCompanion(asset, b)).toBe(false)
    expect(matchesTaskCompanion(JSON.parse(JSON.stringify(asset)), a)).toBe(true)
    expect(buildTaskCompanion(b, 50, 50, 'b')!.id).toBe('b')
  })

  it('порядок ключів JSONB і прихована відповідь не створюють дубль прямої', () => {
    const resolution = resolutions[0]
    const asset = buildTaskCompanion(resolution, 0, 0, 'line')!
    const reordered = JSON.parse(JSON.stringify(asset, (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().reverse().map(key => [key, value[key]])) : value))
    reordered.data.showAnswer = false; reordered.data.showHatching = false
    expect(matchesTaskCompanion(reordered, resolution)).toBe(true)
    const other = { ...resolution, data: { number_line: { ...reordered.data, conditions: [{ op: '>', value: '999' }] } } }
    expect(matchesTaskCompanion(reordered, other)).toBe(false)
  })

  it('точки таблиці залишаються точками, не вигаданою прямою', () => {
    const fp = { graph_points: [{ x: 1, y: 2 }, { x: 1, y: 5 }] }
    expect(hasAvailableCompanions(['show_graph'], fp, [])).toBe(true)
    const asset = buildTaskCompanion(resolveCompanions(['show_graph'], fp, [])[0], 0, 0, 'points')!
    const state = (asset.data as unknown as { state: { expressions: unknown[]; points: unknown } }).state
    expect(state.expressions).toEqual([])
    expect(Object.values(state.points!)).toEqual([{ x: 1, y: 2, mode: 'free' }, { x: 1, y: 5, mode: 'free' }])
  })

  it('пошкоджена пряма/NaN/неправильні межі не дають кнопки', () => {
    const variants: unknown[] = [null, {}, { ...solved, mode: 'other' },
      { ...solved, result: { ok: true, intervals: [null], points: [] } },
      { ...solved, result: { ok: true, intervals: [], points: [{ latex: 'x', approx: NaN }] } }]
    for (const number_line of variants) {
      expect(taskNumberLine(number_line)).toBeNull()
      expect(hasAvailableCompanions(['show_number_line'], { number_line }, [])).toBe(false)
    }
    expect(hasAvailableCompanions(['show_graph'], { equations: [12] }, [])).toBe(false)
    expect(hasAvailableCompanions(['show_graph'], { graph_points: [{ x: Infinity, y: 1 }] }, [])).toBe(false)
  })
})
