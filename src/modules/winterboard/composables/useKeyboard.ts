// WB: Keyboard shortcuts composable
// Ref: ManifestWinterboard_v2.md LAW-21, TASK_BOARD.md B1.2
// Shortcuts must not conflict with browser defaults.
// Guard: disabled when focus is in textarea/input/contenteditable.

import { onMounted, onUnmounted, ref } from 'vue'
import type { WBToolType } from '../types/winterboard'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WBShortcut {
  /** Human-readable key label (for tooltips) */
  label: string
  /** KeyboardEvent.code or key matcher */
  key: string
  /** Modifier flags */
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  /** Action identifier */
  action: string
}

export interface UseKeyboardCallbacks {
  onToolChange?: (tool: WBToolType) => void
  onUndo?: () => void
  onRedo?: () => void
  onDelete?: () => void
  onSelectAll?: () => void
  onCopy?: () => void
  onPaste?: () => void
  onCut?: () => void
  onEscape?: () => void
  onPagePrev?: () => void
  onPageNext?: () => void
  onPageFirst?: () => void
  onPageLast?: () => void
  onZoomReset?: () => void
  onZoomFitWidth?: () => void
  onZoomFitHeight?: () => void
}

export interface UseKeyboardOptions {
  /** If true, shortcuts are disabled. Useful for modal dialogs. */
  disabled?: () => boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Tool shortcuts — single key, no modifiers (LAW-21) */
const TOOL_KEY_MAP: Record<string, WBToolType> = {
  P: 'pen',
  H: 'highlighter',
  E: 'eraser',
  L: 'line',
  R: 'rectangle',
  C: 'circle',
  T: 'text',
  V: 'select',
  // LAW-21 uses S for Select, but TASK_BOARD uses V. Support both.
  S: 'select',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns true if the event target is an editable element (input, textarea, contenteditable) */
function isEditableTarget(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true
  // Also check for role="textbox" (some rich editors)
  if (target.getAttribute('role') === 'textbox') return true
  return false
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useKeyboard(
  callbacks: UseKeyboardCallbacks,
  options: UseKeyboardOptions = {},
) {
  const enabled = ref(true)

  function handleKeydown(event: KeyboardEvent): void {
    // Skip if disabled externally
    if (options.disabled?.()) return
    if (!enabled.value) return
    // Skip repeated keys (held down)
    if (event.repeat) return

    const ctrl = event.ctrlKey || event.metaKey
    const shift = event.shiftKey
    const key = event.key.toUpperCase()
    const code = event.code

    // ── Modifier combos (work even in editable fields for Ctrl+Z etc.) ──

    // Undo: Ctrl+Z
    if (ctrl && !shift && code === 'KeyZ') {
      event.preventDefault()
      callbacks.onUndo?.()
      return
    }

    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if (ctrl && shift && code === 'KeyZ') {
      event.preventDefault()
      callbacks.onRedo?.()
      return
    }
    if (ctrl && !shift && code === 'KeyY') {
      event.preventDefault()
      callbacks.onRedo?.()
      return
    }

    // Select All: Ctrl+A (only outside editable fields)
    if (ctrl && !shift && code === 'KeyA' && !isEditableTarget(event)) {
      event.preventDefault()
      callbacks.onSelectAll?.()
      return
    }

    // Copy: Ctrl+C
    if (ctrl && !shift && code === 'KeyC' && !isEditableTarget(event)) {
      event.preventDefault()
      callbacks.onCopy?.()
      return
    }

    // Paste: Ctrl+V
    if (ctrl && !shift && code === 'KeyV' && !isEditableTarget(event)) {
      event.preventDefault()
      callbacks.onPaste?.()
      return
    }

    // Cut: Ctrl+X
    if (ctrl && !shift && code === 'KeyX' && !isEditableTarget(event)) {
      event.preventDefault()
      callbacks.onCut?.()
      return
    }

    // Zoom: Ctrl+0 (reset), Ctrl+1 (fit width), Ctrl+2 (fit height)
    if (ctrl && !shift && code === 'Digit0') {
      event.preventDefault()
      callbacks.onZoomReset?.()
      return
    }
    if (ctrl && !shift && code === 'Digit1') {
      event.preventDefault()
      callbacks.onZoomFitWidth?.()
      return
    }
    if (ctrl && !shift && code === 'Digit2') {
      event.preventDefault()
      callbacks.onZoomFitHeight?.()
      return
    }

    // ── Non-modifier shortcuts (skip if in editable target) ─────────────

    if (isEditableTarget(event)) return
    if (ctrl) return // Remaining shortcuts are non-modifier only

    // Delete selected
    if (key === 'DELETE' || code === 'Delete') {
      event.preventDefault()
      callbacks.onDelete?.()
      return
    }

    // Backspace also deletes (common UX expectation)
    if (key === 'BACKSPACE' || code === 'Backspace') {
      event.preventDefault()
      callbacks.onDelete?.()
      return
    }

    // Escape: deselect
    if (code === 'Escape') {
      callbacks.onEscape?.()
      return
    }

    // Page navigation
    if (code === 'PageUp') {
      event.preventDefault()
      callbacks.onPagePrev?.()
      return
    }
    if (code === 'PageDown') {
      event.preventDefault()
      callbacks.onPageNext?.()
      return
    }
    if (code === 'Home') {
      event.preventDefault()
      callbacks.onPageFirst?.()
      return
    }
    if (code === 'End') {
      event.preventDefault()
      callbacks.onPageLast?.()
      return
    }

    // Tool shortcuts (single letter, no modifiers)
    const tool = TOOL_KEY_MAP[key]
    if (tool) {
      callbacks.onToolChange?.(tool)
      return
    }
  }

  function enable(): void {
    enabled.value = true
  }

  function disable(): void {
    enabled.value = false
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    enabled,
    enable,
    disable,
    /** Exposed for testing — call directly without mounting */
    _handleKeydown: handleKeydown,
  }
}

export { TOOL_KEY_MAP }
export default useKeyboard
