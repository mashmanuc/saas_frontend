import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useHistory } from './useHistory'
import type { PageState, Stroke, Shape, TextElement } from '../types/solo'

describe('useHistory', () => {
  let pageState: ReturnType<typeof ref<PageState | null>>
  let mockLocalStorage: Record<string, string>

  beforeEach(() => {
    // Create mock page state
    pageState = ref<PageState | null>({
      id: 'page-1',
      name: 'Test Page',
      strokes: [],
      shapes: [],
      texts: [],
    })

    // Mock localStorage
    mockLocalStorage = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key]
      }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('initialization', () => {
    it('should initialize with empty undo/redo stacks', () => {
      const { undoStack, redoStack, canUndo, canRedo } = useHistory(pageState)

      expect(undoStack.value).toHaveLength(0)
      expect(redoStack.value).toHaveLength(0)
      expect(canUndo.value).toBe(false)
      expect(canRedo.value).toBe(false)
    })

    it('should load from localStorage when persistToStorage is true', () => {
      const key = 'test-session'
      mockLocalStorage[`solo-history-${key}`] = JSON.stringify({
        undo: [{ id: '1', type: 'add-stroke', pageId: 'page-1', timestamp: Date.now() }],
        redo: [],
      })

      const { undoStack } = useHistory(pageState, {
        persistToStorage: true,
        storageKey: key,
      })

      expect(undoStack.value).toHaveLength(1)
    })
  })

  describe('recordAddStroke', () => {
    it('should add entry to undo stack', () => {
      const { recordAddStroke, undoStack, canUndo } = useHistory(pageState)

      const stroke: Stroke = {
        id: 'stroke-1',
        tool: 'pen',
        color: '#000000',
        size: 5,
        opacity: 1,
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      }

      recordAddStroke('page-1', stroke)

      expect(undoStack.value).toHaveLength(1)
      expect(undoStack.value[0].type).toBe('add-stroke')
      expect(canUndo.value).toBe(true)
    })

    it('should clear redo stack on new action', () => {
      const { recordAddStroke, undo, redoStack } = useHistory(pageState)

      const stroke1: Stroke = {
        id: 'stroke-1',
        tool: 'pen',
        color: '#000000',
        size: 5,
        opacity: 1,
        points: [],
      }

      const stroke2: Stroke = {
        id: 'stroke-2',
        tool: 'pen',
        color: '#ff0000',
        size: 5,
        opacity: 1,
        points: [],
      }

      // Add first stroke and add to page
      recordAddStroke('page-1', stroke1)
      pageState.value!.strokes.push(stroke1)

      // Undo
      undo()

      expect(redoStack.value).toHaveLength(1)

      // Add new stroke (should clear redo)
      recordAddStroke('page-1', stroke2)

      expect(redoStack.value).toHaveLength(0)
    })
  })

  describe('recordAddShape', () => {
    it('should add shape entry to undo stack', () => {
      const { recordAddShape, undoStack } = useHistory(pageState)

      const shape: Shape = {
        id: 'shape-1',
        type: 'rectangle',
        color: '#000000',
        size: 2,
        x: 10,
        y: 10,
        width: 100,
        height: 50,
      }

      recordAddShape('page-1', shape)

      expect(undoStack.value).toHaveLength(1)
      expect(undoStack.value[0].type).toBe('add-shape')
      expect(undoStack.value[0].itemType).toBe('shape')
    })
  })

  describe('recordAddText', () => {
    it('should add text entry to undo stack', () => {
      const { recordAddText, undoStack } = useHistory(pageState)

      const text: TextElement = {
        id: 'text-1',
        type: 'text',
        text: 'Hello World',
        x: 50,
        y: 50,
        color: '#000000',
        fontSize: 16,
      }

      recordAddText('page-1', text)

      expect(undoStack.value).toHaveLength(1)
      expect(undoStack.value[0].type).toBe('add-text')
      expect(undoStack.value[0].itemType).toBe('text')
    })
  })

  describe('undo', () => {
    it('should undo add-stroke action', () => {
      const { recordAddStroke, undo, canUndo } = useHistory(pageState)

      const stroke: Stroke = {
        id: 'stroke-1',
        tool: 'pen',
        color: '#000000',
        size: 5,
        opacity: 1,
        points: [],
      }

      // Add stroke to page and record
      pageState.value!.strokes.push(stroke)
      recordAddStroke('page-1', stroke)

      expect(pageState.value!.strokes).toHaveLength(1)

      // Undo
      const result = undo()

      expect(result).toBe(true)
      expect(pageState.value!.strokes).toHaveLength(0)
      expect(canUndo.value).toBe(false)
    })

    it('should return false when nothing to undo', () => {
      const { undo } = useHistory(pageState)

      const result = undo()

      expect(result).toBe(false)
    })

    it('should move entry to redo stack', () => {
      const { recordAddStroke, undo, redoStack, canRedo } = useHistory(pageState)

      const stroke: Stroke = {
        id: 'stroke-1',
        tool: 'pen',
        color: '#000000',
        size: 5,
        opacity: 1,
        points: [],
      }

      pageState.value!.strokes.push(stroke)
      recordAddStroke('page-1', stroke)
      undo()

      expect(redoStack.value).toHaveLength(1)
      expect(canRedo.value).toBe(true)
    })
  })

  describe('redo', () => {
    it('should redo undone action', () => {
      const { recordAddStroke, undo, redo } = useHistory(pageState)

      const stroke: Stroke = {
        id: 'stroke-1',
        tool: 'pen',
        color: '#000000',
        size: 5,
        opacity: 1,
        points: [],
      }

      pageState.value!.strokes.push(stroke)
      recordAddStroke('page-1', stroke)
      undo()

      expect(pageState.value!.strokes).toHaveLength(0)

      redo()

      expect(pageState.value!.strokes).toHaveLength(1)
    })

    it('should return false when nothing to redo', () => {
      const { redo } = useHistory(pageState)

      const result = redo()

      expect(result).toBe(false)
    })
  })

  describe('batch operations', () => {
    it('should group multiple actions into single batch', () => {
      const { startBatch, endBatch, recordAddStroke, undoStack } = useHistory(pageState)

      startBatch()

      const stroke1: Stroke = { id: 's1', tool: 'pen', color: '#000', size: 5, opacity: 1, points: [] }
      const stroke2: Stroke = { id: 's2', tool: 'pen', color: '#fff', size: 5, opacity: 1, points: [] }

      recordAddStroke('page-1', stroke1)
      recordAddStroke('page-1', stroke2)

      endBatch()

      expect(undoStack.value).toHaveLength(1)
      expect(undoStack.value[0].type).toBe('batch')
      expect(undoStack.value[0].batch).toHaveLength(2)
    })

    it('should undo entire batch at once', () => {
      const { startBatch, endBatch, recordAddStroke, undo } = useHistory(pageState)

      const stroke1: Stroke = { id: 's1', tool: 'pen', color: '#000', size: 5, opacity: 1, points: [] }
      const stroke2: Stroke = { id: 's2', tool: 'pen', color: '#fff', size: 5, opacity: 1, points: [] }

      pageState.value!.strokes.push(stroke1, stroke2)

      startBatch()
      recordAddStroke('page-1', stroke1)
      recordAddStroke('page-1', stroke2)
      endBatch()

      undo()

      expect(pageState.value!.strokes).toHaveLength(0)
    })
  })

  describe('history limit', () => {
    it('should respect maxHistorySize', () => {
      const { recordAddStroke, undoStack } = useHistory(pageState, { maxHistorySize: 3 })

      for (let i = 0; i < 5; i++) {
        const stroke: Stroke = {
          id: `stroke-${i}`,
          tool: 'pen',
          color: '#000000',
          size: 5,
          opacity: 1,
          points: [],
        }
        recordAddStroke('page-1', stroke)
      }

      expect(undoStack.value).toHaveLength(3)
    })
  })

  describe('clearHistory', () => {
    it('should clear both stacks', () => {
      const { recordAddStroke, clearHistory, undoStack, redoStack } = useHistory(pageState)

      const stroke: Stroke = { id: 's1', tool: 'pen', color: '#000', size: 5, opacity: 1, points: [] }
      recordAddStroke('page-1', stroke)

      clearHistory()

      expect(undoStack.value).toHaveLength(0)
      expect(redoStack.value).toHaveLength(0)
    })
  })

  describe('getHistorySummary', () => {
    it('should return summary of history', () => {
      const { recordAddStroke, recordAddShape, getHistorySummary } = useHistory(pageState)

      const stroke: Stroke = { id: 's1', tool: 'pen', color: '#000', size: 5, opacity: 1, points: [] }
      const shape: Shape = { id: 'sh1', type: 'rectangle', color: '#000', size: 2 }

      recordAddStroke('page-1', stroke)
      recordAddShape('page-1', shape)

      const summary = getHistorySummary()

      expect(summary.undo).toBe(2)
      expect(summary.redo).toBe(0)
      expect(summary.types['add-stroke']).toBe(1)
      expect(summary.types['add-shape']).toBe(1)
    })
  })
})
