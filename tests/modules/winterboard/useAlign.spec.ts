// WB5: Unit tests for useAlign composable + boardStore.applyAlign
// Ref: TASK_BOARD_V5.md A6

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { useAlign } from '@/modules/winterboard/composables/useAlign'
import type { WBStroke, WBAsset } from '@/modules/winterboard/types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStroke(id: string, points: Array<{ x: number; y: number }>, opts?: Partial<WBStroke>): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: points.map((p) => ({ x: p.x, y: p.y })),
    ...opts,
  }
}

function makeAsset(id: string, x: number, y: number, w = 100, h = 100, opts?: Partial<WBAsset>): WBAsset {
  return {
    id,
    type: 'image',
    src: 'test.png',
    x,
    y,
    w,
    h,
    rotation: 0,
    ...opts,
  }
}

function getStrokeMinX(store: ReturnType<typeof useWBStore>, id: string): number {
  const s = store.currentPage!.strokes.find((s) => s.id === id)!
  return Math.min(...s.points.map((p) => p.x))
}

function getStrokeMinY(store: ReturnType<typeof useWBStore>, id: string): number {
  const s = store.currentPage!.strokes.find((s) => s.id === id)!
  return Math.min(...s.points.map((p) => p.y))
}

function getStrokeMaxX(store: ReturnType<typeof useWBStore>, id: string): number {
  const s = store.currentPage!.strokes.find((s) => s.id === id)!
  return Math.max(...s.points.map((p) => p.x))
}

function getStrokeMaxY(store: ReturnType<typeof useWBStore>, id: string): number {
  const s = store.currentPage!.strokes.find((s) => s.id === id)!
  return Math.max(...s.points.map((p) => p.y))
}

// ─── getBBox tests ───────────────────────────────────────────────────────────

describe('useAlign — getBBox', () => {
  let store: ReturnType<typeof useWBStore>
  let align: ReturnType<typeof useAlign>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    align = useAlign(store)
  })

  it('getBBox stroke → correct bounding box from points', () => {
    const s = makeStroke('s1', [
      { x: 10, y: 20 },
      { x: 50, y: 80 },
      { x: 30, y: 40 },
    ])
    const bbox = align.getBBox(s)
    expect(bbox.id).toBe('s1')
    expect(bbox.x).toBe(10)
    expect(bbox.y).toBe(20)
    expect(bbox.width).toBe(40) // 50 - 10
    expect(bbox.height).toBe(60) // 80 - 20
    expect(bbox.right).toBe(50)
    expect(bbox.bottom).toBe(80)
    expect(bbox.centerX).toBe(30) // 10 + 40/2
    expect(bbox.centerY).toBe(50) // 20 + 60/2
  })

  it('getBBox asset → correct bounding box from x,y,w,h', () => {
    const a = makeAsset('a1', 100, 200, 50, 80)
    const bbox = align.getBBox(a)
    expect(bbox.id).toBe('a1')
    expect(bbox.x).toBe(100)
    expect(bbox.y).toBe(200)
    expect(bbox.width).toBe(50)
    expect(bbox.height).toBe(80)
    expect(bbox.right).toBe(150)
    expect(bbox.bottom).toBe(280)
    expect(bbox.centerX).toBe(125)
    expect(bbox.centerY).toBe(240)
  })

  it('getBBox stroke with empty points → zero bbox', () => {
    const s = makeStroke('s1', [])
    const bbox = align.getBBox(s)
    expect(bbox.width).toBe(0)
    expect(bbox.height).toBe(0)
  })
})

// ─── Alignment tests ─────────────────────────────────────────────────────────

