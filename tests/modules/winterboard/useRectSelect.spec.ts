// WB5: Unit tests for useRectSelect composable and boardStore selection actions
// Ref: TASK_BOARD_V5.md A1

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import {
  getStrokeBBox,
  getAssetBBox,
  rectsIntersect,
  useRectSelect,
} from '@/modules/winterboard/composables/useRectSelect'
import type { WBStroke, WBAsset } from '@/modules/winterboard/types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePenStroke(id: string, points: Array<{ x: number; y: number }>): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: points.map((p) => ({ ...p, t: Date.now() })),
  }
}

function makeRectStroke(id: string, x: number, y: number, w: number, h: number): WBStroke {
  return {
    id,
    tool: 'rectangle',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [{ x, y, t: Date.now() }],
    width: w,
    height: h,
  }
}

function makeTextStroke(id: string, x: number, y: number, text: string): WBStroke {
  return {
    id,
    tool: 'text',
    color: '#000',
    size: 16,
    opacity: 1,
    points: [{ x, y, t: Date.now() }],
    text,
  }
}

function makeAsset(id: string, x: number, y: number, w: number, h: number): WBAsset {
  return { id, type: 'image', src: 'data:image/png;base64,test', x, y, w, h, rotation: 0 }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getStrokeBBox', () => {
  it('computes bbox for pen stroke from points', () => {
    const stroke = makePenStroke('s1', [
      { x: 10, y: 20 },
      { x: 50, y: 60 },
      { x: 30, y: 40 },
    ])
    const bbox = getStrokeBBox(stroke)
    // With size=2, pad=1
    expect(bbox.x).toBe(9)
    expect(bbox.y).toBe(19)
    expect(bbox.width).toBe(42) // (50-10) + 2
    expect(bbox.height).toBe(42) // (60-20) + 2
  })

  it('computes bbox for rectangle stroke', () => {
    const stroke = makeRectStroke('r1', 100, 200, 300, 150)
    const bbox = getStrokeBBox(stroke)
    expect(bbox).toEqual({ x: 100, y: 200, width: 300, height: 150 })
  })

  it('computes bbox for text stroke', () => {
    const stroke = makeTextStroke('t1', 50, 100, 'Hello')
    const bbox = getStrokeBBox(stroke)
    expect(bbox.x).toBe(50)
    expect(bbox.y).toBe(100)
    expect(bbox.width).toBeGreaterThan(0)
    expect(bbox.height).toBeGreaterThan(0)
  })

  it('returns zero bbox for empty points', () => {
    const stroke: WBStroke = {
      id: 'empty',
      tool: 'pen',
      color: '#000',
      size: 2,
      opacity: 1,
      points: [],
    }
    const bbox = getStrokeBBox(stroke)
    expect(bbox).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('getAssetBBox', () => {
  it('returns asset dimensions as bbox', () => {
    const asset = makeAsset('a1', 10, 20, 100, 50)
    expect(getAssetBBox(asset)).toEqual({ x: 10, y: 20, width: 100, height: 50 })
  })
})

describe('rectsIntersect', () => {
  it('returns true for overlapping rects', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 50, y: 50, width: 100, height: 100 },
    )).toBe(true)
  })

  it('returns false for non-overlapping rects', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 100, y: 100, width: 50, height: 50 },
    )).toBe(false)
  })

  it('returns true for contained rect', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 200, height: 200 },
      { x: 50, y: 50, width: 10, height: 10 },
    )).toBe(true)
  })

  it('returns true for touching edges', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 50, y: 0, width: 50, height: 50 },
    )).toBe(true)
  })
})

