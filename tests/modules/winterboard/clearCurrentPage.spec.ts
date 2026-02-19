// WB5: Unit tests for boardStore.clearCurrentPage (locked items preserved)
// Ref: TASK_BOARD_V5.md A8

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import type { WBStroke, WBAsset } from '@/modules/winterboard/types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeStroke(id: string, opts?: Partial<WBStroke>): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#000',
    size: 2,
    opacity: 1,
    points: [{ x: 10, y: 20 }, { x: 30, y: 40 }],
    ...opts,
  }
}

function makeAsset(id: string, opts?: Partial<WBAsset>): WBAsset {
  return {
    id,
    type: 'image',
    src: 'test.png',
    x: 50,
    y: 60,
    w: 100,
    h: 100,
    rotation: 0,
    ...opts,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('boardStore.clearCurrentPage', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
  })

  it('removes all unlocked strokes', () => {
    store.addStroke(makeStroke('s1'))
    store.addStroke(makeStroke('s2'))
    store.undoStack = []

    store.clearCurrentPage()
    expect(store.currentPage!.strokes).toHaveLength(0)
  })

  it('removes all unlocked assets', () => {
    store.addAsset(makeAsset('a1'))
    store.addAsset(makeAsset('a2'))
    store.undoStack = []

    store.clearCurrentPage()
    expect(store.currentPage!.assets).toHaveLength(0)
  })

  it('locked strokes preserved', () => {
    store.addStroke(makeStroke('s1'))
    store.addStroke(makeStroke('s2', { locked: true, lockedBy: 'user-1' }))
    store.addStroke(makeStroke('s3'))
    store.undoStack = []

    store.clearCurrentPage()
    expect(store.currentPage!.strokes).toHaveLength(1)
    expect(store.currentPage!.strokes[0].id).toBe('s2')
  })

  it('locked assets preserved', () => {
    store.addAsset(makeAsset('a1'))
    store.addAsset(makeAsset('a2', { locked: true, lockedBy: 'user-1' }))
    store.undoStack = []

    store.clearCurrentPage()
    expect(store.currentPage!.assets).toHaveLength(1)
    expect(store.currentPage!.assets[0].id).toBe('a2')
  })

  it('selection cleared after clear', () => {
    store.addStroke(makeStroke('s1'))
    store.selectItems(['s1'])
    store.undoStack = []

    store.clearCurrentPage()
    expect(store.selectedIds).toEqual([])
  })

  it('nothing to clear (all locked) → no-op', () => {
    store.addStroke(makeStroke('s1', { locked: true }))
    store.addAsset(makeAsset('a1', { locked: true }))
    store.undoStack = []

    store.clearCurrentPage()
    expect(store.currentPage!.strokes).toHaveLength(1)
    expect(store.currentPage!.assets).toHaveLength(1)
    expect(store.undoStack).toHaveLength(0)
  })

  it('empty page → no-op', () => {
    store.undoStack = []
    store.clearCurrentPage()
    expect(store.undoStack).toHaveLength(0)
  })

  it('undo clearCurrentPage → all cleared items restored', () => {
    store.addStroke(makeStroke('s1'))
    store.addStroke(makeStroke('s2', { locked: true }))
    store.addAsset(makeAsset('a1'))
    store.undoStack = []

    store.clearCurrentPage()
    expect(store.currentPage!.strokes).toHaveLength(1) // only locked
    expect(store.currentPage!.assets).toHaveLength(0)

    store.undo()
    expect(store.currentPage!.strokes).toHaveLength(2) // locked + restored
    expect(store.currentPage!.assets).toHaveLength(1)
    expect(store.currentPage!.strokes.find((s) => s.id === 's1')).toBeDefined()
  })

  it('redo clearCurrentPage → items removed again', () => {
    store.addStroke(makeStroke('s1'))
    store.addStroke(makeStroke('s2', { locked: true }))
    store.undoStack = []

    store.clearCurrentPage()
    store.undo()
    expect(store.currentPage!.strokes).toHaveLength(2)

    store.redo()
    expect(store.currentPage!.strokes).toHaveLength(1)
    expect(store.currentPage!.strokes[0].id).toBe('s2')
  })

  it('mixed strokes and assets — only unlocked removed', () => {
    store.addStroke(makeStroke('s1'))
    store.addStroke(makeStroke('s2', { locked: true }))
    store.addAsset(makeAsset('a1', { locked: true }))
    store.addAsset(makeAsset('a2'))
    store.undoStack = []

    store.clearCurrentPage()
    expect(store.currentPage!.strokes).toHaveLength(1)
    expect(store.currentPage!.strokes[0].id).toBe('s2')
    expect(store.currentPage!.assets).toHaveLength(1)
    expect(store.currentPage!.assets[0].id).toBe('a1')
  })
})

describe('boardStore.handleRemotePageClear', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
  })

  it('removes unlocked items from specified page', () => {
    const pageId = store.pages[0].id
    store.addStroke(makeStroke('s1'))
    store.addStroke(makeStroke('s2', { locked: true }))
    store.addAsset(makeAsset('a1'))

    store.handleRemotePageClear(pageId)
    expect(store.currentPage!.strokes).toHaveLength(1)
    expect(store.currentPage!.strokes[0].id).toBe('s2')
    expect(store.currentPage!.assets).toHaveLength(0)
  })

  it('unknown page ID → no-op', () => {
    store.addStroke(makeStroke('s1'))
    store.handleRemotePageClear('unknown-page-id')
    expect(store.currentPage!.strokes).toHaveLength(1)
  })
})
