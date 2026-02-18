// WB: Unit tests for useKeyboard composable
// Ref: TASK_BOARD.md B1.2, ManifestWinterboard_v2.md LAW-21

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useKeyboard, TOOL_KEY_MAP } from '../composables/useKeyboard'
import type { UseKeyboardCallbacks } from '../composables/useKeyboard'
import type { WBToolType } from '../types/winterboard'

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Create a synthetic KeyboardEvent with sensible defaults */
function makeKeyEvent(
  code: string,
  overrides: Partial<KeyboardEvent> = {},
): KeyboardEvent {
  const key = overrides.key ?? code.replace('Key', '').replace('Digit', '')
  return new KeyboardEvent('keydown', {
    code,
    key,
    bubbles: true,
    cancelable: true,
    ...overrides,
  })
}

/** Create event with Ctrl modifier */
function ctrlKey(code: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return makeKeyEvent(code, { ctrlKey: true, ...extra })
}

/** Create event with Ctrl+Shift modifier */
function ctrlShiftKey(code: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return makeKeyEvent(code, { ctrlKey: true, shiftKey: true, ...extra })
}

/** Simulate event coming from an input element */
function fromInput(event: KeyboardEvent): KeyboardEvent {
  Object.defineProperty(event, 'target', {
    value: document.createElement('input'),
    writable: false,
  })
  return event
}

/** Simulate event coming from a textarea element */
function fromTextarea(event: KeyboardEvent): KeyboardEvent {
  Object.defineProperty(event, 'target', {
    value: document.createElement('textarea'),
    writable: false,
  })
  return event
}