describe('boardStore selection actions', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    // Store already has a default page from state() initialization
  })

  it('selectItems sets selectedIds', () => {
    store.selectItems(['s1', 's2'])
    expect(store.selectedIds).toEqual(['s1', 's2'])
  })

  it('addToSelection adds without duplicates', () => {
    store.selectItems(['s1'])
    store.addToSelection('s2')
    store.addToSelection('s1') // duplicate
    expect(store.selectedIds).toEqual(['s1', 's2'])
  })

  it('removeFromSelection removes specific id', () => {
    store.selectItems(['s1', 's2', 's3'])
    store.removeFromSelection('s2')
    expect(store.selectedIds).toEqual(['s1', 's3'])
  })

  it('toggleSelection toggles item in/out', () => {
    store.selectItems(['s1'])
    store.toggleSelection('s2')
    expect(store.selectedIds).toEqual(['s1', 's2'])
    store.toggleSelection('s1')
    expect(store.selectedIds).toEqual(['s2'])
  })

  it('clearSelection resets selectedIds and selectionRect', () => {
    store.selectItems(['s1', 's2'])
    store.setSelectionRect({ x: 0, y: 0, width: 100, height: 100 })
    store.clearSelection()
    expect(store.selectedIds).toEqual([])
    expect(store.selectionRect).toBeNull()
  })

  it('setSelectionRect sets and clears rect', () => {
    const rect = { x: 10, y: 20, width: 30, height: 40 }
    store.setSelectionRect(rect)
    expect(store.selectionRect).toEqual(rect)
    store.setSelectionRect(null)
    expect(store.selectionRect).toBeNull()
  })

  it('hasSelection getter works', () => {
    expect(store.hasSelection).toBe(false)
    store.selectItems(['s1'])
    expect(store.hasSelection).toBe(true)
  })

  it('selectedCount getter works', () => {
    expect(store.selectedCount).toBe(0)
    store.selectItems(['s1', 's2', 's3'])
    expect(store.selectedCount).toBe(3)
  })

  it('moveSelected moves strokes and assets', () => {
    // Add a stroke to the page
    const stroke = makePenStroke('ms1', [{ x: 100, y: 100 }, { x: 200, y: 200 }])
    store.addStroke(stroke)
    store.selectItems(['ms1'])
    store.moveSelected(10, 20)

    const page = store.currentPage!
    const moved = page.strokes.find((s) => s.id === 'ms1')!
    expect(moved.points[0].x).toBe(110)
    expect(moved.points[0].y).toBe(120)
    expect(moved.points[1].x).toBe(210)
    expect(moved.points[1].y).toBe(220)
  })

  it('deleteSelected removes selected items and clears selection', () => {
    const s1 = makePenStroke('ds1', [{ x: 10, y: 10 }, { x: 20, y: 20 }])
    const s2 = makePenStroke('ds2', [{ x: 30, y: 30 }, { x: 40, y: 40 }])
    store.addStroke(s1)
    store.addStroke(s2)
    expect(store.currentPage!.strokes.length).toBe(2)

    store.selectItems(['ds1'])
    store.deleteSelected()

    expect(store.currentPage!.strokes.length).toBe(1)
    expect(store.currentPage!.strokes[0].id).toBe('ds2')
    expect(store.selectedIds).toEqual([])
  })

  it('getSelectedStrokes returns only selected strokes', () => {
    const s1 = makePenStroke('gs1', [{ x: 10, y: 10 }, { x: 20, y: 20 }])
    const s2 = makePenStroke('gs2', [{ x: 30, y: 30 }, { x: 40, y: 40 }])
    store.addStroke(s1)
    store.addStroke(s2)
    store.selectItems(['gs1'])

    const selected = store.getSelectedStrokes
    expect(selected.length).toBe(1)
    expect(selected[0].id).toBe('gs1')
  })
})

describe('useRectSelect composable', () => {
  let store: ReturnType<typeof useWBStore>
  let rs: ReturnType<typeof useRectSelect>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    rs = useRectSelect(store)
  })

  it('startRectSelect sets isDragging and selectionRect', () => {
    rs.startRectSelect({ x: 10, y: 20, t: Date.now() })
    expect(rs.isDragging.value).toBe(true)
    expect(store.selectionRect).toEqual({ x: 10, y: 20, width: 0, height: 0 })
  })

  it('updateRectSelect updates rect dimensions', () => {
    rs.startRectSelect({ x: 10, y: 20, t: Date.now() })
    rs.updateRectSelect({ x: 110, y: 120, t: Date.now() })
    expect(store.selectionRect).toEqual({ x: 10, y: 20, width: 100, height: 100 })
  })

  it('updateRectSelect handles negative direction (drag up-left)', () => {
    rs.startRectSelect({ x: 100, y: 100, t: Date.now() })
    rs.updateRectSelect({ x: 50, y: 60, t: Date.now() })
    expect(store.selectionRect).toEqual({ x: 50, y: 60, width: 50, height: 40 })
  })

  it('finishRectSelect selects items inside rect', () => {
    const s1 = makePenStroke('rs1', [{ x: 50, y: 50 }, { x: 60, y: 60 }])
    const s2 = makePenStroke('rs2', [{ x: 500, y: 500 }, { x: 510, y: 510 }])
    store.addStroke(s1)
    store.addStroke(s2)

    rs.startRectSelect({ x: 0, y: 0, t: Date.now() })
    rs.updateRectSelect({ x: 100, y: 100, t: Date.now() })
    rs.finishRectSelect()

    expect(store.selectedIds).toContain('rs1')
    expect(store.selectedIds).not.toContain('rs2')
    expect(rs.isDragging.value).toBe(false)
  })

  it('finishRectSelect clears selection for tiny rect (click)', () => {
    rs.startRectSelect({ x: 10, y: 10, t: Date.now() })
    rs.updateRectSelect({ x: 11, y: 11, t: Date.now() })
    rs.finishRectSelect()

    expect(store.selectedIds).toEqual([])
    expect(store.selectionRect).toBeNull()
  })

  it('handleClick selects single item', () => {
    rs.handleClick('item1', false)
    expect(store.selectedIds).toEqual(['item1'])
  })

  it('handleClick with shift toggles item', () => {
    rs.handleClick('item1', false)
    rs.handleClick('item2', true)
    expect(store.selectedIds).toEqual(['item1', 'item2'])
    rs.handleClick('item1', true)
    expect(store.selectedIds).toEqual(['item2'])
  })

  it('handleClickEmpty clears selection', () => {
    store.selectItems(['item1', 'item2'])
    rs.handleClickEmpty()
    expect(store.selectedIds).toEqual([])
  })

  it('deleteSelected removes selected items', () => {
    const s1 = makePenStroke('del1', [{ x: 10, y: 10 }, { x: 20, y: 20 }])
    store.addStroke(s1)
    store.selectItems(['del1'])
    rs.deleteSelected()
    expect(store.currentPage!.strokes.length).toBe(0)
    expect(store.selectedIds).toEqual([])
  })
})
