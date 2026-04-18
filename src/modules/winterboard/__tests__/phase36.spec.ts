/**
 * Phase 36: Unit tests — alignment, batch update, mixed values, undo
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import type { WBStroke, WBAsset } from '../types/winterboard'
import { useAlign } from '../composables/useAlign'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStroke(overrides: Partial<WBStroke> = {}): WBStroke {
  return {
    id: `stroke-${Math.random().toString(36).slice(2, 8)}`,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
    ...overrides,
  }
}

function makeAsset(overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id: `asset-${Math.random().toString(36).slice(2, 8)}`,
    type: 'image',
    src: 'test.png',
    x: 100,
    y: 100,
    w: 200,
    h: 150,
    rotation: 0,
    ...overrides,
  }
}

function seedPage(store: ReturnType<typeof useWBStore>) {
  if (store.pages.length === 0) {
    store.pages = [{ id: 'page-1', name: 'Page 1', strokes: [], assets: [] }]
    store.currentPageIndex = 0
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Phase 36: batchUpdateObjects', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    seedPage(store)
  })

  it('updates multiple objects with single undo entry', () => {
    const s1 = makeStroke({ id: 'st-1', color: '#000' })
    const s2 = makeStroke({ id: 'st-2', color: '#111' })
    store.pages[0].strokes = [s1, s2]

    const undoBefore = store.undoStack.length
    store.batchUpdateObjects([
      { id: 'st-1', changes: { color: '#ff0000' } },
      { id: 'st-2', changes: { color: '#00ff00' } },
    ])

    // Verify changes applied
    expect(store.pages[0].strokes[0].color).toBe('#ff0000')
    expect(store.pages[0].strokes[1].color).toBe('#00ff00')

    // Single undo entry
    expect(store.undoStack.length).toBe(undoBefore + 1)
    // WBCommand pattern: no .type, just apply/revert
    expect(store.undoStack[store.undoStack.length - 1]).toHaveProperty('apply')
    expect(store.undoStack[store.undoStack.length - 1]).toHaveProperty('revert')
  })

  it('skips locked objects in batch', () => {
    const s1 = makeStroke({ id: 'st-1', color: '#000', locked: true })
    const s2 = makeStroke({ id: 'st-2', color: '#111' })
    store.pages[0].strokes = [s1, s2]

    store.batchUpdateObjects([
      { id: 'st-1', changes: { color: '#ff0000' } },
      { id: 'st-2', changes: { color: '#00ff00' } },
    ])

    // Locked stays unchanged
    expect(store.pages[0].strokes[0].color).toBe('#000')
    // Unlocked updated
    expect(store.pages[0].strokes[1].color).toBe('#00ff00')
  })

  it('undo restores all objects in batch', () => {
    const a1 = makeAsset({ id: 'img-1', opacity: 1 })
    const a2 = makeAsset({ id: 'img-2', opacity: 0.8 })
    store.pages[0].assets = [a1, a2]

    store.batchUpdateObjects([
      { id: 'img-1', changes: { opacity: 0.5 } },
      { id: 'img-2', changes: { opacity: 0.3 } },
    ])

    expect(store.pages[0].assets[0].opacity).toBe(0.5)
    expect(store.pages[0].assets[1].opacity).toBe(0.3)

    // Undo
    store.undo()
    expect(store.pages[0].assets[0].opacity).toBe(1)
    expect(store.pages[0].assets[1].opacity).toBe(0.8)
  })

  it('redo re-applies batch', () => {
    const s1 = makeStroke({ id: 'st-1', color: '#000' })
    store.pages[0].strokes = [s1]

    store.batchUpdateObjects([
      { id: 'st-1', changes: { color: '#ff0000' } },
    ])

    store.undo()
    expect(store.pages[0].strokes[0].color).toBe('#000')

    store.redo()
    expect(store.pages[0].strokes[0].color).toBe('#ff0000')
  })

  it('does nothing with empty updates array', () => {
    const undoBefore = store.undoStack.length
    store.batchUpdateObjects([])
    expect(store.undoStack.length).toBe(undoBefore)
  })

  it('works with mixed strokes and assets', () => {
    const s1 = makeStroke({ id: 'st-1', color: '#000' })
    const a1 = makeAsset({ id: 'img-1', opacity: 1 })
    store.pages[0].strokes = [s1]
    store.pages[0].assets = [a1]

    store.batchUpdateObjects([
      { id: 'st-1', changes: { color: '#ff0000' } },
      { id: 'img-1', changes: { opacity: 0.5 } },
    ])

    expect(store.pages[0].strokes[0].color).toBe('#ff0000')
    expect(store.pages[0].assets[0].opacity).toBe(0.5)
    expect(store.undoStack[store.undoStack.length - 1]).toHaveProperty('apply')
    expect(store.undoStack[store.undoStack.length - 1]).toHaveProperty('revert')
  })
})

describe('Phase 36: useAlign', () => {
  let store: ReturnType<typeof useWBStore>
  let align: ReturnType<typeof useAlign>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    seedPage(store)
    align = useAlign(store)
  })

  it('alignLeft moves items to leftmost x', () => {
    const a1 = makeAsset({ id: 'a1', x: 100, y: 50, w: 80, h: 60 })
    const a2 = makeAsset({ id: 'a2', x: 300, y: 100, w: 80, h: 60 })
    store.pages[0].assets = [a1, a2]
    store.selectItems(['a1', 'a2'])

    align.alignLeft()

    expect(store.pages[0].assets[0].x).toBe(100) // already leftmost
    expect(store.pages[0].assets[1].x).toBe(100) // moved to leftmost
  })

  it('alignRight moves items to rightmost edge', () => {
    const a1 = makeAsset({ id: 'a1', x: 100, y: 50, w: 80, h: 60 })
    const a2 = makeAsset({ id: 'a2', x: 300, y: 100, w: 80, h: 60 })
    store.pages[0].assets = [a1, a2]
    store.selectItems(['a1', 'a2'])

    align.alignRight()

    // rightmost edge = 300 + 80 = 380
    expect(store.pages[0].assets[0].x).toBe(300) // moved: 380 - 80 = 300
    expect(store.pages[0].assets[1].x).toBe(300) // already at rightmost
  })

  it('alignTop moves items to topmost y', () => {
    const a1 = makeAsset({ id: 'a1', x: 100, y: 50, w: 80, h: 60 })
    const a2 = makeAsset({ id: 'a2', x: 300, y: 200, w: 80, h: 60 })
    store.pages[0].assets = [a1, a2]
    store.selectItems(['a1', 'a2'])

    align.alignTop()

    expect(store.pages[0].assets[0].y).toBe(50)
    expect(store.pages[0].assets[1].y).toBe(50) // moved to topmost
  })

  it('skips locked items during alignment', () => {
    const a1 = makeAsset({ id: 'a1', x: 100, y: 50, w: 80, h: 60, locked: true })
    const a2 = makeAsset({ id: 'a2', x: 300, y: 100, w: 80, h: 60 })
    store.pages[0].assets = [a1, a2]
    store.selectItems(['a1', 'a2'])

    align.alignLeft()

    expect(store.pages[0].assets[0].x).toBe(100) // locked: unchanged
    expect(store.pages[0].assets[1].x).toBe(100) // moved to leftmost
  })

  it('creates single undo entry for alignment', () => {
    const a1 = makeAsset({ id: 'a1', x: 100, y: 50, w: 80, h: 60 })
    const a2 = makeAsset({ id: 'a2', x: 300, y: 100, w: 80, h: 60 })
    store.pages[0].assets = [a1, a2]
    store.selectItems(['a1', 'a2'])

    const undoBefore = store.undoStack.length
    align.alignLeft()

    expect(store.undoStack.length).toBe(undoBefore + 1)
    expect(store.undoStack[store.undoStack.length - 1]).toHaveProperty('apply')
    expect(store.undoStack[store.undoStack.length - 1]).toHaveProperty('revert')
  })

  it('canAlign requires 2+ items selected', () => {
    store.selectItems([])
    expect(align.canAlign.value).toBe(false)

    store.selectItems(['a1'])
    expect(align.canAlign.value).toBe(false)

    store.selectItems(['a1', 'a2'])
    expect(align.canAlign.value).toBe(true)
  })

  it('canDistribute requires 3+ items selected', () => {
    store.selectItems(['a1', 'a2'])
    expect(align.canDistribute.value).toBe(false)

    store.selectItems(['a1', 'a2', 'a3'])
    expect(align.canDistribute.value).toBe(true)
  })

  it('distributeHorizontal spaces items evenly', () => {
    const a1 = makeAsset({ id: 'a1', x: 0, y: 0, w: 40, h: 40 })
    const a2 = makeAsset({ id: 'a2', x: 50, y: 0, w: 40, h: 40 })
    const a3 = makeAsset({ id: 'a3', x: 200, y: 0, w: 40, h: 40 })
    store.pages[0].assets = [a1, a2, a3]
    store.selectItems(['a1', 'a2', 'a3'])

    align.distributeHorizontal()

    // First and last stay fixed, middle redistributed
    expect(store.pages[0].assets[0].x).toBe(0)   // first: unchanged
    expect(store.pages[0].assets[2].x).toBe(200)  // last: unchanged
    // Middle should be evenly spaced: totalWidth = 240, totalItemWidth = 120, gap = 60
    // target: 0 + 40 + 60 = 100
    expect(store.pages[0].assets[1].x).toBe(100)
  })

  it('undo reverses alignment', () => {
    const a1 = makeAsset({ id: 'a1', x: 100, y: 50, w: 80, h: 60 })
    const a2 = makeAsset({ id: 'a2', x: 300, y: 100, w: 80, h: 60 })
    store.pages[0].assets = [a1, a2]
    store.selectItems(['a1', 'a2'])

    align.alignLeft()
    expect(store.pages[0].assets[1].x).toBe(100)

    store.undo()
    expect(store.pages[0].assets[1].x).toBe(300) // restored
  })
})

describe('Phase 36: Mixed values logic', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    seedPage(store)
  })

  it('getCommonValue returns same value when all objects match', () => {
    const s1 = makeStroke({ id: 'st-1', color: '#ff0000' })
    const s2 = makeStroke({ id: 'st-2', color: '#ff0000' })
    store.pages[0].strokes = [s1, s2]
    store.selectItems(['st-1', 'st-2'])

    // Replicate the mixed values logic from MultiSelectProperties
    const objects = store.selectedIds.map(id => store.getObjectById(id)).filter(Boolean)
    const colors = objects.map(o => (o as unknown as Record<string, unknown>).color)
    const allSame = colors.every(c => c === colors[0])
    expect(allSame).toBe(true)
    expect(colors[0]).toBe('#ff0000')
  })

  it('getCommonValue returns mixed when objects differ', () => {
    const s1 = makeStroke({ id: 'st-1', color: '#ff0000' })
    const s2 = makeStroke({ id: 'st-2', color: '#00ff00' })
    store.pages[0].strokes = [s1, s2]
    store.selectItems(['st-1', 'st-2'])

    const objects = store.selectedIds.map(id => store.getObjectById(id)).filter(Boolean)
    const colors = objects.map(o => (o as unknown as Record<string, unknown>).color)
    const allSame = colors.every(c => c === colors[0])
    expect(allSame).toBe(false)
  })

  it('batch update resolves mixed to uniform', () => {
    const s1 = makeStroke({ id: 'st-1', color: '#ff0000' })
    const s2 = makeStroke({ id: 'st-2', color: '#00ff00' })
    store.pages[0].strokes = [s1, s2]
    store.selectItems(['st-1', 'st-2'])

    // Apply same color to all
    store.batchUpdateObjects([
      { id: 'st-1', changes: { color: '#0000ff' } },
      { id: 'st-2', changes: { color: '#0000ff' } },
    ])

    const colors = store.pages[0].strokes.map(s => s.color)
    expect(colors.every(c => c === '#0000ff')).toBe(true)
  })
})
