import { defineStore } from 'pinia'
import { soloApi } from '@/modules/solo/api/soloApi'
import { notifyError, notifySuccess } from '@/utils/notify'
import { i18n } from '@/i18n'
import type { SoloSession } from '@/modules/solo/types/solo'
import { useBoardSyncStore } from './boardSyncStore'
// F29-STEALTH: Import stealth autosave utilities
import {
  startSaveWindow,
  endSaveWindow,
  recordOverlayCopy,
  recordSaveRtt,
} from '../perf/saveWindowMetrics'
import {
  startRenderGuard,
  stopRenderGuard,
  getExtraDrawsDuringSave,
} from '../render/guards'
import { cancelPendingRender } from '../render/renderQueue'
import {
  showSnapshotOverlay,
  hideSnapshotOverlay,
} from '../render/snapshotOverlay'
import type Konva from 'konva'

const translate = (key: string, params?: Record<string, unknown>) => {
  try {
    return i18n.global?.t?.(key, params || {}) ?? key
  } catch {
    return key
  }
}

export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'error'

const IS_TEST_ENV = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.MODE === 'test'
const IS_DEV_ENV = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.DEV
const AUTOSAVE_DEBOUNCE_MS = 3000 // Increased to reduce flickering

// Module-level timer for autosave
let _autosaveTimer: number | null = null

// F29-AS.23: AbortController for cancellable saves
let _currentSaveController: AbortController | null = null
// F29-AS.6: Pending save state for coalescing
let _pendingSave = false
// F29-AS.24: Back-pressure aware debounce
let _currentDebounceMs = 3000
const MIN_DEBOUNCE_MS = AUTOSAVE_DEBOUNCE_MS
const MAX_DEBOUNCE_MS = 5000
let _lastSaveRTT = 0
let _lastMarkDirtyTs = 0
let _markDirtySeq = 0

// F29-STEALTH: Stage reference for render guard/overlay
let _stageRef: Konva.Stage | null = null
let _saveWindowRev = 0

/**
 * F29-STEALTH: Set stage reference for stealth autosave
 * Call this from BoardCanvas onMounted
 */
export function setStageRef(stage: Konva.Stage | null): void {
  _stageRef = stage
  logAutosaveDebug('setStageRef', { hasStage: !!stage })
}

const AUTOSAVE_DEBUG_ENABLED = IS_DEV_ENV && !IS_TEST_ENV

function logAutosaveDebug(event: string, payload: Record<string, unknown> = {}): void {
  if (!AUTOSAVE_DEBUG_ENABLED) return
  const timestamp = new Date().toISOString()
  // eslint-disable-next-line no-console
  console.log('[autosave.debug]', { event, timestamp, ...payload })
}

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

  // UI state
  currentTool: string
  currentColor: string
  currentSize: number
  zoom: number

  // History
  undoStack: unknown[]
  redoStack: unknown[]
}

