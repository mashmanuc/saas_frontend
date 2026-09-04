// useRemoteViewAdapter — «задача на екран», A−/A+, ▲/▼, відповідь/розбір над фейковим стором.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createRemoteViewAdapter, FIT_MARGIN_PX, SCROLL_FRACTION, TASK_ASSET_TYPE,
} from '../composables/useRemoteViewAdapter'
import { resetTutorGate } from '../composables/useStudentTutor'

function card(id: string, x: number, y: number, w = 400, data: Record<string, unknown> = {}) {
  return { id, type: TASK_ASSET_TYPE, x, y, w, h: 200, data: { externalId: id, ...data } }
}

function makeStore(assets: any[] = [], over: Partial<any> = {}) {
  const store: any = {
    containerWidth: 1000, containerHeight: 600,
    pageWidth: 2000, pageHeight: 1500,
    zoom: 1, scrollX: 0, scrollY: 0,
    currentPageIndex: 0,
    pages: [{ assets }],
    setZoom: vi.fn(function (this: any, z: number) { store.zoom = Math.max(0.1, Math.min(5, z)) }),
    setScroll: vi.fn((x: number, y: number) => { store.scrollX = x; store.scrollY = y }),
    updateAsset: vi.fn((a: any) => {
      const page = store.pages[0]
      page.assets = page.assets.map((o: any) => (o.id === a.id ? a : o))
    }),
    ...over,
  }
  return store
}

