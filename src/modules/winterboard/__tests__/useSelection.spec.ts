// WB: Unit tests for useSelection composable
// Ref: TASK_BOARD.md B3.3 — min 10 tests

import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import {
  useSelection,
  pointInPolygon,
  getStrokeBounds,
  getAssetBounds,
  rectsIntersect,
  rectIntersectsPolygon,
  pointToPolylineDistSq,
  combinedBounds,
} from '../composables/useSelection'
import type { WBStroke, WBAsset, WBPoint } from '../types/winterboard'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStroke(overrides: Partial<WBStroke> = {}): WBStroke {
  return {
    id: `stroke-${Math.random().toString(36).slice(2, 6)}`,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
    ],
    ...overrides,
  }
}

function makeAsset(overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id: `asset-${Math.random().toString(36).slice(2, 6)}`,
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

// ─── Geometry utility tests ─────────────────────────────────────────────────

describe('pointInPolygon', () => {
  const square: WBPoint[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ]

  it('returns true for point inside polygon', () => {
    expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true)
  })

  it('returns false for point outside polygon', () => {
    expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false)
  })

  it('returns false for polygon with fewer than 3 points', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, [{ x: 0, y: 0 }, { x: 10, y: 10 }])).toBe(false)
  })
})

describe('getStrokeBounds', () => {
  it('computes bounding box with size padding', () => {
    const stroke = makeStroke({
      size: 4,
      points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    })
    const bounds = getStrokeBounds(stroke)
    expect(bounds.x).toBe(8)   // 10 - 4/2
    expect(bounds.y).toBe(18)  // 20 - 4/2
    expect(bounds.width).toBe(24)  // 30 - 10 + 4
    expect(bounds.height).toBe(24) // 40 - 20 + 4
  })

  it('returns zero-size box for empty points', () => {
    const stroke = makeStroke({ points: [] })
    const bounds = getStrokeBounds(stroke)
    expect(bounds.width).toBe(0)
    expect(bounds.height).toBe(0)
  })
})

describe('rectsIntersect', () => {
  it('returns true for overlapping rects', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 50, height: 50 },
      { x: 25, y: 25, width: 50, height: 50 },
    )).toBe(true)
  })

  it('returns false for non-overlapping rects', () => {
    expect(rectsIntersect(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 },
    )).toBe(false)
  })
})