describe('useAlign — alignment', () => {
  let store: ReturnType<typeof useWBStore>
  let align: ReturnType<typeof useAlign>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    align = useAlign(store)
  })

  it('canAlign is false for 0-1 items', () => {
    expect(align.canAlign.value).toBe(false)
    store.addStroke(makeStroke('s1', [{ x: 10, y: 20 }]))
    store.selectItems(['s1'])
    expect(align.canAlign.value).toBe(false)
  })

  it('canAlign is true for 2+ items', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 60 }]))
    store.selectItems(['s1', 's2'])
    expect(align.canAlign.value).toBe(true)
  })

  it('canDistribute is false for 0-2 items', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 60 }]))
    store.selectItems(['s1', 's2'])
    expect(align.canDistribute.value).toBe(false)
  })

  it('canDistribute is true for 3+ items', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 60 }]))
    store.addStroke(makeStroke('s3', [{ x: 90, y: 100 }]))
    store.selectItems(['s1', 's2', 's3'])
    expect(align.canDistribute.value).toBe(true)
  })

  it('alignLeft → all items left edge = min X', () => {
    // s1 starts at x=10, s2 starts at x=50
    store.addStroke(makeStroke('s1', [{ x: 10, y: 0 }, { x: 30, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 0 }, { x: 70, y: 20 }]))
    store.selectItems(['s1', 's2'])
    store.undoStack = []

    align.alignLeft()

    // Both should have left edge at x=10
    expect(getStrokeMinX(store, 's1')).toBe(10)
    expect(getStrokeMinX(store, 's2')).toBe(10)
  })

  it('alignRight → all items right edge = max right', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 0 }, { x: 30, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 0 }, { x: 70, y: 20 }]))
    store.selectItems(['s1', 's2'])
    store.undoStack = []

    align.alignRight()

    // Both should have right edge at x=70
    expect(getStrokeMaxX(store, 's1')).toBe(70)
    expect(getStrokeMaxX(store, 's2')).toBe(70)
  })

  it('alignTop → all items top edge = min Y', () => {
    store.addStroke(makeStroke('s1', [{ x: 0, y: 10 }, { x: 20, y: 30 }]))
    store.addStroke(makeStroke('s2', [{ x: 0, y: 50 }, { x: 20, y: 70 }]))
    store.selectItems(['s1', 's2'])
    store.undoStack = []

    align.alignTop()

    expect(getStrokeMinY(store, 's1')).toBe(10)
    expect(getStrokeMinY(store, 's2')).toBe(10)
  })

  it('alignBottom → all items bottom edge = max bottom', () => {
    store.addStroke(makeStroke('s1', [{ x: 0, y: 10 }, { x: 20, y: 30 }]))
    store.addStroke(makeStroke('s2', [{ x: 0, y: 50 }, { x: 20, y: 70 }]))
    store.selectItems(['s1', 's2'])
    store.undoStack = []

    align.alignBottom()

    expect(getStrokeMaxY(store, 's1')).toBe(70)
    expect(getStrokeMaxY(store, 's2')).toBe(70)
  })

  it('alignCenter → all items center X = combined center', () => {
    // s1: x=[10,30], center=20. s2: x=[50,70], center=60
    // Combined: min=10, max=70, center=40
    store.addStroke(makeStroke('s1', [{ x: 10, y: 0 }, { x: 30, y: 0 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 0 }, { x: 70, y: 0 }]))
    store.selectItems(['s1', 's2'])
    store.undoStack = []

    align.alignCenter()

    // s1 center should be 40: points at [30, 50]
    const s1 = store.currentPage!.strokes.find((s) => s.id === 's1')!
    const s1CenterX = (Math.min(...s1.points.map((p) => p.x)) + Math.max(...s1.points.map((p) => p.x))) / 2
    expect(s1CenterX).toBe(40)

    // s2 center should be 40: points at [30, 50]
    const s2 = store.currentPage!.strokes.find((s) => s.id === 's2')!
    const s2CenterX = (Math.min(...s2.points.map((p) => p.x)) + Math.max(...s2.points.map((p) => p.x))) / 2
    expect(s2CenterX).toBe(40)
  })

  it('alignMiddle → all items center Y = combined center', () => {
    // s1: y=[10,30], center=20. s2: y=[50,70], center=60
    // Combined: min=10, max=70, center=40
    store.addStroke(makeStroke('s1', [{ x: 0, y: 10 }, { x: 0, y: 30 }]))
    store.addStroke(makeStroke('s2', [{ x: 0, y: 50 }, { x: 0, y: 70 }]))
    store.selectItems(['s1', 's2'])
    store.undoStack = []

    align.alignMiddle()

    const s1 = store.currentPage!.strokes.find((s) => s.id === 's1')!
    const s1CenterY = (Math.min(...s1.points.map((p) => p.y)) + Math.max(...s1.points.map((p) => p.y))) / 2
    expect(s1CenterY).toBe(40)
  })

  it('align with locked items → locked items not moved', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 0 }, { x: 30, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 0 }, { x: 70, y: 20 }], { locked: true, lockedBy: 'user-1' }))
    store.selectItems(['s1', 's2'])
    store.undoStack = []

    align.alignLeft()

    // s1 should move to x=10 (already there)
    expect(getStrokeMinX(store, 's1')).toBe(10)
    // s2 should NOT move (locked)
    expect(getStrokeMinX(store, 's2')).toBe(50)
  })

  it('single item → no-op (canAlign=false, no store changes)', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 20 }]))
    store.selectItems(['s1'])
    store.undoStack = []

    align.alignLeft()

    expect(store.undoStack).toHaveLength(0)
    expect(getStrokeMinX(store, 's1')).toBe(10)
  })

  it('alignLeft works with assets', () => {
    store.addAsset(makeAsset('a1', 100, 0, 50, 50))
    store.addAsset(makeAsset('a2', 200, 0, 50, 50))
    store.selectItems(['a1', 'a2'])
    store.undoStack = []

    align.alignLeft()

    const a1 = store.currentPage!.assets.find((a) => a.id === 'a1')!
    const a2 = store.currentPage!.assets.find((a) => a.id === 'a2')!
    expect(a1.x).toBe(100)
    expect(a2.x).toBe(100)
  })
})

