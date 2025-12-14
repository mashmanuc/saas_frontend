import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBoardStore } from '../boardStore'

// Mock soloApi
vi.mock('@/modules/solo/api/soloApi', () => ({
  soloApi: {
    getSession: vi.fn(),
    createSession: vi.fn(),
    updateSession: vi.fn(),
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
      const { soloApi } = await import('@/modules/solo/api/soloApi')
      const store = useBoardStore()

      // Set existing sessionId
      store.sessionId = 'existing-session-123'

      const result = await store.createSession()

      // Should return existing sessionId without calling API
      expect(result).toBe('existing-session-123')
      expect(soloApi.createSession).not.toHaveBeenCalled()
    })

    it('should create new session if no sessionId exists', async () => {
      const { soloApi } = await import('@/modules/solo/api/soloApi')
      const mockSession = {
        id: 'new-session-456',
        name: 'Test Session',
        owner_id: 'user-123',
        updated_at: new Date().toISOString(),
      }
      vi.mocked(soloApi.createSession).mockResolvedValue(mockSession as any)

      const store = useBoardStore()
      const result = await store.createSession('Test Session')

      expect(result).toBe('new-session-456')
      expect(store.sessionId).toBe('new-session-456')
      expect(soloApi.createSession).toHaveBeenCalled()
    })
  })

  describe('markDirty', () => {
    it('should set isDirty to true', () => {
      const store = useBoardStore()
      expect(store.isDirty).toBe(false)

      store.markDirty()

      expect(store.isDirty).toBe(true)
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
      const { soloApi } = await import('@/modules/solo/api/soloApi')
      const mockSession = {
        id: 'session-789',
        name: 'Loaded Session',
        owner_id: 'owner-456',
        updated_at: new Date().toISOString(),
        state: {
          pages: [{ id: 'page-1', name: 'Page 1', strokes: [{ id: 'stroke-1' }], assets: [{ id: 'asset-1' }] }],
          currentPageIndex: 0,
        },
      }
      vi.mocked(soloApi.getSession).mockResolvedValue(mockSession as any)

      const store = useBoardStore()
      const result = await store.loadSession('session-789')

      expect(result).toBe(true)
      expect(store.sessionId).toBe('session-789')
      expect(store.sessionName).toBe('Loaded Session')
      // Strokes are now inside pages[currentPageIndex].strokes
      expect(store.currentStrokes).toEqual([{ id: 'stroke-1' }])
      expect(store.syncStatus).toBe('saved')
    })

    it('should return false on error', async () => {
      const { soloApi } = await import('@/modules/solo/api/soloApi')
      vi.mocked(soloApi.getSession).mockRejectedValue(new Error('Not found'))

      const store = useBoardStore()
      const result = await store.loadSession('nonexistent')

      expect(result).toBe(false)
      expect(store.syncStatus).toBe('error')
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
      expect(store.undoStack[0]).toEqual([{ id: 'existing' }])
    })

    it('should clear redoStack', () => {
      const store = useBoardStore()
      store.redoStack = [{ id: 'redo-state' }] as any

      store.addStroke({ id: 'new' })

      expect(store.redoStack).toEqual([])
    })

    it('should mark as dirty', () => {
      const store = useBoardStore()
      store.addStroke({ id: 'stroke' })

      expect(store.isDirty).toBe(true)
    })
  })

  describe('undo/redo', () => {
    it('undo should restore previous state', () => {
      const store = useBoardStore()
      // Set up strokes in the current page
      store.pages[0].strokes = [{ id: 'stroke-1' }, { id: 'stroke-2' }]
      store.undoStack = [[{ id: 'stroke-1' }]] as any

      store.undo()

      expect(store.currentStrokes).toEqual([{ id: 'stroke-1' }])
      expect(store.redoStack.length).toBe(1)
    })

    it('redo should restore next state', () => {
      const store = useBoardStore()
      // Set up strokes in the current page
      store.pages[0].strokes = [{ id: 'stroke-1' }]
      store.redoStack = [[{ id: 'stroke-1' }, { id: 'stroke-2' }]] as any

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