/** Simulate event coming from a contenteditable div */
function fromContentEditable(event: KeyboardEvent): KeyboardEvent {
  const div = document.createElement('div')
  div.setAttribute('contenteditable', 'true')
  div.contentEditable = 'true'
  Object.defineProperty(event, 'target', {
    value: div,
    writable: false,
  })
  return event
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useKeyboard', () => {
  let callbacks: UseKeyboardCallbacks & Record<string, ReturnType<typeof vi.fn>>
  let handler: (e: KeyboardEvent) => void

  beforeEach(() => {
    callbacks = {
      onToolChange: vi.fn(),
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onDelete: vi.fn(),
      onSelectAll: vi.fn(),
      onCopy: vi.fn(),
      onPaste: vi.fn(),
      onCut: vi.fn(),
      onEscape: vi.fn(),
      onPagePrev: vi.fn(),
      onPageNext: vi.fn(),
      onPageFirst: vi.fn(),
      onPageLast: vi.fn(),
      onZoomReset: vi.fn(),
      onZoomFitWidth: vi.fn(),
      onZoomFitHeight: vi.fn(),
    }

    // Use _handleKeydown directly to avoid needing mount/unmount lifecycle
    const kb = useKeyboard(callbacks)
    handler = kb._handleKeydown
  })

  // ── Tool shortcuts ────────────────────────────────────────────────────

  describe('tool shortcuts (single key, no modifiers)', () => {
    const toolTests: Array<[string, WBToolType]> = [
      ['P', 'pen'],
      ['H', 'highlighter'],
      ['E', 'eraser'],
      ['L', 'line'],
      ['R', 'rectangle'],
      ['C', 'circle'],
      ['T', 'text'],
      ['V', 'select'],
      ['S', 'select'],
    ]

    it.each(toolTests)('key "%s" → tool "%s"', (key, expectedTool) => {
      handler(makeKeyEvent(`Key${key}`, { key }))
      expect(callbacks.onToolChange).toHaveBeenCalledWith(expectedTool)
    })

    it('does not fire tool change with Ctrl held', () => {
      handler(ctrlKey('KeyP', { key: 'P' }))
      expect(callbacks.onToolChange).not.toHaveBeenCalled()
    })
  })

  // ── Undo / Redo ───────────────────────────────────────────────────────

  describe('undo / redo', () => {
    it('Ctrl+Z → onUndo', () => {
      handler(ctrlKey('KeyZ', { key: 'z' }))
      expect(callbacks.onUndo).toHaveBeenCalledOnce()
    })

    it('Ctrl+Shift+Z → onRedo', () => {
      handler(ctrlShiftKey('KeyZ', { key: 'Z' }))
      expect(callbacks.onRedo).toHaveBeenCalledOnce()
    })

    it('Ctrl+Y → onRedo', () => {
      handler(ctrlKey('KeyY', { key: 'y' }))
      expect(callbacks.onRedo).toHaveBeenCalledOnce()
    })

    it('Ctrl+Z works even in input fields', () => {
      handler(fromInput(ctrlKey('KeyZ', { key: 'z' })))
      expect(callbacks.onUndo).toHaveBeenCalledOnce()
    })
  })

  // ── Delete ────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('Delete key → onDelete', () => {
      handler(makeKeyEvent('Delete', { key: 'Delete' }))
      expect(callbacks.onDelete).toHaveBeenCalledOnce()
    })

    it('Backspace → onDelete', () => {
      handler(makeKeyEvent('Backspace', { key: 'Backspace' }))
      expect(callbacks.onDelete).toHaveBeenCalledOnce()
    })
  })

  // ── Escape ────────────────────────────────────────────────────────────

  describe('escape', () => {
    it('Escape → onEscape', () => {
      handler(makeKeyEvent('Escape', { key: 'Escape' }))
      expect(callbacks.onEscape).toHaveBeenCalledOnce()
    })
  })

  // ── Clipboard ─────────────────────────────────────────────────────────

  describe('clipboard shortcuts', () => {
    it('Ctrl+A → onSelectAll', () => {
      handler(ctrlKey('KeyA', { key: 'a' }))
      expect(callbacks.onSelectAll).toHaveBeenCalledOnce()
    })

    it('Ctrl+C → onCopy', () => {
      handler(ctrlKey('KeyC', { key: 'c' }))
      expect(callbacks.onCopy).toHaveBeenCalledOnce()
    })

    it('Ctrl+V → onPaste', () => {
      handler(ctrlKey('KeyV', { key: 'v' }))
      expect(callbacks.onPaste).toHaveBeenCalledOnce()
    })

    it('Ctrl+X → onCut', () => {
      handler(ctrlKey('KeyX', { key: 'x' }))
      expect(callbacks.onCut).toHaveBeenCalledOnce()
    })

    it('Ctrl+A does NOT fire in input fields', () => {
      handler(fromInput(ctrlKey('KeyA', { key: 'a' })))
      expect(callbacks.onSelectAll).not.toHaveBeenCalled()
    })

    it('Ctrl+C does NOT fire in textarea', () => {
      handler(fromTextarea(ctrlKey('KeyC', { key: 'c' })))
      expect(callbacks.onCopy).not.toHaveBeenCalled()
    })
  })

  // ── Page navigation ───────────────────────────────────────────────────

  describe('page navigation', () => {
    it('PageUp → onPagePrev', () => {
      handler(makeKeyEvent('PageUp', { key: 'PageUp' }))
      expect(callbacks.onPagePrev).toHaveBeenCalledOnce()
    })

    it('PageDown → onPageNext', () => {
      handler(makeKeyEvent('PageDown', { key: 'PageDown' }))
      expect(callbacks.onPageNext).toHaveBeenCalledOnce()
    })

    it('Home → onPageFirst', () => {
      handler(makeKeyEvent('Home', { key: 'Home' }))
      expect(callbacks.onPageFirst).toHaveBeenCalledOnce()
    })

    it('End → onPageLast', () => {
      handler(makeKeyEvent('End', { key: 'End' }))
      expect(callbacks.onPageLast).toHaveBeenCalledOnce()
    })
  })

  // ── Zoom shortcuts ────────────────────────────────────────────────────

  describe('zoom shortcuts', () => {
    it('Ctrl+0 → onZoomReset', () => {
      handler(ctrlKey('Digit0', { key: '0' }))
      expect(callbacks.onZoomReset).toHaveBeenCalledOnce()
    })

    it('Ctrl+1 → onZoomFitWidth', () => {
      handler(ctrlKey('Digit1', { key: '1' }))
      expect(callbacks.onZoomFitWidth).toHaveBeenCalledOnce()
    })

    it('Ctrl+2 → onZoomFitHeight', () => {
      handler(ctrlKey('Digit2', { key: '2' }))
      expect(callbacks.onZoomFitHeight).toHaveBeenCalledOnce()
    })
  })

  // ── Conflict guard: editable targets ──────────────────────────────────

  describe('editable target guard', () => {
    it('tool shortcuts do NOT fire in input', () => {
      handler(fromInput(makeKeyEvent('KeyP', { key: 'P' })))
      expect(callbacks.onToolChange).not.toHaveBeenCalled()
    })

    it('tool shortcuts do NOT fire in textarea', () => {
      handler(fromTextarea(makeKeyEvent('KeyE', { key: 'E' })))
      expect(callbacks.onToolChange).not.toHaveBeenCalled()
    })

    it('tool shortcuts do NOT fire in contenteditable', () => {
      const event = makeKeyEvent('KeyR', { key: 'R' })
      const div = document.createElement('div')
      div.setAttribute('contenteditable', 'true')
      // Verify jsdom setup
      expect(div.getAttribute('contenteditable')).toBe('true')
      Object.defineProperty(event, 'target', { value: div, writable: false })
      handler(event)
      expect(callbacks.onToolChange).not.toHaveBeenCalled()
    })

    it('Delete does NOT fire in input', () => {
      handler(fromInput(makeKeyEvent('Delete', { key: 'Delete' })))
      expect(callbacks.onDelete).not.toHaveBeenCalled()
    })
  })

  // ── Repeat guard ──────────────────────────────────────────────────────

  describe('repeat guard', () => {
    it('ignores repeated keydown events', () => {
      handler(makeKeyEvent('KeyP', { key: 'P', repeat: true }))
      expect(callbacks.onToolChange).not.toHaveBeenCalled()
    })
  })

  // ── Enable / Disable ──────────────────────────────────────────────────

  describe('enable / disable', () => {
    it('disabled option prevents all shortcuts', () => {
      const kb = useKeyboard(callbacks, { disabled: () => true })
      kb._handleKeydown(makeKeyEvent('KeyP', { key: 'P' }))
      expect(callbacks.onToolChange).not.toHaveBeenCalled()
    })

    it('enable/disable toggle works', () => {
      const kb = useKeyboard(callbacks)
      kb.disable()
      kb._handleKeydown(makeKeyEvent('KeyP', { key: 'P' }))
      expect(callbacks.onToolChange).not.toHaveBeenCalled()

      kb.enable()
      kb._handleKeydown(makeKeyEvent('KeyP', { key: 'P' }))
      expect(callbacks.onToolChange).toHaveBeenCalledOnce()
    })
  })
})
