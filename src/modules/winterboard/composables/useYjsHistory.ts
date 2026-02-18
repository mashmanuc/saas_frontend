// WB: useYjsHistory — Per-user undo/redo via Yjs UndoManager
// Ref: TASK_BOARD_PHASES.md A6.3, LAW-19 (Undo/Redo)
//
// Key differences from useHistory (command pattern):
// - Uses Y.UndoManager which tracks Yjs transactions by origin
// - Per-user: each user only undoes their own changes
// - No manual recording needed — UndoManager auto-captures
// - Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z (Cmd on Mac)
//
// Fallback: when Yjs disabled → useHistory (command pattern) is used

import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'
import * as Y from 'yjs'
import { getPages } from '../engine/collaboration/yjsDocument'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:YjsHistory]'
const DEFAULT_CAPTURE_TIMEOUT = 500  // Group rapid changes into one undo step (ms)

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseYjsHistoryOptions {
  /** Transaction origin to track (typically userId) */
  trackedOrigins: Set<string>
  /** Timeout for grouping rapid changes (ms). Default: 500 */
  captureTimeout?: number
  /** Register keyboard shortcuts. Default: true */
  enableKeyboard?: boolean
  /** Scope to specific Y.AbstractType (e.g. pages array). Default: pages */
  scope?: Y.AbstractType<unknown>[]
}

export interface UseYjsHistoryReturn {
  /** Whether undo is available */
  canUndo: Ref<boolean>
  /** Whether redo is available */
  canRedo: Ref<boolean>
  /** Number of undo steps */
  undoCount: Ref<number>
  /** Number of redo steps */
  redoCount: Ref<number>
  /** Perform undo */
  undo: () => void
  /** Perform redo */
  redo: () => void
  /** Clear all undo/redo history */
  clear: () => void
  /** Stop tracking (also called on unmount) */
  destroy: () => void
  /** The underlying Y.UndoManager (for advanced use) */
  undoManager: Y.UndoManager | null
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useYjsHistory(
  doc: Y.Doc,
  options: UseYjsHistoryOptions,
): UseYjsHistoryReturn {
  const {
    trackedOrigins,
    captureTimeout = DEFAULT_CAPTURE_TIMEOUT,
    enableKeyboard = true,
  } = options

  // ── State ─────────────────────────────────────────────────────────────

  const canUndo = ref(false)
  const canRedo = ref(false)
  const undoCount = ref(0)
  const redoCount = ref(0)

  let destroyed = false

  // ── Create UndoManager ────────────────────────────────────────────────

  const yPages = getPages(doc)
  const scope = options.scope ?? [yPages]

  const undoManager = new Y.UndoManager(scope, {
    trackedOrigins: trackedOrigins as Set<unknown>,
    captureTimeout,
  })

  // ── Sync reactive state ───────────────────────────────────────────────

  function syncState(): void {
    if (destroyed) return
    canUndo.value = undoManager.undoStack.length > 0
    canRedo.value = undoManager.redoStack.length > 0
    undoCount.value = undoManager.undoStack.length
    redoCount.value = undoManager.redoStack.length
  }

  // Listen to stack changes
  function onStackItemAdded(): void {
    syncState()
  }

  function onStackItemPopped(): void {
    syncState()
  }

  undoManager.on('stack-item-added', onStackItemAdded)
  undoManager.on('stack-item-popped', onStackItemPopped)
  undoManager.on('stack-cleared', syncState)

  // Initial sync
  syncState()

  // ── Undo / Redo ───────────────────────────────────────────────────────

  function undo(): void {
    if (destroyed || !canUndo.value) return
    try {
      undoManager.undo()
    } catch (err) {
      console.error(LOG, 'Undo failed:', err)
    }
  }

  function redo(): void {
    if (destroyed || !canRedo.value) return
    try {
      undoManager.redo()
    } catch (err) {
      console.error(LOG, 'Redo failed:', err)
    }
  }

  function clear(): void {
    if (destroyed) return
    undoManager.clear()
    syncState()
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return

    // Skip if focus is in an input/textarea/contenteditable
    const target = e.target as HTMLElement | null
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return
    }

    const isMac = navigator.platform?.includes('Mac') || navigator.userAgent?.includes('Mac')
    const mod = isMac ? e.metaKey : e.ctrlKey

    if (!mod || e.key.toLowerCase() !== 'z') return

    e.preventDefault()
    e.stopPropagation()

    if (e.shiftKey) {
      redo()
    } else {
      undo()
    }
  }

  if (enableKeyboard && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown, { capture: true })
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  function destroy(): void {
    if (destroyed) return
    destroyed = true

    undoManager.off('stack-item-added', onStackItemAdded)
    undoManager.off('stack-item-popped', onStackItemPopped)
    undoManager.off('stack-cleared', syncState)

    if (enableKeyboard && typeof window !== 'undefined') {
      window.removeEventListener('keydown', onKeyDown, { capture: true })
    }

    undoManager.destroy()

    canUndo.value = false
    canRedo.value = false
    undoCount.value = 0
    redoCount.value = 0
  }

  onUnmounted(destroy)

  return {
    canUndo,
    canRedo,
    undoCount,
    redoCount,
    undo,
    redo,
    clear,
    destroy,
    undoManager,
  }
}
