import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBoardStore } from '../boardStore'
import { useBoardSyncStore } from '../boardSyncStore'

// [WB:B1.6] Mock winterboardApi (boardStore migrated from soloApi → winterboardApi)
vi.mock('@/modules/winterboard/api/winterboardApi', () => ({
  winterboardApi: {
    getSession: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
    presignUpload: vi.fn(),
    createExport: vi.fn(),
    getExport: vi.fn(),
  },
}))

// Mock saveCoordinator (used by loadSession for ETag resync)
vi.mock('../saveCoordinator', () => ({
  saveCoordinator: {
    resyncSession: vi.fn().mockResolvedValue({ etag: null, rev: null }),
    save: vi.fn().mockResolvedValue({ etag: 'test-etag', rev: 1 }),
    beaconTelemetry: vi.fn(),
  },
  SaveCoordinatorError: class SaveCoordinatorError extends Error {
    code: number
    endpoint: string
    payload: Record<string, unknown>
    constructor(code: number, endpoint: string, payload?: Record<string, unknown>) {
      super(`SaveCoordinatorError ${code}`)
      this.code = code
      this.endpoint = endpoint
      this.payload = payload || {}
    }
  },
}))

// Mock notify
vi.mock('@/utils/notify', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}))

// Mock i18n
vi.mock('@/i18n', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}))

