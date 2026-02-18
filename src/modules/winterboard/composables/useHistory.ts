// WB: Undo/Redo composable — Command Pattern
// Ref: ManifestWinterboard_v2.md LAW-19, TASK_BOARD.md B1.1
// Adapted from SOLO_v2/useHistory.ts for Konva/Pinia architecture

import { ref, computed } from 'vue'
import type {
  WBStroke,
  WBAsset,
  WBHistoryActionType,
} from '../types/winterboard'

// ─── Types ──────────────────────────────────────────────────────────────────

/** Union of all items that can be tracked in history */
export type WBHistoryItem = WBStroke | WBAsset

/** Discriminated payload per action type */
export interface WBHistoryEntry {
  id: string
  type: WBHistoryActionType
  pageId: string
  timestamp: number
  /** For add/remove — the full item snapshot */
  item?: WBHistoryItem
  itemId?: string
  /** For update — before/after partial snapshots */
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  /** For clear-page — all removed items */
  clearedStrokes?: WBStroke[]
  clearedAssets?: WBAsset[]
  /** For batch — ordered sub-entries */
  batch?: WBHistoryEntry[]
}

export interface UseHistoryOptions {
  /** Max undo stack depth. LAW-19 specifies 50. Default: 100 (TASK_BOARD) */
  maxSize?: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_SIZE = 100
const LOG_PREFIX = '[WB:History]'

// ─── ID generator ───────────────────────────────────────────────────────────

let _seq = 0
function generateId(): string {
  return `wbh-${Date.now()}-${++_seq}`
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useHistory(options: UseHistoryOptions = {}) {
  const maxSize = options.maxSize ?? DEFAULT_MAX_SIZE

  // Stacks
  const undoStack = ref<WBHistoryEntry[]>([])
  const redoStack = ref<WBHistoryEntry[]>([])

  // Batching state
  const _isBatching = ref(false)
  const _batchEntries = ref<WBHistoryEntry[]>([])

  // ── Computed ────────────────────────────────────────────────────────────

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const historyLength = computed(() => undoStack.value.length)

  // ── Internal helpers ───────────────────────────────────────────────────

  function trimStack(stack: WBHistoryEntry[]): WBHistoryEntry[] {
    return stack.length > maxSize ? stack.slice(-maxSize) : stack
  }

  function pushEntry(entry: WBHistoryEntry): void {
    if (_isBatching.value) {
      _batchEntries.value.push(entry)
      return
    }
    undoStack.value = trimStack([...undoStack.value, entry])
    // New action invalidates redo (LAW-19: standard undo/redo semantics)
    redoStack.value = []
  }

  // ── Recording API ──────────────────────────────────────────────────────

  function recordAdd(pageId: string, item: WBHistoryItem, type: 'stroke' | 'asset' = 'stroke'): void {
    const actionType: WBHistoryActionType = type === 'stroke' ? 'add-stroke' : 'add-asset'
    pushEntry({
      id: generateId(),
      type: actionType,
      pageId,
      timestamp: Date.now(),
      item: structuredClone(item),
      itemId: item.id,
    })
  }

  function recordRemove(pageId: string, item: WBHistoryItem, type: 'stroke' | 'asset' = 'stroke'): void {
    const actionType: WBHistoryActionType = type === 'stroke' ? 'remove-stroke' : 'remove-asset'
    pushEntry({
      id: generateId(),
      type: actionType,
      pageId,
      timestamp: Date.now(),
      item: structuredClone(item),
      itemId: item.id,
    })
  }

  function recordUpdate(
    pageId: string,
    itemId: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    type: 'stroke' | 'asset' = 'stroke',
  ): void {
    const actionType: WBHistoryActionType = type === 'stroke' ? 'update-stroke' : 'update-asset'
    pushEntry({
      id: generateId(),
      type: actionType,
      pageId,
      timestamp: Date.now(),
      itemId,
      before: structuredClone(before),
      after: structuredClone(after),
    })
  }

  function recordClearPage(pageId: string, strokes: WBStroke[], assets: WBAsset[]): void {
    pushEntry({
      id: generateId(),
      type: 'clear-page',
      pageId,
      timestamp: Date.now(),
      clearedStrokes: structuredClone(strokes),
      clearedAssets: structuredClone(assets),
    })
  }

  // ── Batch API (group multiple actions as one undo step) ────────────────

  function startBatch(): void {
    if (_isBatching.value) {
      console.warn(LOG_PREFIX, 'startBatch called while already batching — ignored')
      return
    }
    _isBatching.value = true
    _batchEntries.value = []
  }

  function endBatch(): void {
    if (!_isBatching.value) return
    _isBatching.value = false

    if (_batchEntries.value.length === 0) return

    const batchEntry: WBHistoryEntry = {
      id: generateId(),
      type: 'batch',
      pageId: _batchEntries.value[0].pageId,
      timestamp: Date.now(),
      batch: [..._batchEntries.value],
    }

    undoStack.value = trimStack([...undoStack.value, batchEntry])
    redoStack.value = []
    _batchEntries.value = []
  }

  function cancelBatch(): void {
    _isBatching.value = false
    _batchEntries.value = []
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────
  // These return the entry so the caller (store/canvas) can apply the
  // inverse operation. The composable does NOT mutate canvas state —
  // that responsibility belongs to boardStore / WBCanvas.

  function undo(): WBHistoryEntry | null {
    if (!canUndo.value) return null
    const stack = [...undoStack.value]
    const entry = stack.pop()!
    undoStack.value = stack
    redoStack.value = [...redoStack.value, entry]
    return entry
  }

  function redo(): WBHistoryEntry | null {
    if (!canRedo.value) return null
    const stack = [...redoStack.value]
    const entry = stack.pop()!
    redoStack.value = stack
    undoStack.value = [...undoStack.value, entry]
    return entry
  }

  // ── Utilities ──────────────────────────────────────────────────────────

  function clear(): void {
    undoStack.value = []
    redoStack.value = []
    _isBatching.value = false
    _batchEntries.value = []
  }

  function getSummary(): { undoCount: number; redoCount: number; types: Record<string, number> } {
    const types: Record<string, number> = {}
    for (const entry of undoStack.value) {
      types[entry.type] = (types[entry.type] || 0) + 1
    }
    return { undoCount: undoStack.value.length, redoCount: redoStack.value.length, types }
  }

  return {
    // State (readonly externally)
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    historyLength,

    // Recording
    recordAdd,
    recordRemove,
    recordUpdate,
    recordClearPage,

    // Batch
    startBatch,
    endBatch,
    cancelBatch,

    // Undo / Redo
    undo,
    redo,

    // Utils
    clear,
    getSummary,
  }
}

export default useHistory