describe('useRemoteViewAdapter', () => {
  beforeEach(() => resetTutorGate())

  it('fitTask: масштаб = (containerW − 2·margin) / w, картка притиснута до верху-ліва', () => {
    const store = makeStore([card('a', 100, 300, 400)])
    const v = createRemoteViewAdapter(store)
    expect(v.fitTask()).toBe(0)
    const expectedZoom = (1000 - 2 * FIT_MARGIN_PX) / 400   // 2.42
    expect(store.zoom).toBeCloseTo(expectedZoom, 5)
    // сторінка 2000·2.42 > контейнер → base=0 → scroll = margin − a·zoom
    expect(store.scrollX).toBeCloseTo(FIT_MARGIN_PX - 100 * expectedZoom, 5)
    expect(store.scrollY).toBeCloseTo(FIT_MARGIN_PX - 300 * expectedZoom, 5)
    // ліва грань картки на екрані = base + scroll + x·zoom = margin
    const screenLeft = 0 + store.scrollX + 100 * store.zoom
    expect(screenLeft).toBeCloseTo(FIT_MARGIN_PX, 5)
    // права грань = margin + w·zoom = containerW − margin → без горизонтального виходу
    expect(screenLeft + 400 * store.zoom).toBeCloseTo(1000 - FIT_MARGIN_PX, 5)
  })

  it('fitTask на сторінці без карток → −1, стор не чіпається', () => {
    const store = makeStore([{ id: 'img', type: 'image', x: 0, y: 0, w: 100, h: 100 }])
    const v = createRemoteViewAdapter(store)
    expect(v.fitTask()).toBe(-1)
    expect(store.setZoom).not.toHaveBeenCalled()
  })

  it('повторний fitTask циклює по картках зверху вниз; resetFocus повертає на першу', () => {
    const store = makeStore([card('low', 0, 900), card('top', 0, 100), card('mid', 0, 500)])
    const v = createRemoteViewAdapter(store)
    expect(v.taskCards().map((c) => c.id)).toEqual(['top', 'mid', 'low'])
    expect(v.fitTask()).toBe(0)
    expect(v.fitTask()).toBe(1)
    expect(v.fitTask()).toBe(2)
    expect(v.fitTask()).toBe(0)
    v.resetFocus()
    expect(v.fitTask()).toBe(0)
  })

  it('A+ збільшує символи картки, але НЕ масштаб полотна і НЕ рамку', () => {
    const store = makeStore([card('a', 0, 0, 800)])
    const v = createRemoteViewAdapter(store)
    store.zoom = 1
    const initialWidth = store.pages[0].assets[0].w
    expect(v.changeTextScale(1)).toBe(1.25)
    expect(store.pages[0].assets[0].data.presentationScale).toBe(1.25)
    expect(store.zoom).toBe(1)
    expect(store.pages[0].assets[0].w).toBe(initialWidth)
    expect(v.changeTextScale(3)).toBe(2) // стеля саме для шрифту
    expect(v.changeTextScale(-1)).toBe(1.6)
  })

  it('A+ без карток не чіпає сторінку', () => {
    const store = makeStore([])
    const v = createRemoteViewAdapter(store)
    expect(v.changeTextScale(1)).toBe(1)
    expect(store.zoom).toBe(1)
    expect(store.updateAsset).not.toHaveBeenCalled()
  })

  it('scrollBy(+1) = контент угору на SCROLL_FRACTION висоти; горизонталь не міняється', () => {
    const store = makeStore([], { scrollX: -123, scrollY: 0 })
    const v = createRemoteViewAdapter(store)
    v.scrollBy(1)
    expect(store.scrollY).toBeCloseTo(-600 * SCROLL_FRACTION, 5)
    expect(store.scrollX).toBe(-123)
    v.scrollBy(-1)
    expect(store.scrollY).toBeCloseTo(0, 5)
  })

  it('reveal(answer): перемикає ВСІ картки сторінки через updateAsset; повторно — ховає', () => {
    const store = makeStore([card('a', 0, 0), card('b', 0, 300, 400, { showAnswer: true })])
    const v = createRemoteViewAdapter(store)
    expect(v.summary()).toMatchObject({ count: 2, answer: false, solution: false })
    expect(v.reveal('answer')).toBe(1)          // 'b' уже показана → міняється лише 'a'
    expect(store.pages[0].assets.every((a: any) => a.data.showAnswer)).toBe(true)
    expect(v.summary().answer).toBe(true)
    expect(v.reveal('answer')).toBe(2)          // усі показані → сховати всім
    expect(store.pages[0].assets.every((a: any) => !a.data.showAnswer)).toBe(true)
  })

  it('reveal(solution) не чіпає showAnswer; без карток → 0', () => {
    const store = makeStore([card('a', 0, 0, 400, { showAnswer: true })])
    const v = createRemoteViewAdapter(store)
    expect(v.reveal('solution')).toBe(1)
    const a = store.pages[0].assets[0]
    expect(a.data.showSolution).toBe(true)
    expect(a.data.showAnswer).toBe(true)
    expect(createRemoteViewAdapter(makeStore([])).reveal('answer')).toBe(0)
  })

  it('картки з інших сторінок не рахуються', () => {
    const store = makeStore([card('a', 0, 0)], { currentPageIndex: 1, pages: [{ assets: [card('a', 0, 0)] }, { assets: [] }] })
    const v = createRemoteViewAdapter(store)
    expect(v.summary().count).toBe(0)
  })
})

// ──────────────────────────────────────────────────────────────────────────
describe('useRemoteViewAdapter — A+/A− змінюють типографіку, не дошку', () => {
  beforeEach(() => resetTutorGate())

  it('A+ не зменшує текст, A− не збільшує текст', () => {
    const store = makeStore([card('a', 0, 0, 400, { presentationScale: 1.5 })], { zoom: 1 })
    const v = createRemoteViewAdapter(store)
    expect(v.changeTextScale(1)).toBeGreaterThanOrEqual(1.5)
    expect(v.changeTextScale(-1)).toBe(1.5)
    expect(store.zoom).toBe(1)
  })

  it('fitTask при НЕвиміряному екрані нічого не рухає і не зсуває фокус', () => {
    const store = makeStore([card('a', 0, 0, 400), card('b', 0, 500, 400)],
                            { containerWidth: 0, zoom: 1 })
    const v = createRemoteViewAdapter(store)
    expect(v.fitTask()).toBe(-1)
    expect(store.zoom).toBe(1)
    expect(store.setScroll).not.toHaveBeenCalled()
  })
})