describe('boardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('should not create duplicate if sessionId already exists', async () => {
      const { winterboardApi } = await import('@/modules/winterboard/api/winterboardApi')
      const store = useBoardStore()

      // Set existing sessionId
      store.sessionId = 'existing-session-123'

      const result = await store.createSession()

      // Should return existing sessionId without calling API
      expect(result).toBe('existing-session-123')
      expect(winterboardApi.createSession).not.toHaveBeenCalled()
    })

    it('should create new session if no sessionId exists', async () => {
      const { winterboardApi } = await import('@/modules/winterboard/api/winterboardApi')
      const mockSession = {
        id: 'new-session-456',
        name: 'Test Session',
        owner_id: 'user-123',
        updated_at: new Date().toISOString(),
        state: null,
        page_count: 1,
        thumbnail_url: null,
        rev: 1,
        created_at: new Date().toISOString(),
      }
      vi.mocked(winterboardApi.createSession).mockResolvedValue(mockSession as any)

      const store = useBoardStore()
      const result = await store.createSession('Test Session')

      expect(result).toBe('new-session-456')
      expect(store.sessionId).toBe('new-session-456')
      expect(winterboardApi.createSession).toHaveBeenCalled()
    })
  })

  describe('markDirty', () => {
    it('should set isDirty to true', () => {
      const store = useBoardStore()
      const syncStore = useBoardSyncStore()
      expect(syncStore.isDirty).toBe(false)

      store.markDirty()

      expect(syncStore.isDirty).toBe(true)
    })

    it('should schedule autosave with debounce', async () => {
      const store = useBoardStore()
      const autosaveSpy = vi.spyOn(store, 'autosave').mockResolvedValue()

      store.markDirty()

      // Autosave should not be called immediately
      expect(autosaveSpy).not.toHaveBeenCalled()

      // Fast-forward debounce time (3000ms)
      await vi.advanceTimersByTimeAsync(3000)

      expect(autosaveSpy).toHaveBeenCalledTimes(1)
    })

    it('should debounce multiple markDirty calls', async () => {
      const store = useBoardStore()
      const autosaveSpy = vi.spyOn(store, 'autosave').mockResolvedValue()

      // Call markDirty multiple times
      store.markDirty()
      await vi.advanceTimersByTimeAsync(500)
      store.markDirty()
      await vi.advanceTimersByTimeAsync(500)
      store.markDirty()

      // Still no autosave (debounce resets)
      expect(autosaveSpy).not.toHaveBeenCalled()

      // Fast-forward remaining time
      await vi.advanceTimersByTimeAsync(3000)

      // Only one autosave call
      expect(autosaveSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('loadSession', () => {
    it('should hydrate state from session data', async () => {
      const { winterboardApi } = await import('@/modules/winterboard/api/winterboardApi')
      const mockSession = {
        id: 'session-789',
        name: 'Loaded Session',
        owner_id: 'owner-456',
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        page_count: 1,
        thumbnail_url: null,
        rev: 1,
        state: {
          pages: [{ id: 'page-1', name: 'Page 1', strokes: [{ id: 'stroke-1' }], assets: [{ id: 'asset-1' }] }],
          currentPageIndex: 0,
        },
      }
      vi.mocked(winterboardApi.getSession).mockResolvedValue(mockSession as any)

      const store = useBoardStore()
      const syncStore = useBoardSyncStore()
      const result = await store.loadSession('session-789')

      expect(result).toBe(true)
      expect(store.sessionId).toBe('session-789')
      expect(store.sessionName).toBe('Loaded Session')
      // Strokes are now inside pages[currentPageIndex].strokes
      expect(store.currentStrokes).toEqual([{ id: 'stroke-1' }])
      expect(syncStore.syncStatus).toBe('saved')
    })

    it('should return false on error', async () => {
      const { winterboardApi } = await import('@/modules/winterboard/api/winterboardApi')
      vi.mocked(winterboardApi.getSession).mockRejectedValue(new Error('Not found'))

      const store = useBoardStore()
      const syncStore = useBoardSyncStore()
      const result = await store.loadSession('nonexistent')

      expect(result).toBe(false)
      expect(syncStore.syncStatus).toBe('error')
    })
  })

  describe('addStroke', () => {
    it('should add stroke to strokes array', () => {
      const store = useBoardStore()
      const stroke = { id: 'new-stroke', points: [] }

      store.addStroke(stroke)

      // Strokes are now inside pages[currentPageIndex].strokes
      expect(store.currentStrokes).toContainEqual(stroke)
    })

    it('should push current state to undoStack', () => {
      const store = useBoardStore()
      // Set up initial stroke in the current page
      store.pages[0].strokes = [{ id: 'existing' }]

      store.addStroke({ id: 'new' })

      expect(store.undoStack.length).toBe(1)
      expect(store.undoStack[0]).toEqual({ type: 'addStroke', stroke: { id: 'new' }, index: 1 })
    })

    it('should clear redoStack', () => {
      const store = useBoardStore()
      store.redoStack = [{ id: 'redo-state' }] as any

      store.addStroke({ id: 'new' })

      expect(store.redoStack).toEqual([])
    })

    it('should mark as dirty', () => {
      const store = useBoardStore()
      const syncStore = useBoardSyncStore()

      store.addStroke({ id: 'stroke' })

      expect(syncStore.isDirty).toBe(true)
    })
  })

  describe('undo/redo', () => {
    it('undo should restore previous state', () => {
      const store = useBoardStore()
      // Set up strokes in the current page
      store.pages[0].strokes = [{ id: 'stroke-1' }, { id: 'stroke-2' }]
      // UndoStack stores operations now. To revert to [{stroke-1}], we undo a previous addStroke of stroke-2.
      store.undoStack = [{ type: 'addStroke', stroke: { id: 'stroke-2' }, index: 1 }] as any

      store.undo()

      expect(store.currentStrokes).toEqual([{ id: 'stroke-1' }])
      expect(store.redoStack.length).toBe(1)
    })

    it('redo should restore next state', () => {
      const store = useBoardStore()
      // Set up strokes in the current page
      store.pages[0].strokes = [{ id: 'stroke-1' }]
      store.redoStack = [{ type: 'addStroke', stroke: { id: 'stroke-2' }, index: 1 }] as any

      store.redo()

      expect(store.currentStrokes).toEqual([{ id: 'stroke-1' }, { id: 'stroke-2' }])
      expect(store.undoStack.length).toBe(1)
    })

    it('canUndo should be false when undoStack is empty', () => {
      const store = useBoardStore()
      expect(store.canUndo).toBe(false)
    })

    it('canRedo should be false when redoStack is empty', () => {
      const store = useBoardStore()
      expect(store.canRedo).toBe(false)
    })

    it('undo/redo should work for deleteStroke', () => {
      const store = useBoardStore()
      store.pages[0].strokes = [{ id: 'stroke-1' }, { id: 'stroke-2' }]
      store.undoStack = [{ type: 'deleteStroke', stroke: { id: 'stroke-2' }, index: 1 }] as any

      store.undo()
      expect(store.currentStrokes).toEqual([{ id: 'stroke-1' }, { id: 'stroke-2' }, { id: 'stroke-2' }])

      // redo should remove the re-inserted stroke at index
      store.redo()
      expect(store.currentStrokes).toEqual([{ id: 'stroke-1' }, { id: 'stroke-2' }])
    })

    it('undo/redo should work for updateStroke', () => {
      const store = useBoardStore()
      store.pages[0].strokes = [{ id: 's1', v: 2 }]
      store.undoStack = [{ type: 'updateStroke', prev: { id: 's1', v: 1 }, next: { id: 's1', v: 2 }, index: 0 }] as any

      store.undo()
      expect(store.currentStrokes).toEqual([{ id: 's1', v: 1 }])

      store.redo()
      expect(store.currentStrokes).toEqual([{ id: 's1', v: 2 }])
    })

    it('undo/redo should work for clearBoard', () => {
      const store = useBoardStore()
      store.pages[0].strokes = [{ id: 's1' }]
      store.pages[0].assets = [{ id: 'a1' }]
      store.undoStack = [{ type: 'clearBoard', prevStrokes: [{ id: 's1' }], prevAssets: [{ id: 'a1' }] }] as any

      store.undo()
      expect(store.pages[0].strokes).toEqual([{ id: 's1' }])
      expect(store.pages[0].assets).toEqual([{ id: 'a1' }])

      store.redo()
      expect(store.pages[0].strokes).toEqual([])
      expect(store.pages[0].assets).toEqual([])
    })

    it('undo/redo should work for updateAsset', () => {
      const store = useBoardStore()
      store.pages[0].assets = [{ id: 'a1', x: 10 }]
      store.undoStack = [{ type: 'updateAsset', prev: { id: 'a1', x: 1 }, next: { id: 'a1', x: 10 }, index: 0 }] as any

      store.undo()
      expect(store.pages[0].assets).toEqual([{ id: 'a1', x: 1 }])

      store.redo()
      expect(store.pages[0].assets).toEqual([{ id: 'a1', x: 10 }])
    })
  })

  describe('tool state', () => {
    it('setTool should update currentTool', () => {
      const store = useBoardStore()
      store.setTool('highlighter')
      expect(store.currentTool).toBe('highlighter')
    })

    it('setColor should update currentColor', () => {
      const store = useBoardStore()
      store.setColor('#ff0000')
      expect(store.currentColor).toBe('#ff0000')
    })

    it('setSize should update currentSize', () => {
      const store = useBoardStore()
      store.setSize(4)
      expect(store.currentSize).toBe(4)
    })

    it('setZoom should clamp value between 0.25 and 4', () => {
      const store = useBoardStore()

      store.setZoom(0.1)
      expect(store.zoom).toBe(0.25)

      store.setZoom(10)
      expect(store.zoom).toBe(4)

      store.setZoom(1.5)
      expect(store.zoom).toBe(1.5)
    })
  })
})
