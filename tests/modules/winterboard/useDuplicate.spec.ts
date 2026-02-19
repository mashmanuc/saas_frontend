// WB5: Unit tests for useDuplicate composable + boardStore.duplicateSelected
// Ref: TASK_BOARD_V5.md A5

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { useDuplicate } from '@/modules/winterboard/composables/useDuplicate'
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useDuplicate composable', () => {
  let store: ReturnType<typeof useWBStore>
  let dup: ReturnType<typeof useDuplicate>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    dup = useDuplicate(store)
  })

  it('canDuplicate is false when nothing selected', () => {
    expect(dup.canDuplicate.value).toBe(false)
  })

  it('canDuplicate is true when items selected', () => {
    const s = makeStroke('s1', [{ x: 10, y: 20 }])
    store.addStroke(s)
    store.selectItems(['s1'])
    expect(dup.canDuplicate.value).toBe(true)
  })

  it('duplicateSelected returns [] when nothing selected', () => {
    const result = dup.duplicateSelected()
    expect(result).toEqual([])
  })
})

describe('boardStore.duplicateSelected', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
  })

  it('creates clones with new IDs', () => {
    const s = makeStroke('s1', [{ x: 10, y: 20 }])
    store.addStroke(s)
    store.selectItems(['s1'])

    const newIds = store.duplicateSelected()
    expect(newIds).toHaveLength(1)
    expect(newIds[0]).not.toBe('s1')

    const page = store.currentPage!
    expect(page.strokes).toHaveLength(2)
    expect(page.strokes[1].id).toBe(newIds[0])
  })

  it('offsets cloned stroke points by +20px', () => {
    const s = makeStroke('s1', [{ x: 100, y: 200 }, { x: 150, y: 250 }])
    store.addStroke(s)
    store.selectItems(['s1'])

    store.duplicateSelected()
    const clone = store.currentPage!.strokes[1]
    expect(clone.points[0].x).toBe(120)
    expect(clone.points[0].y).toBe(220)
    expect(clone.points[1].x).toBe(170)
    expect(clone.points[1].y).toBe(270)
  })

  it('offsets cloned asset position by +20px', () => {
    const a = makeAsset('a1', 50, 60)
    store.addAsset(a)
    store.selectItems(['a1'])

    store.duplicateSelected()
    const clone = store.currentPage!.assets[1]
    expect(clone.x).toBe(70)
    expect(clone.y).toBe(80)
  })

  it('clones are unlocked even if originals are locked', () => {
    const s = makeStroke('s1', [{ x: 10, y: 20 }], { locked: true, lockedBy: 'user-1' })
    store.addStroke(s)
    store.selectItems(['s1'])

    store.duplicateSelected()
    const clone = store.currentPage!.strokes[1]
    expect(clone.locked).toBe(false)
    expect(clone.lockedBy).toBeUndefined()
  })

  it('selects new items after duplicate (originals deselected)', () => {
    const s = makeStroke('s1', [{ x: 10, y: 20 }])
    store.addStroke(s)
    store.selectItems(['s1'])

    const newIds = store.duplicateSelected()
    expect(store.selectedIds).toEqual(newIds)
    expect(store.selectedIds).not.toContain('s1')
  })

  it('duplicates multiple strokes and assets', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 20 }]))
    store.addStroke(makeStroke('s2', [{ x: 30, y: 40 }]))
    store.addAsset(makeAsset('a1', 50, 60))
    store.selectItems(['s1', 's2', 'a1'])

    const newIds = store.duplicateSelected()
    expect(newIds).toHaveLength(3)

    const page = store.currentPage!
    expect(page.strokes).toHaveLength(4) // 2 original + 2 cloned
    expect(page.assets).toHaveLength(2)  // 1 original + 1 cloned
  })

  it('undo duplicate removes clones and re-selects originals', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 20 }]))
    store.selectItems(['s1'])
    // Clear undo stack from addStroke
    store.undoStack = []

    const newIds = store.duplicateSelected()
    expect(store.currentPage!.strokes).toHaveLength(2)
    expect(store.selectedIds).toEqual(newIds)

    store.undo()
    expect(store.currentPage!.strokes).toHaveLength(1)
    expect(store.currentPage!.strokes[0].id).toBe('s1')
    expect(store.selectedIds).toEqual(['s1'])
  })

  it('redo duplicate re-adds clones and selects them', () => {
    store.addStroke(makeStroke('s1', [{ x: 10, y: 20 }]))
    store.selectItems(['s1'])
    store.undoStack = []

    const newIds = store.duplicateSelected()
    store.undo()
    expect(store.currentPage!.strokes).toHaveLength(1)

    store.redo()
    expect(store.currentPage!.strokes).toHaveLength(2)
    expect(store.selectedIds).toEqual(newIds)
  })

  it('empty selection returns []', () => {
    store.selectItems([])
    const result = store.duplicateSelected()
    expect(result).toEqual([])
    expect(store.undoStack).toHaveLength(0)
  })
})