// ─── Distribution tests ──────────────────────────────────────────────────────

describe('useAlign — distribution', () => {
  let store: ReturnType<typeof useWBStore>
  let align: ReturnType<typeof useAlign>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    align = useAlign(store)
  })

  it('distributeHorizontal → equal gaps between items', () => {
    // 3 items: widths 20, 20, 20. Span from x=0 to x=120 (right=140)
    // Total width = 140, item widths = 60, gap space = 80, gap = 40
    store.addStroke(makeStroke('s1', [{ x: 0, y: 0 }, { x: 20, y: 0 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 0 }, { x: 70, y: 0 }]))
    store.addStroke(makeStroke('s3', [{ x: 120, y: 0 }, { x: 140, y: 0 }]))
    store.selectItems(['s1', 's2', 's3'])
    store.undoStack = []

    align.distributeHorizontal()

    // s1 stays at x=0 (leftmost)
    expect(getStrokeMinX(store, 's1')).toBe(0)
    // s3 stays at x=120 (rightmost)
    expect(getStrokeMinX(store, 's3')).toBe(120)
    // s2 should be at x=60 (0 + 20 + 40 = 60)
    expect(getStrokeMinX(store, 's2')).toBe(60)
  })

  it('distributeVertical → equal gaps between items', () => {
    store.addStroke(makeStroke('s1', [{ x: 0, y: 0 }, { x: 0, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 0, y: 50 }, { x: 0, y: 70 }]))
    store.addStroke(makeStroke('s3', [{ x: 0, y: 120 }, { x: 0, y: 140 }]))
    store.selectItems(['s1', 's2', 's3'])
    store.undoStack = []

    align.distributeVertical()

    expect(getStrokeMinY(store, 's1')).toBe(0)
    expect(getStrokeMinY(store, 's3')).toBe(120)
    expect(getStrokeMinY(store, 's2')).toBe(60)
  })

  it('distribute with < 3 items → no-op', () => {
    store.addStroke(makeStroke('s1', [{ x: 0, y: 0 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 0 }]))
    store.selectItems(['s1', 's2'])
    store.undoStack = []

    align.distributeHorizontal()
    expect(store.undoStack).toHaveLength(0)
  })
})

// ─── Undo/Redo tests ─────────────────────────────────────────────────────────

describe('boardStore.applyAlign — undo/redo', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
  })

  it('undo align → items return to previous positions', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 0 }, { x: 30, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 50, y: 0 }, { x: 70, y: 20 }]))
    store.undoStack = []

    // Apply align: move s2 left by -40
    store.applyAlign([{ id: 's2', dx: -40, dy: 0 }])
    expect(getStrokeMinX(store, 's2')).toBe(10)

    store.undo()
    expect(getStrokeMinX(store, 's2')).toBe(50) // back to original
  })

  it('redo align → re-applies moves', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 0 }, { x: 30, y: 20 }]))
    store.undoStack = []

    store.applyAlign([{ id: 's1', dx: 100, dy: 50 }])
    expect(getStrokeMinX(store, 's1')).toBe(110)

    store.undo()
    expect(getStrokeMinX(store, 's1')).toBe(10)

    store.redo()
    expect(getStrokeMinX(store, 's1')).toBe(110)
  })

  it('applyAlign skips locked items', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 0 }], { locked: true }))
    store.undoStack = []

    store.applyAlign([{ id: 's1', dx: 100, dy: 0 }])
    expect(getStrokeMinX(store, 's1')).toBe(10) // not moved
    expect(store.undoStack).toHaveLength(0) // no undo action
  })

  it('applyAlign skips zero-delta moves', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 0 }]))
    store.undoStack = []

    store.applyAlign([{ id: 's1', dx: 0, dy: 0 }])
    expect(store.undoStack).toHaveLength(0)
  })

  it('undo/redo align works with assets', () => {
    store.addAsset(makeAsset('a1', 100, 200))
    store.undoStack = []

    store.applyAlign([{ id: 'a1', dx: -50, dy: 30 }])
    expect(store.currentPage!.assets[0].x).toBe(50)
    expect(store.currentPage!.assets[0].y).toBe(230)

    store.undo()
    expect(store.currentPage!.assets[0].x).toBe(100)
    expect(store.currentPage!.assets[0].y).toBe(200)
  })
})

