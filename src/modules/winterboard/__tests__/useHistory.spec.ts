// WB: Unit tests for useHistory composable
// Ref: TASK_BOARD.md B1.1, ManifestWinterboard_v2.md LAW-19

import { describe, it, expect, beforeEach } from 'vitest'
import { useHistory } from '../composables/useHistory'
import type { WBStroke, WBAsset } from '../types/winterboard'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStroke(id: string, overrides: Partial<WBStroke> = {}): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#000000',
    size: 2,
    opacity: 1,
    points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
    ...overrides,
  }
}

function makeAsset(id: string): WBAsset {
  return {
    id,
    type: 'image',
    src: 'https://example.com/img.png',
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    rotation: 0,
  }
}

const PAGE_ID = 'page-1'

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useHistory', () => {
  let history: ReturnType<typeof useHistory>

  beforeEach(() => {
    history = useHistory()
  })

  // ── Initial state ───────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty stacks', () => {
      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(false)
      expect(history.historyLength.value).toBe(0)
    })
  })

  // ── recordAdd + undo/redo ─────────────────────────────────────────────

  describe('recordAdd → undo → redo (stroke)', () => {
    it('records add-stroke and allows undo', () => {
      const stroke = makeStroke('s1')
      history.recordAdd(PAGE_ID, stroke, 'stroke')

      expect(history.canUndo.value).toBe(true)
      expect(history.canRedo.value).toBe(false)
      expect(history.historyLength.value).toBe(1)

      const entry = history.undo()
      expect(entry).not.toBeNull()
      expect(entry!.type).toBe('add-stroke')
      expect(entry!.itemId).toBe('s1')
      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(true)
    })

    it('redo restores the entry', () => {
      history.recordAdd(PAGE_ID, makeStroke('s1'), 'stroke')
      history.undo()

      const entry = history.redo()
      expect(entry).not.toBeNull()
      expect(entry!.type).toBe('add-stroke')
      expect(history.canUndo.value).toBe(true)
      expect(history.canRedo.value).toBe(false)
    })
  })

  // ── recordRemove ──────────────────────────────────────────────────────

  describe('recordRemove', () => {
    it('records remove-stroke', () => {
      const stroke = makeStroke('s2')
      history.recordRemove(PAGE_ID, stroke, 'stroke')

      const entry = history.undo()
      expect(entry!.type).toBe('remove-stroke')
      expect(entry!.item).toBeDefined()
    })

    it('records remove-asset', () => {
      const asset = makeAsset('a1')
      history.recordRemove(PAGE_ID, asset, 'asset')

      const entry = history.undo()
      expect(entry!.type).toBe('remove-asset')
    })
  })

  // ── recordUpdate ──────────────────────────────────────────────────────

  describe('recordUpdate', () => {
    it('stores before/after snapshots', () => {
      history.recordUpdate(
        PAGE_ID,
        's1',
        { x: 0, y: 0 },
        { x: 50, y: 50 },
        'stroke',
      )

      const entry = history.undo()
      expect(entry!.type).toBe('update-stroke')
      expect(entry!.before).toEqual({ x: 0, y: 0 })
      expect(entry!.after).toEqual({ x: 50, y: 50 })
    })
  })

  // ── recordClearPage ───────────────────────────────────────────────────

  describe('recordClearPage', () => {
    it('stores all cleared items for restore', () => {
      const strokes = [makeStroke('s1'), makeStroke('s2')]
      const assets = [makeAsset('a1')]
      history.recordClearPage(PAGE_ID, strokes, assets)

      const entry = history.undo()
      expect(entry!.type).toBe('clear-page')
      expect(entry!.clearedStrokes).toHaveLength(2)
      expect(entry!.clearedAssets).toHaveLength(1)
    })
  })

  // ── New action clears redo stack ──────────────────────────────────────

  describe('redo invalidation', () => {
    it('new action after undo clears redo stack', () => {
      history.recordAdd(PAGE_ID, makeStroke('s1'))
      history.recordAdd(PAGE_ID, makeStroke('s2'))
      history.undo()
      expect(history.canRedo.value).toBe(true)

      // New action should clear redo
      history.recordAdd(PAGE_ID, makeStroke('s3'))
      expect(history.canRedo.value).toBe(false)
    })
  })

  // ── Max size trimming ─────────────────────────────────────────────────

  describe('max size', () => {
    it('trims undo stack to maxSize', () => {
      const h = useHistory({ maxSize: 5 })
      for (let i = 0; i < 10; i++) {
        h.recordAdd(PAGE_ID, makeStroke(`s${i}`))
      }
      expect(h.historyLength.value).toBe(5)
      // Oldest entries should be dropped (FIFO per LAW-19)
      const entry = h.undo()
      expect(entry!.itemId).toBe('s9') // most recent
    })
  })

  // ── Batch operations ──────────────────────────────────────────────────

  describe('batch', () => {
    it('groups multiple actions into one undo step', () => {
      history.startBatch()
      history.recordAdd(PAGE_ID, makeStroke('s1'))
      history.recordAdd(PAGE_ID, makeStroke('s2'))
      history.recordAdd(PAGE_ID, makeStroke('s3'))
      history.endBatch()

      expect(history.historyLength.value).toBe(1)

      const entry = history.undo()
      expect(entry!.type).toBe('batch')
      expect(entry!.batch).toHaveLength(3)
    })

    it('cancelBatch discards pending entries', () => {
      history.startBatch()
      history.recordAdd(PAGE_ID, makeStroke('s1'))
      history.cancelBatch()

      expect(history.historyLength.value).toBe(0)
    })

    it('endBatch with no entries is a no-op', () => {
      history.startBatch()
      history.endBatch()
      expect(history.historyLength.value).toBe(0)
    })

    it('nested startBatch warns and is ignored', () => {
      history.startBatch()
      // Second startBatch should be ignored (no crash)
      history.startBatch()
      history.recordAdd(PAGE_ID, makeStroke('s1'))
      history.endBatch()
      expect(history.historyLength.value).toBe(1)
    })
  })

  // ── Deep clone safety ─────────────────────────────────────────────────

  describe('immutability', () => {
    it('recorded items are deep-cloned (mutation-safe)', () => {
      const stroke = makeStroke('s1')
      history.recordAdd(PAGE_ID, stroke)

      // Mutate original
      stroke.color = '#ff0000'
      stroke.points.push({ x: 99, y: 99 })

      const entry = history.undo()
      const recorded = entry!.item as WBStroke
      expect(recorded.color).toBe('#000000')
      expect(recorded.points).toHaveLength(2)
    })
  })

  // ── clear ─────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('resets all stacks', () => {
      history.recordAdd(PAGE_ID, makeStroke('s1'))
      history.undo()
      history.clear()

      expect(history.canUndo.value).toBe(false)
      expect(history.canRedo.value).toBe(false)
      expect(history.historyLength.value).toBe(0)
    })
  })

  // ── getSummary ────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('returns correct counts and type breakdown', () => {
      history.recordAdd(PAGE_ID, makeStroke('s1'))
      history.recordAdd(PAGE_ID, makeStroke('s2'))
      history.recordRemove(PAGE_ID, makeStroke('s3'))

      const summary = history.getSummary()
      expect(summary.undoCount).toBe(3)
      expect(summary.redoCount).toBe(0)
      expect(summary.types['add-stroke']).toBe(2)
      expect(summary.types['remove-stroke']).toBe(1)
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('undo on empty stack returns null', () => {
      expect(history.undo()).toBeNull()
    })

    it('redo on empty stack returns null', () => {
      expect(history.redo()).toBeNull()
    })

    it('multiple undo/redo cycles are consistent', () => {
      history.recordAdd(PAGE_ID, makeStroke('s1'))
      history.recordAdd(PAGE_ID, makeStroke('s2'))

      // Undo both
      const e2 = history.undo()
      const e1 = history.undo()
      expect(e2!.itemId).toBe('s2')
      expect(e1!.itemId).toBe('s1')

      // Redo both
      const r1 = history.redo()
      const r2 = history.redo()
      expect(r1!.itemId).toBe('s1')
      expect(r2!.itemId).toBe('s2')

      expect(history.historyLength.value).toBe(2)
      expect(history.canRedo.value).toBe(false)
    })
  })
})