describe('pointToPolylineDistSq', () => {
  it('returns 0 for point on the line', () => {
    const distSq = pointToPolylineDistSq(
      { x: 5, y: 5 },
      [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    )
    expect(distSq).toBeCloseTo(0, 5)
  })

  it('returns correct distance for point off the line', () => {
    const distSq = pointToPolylineDistSq(
      { x: 0, y: 10 },
      [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    )
    expect(distSq).toBe(100) // 10^2
  })

  it('returns Infinity for empty polyline', () => {
    expect(pointToPolylineDistSq({ x: 0, y: 0 }, [])).toBe(Infinity)
  })
})

describe('combinedBounds', () => {
  it('returns null for empty array', () => {
    expect(combinedBounds([])).toBeNull()
  })

  it('combines multiple boxes', () => {
    const result = combinedBounds([
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 20, y: 20, width: 10, height: 10 },
    ])
    expect(result).toEqual({ x: 0, y: 0, width: 30, height: 30 })
  })
})

// ─── useSelection composable tests ──────────────────────────────────────────

describe('useSelection', () => {
  function setup(strokeList: WBStroke[] = [], assetList: WBAsset[] = []) {
    const strokes = ref(strokeList)
    const assets = ref(assetList)
    const onChange = vi.fn()
    const sel = useSelection(strokes, assets, { onSelectionChange: onChange })
    return { strokes, assets, sel, onChange }
  }

  it('starts with empty selection', () => {
    const { sel } = setup()
    expect(sel.hasSelection.value).toBe(false)
    expect(sel.selectionCount.value).toBe(0)
    expect(sel.selectedIdsList.value).toEqual([])
  })

  it('selectById selects a single item', () => {
    const s1 = makeStroke({ id: 's1' })
    const { sel, onChange } = setup([s1])

    sel.selectById('s1')
    expect(sel.selectedIds.value.has('s1')).toBe(true)
    expect(sel.selectionCount.value).toBe(1)
    expect(onChange).toHaveBeenCalledWith(['s1'])
  })

  it('selectById replaces previous selection', () => {
    const s1 = makeStroke({ id: 's1' })
    const s2 = makeStroke({ id: 's2' })
    const { sel } = setup([s1, s2])

    sel.selectById('s1')
    sel.selectById('s2')
    expect(sel.selectedIds.value.has('s1')).toBe(false)
    expect(sel.selectedIds.value.has('s2')).toBe(true)
    expect(sel.selectionCount.value).toBe(1)
  })

  it('toggleSelection adds and removes', () => {
    const s1 = makeStroke({ id: 's1' })
    const { sel } = setup([s1])

    sel.toggleSelection('s1')
    expect(sel.selectedIds.value.has('s1')).toBe(true)

    sel.toggleSelection('s1')
    expect(sel.selectedIds.value.has('s1')).toBe(false)
  })

  it('addToSelection adds without removing existing', () => {
    const s1 = makeStroke({ id: 's1' })
    const s2 = makeStroke({ id: 's2' })
    const { sel } = setup([s1, s2])

    sel.selectById('s1')
    sel.addToSelection('s2')
    expect(sel.selectionCount.value).toBe(2)
    expect(sel.selectedIds.value.has('s1')).toBe(true)
    expect(sel.selectedIds.value.has('s2')).toBe(true)
  })

  it('deselectAll clears selection', () => {
    const s1 = makeStroke({ id: 's1' })
    const { sel, onChange } = setup([s1])

    sel.selectById('s1')
    sel.deselectAll()
    expect(sel.hasSelection.value).toBe(false)
    expect(onChange).toHaveBeenLastCalledWith([])
  })

  it('selectAll selects all strokes and assets', () => {
    const s1 = makeStroke({ id: 's1' })
    const a1 = makeAsset({ id: 'a1' })
    const { sel } = setup([s1], [a1])

    sel.selectAll()
    expect(sel.selectionCount.value).toBe(2)
    expect(sel.selectedIds.value.has('s1')).toBe(true)
    expect(sel.selectedIds.value.has('a1')).toBe(true)
  })

  it('hitTest finds stroke near point', () => {
    const s1 = makeStroke({
      id: 's1',
      size: 4,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    })
    const { sel } = setup([s1])

    // Point on the line
    expect(sel.hitTest({ x: 50, y: 0 })).toBe('s1')
    // Point 2px away (within size/2 = 2)
    expect(sel.hitTest({ x: 50, y: 2 })).toBe('s1')
    // Point far away
    expect(sel.hitTest({ x: 50, y: 100 })).toBeNull()
  })

  it('hitTest finds asset by bounding box', () => {
    const a1 = makeAsset({ id: 'a1', x: 10, y: 10, w: 50, h: 50 })
    const { sel } = setup([], [a1])

    expect(sel.hitTest({ x: 30, y: 30 })).toBe('a1')
    expect(sel.hitTest({ x: 0, y: 0 })).toBeNull()
  })

  it('hitTest prefers assets over strokes (topmost)', () => {
    const s1 = makeStroke({
      id: 's1',
      size: 4,
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    })
    const a1 = makeAsset({ id: 'a1', x: 0, y: 0, w: 100, h: 100 })
    const { sel } = setup([s1], [a1])

    expect(sel.hitTest({ x: 50, y: 50 })).toBe('a1')
  })

  it('hitTest skips eraser strokes', () => {
    const s1 = makeStroke({
      id: 's1',
      tool: 'eraser',
      size: 10,
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    })
    const { sel } = setup([s1])

    expect(sel.hitTest({ x: 50, y: 0 })).toBeNull()
  })

  it('lassoSelect selects items inside polygon', () => {
    const s1 = makeStroke({
      id: 's1',
      size: 2,
      points: [{ x: 20, y: 20 }, { x: 30, y: 30 }],
    })
    const s2 = makeStroke({
      id: 's2',
      size: 2,
      points: [{ x: 200, y: 200 }, { x: 210, y: 210 }],
    })
    const { sel } = setup([s1, s2])

    // Lasso around s1 only
    const polygon: WBPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ]
    sel.lassoSelect(polygon)

    expect(sel.selectedIds.value.has('s1')).toBe(true)
    expect(sel.selectedIds.value.has('s2')).toBe(false)
  })

  it('lassoSelect skips eraser strokes', () => {
    const s1 = makeStroke({
      id: 's1',
      tool: 'eraser',
      size: 2,
      points: [{ x: 20, y: 20 }, { x: 30, y: 30 }],
    })
    const { sel } = setup([s1])

    const polygon: WBPoint[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 50 },
      { x: 0, y: 50 },
    ]
    sel.lassoSelect(polygon)
    expect(sel.selectedIds.value.has('s1')).toBe(false)
  })

  it('rectSelect selects items inside rectangle', () => {
    const s1 = makeStroke({
      id: 's1',
      size: 2,
      points: [{ x: 20, y: 20 }, { x: 30, y: 30 }],
    })
    const s2 = makeStroke({
      id: 's2',
      size: 2,
      points: [{ x: 200, y: 200 }, { x: 210, y: 210 }],
    })
    const { sel } = setup([s1, s2])

    sel.rectSelect({ x: 0, y: 0, width: 50, height: 50 })
    expect(sel.selectedIds.value.has('s1')).toBe(true)
    expect(sel.selectedIds.value.has('s2')).toBe(false)
  })

  it('selectionBounds computes combined bounds', () => {
    const s1 = makeStroke({
      id: 's1',
      size: 0,
      points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    })
    const s2 = makeStroke({
      id: 's2',
      size: 0,
      points: [{ x: 20, y: 20 }, { x: 30, y: 30 }],
    })
    const { sel } = setup([s1, s2])

    sel.selectAll()
    const bounds = sel.selectionBounds.value
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBe(0)
    expect(bounds!.y).toBe(0)
    expect(bounds!.width).toBe(30)
    expect(bounds!.height).toBe(30)
  })
})
