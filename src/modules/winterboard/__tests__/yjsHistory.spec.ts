// WB: Unit tests for Yjs History / UndoManager (Phase 6: A6.3)
// Tests: undo/redo, per-user tracking, keyboard shortcuts, clear, destroy, fallback

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Y from 'yjs'
import {
  createWBDocument,
  getPages,
  addPage,
  addStroke,
  removeStroke,
  readPageStrokes,
  getPageCount,
} from '../engine/collaboration/yjsDocument'
import { useYjsHistory } from '../composables/useYjsHistory'
import type { WBPage, WBStroke } from '../types/winterboard'

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makePage(id = 'p1'): WBPage {
  return { id, name: 'Page 1', strokes: [], assets: [], background: 'white' }
}

function makeStroke(id = 's1'): WBStroke {
  return {
    id,
    tool: 'pen',
    color: '#ff0000',
    size: 3,
    opacity: 1,
    points: [{ x: 10, y: 20, pressure: 0.5 }],
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Yjs History / UndoManager (A6.3)', () => {
  let doc: Y.Doc

  beforeEach(() => {
    doc = createWBDocument()
    // Seed with one page so strokes can be added
    addPage(doc, makePage('p1'), 'init')
  })

  afterEach(() => {
    doc.destroy()
  })

  // ── Basic undo/redo ───────────────────────────────────────────────────

  describe('Basic undo/redo', () => {
    it('starts with canUndo=false, canRedo=false', () => {
      const { canUndo, canRedo, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(false)

      destroy()
    })

    it('undo reverses a stroke addition', () => {
      const { canUndo, undo, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      // Add stroke with tracked origin
      addStroke(doc, 0, makeStroke('s1'), 'user-1')

      expect(canUndo.value).toBe(true)
      expect(readPageStrokes(doc, 0)).toHaveLength(1)

      undo()

      expect(readPageStrokes(doc, 0)).toHaveLength(0)
      expect(canUndo.value).toBe(false)

      destroy()
    })

    it('redo re-applies undone stroke', () => {
      const { undo, redo, canRedo, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')
      undo()

      expect(canRedo.value).toBe(true)
      expect(readPageStrokes(doc, 0)).toHaveLength(0)

      redo()

      expect(readPageStrokes(doc, 0)).toHaveLength(1)
      expect(readPageStrokes(doc, 0)[0].id).toBe('s1')
      expect(canRedo.value).toBe(false)

      destroy()
    })

    it('multiple undo steps', () => {
      const { undo, undoCount, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
        captureTimeout: 0, // No grouping — each change is separate
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')
      addStroke(doc, 0, makeStroke('s2'), 'user-1')
      addStroke(doc, 0, makeStroke('s3'), 'user-1')

      expect(readPageStrokes(doc, 0)).toHaveLength(3)
      expect(undoCount.value).toBe(3)

      undo()
      expect(readPageStrokes(doc, 0)).toHaveLength(2)

      undo()
      expect(readPageStrokes(doc, 0)).toHaveLength(1)

      undo()
      expect(readPageStrokes(doc, 0)).toHaveLength(0)

      destroy()
    })
  })

  // ── Per-user tracking ─────────────────────────────────────────────────

  describe('Per-user tracking', () => {
    it('only tracks changes from specified origin', () => {
      const { canUndo, undo, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      // Change from different user — NOT tracked
      addStroke(doc, 0, makeStroke('s-other'), 'user-2')

      expect(canUndo.value).toBe(false)

      // Change from tracked user
      addStroke(doc, 0, makeStroke('s-mine'), 'user-1')

      expect(canUndo.value).toBe(true)

      // Undo only removes user-1's stroke
      undo()

      const strokes = readPageStrokes(doc, 0)
      expect(strokes).toHaveLength(1)
      expect(strokes[0].id).toBe('s-other') // user-2's stroke remains

      destroy()
    })

    it('two users have independent undo stacks', () => {
      const history1 = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      const history2 = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-2']),
        enableKeyboard: false,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')
      addStroke(doc, 0, makeStroke('s2'), 'user-2')

      expect(history1.canUndo.value).toBe(true)
      expect(history2.canUndo.value).toBe(true)

      // User 1 undoes — only their stroke removed
      history1.undo()

      const strokes = readPageStrokes(doc, 0)
      expect(strokes).toHaveLength(1)
      expect(strokes[0].id).toBe('s2')

      history1.destroy()
      history2.destroy()
    })
  })

  // ── Stroke removal undo ───────────────────────────────────────────────

  describe('Stroke removal undo', () => {
    it('undo of removeStroke restores the stroke', () => {
      const { undo, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      // Add stroke (not tracked — from init)
      addStroke(doc, 0, makeStroke('s1'), 'init')

      // Remove stroke (tracked)
      removeStroke(doc, 0, 's1', 'user-1')
      expect(readPageStrokes(doc, 0)).toHaveLength(0)

      // Undo restores
      undo()
      expect(readPageStrokes(doc, 0)).toHaveLength(1)
      expect(readPageStrokes(doc, 0)[0].id).toBe('s1')

      destroy()
    })
  })

  // ── Clear ─────────────────────────────────────────────────────────────

  describe('Clear', () => {
    it('clear removes all undo/redo history', () => {
      const { canUndo, canRedo, undoCount, redoCount, undo, clear, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')
      undo()

      expect(canRedo.value).toBe(true)

      clear()

      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(false)
      expect(undoCount.value).toBe(0)
      expect(redoCount.value).toBe(0)

      destroy()
    })
  })

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  describe('Keyboard shortcuts', () => {
    it('Ctrl+Z triggers undo', () => {
      const { destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: true,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')
      expect(readPageStrokes(doc, 0)).toHaveLength(1)

      // Simulate Ctrl+Z
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(event)

      expect(readPageStrokes(doc, 0)).toHaveLength(0)

      destroy()
    })

    it('Ctrl+Shift+Z triggers redo', () => {
      const { undo, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: true,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')
      undo()
      expect(readPageStrokes(doc, 0)).toHaveLength(0)

      // Simulate Ctrl+Shift+Z
      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(event)

      expect(readPageStrokes(doc, 0)).toHaveLength(1)

      destroy()
    })

    it('ignores keyboard when enableKeyboard=false', () => {
      const { destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      window.dispatchEvent(event)

      // Stroke should still be there
      expect(readPageStrokes(doc, 0)).toHaveLength(1)

      destroy()
    })

    it('ignores keyboard when target is input', () => {
      const { destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: true,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')

      const input = document.createElement('input')
      document.body.appendChild(input)

      const event = new KeyboardEvent('keydown', {
        key: 'z',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(event, 'target', { value: input })
      window.dispatchEvent(event)

      // Stroke should still be there (keyboard ignored in input)
      expect(readPageStrokes(doc, 0)).toHaveLength(1)

      document.body.removeChild(input)
      destroy()
    })
  })

  // ── Destroy ───────────────────────────────────────────────────────────

  describe('Destroy', () => {
    it('after destroy, undo/redo are no-ops', () => {
      const { undo, redo, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')
      destroy()

      // Should not throw and should not change state
      undo()
      redo()

      expect(readPageStrokes(doc, 0)).toHaveLength(1)
    })

    it('after destroy, canUndo/canRedo are false', () => {
      const { canUndo, canRedo, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      addStroke(doc, 0, makeStroke('s1'), 'user-1')
      expect(canUndo.value).toBe(true)

      destroy()

      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(false)
    })

    it('removes keyboard listener on destroy', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      const { destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: true,
      })

      destroy()

      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function), { capture: true })

      removeSpy.mockRestore()
    })
  })

  // ── UndoManager instance ──────────────────────────────────────────────

  describe('UndoManager instance', () => {
    it('exposes undoManager for advanced use', () => {
      const { undoManager, destroy } = useYjsHistory(doc, {
        trackedOrigins: new Set(['user-1']),
        enableKeyboard: false,
      })

      expect(undoManager).toBeInstanceOf(Y.UndoManager)

      destroy()
    })
  })
})
