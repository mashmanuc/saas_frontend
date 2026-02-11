import { ref, computed, watch, type Ref } from 'vue'
import type { PageState, Stroke, Shape, TextElement, HistoryAction } from '../types/solo'

export type HistoryActionType =
  | 'add-stroke'
  | 'remove-stroke'
  | 'add-shape'
  | 'remove-shape'
  | 'add-text'
  | 'remove-text'
  | 'update-stroke'
  | 'update-shape'
  | 'update-text'
  | 'batch'

export interface HistoryEntry {
  id: string
  type: HistoryActionType
  pageId: string
  timestamp: number
  // For add/remove actions
  item?: Stroke | Shape | TextElement
  items?: Array<Stroke | Shape | TextElement>
  itemType?: 'stroke' | 'shape' | 'text'
  // For update actions (store before/after)
  before?: Partial<Stroke | Shape | TextElement>
  after?: Partial<Stroke | Shape | TextElement>
  itemId?: string
  // For batch actions
  batch?: HistoryEntry[]
}

export interface UseHistoryOptions {
  maxHistorySize?: number
  persistToStorage?: boolean
  storageKey?: string
}

const DEFAULT_MAX_HISTORY = 50
const STORAGE_KEY_PREFIX = 'solo-history-'

export function useHistory(
  pageState: Ref<PageState | null>,
  options: UseHistoryOptions = {}
) {
  const {
    maxHistorySize = DEFAULT_MAX_HISTORY,
    persistToStorage = false,
    storageKey = '',
  } = options

  // State
  const undoStack = ref<HistoryEntry[]>([])
  const redoStack = ref<HistoryEntry[]>([])
  const isBatching = ref(false)
  const batchEntries = ref<HistoryEntry[]>([])

  // Computed
  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const historyLength = computed(() => undoStack.value.length)

  // Generate unique ID
  function generateId(): string {
    return `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Load from localStorage
  function loadFromStorage(): void {
    if (!persistToStorage || !storageKey) return

    try {
      const key = STORAGE_KEY_PREFIX + storageKey
      const stored = localStorage.getItem(key)
      if (stored) {
        const data = JSON.parse(stored)
        undoStack.value = data.undo || []
        redoStack.value = data.redo || []
      }
    } catch (e) {
      console.warn('[History] Failed to load from storage:', e)
    }
  }

  // Save to localStorage
  function saveToStorage(): void {
    if (!persistToStorage || !storageKey) return

    try {
      const key = STORAGE_KEY_PREFIX + storageKey
      const data = {
        undo: undoStack.value.slice(-maxHistorySize),
        redo: redoStack.value.slice(-maxHistorySize),
      }
      localStorage.setItem(key, JSON.stringify(data))
    } catch (e) {
      console.warn('[History] Failed to save to storage:', e)
    }
  }

  // Trim history to max size
  function trimHistory(): void {
    if (undoStack.value.length > maxHistorySize) {
      undoStack.value = undoStack.value.slice(-maxHistorySize)
    }
    if (redoStack.value.length > maxHistorySize) {
      redoStack.value = redoStack.value.slice(-maxHistorySize)
    }
  }

  // Push entry to undo stack
  function pushEntry(entry: HistoryEntry): void {
    if (isBatching.value) {
      batchEntries.value.push(entry)
      return
    }

    undoStack.value.push(entry)
    redoStack.value = [] // Clear redo stack on new action
    trimHistory()
    saveToStorage()
  }

  // Record add stroke action
  function recordAddStroke(pageId: string, stroke: Stroke): void {
    pushEntry({
      id: generateId(),
      type: 'add-stroke',
      pageId,
      timestamp: Date.now(),
      item: { ...stroke },
      itemType: 'stroke',
    })
  }

  // Record remove stroke action
  function recordRemoveStroke(pageId: string, stroke: Stroke): void {
    pushEntry({
      id: generateId(),
      type: 'remove-stroke',
      pageId,
      timestamp: Date.now(),
      item: { ...stroke },
      itemType: 'stroke',
    })
  }

  // Record add shape action
  function recordAddShape(pageId: string, shape: Shape): void {
    pushEntry({
      id: generateId(),
      type: 'add-shape',
      pageId,
      timestamp: Date.now(),
      item: { ...shape },
      itemType: 'shape',
    })
  }

  // Record remove shape action
  function recordRemoveShape(pageId: string, shape: Shape): void {
    pushEntry({
      id: generateId(),
      type: 'remove-shape',
      pageId,
      timestamp: Date.now(),
      item: { ...shape },
      itemType: 'shape',
    })
  }

  // Record add text action
  function recordAddText(pageId: string, text: TextElement): void {
    pushEntry({
      id: generateId(),
      type: 'add-text',
      pageId,
      timestamp: Date.now(),
      item: { ...text },
      itemType: 'text',
    })
  }

  // Record remove text action
  function recordRemoveText(pageId: string, text: TextElement): void {
    pushEntry({
      id: generateId(),
      type: 'remove-text',
      pageId,
      timestamp: Date.now(),
      item: { ...text },
      itemType: 'text',
    })
  }

  // Record update action (for move/resize)
  function recordUpdate(
    pageId: string,
    itemType: 'stroke' | 'shape' | 'text',
    itemId: string,
    before: Partial<Stroke | Shape | TextElement>,
    after: Partial<Stroke | Shape | TextElement>
  ): void {
    pushEntry({
      id: generateId(),
      type: `update-${itemType}` as HistoryActionType,
      pageId,
      timestamp: Date.now(),
      itemType,
      itemId,
      before: { ...before },
      after: { ...after },
    })
  }

  // Start batching (group multiple actions)
  function startBatch(): void {
    isBatching.value = true
    batchEntries.value = []
  }

  // End batching
  function endBatch(description?: string): void {
    if (!isBatching.value) return

    isBatching.value = false

    if (batchEntries.value.length > 0) {
      undoStack.value.push({
        id: generateId(),
        type: 'batch',
        pageId: batchEntries.value[0].pageId,
        timestamp: Date.now(),
        batch: [...batchEntries.value],
      })
      redoStack.value = []
      trimHistory()
      saveToStorage()
    }

    batchEntries.value = []
  }

  // Cancel batching
  function cancelBatch(): void {
    isBatching.value = false
    batchEntries.value = []
  }

  // Apply undo/redo entry to page state
  function applyEntry(entry: HistoryEntry, isUndo: boolean): void {
    if (!pageState.value || pageState.value.id !== entry.pageId) {
      console.warn('[History] Page mismatch, cannot apply entry')
      return
    }

    const page = pageState.value

    // Handle batch
    if (entry.type === 'batch' && entry.batch) {
      const entries = isUndo ? [...entry.batch].reverse() : entry.batch
      for (const subEntry of entries) {
        applyEntry(subEntry, isUndo)
      }
      return
    }

    // Determine action based on undo/redo
    switch (entry.type) {
      case 'add-stroke':
        if (isUndo) {
          // Undo add = remove
          page.strokes = page.strokes.filter(s => s.id !== (entry.item as Stroke).id)
        } else {
          // Redo add = add back
          page.strokes.push(entry.item as Stroke)
        }
        break

      case 'remove-stroke':
        if (isUndo) {
          // Undo remove = add back
          page.strokes.push(entry.item as Stroke)
        } else {
          // Redo remove = remove again
          page.strokes = page.strokes.filter(s => s.id !== (entry.item as Stroke).id)
        }
        break

      case 'add-shape':
        if (isUndo) {
          page.shapes = page.shapes.filter(s => s.id !== (entry.item as Shape).id)
        } else {
          page.shapes.push(entry.item as Shape)
        }
        break

      case 'remove-shape':
        if (isUndo) {
          page.shapes.push(entry.item as Shape)
        } else {
          page.shapes = page.shapes.filter(s => s.id !== (entry.item as Shape).id)
        }
        break

      case 'add-text':
        if (isUndo) {
          page.texts = page.texts.filter(t => t.id !== (entry.item as TextElement).id)
        } else {
          page.texts.push(entry.item as TextElement)
        }
        break

      case 'remove-text':
        if (isUndo) {
          page.texts.push(entry.item as TextElement)
        } else {
          page.texts = page.texts.filter(t => t.id !== (entry.item as TextElement).id)
        }
        break

      case 'update-stroke':
        if (entry.itemId) {
          const stroke = page.strokes.find(s => s.id === entry.itemId)
          if (stroke) {
            const changes = isUndo ? entry.before : entry.after
            Object.assign(stroke, changes)
          }
        }
        break

      case 'update-shape':
        if (entry.itemId) {
          const shape = page.shapes.find(s => s.id === entry.itemId)
          if (shape) {
            const changes = isUndo ? entry.before : entry.after
            Object.assign(shape, changes)
          }
        }
        break

      case 'update-text':
        if (entry.itemId) {
          const text = page.texts.find(t => t.id === entry.itemId)
          if (text) {
            const changes = isUndo ? entry.before : entry.after
            Object.assign(text, changes)
          }
        }
        break
    }
  }

  // Undo last action
  function undo(): boolean {
    if (!canUndo.value) return false

    const entry = undoStack.value.pop()!
    applyEntry(entry, true)
    redoStack.value.push(entry)
    saveToStorage()

    return true
  }

  // Redo last undone action
  function redo(): boolean {
    if (!canRedo.value) return false

    const entry = redoStack.value.pop()!
    applyEntry(entry, false)
    undoStack.value.push(entry)
    saveToStorage()

    return true
  }

  // Clear all history
  function clearHistory(): void {
    undoStack.value = []
    redoStack.value = []

    if (persistToStorage && storageKey) {
      localStorage.removeItem(STORAGE_KEY_PREFIX + storageKey)
    }
  }

  // Get history summary (for debugging)
  function getHistorySummary(): { undo: number; redo: number; types: Record<string, number> } {
    const types: Record<string, number> = {}

    for (const entry of undoStack.value) {
      types[entry.type] = (types[entry.type] || 0) + 1
    }

    return {
      undo: undoStack.value.length,
      redo: redoStack.value.length,
      types,
    }
  }

  // Load from storage on init
  loadFromStorage()

  return {
    // State
    undoStack,
    redoStack,
    canUndo,
    canRedo,
    historyLength,

    // Actions
    undo,
    redo,
    clearHistory,

    // Recording
    recordAddStroke,
    recordRemoveStroke,
    recordAddShape,
    recordRemoveShape,
    recordAddText,
    recordRemoveText,
    recordUpdate,

    // Batching
    startBatch,
    endBatch,
    cancelBatch,

    // Utils
    getHistorySummary,
  }
}

export default useHistory