export const useBoardStore = defineStore('board', {
  state: (): BoardState => ({
    // Session
    sessionId: null,
    sessionName: 'Untitled',
    ownerId: null,

    // Board data - strokes/assets are inside pages
    pages: [{ id: 'page-1', name: 'Page 1', strokes: [], assets: [] }],
    currentPageIndex: 0,

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
    
    // Current page strokes/assets for easy access
    // IMPORTANT: Return the actual array reference, not a new array
    // F29-CRITICAL-FIX: Return ORIGINAL array, NO copying
    // Copying with [...] creates new reference → flicker on autosave
    currentStrokes(state): unknown[] {
      const page = state.pages[state.currentPageIndex]
      if (!page) return []
      // Return original reference - Vue will detect changes when page is replaced
      return page.strokes
    },
    currentAssets(state): unknown[] {
      const page = state.pages[state.currentPageIndex]
      if (!page) return []
      // F29-CRITICAL-FIX: Return original reference, NO copying
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
      const syncStore = useBoardSyncStore()
      syncStore.setStatus('syncing')

      try {
        const session = await soloApi.getSession(sessionId)
        this.hydrateFromSession(session)
        const savedAt = new Date(session.updated_at)
        syncStore.setStatus('saved')
        syncStore.setLastSaved(savedAt)
        syncStore.setDirty(false)
        console.log('[ui.session_loaded]', { sessionId })
        return true
      } catch (error) {
        syncStore.setStatus('error')
        syncStore.setError(translate('solo.sync.loadError'))
        notifyError(translate('solo.sync.loadError'))
        console.error('[BoardStore] loadSession failed:', error)
        return false
      }
    },

    /**
     * Create new session (only if no sessionId exists)
     */
    async createSession(name?: string): Promise<string | null> {
      const syncStore = useBoardSyncStore()
      // Anti-duplicate: only create if no session exists
      if (this.sessionId) {
        console.warn('[BoardStore] Session already exists, skipping create')
        return this.sessionId
      }

      syncStore.setStatus('syncing')

      try {
        const session = await soloApi.createSession({
          name: name || this.sessionName,
          state: this.serializedState as { pages: unknown[] },
        })

        this.sessionId = session.id
        this.ownerId = session.owner_id || null
        this.sessionName = session.name
        const savedAt = new Date()
        syncStore.setStatus('saved')
        syncStore.setLastSaved(savedAt)
        syncStore.setDirty(false)

        console.log('[ui.session_created]', { sessionId: session.id })
        return session.id
      } catch (error) {
        syncStore.setStatus('error')
        syncStore.setError(translate('solo.sync.createError'))
        notifyError(translate('solo.sync.createError'))
        console.error('[BoardStore] createSession failed:', error)
        return null
      }
    },

    /**
     * Update existing session
     */
    async updateSession(): Promise<boolean> {
      const syncStore = useBoardSyncStore()
      if (!this.sessionId) {
        console.warn('[BoardStore] No sessionId, creating new session')
        return !!(await this.createSession())
      }

      // Block autosave during export
      if (syncStore.isExporting) {
        console.log('[BoardStore] Export in progress, skipping autosave')
        return false
      }

      try {
        const session = await soloApi.updateSession(this.sessionId, {
          name: this.sessionName,
          state: this.serializedState as { pages: unknown[] },
        })

        // Update syncStore only
        const newSavedAt = new Date(session.updated_at)
        syncStore.setStatus('saved')
        syncStore.setLastSaved(newSavedAt)
        syncStore.setDirty(false)
        syncStore.setError(null)

        console.log('[ui.session_saved]', { sessionId: this.sessionId })
        return true
      } catch (error) {
        syncStore.setStatus('error')
        syncStore.setError(translate('solo.sync.saveError'))
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

      // isDirty is now in syncStore
    },

    // ============ Autosave ============

    /**
     * Mark state as dirty and schedule autosave
     * F29-AS.1: Update syncStore to decouple from render path
     * F29-AS.5: Use rAF → idle → network scheduling
     * F29-AS.6: Coalesce rapid changes into single save
     */
    markDirty(): void {
      const syncStore = useBoardSyncStore()
      const wasDirty = syncStore.isDirty
      syncStore.setDirty(true)

      if (_pendingSave && wasDirty) {
        logAutosaveDebug('markDirty.skipDuplicate', {
          pendingSave: _pendingSave,
          wasDirty,
        })
        return
      }

      // F29-AS.6: Mark pending save for coalescing
      _pendingSave = true
      _markDirtySeq += 1
      const now = performance.now()
      const deltaSinceLast = _lastMarkDirtyTs ? now - _lastMarkDirtyTs : null
      _lastMarkDirtyTs = now
      logAutosaveDebug('markDirty', {
        seq: _markDirtySeq,
        deltaSinceLastMs: deltaSinceLast,
        debounceMs: _currentDebounceMs,
        pendingSave: _pendingSave,
        isDirty: syncStore.isDirty,
      })

      // Clear existing timer
      if (_autosaveTimer) {
        clearTimeout(_autosaveTimer)
        logAutosaveDebug('markDirty.clearTimer', { seq: _markDirtySeq })
      }

      // In tests ми не використовуємо idle-шедулер, щоб unit-тести були детермінованими
      if (IS_TEST_ENV) {
        _autosaveTimer = window.setTimeout(() => {
          this.autosave()
        }, AUTOSAVE_DEBOUNCE_MS)
        logAutosaveDebug('markDirty.scheduleTestTimer', { seq: _markDirtySeq, debounceMs: AUTOSAVE_DEBOUNCE_MS })
        return
      }

      // F29-AS.5: Schedule autosave with adaptive debounce (prod)
      _autosaveTimer = window.setTimeout(() => {
        this.scheduleIdleSave()
      }, _currentDebounceMs)
      logAutosaveDebug('markDirty.scheduleDebounce', { seq: _markDirtySeq, debounceMs: _currentDebounceMs })
    },

    /**
     * F29-AS.5: Schedule save during idle time
     */
    scheduleIdleSave(): void {
      const syncStore = useBoardSyncStore()
      if (!_pendingSave || !syncStore.isDirty) return
      logAutosaveDebug('scheduleIdleSave.start', {
        pendingSave: _pendingSave,
        isDirty: syncStore.isDirty,
        debounceMs: _currentDebounceMs,
      })

      // Use requestIdleCallback if available, otherwise setTimeout
      if (!IS_TEST_ENV && 'requestIdleCallback' in window) {
        ;(window as Window & { requestIdleCallback: (cb: () => void, opts?: { timeout: number }) => void }).requestIdleCallback(
          () => {
            this.autosave()
          },
          { timeout: 800 }
        )
        logAutosaveDebug('scheduleIdleSave.requestIdle', {})
      } else {
        // Fallback: schedule after current frame (or immediately in tests)
        const schedule = () => {
          window.setTimeout(() => {
            this.autosave()
          }, 0)
          logAutosaveDebug('scheduleIdleSave.timeoutFallback', {})
        }
        if (IS_TEST_ENV) {
          schedule()
        } else {
          requestAnimationFrame(() => {
            schedule()
          })
          logAutosaveDebug('scheduleIdleSave.rafFallback', {})
        }
      }
    },

    /**
     * Perform autosave
     * F29-AS.23: Support abortable saves
     * F29-AS.24: Back-pressure aware debounce
     * F29-STEALTH: Integrated stealth save window
     */
    async autosave(): Promise<void> {
      const syncStore = useBoardSyncStore()
      if (!syncStore.isDirty) return

      // F29-AS.23: Abort previous save if still pending
      if (_currentSaveController) {
        _currentSaveController.abort()
        _currentSaveController = null
        logAutosaveDebug('autosave.abortPrevious', {})
      }

      // F29-AS.6: Reset pending flag
      _pendingSave = false

      // F29-AS.23: Create new abort controller
      _currentSaveController = new AbortController()
      const startTime = performance.now()
      
      // F29-STEALTH: Start save window BEFORE any network/serialization
      _saveWindowRev++
      const currentRev = _saveWindowRev
      startSaveWindow(this.sessionId || 'new', currentRev)
      
      // F29-STEALTH: Cancel any pending rAF renders before guarding
      cancelPendingRender()
      
      let overlayCopyMs = 0
      if (_stageRef) {
        // F29-STEALTH: Capture snapshot BEFORE enabling guard to avoid extra draws
        overlayCopyMs = await showSnapshotOverlay(_stageRef)
        recordOverlayCopy(overlayCopyMs)
        logAutosaveDebug('autosave.overlayShown', { overlayCopyMs })
        
        // F29-STEALTH: Activate render guard to block draw() calls
        startRenderGuard(_stageRef)
      }
      
      logAutosaveDebug('autosave.start', {
        hasSession: !!this.sessionId,
        debounceMs: _currentDebounceMs,
        rev: currentRev,
      })

      let saveResult: 'success' | 'queued' | 'error' = 'error'
      
      try {
        if (this.sessionId) {
          await this.updateSession()
        } else {
          await this.createSession()
        }

        // F29-AS.24: Adjust debounce based on RTT
        _lastSaveRTT = performance.now() - startTime
        recordSaveRtt(_lastSaveRTT)
        saveResult = 'success'
        
        logAutosaveDebug('autosave.success', {
          rttMs: _lastSaveRTT,
          sessionId: this.sessionId,
          extraDraws: getExtraDrawsDuringSave(),
        })
        if (_lastSaveRTT > 400) {
          // Slow network - increase debounce
          _currentDebounceMs = Math.min(MAX_DEBOUNCE_MS, _currentDebounceMs + 500)
        } else if (_lastSaveRTT < 200 && _currentDebounceMs > MIN_DEBOUNCE_MS) {
          // Fast network - decrease debounce
          _currentDebounceMs = Math.max(MIN_DEBOUNCE_MS, _currentDebounceMs - 200)
        }
        logAutosaveDebug('autosave.debounceAdjusted', { debounceMs: _currentDebounceMs })
      } catch (error) {
        // F29-AS.24: On error, increase debounce for backoff
        _currentDebounceMs = Math.min(MAX_DEBOUNCE_MS, _currentDebounceMs * 1.5)
        saveResult = 'error'
        console.error('[BoardStore] autosave failed:', error)
        logAutosaveDebug('autosave.error', { message: (error as Error)?.message, debounceMs: _currentDebounceMs })
      } finally {
        _currentSaveController = null
        
        // F29-STEALTH: End save window and cleanup
        endSaveWindow(saveResult)
        
        // F29-STEALTH: Stop render guard and restore draw() methods
        if (_stageRef) {
          stopRenderGuard(_stageRef)
          
          // F29-STEALTH: Hide overlay with fade
          hideSnapshotOverlay(100)
        }
        
        logAutosaveDebug('autosave.windowClosed', {
          result: saveResult,
          extraDraws: getExtraDrawsDuringSave(),
        })
      }
    },

    /**
     * Retry failed sync
     */
    async retrySync(): Promise<void> {
      const syncStore = useBoardSyncStore()
      if (syncStore.syncStatus !== 'error') return
      // Reset debounce on manual retry
      _currentDebounceMs = AUTOSAVE_DEBOUNCE_MS
      await this.autosave()
    },

    // ============ Drawing Actions ============

    addStroke(stroke: unknown): void {
      // CRITICAL FIX: Replace entire page object to trigger Vue reactivity
      // Direct array mutation doesn't work reliably with nested Pinia state
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) {
        console.error('[BoardStore] addStroke: No page found at index', pageIndex)
        return
      }

      this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
      this.redoStack = []
      
      // Replace the entire page object to trigger reactivity
      this.pages[pageIndex] = {
        ...page,
        strokes: [...page.strokes, stroke]
      }
      
      this.markDirty()
    },

    undo(): void {
      if (!this.canUndo) return
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      const previousState = this.undoStack.pop()
      this.redoStack.push(JSON.parse(JSON.stringify(page.strokes)))
      // Replace page to trigger reactivity
      this.pages[pageIndex] = { ...page, strokes: previousState as unknown[] }
      this.markDirty()
    },

    redo(): void {
      if (!this.canRedo) return
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      const nextState = this.redoStack.pop()
      this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
      // Replace page to trigger reactivity
      this.pages[pageIndex] = { ...page, strokes: nextState as unknown[] }
      this.markDirty()
    },

    clearBoard(): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
      this.redoStack = []
      // Replace page to trigger reactivity
      this.pages[pageIndex] = { ...page, strokes: [] }
      this.markDirty()
    },
    
    updateStroke(stroke: unknown): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      const strokeObj = stroke as { id: string }
      const index = page.strokes.findIndex((s: unknown) => (s as { id: string }).id === strokeObj.id)
      if (index !== -1) {
        this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
        this.redoStack = []
        // Replace page with new strokes array to trigger reactivity
        const newStrokes = [...page.strokes]
        newStrokes[index] = stroke
        this.pages[pageIndex] = { ...page, strokes: newStrokes }
        this.markDirty()
      }
    },
    
    deleteStroke(strokeId: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      const index = page.strokes.findIndex((s: unknown) => (s as { id: string }).id === strokeId)
      if (index !== -1) {
        this.undoStack.push(JSON.parse(JSON.stringify(page.strokes)))
        this.redoStack = []
        // Replace page with filtered strokes to trigger reactivity
        this.pages[pageIndex] = { ...page, strokes: page.strokes.filter((_, i) => i !== index) }
        this.markDirty()
      }
    },

    // ============ Asset Management (Paste) ============

    /**
     * Add image asset from paste event
     */
    addImageAsset(src: string, width: number, height: number): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
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

      // Replace page to trigger reactivity
      this.pages[pageIndex] = { ...page, assets: [...page.assets, asset] }
      this.markDirty()
      console.log('[ui.asset_added]', { type: 'image' })
    },
    
    /**
     * Add asset (from BoardCanvas paste)
     */
    addAsset(asset: unknown): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      // Replace page to trigger reactivity
      this.pages[pageIndex] = { ...page, assets: [...page.assets, asset] }
      this.markDirty()
      console.log('[ui.asset_added]', { assetId: (asset as { id: string }).id })
    },
    
    /**
     * Update asset position/size
     */
    updateAsset(asset: unknown): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      const assetData = asset as { id: string }
      const index = page.assets.findIndex((a: unknown) => (a as { id: string }).id === assetData.id)
      if (index !== -1) {
        const newAssets = [...page.assets]
        newAssets[index] = asset
        // Replace page to trigger reactivity
        this.pages[pageIndex] = { ...page, assets: newAssets }
        this.markDirty()
      }
    },
    
    deleteAsset(assetId: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      const index = page.assets.findIndex((a: unknown) => (a as { id: string }).id === assetId)
      if (index !== -1) {
        // Replace page to trigger reactivity
        this.pages[pageIndex] = { ...page, assets: page.assets.filter((_, i) => i !== index) }
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
      const syncStore = useBoardSyncStore()
      syncStore.setExporting(isExporting)
      syncStore.setExportJob(jobId || null)
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
