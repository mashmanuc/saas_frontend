import { defineStore } from 'pinia'
import { soloApi } from '@/modules/solo/api/soloApi'
import { notifyError, notifySuccess } from '@/utils/notify'
import { i18n } from '@/i18n'
import type { SoloSession } from '@/modules/solo/types/solo'

const translate = (key: string, params?: Record<string, unknown>) => {
  try {
    return i18n.global?.t?.(key, params || {}) ?? key
  } catch {
    return key
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error'

// Module-level timer for autosave
let _autosaveTimer: number | null = null

export interface Page {
  id: string
  name: string
  strokes: unknown[]
  assets: unknown[]
}

export interface BoardState {
  // Session
  sessionId: string | null
  sessionName: string
  ownerId: string | null

  // Board data - strokes/assets are now inside pages
  pages: Page[]
  currentPageIndex: number

  // Sync state
  syncStatus: SyncStatus
  lastSavedAt: Date | null
  syncError: string | null
  isDirty: boolean

  // Export state
  isExporting: boolean
  exportJobId: string | null

  // UI state
  currentTool: string
  currentColor: string
  currentSize: number
  zoom: number

  // History
  undoStack: unknown[]
  redoStack: unknown[]
}

const AUTOSAVE_DEBOUNCE_MS = 3000 // Increased to reduce flickering

export const useBoardStore = defineStore('board', {
  state: (): BoardState => ({
    // Session
    sessionId: null,
    sessionName: 'Untitled',
    ownerId: null,

    // Board data - strokes/assets are inside pages
    pages: [{ id: 'page-1', name: 'Page 1', strokes: [], assets: [] }],
    currentPageIndex: 0,

    // Sync state
    syncStatus: 'idle',
    lastSavedAt: null,
    syncError: null,
    isDirty: false,

    // Export state
    isExporting: false,
    exportJobId: null,

    // UI state
    currentTool: 'pen',
    currentColor: '#1e293b',
    currentSize: 2,
    zoom: 1,

    // History
    undoStack: [],
    redoStack: [],
  }),

  getters: {
    canUndo: (state) => state.undoStack.length > 0,
    canRedo: (state) => state.redoStack.length > 0,
    currentPage: (state): Page | null => state.pages[state.currentPageIndex] || null,
    hasSession: (state) => !!state.sessionId,
    isSyncing: (state) => state.syncStatus === 'syncing',
    
    // Current page strokes/assets for easy access
    // IMPORTANT: Return the actual array reference, not a new array
    // This prevents unnecessary re-renders when other state changes
    currentStrokes(state): unknown[] {
      const page = state.pages[state.currentPageIndex]
      // Return the actual strokes array reference (not a copy)
      // If page doesn't exist, return empty array from state to keep reference stable
      if (!page) return []
      return page.strokes
    },
    currentAssets(state): unknown[] {
      const page = state.pages[state.currentPageIndex]
      if (!page) return []
      return page.assets
    },

    // Serialize state for API
    serializedState: (state) => ({
      pages: state.pages,
      currentPageIndex: state.currentPageIndex,
    }),
  },

  actions: {
    // ============ Session Management ============

    /**
     * Load existing session from backend
     */
    async loadSession(sessionId: string): Promise<boolean> {
      this.syncStatus = 'syncing'

      try {
        const session = await soloApi.getSession(sessionId)
        this.hydrateFromSession(session)
        this.syncStatus = 'saved'
        this.lastSavedAt = new Date(session.updated_at)
        console.log('[ui.session_loaded]', { sessionId })
        return true
      } catch (error) {
        this.syncStatus = 'error'
        this.syncError = translate('solo.sync.loadError')
        notifyError(translate('solo.sync.loadError'))
        console.error('[BoardStore] loadSession failed:', error)
        return false
      }
    },

    /**
     * Create new session (only if no sessionId exists)
     */
    async createSession(name?: string): Promise<string | null> {
      // Anti-duplicate: only create if no session exists
      if (this.sessionId) {
        console.warn('[BoardStore] Session already exists, skipping create')
        return this.sessionId
      }

      this.syncStatus = 'syncing'

      try {
        const session = await soloApi.createSession({
          name: name || this.sessionName,
          state: this.serializedState as { pages: unknown[] },
        })

        this.sessionId = session.id
        this.ownerId = session.owner_id || null
        this.sessionName = session.name
        this.syncStatus = 'saved'
        this.lastSavedAt = new Date()
        this.isDirty = false

        console.log('[ui.session_created]', { sessionId: session.id })
        return session.id
      } catch (error) {
        this.syncStatus = 'error'
        this.syncError = translate('solo.sync.createError')
        notifyError(translate('solo.sync.createError'))
        console.error('[BoardStore] createSession failed:', error)
        return null
      }
    },

    /**
     * Update existing session
     */
    async updateSession(): Promise<boolean> {
      if (!this.sessionId) {
        console.warn('[BoardStore] No sessionId, creating new session')
        return !!(await this.createSession())
      }

      // Block autosave during export
      if (this.isExporting) {
        console.log('[BoardStore] Export in progress, skipping autosave')
        return false
      }

      // Silent save - don't change syncStatus to 'syncing' to avoid flickering
      const previousStatus = this.syncStatus

      try {
        const session = await soloApi.updateSession(this.sessionId, {
          name: this.sessionName,
          state: this.serializedState as { pages: unknown[] },
        })

        // Only update if status changed to avoid re-renders
        if (this.syncStatus !== 'saved') {
          this.syncStatus = 'saved'
        }
        // Only update lastSavedAt if it's significantly different (>1 second)
        const newSavedAt = new Date(session.updated_at)
        if (!this.lastSavedAt || Math.abs(newSavedAt.getTime() - this.lastSavedAt.getTime()) > 1000) {
          this.lastSavedAt = newSavedAt
        }
        this.isDirty = false
        if (this.syncError !== null) {
          this.syncError = null
        }

        console.log('[ui.session_saved]', { sessionId: this.sessionId })
        return true
      } catch (error) {
        // Only update if status changed
        if (this.syncStatus !== 'error') {
          this.syncStatus = 'error'
          this.syncError = translate('solo.sync.saveError')
        }
        console.error('[BoardStore] updateSession failed:', error)
        return false
      }
    },

    /**
     * Hydrate store from session data
     */
    hydrateFromSession(session: SoloSession): void {
      this.sessionId = session.id
      this.sessionName = session.name
      this.ownerId = session.owner_id || null

      if (session.state) {
        const state = session.state as Record<string, unknown>
        // Support both old format (strokes at root) and new format (strokes in pages)
        if (state.pages && Array.isArray(state.pages)) {
          this.pages = state.pages as Page[]
        } else {
          // Legacy format - migrate strokes/assets to first page
          const strokes = (state.strokes as unknown[]) || []
          const assets = (state.assets as unknown[]) || []
          this.pages = [{ id: 'page-1', name: 'Page 1', strokes, assets }]
        }
        this.currentPageIndex = (state.currentPageIndex as number) || 0
      }

      this.isDirty = false
    },

    // ============ Autosave ============


    /**
     * Mark state as dirty and schedule autosave
     */
    markDirty(): void {
      this.isDirty = true

      // Clear existing timer
      if (_autosaveTimer) {
        clearTimeout(_autosaveTimer)
      }

      // Schedule autosave with debounce
      _autosaveTimer = window.setTimeout(() => {
        this.autosave()
      }, AUTOSAVE_DEBOUNCE_MS)
    },

    /**
     * Perform autosave
     */
    async autosave(): Promise<void> {
      if (!this.isDirty) return

      if (this.sessionId) {
        await this.updateSession()
      } else {
        await this.createSession()
      }
    },

    /**
     * Retry failed sync
     */
    async retrySync(): Promise<void> {
      if (this.syncStatus !== 'error') return
      await this.autosave()
    },

    // ============ Drawing Actions ============

    addStroke(stroke: unknown): void {
      const page = this.pages[this.currentPageIndex]
      if (!page) return
      
      // Save current state for undo
      this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
      this.redoStack = []

      page.strokes.push(stroke)
      this.markDirty()
    },

    undo(): void {
      if (!this.canUndo) return
      const page = this.pages[this.currentPageIndex]
      if (!page) return

      const previousState = this.undoStack.pop()
      this.redoStack.push(JSON.parse(JSON.stringify(page.strokes)))
      page.strokes = previousState as unknown[]
      this.markDirty()
    },

    redo(): void {
      if (!this.canRedo) return
      const page = this.pages[this.currentPageIndex]
      if (!page) return

      const nextState = this.redoStack.pop()
      this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
      page.strokes = nextState as unknown[]
      this.markDirty()
    },

    clearBoard(): void {
      const page = this.pages[this.currentPageIndex]
      if (!page) return
      
      this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
      this.redoStack = []
      page.strokes = []
      this.markDirty()
    },
    
    updateStroke(stroke: unknown): void {
      const page = this.pages[this.currentPageIndex]
      if (!page) return
      
      const strokeObj = stroke as { id: string }
      const index = page.strokes.findIndex((s: unknown) => (s as { id: string }).id === strokeObj.id)
      if (index !== -1) {
        this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
        this.redoStack = []
        page.strokes[index] = stroke
        this.markDirty()
      }
    },
    
    deleteStroke(strokeId: string): void {
      const page = this.pages[this.currentPageIndex]
      if (!page) return
      
      const index = page.strokes.findIndex((s: unknown) => (s as { id: string }).id === strokeId)
      if (index !== -1) {
        this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
        this.redoStack = []
        page.strokes.splice(index, 1)
        this.markDirty()
      }
    },

    // ============ Asset Management (Paste) ============

    /**
     * Add image asset from paste event
     */
    addImageAsset(src: string, width: number, height: number): void {
      const page = this.pages[this.currentPageIndex]
      if (!page) return
      
      const asset = {
        id: `asset-${Date.now()}`,
        type: 'image',
        src,
        x: 100,
        y: 100,
        width,
        height,
        zIndex: page.assets.length + 1,
        locked: false,
      }

      page.assets.push(asset)
      this.markDirty()
      console.log('[ui.asset_added]', { type: 'image' })
    },
    
    /**
     * Add asset (from BoardCanvas paste)
     */
    addAsset(asset: unknown): void {
      const page = this.pages[this.currentPageIndex]
      if (!page) return
      
      page.assets.push(asset)
      this.markDirty()
      console.log('[ui.asset_added]', { assetId: (asset as { id: string }).id })
    },
    
    /**
     * Update asset position/size
     */
    updateAsset(asset: unknown): void {
      const page = this.pages[this.currentPageIndex]
      if (!page) return
      
      const assetData = asset as { id: string }
      const index = page.assets.findIndex((a: unknown) => (a as { id: string }).id === assetData.id)
      if (index !== -1) {
        page.assets[index] = asset
        this.markDirty()
      }
    },
    
    deleteAsset(assetId: string): void {
      const page = this.pages[this.currentPageIndex]
      if (!page) return
      
      const index = page.assets.findIndex((a: unknown) => (a as { id: string }).id === assetId)
      if (index !== -1) {
        page.assets.splice(index, 1)
        this.markDirty()
        console.log('[ui.asset_deleted]', { assetId })
      }
    },
    
    // ============ Page Management ============
    
    addPage(): void {
      const newPage: Page = {
        id: `page-${Date.now()}`,
        name: `Page ${this.pages.length + 1}`,
        strokes: [],
        assets: [],
      }
      this.pages.push(newPage)
      this.currentPageIndex = this.pages.length - 1
      this.undoStack = []
      this.redoStack = []
      this.markDirty()
    },
    
    goToPage(index: number): void {
      if (index >= 0 && index < this.pages.length) {
        this.currentPageIndex = index
        this.undoStack = []
        this.redoStack = []
      }
    },
    
    deletePage(index: number): void {
      if (this.pages.length <= 1) return // Keep at least one page
      
      this.pages.splice(index, 1)
      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = this.pages.length - 1
      }
      this.markDirty()
    },

    // ============ Tool State ============

    setTool(tool: string): void {
      this.currentTool = tool
    },

    setColor(color: string): void {
      this.currentColor = color
    },

    setSize(size: number): void {
      this.currentSize = size
    },

    setZoom(zoom: number): void {
      this.zoom = Math.max(0.25, Math.min(4, zoom))
    },

    // ============ Export ============

    setExporting(isExporting: boolean, jobId?: string): void {
      this.isExporting = isExporting
      this.exportJobId = jobId || null
    },

    // ============ Reset ============

    reset(): void {
      if (_autosaveTimer) {
        clearTimeout(_autosaveTimer)
        _autosaveTimer = null
      }

      this.$reset()
    },
  },
})
