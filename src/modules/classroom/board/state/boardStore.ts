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

const SOLO_BEACON_MAX_BYTES = 64 * 1024
const SOLO_SAVE_STREAM_MAX_BYTES = 2 * 1024 * 1024

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

// F29-STEALTH: Defer autosave while user is actively editing text to prevent focus/UX disruptions
let _isTextEditingActive = false

// F29-STABLE: Defer autosave while user is actively drawing/erasing (penDown)
let _isPointerInputActive = false

// F29-STABLE: Single idle-save timer after input ends
const STABLE_IDLE_SAVE_MS = 10_000
let _stableIdleSaveTimer: number | null = null

// F29-STABLE: store reference for module-level schedulers (set once from component)
let _stableAutosaveStore: ReturnType<typeof useBoardStore> | null = null

export function setStableAutosaveStore(store: ReturnType<typeof useBoardStore> | null): void {
  _stableAutosaveStore = store
}

function clearStableIdleSaveTimer(): void {
  if (_stableIdleSaveTimer) {
    clearTimeout(_stableIdleSaveTimer)
    _stableIdleSaveTimer = null
  }
}

function scheduleStableIdleSave(): void {
  // Only schedule if something is pending/dirty
  const syncStore = useBoardSyncStore()
  if (!_pendingSave || !syncStore.isDirty) return

  // Do not schedule while any input gate is active
  if (_isTextEditingActive || _isPointerInputActive) return

  clearStableIdleSaveTimer()
  _stableIdleSaveTimer = window.setTimeout(() => {
    // Guard again at execution time
    if (_isTextEditingActive || _isPointerInputActive) return
    if (!_stableAutosaveStore) return
    _stableAutosaveStore.scheduleIdleSave()
  }, STABLE_IDLE_SAVE_MS)
  logAutosaveDebug('stableIdleSave.scheduled', { idleMs: STABLE_IDLE_SAVE_MS })
}

/**
 * F29-STEALTH: Set stage reference for stealth autosave
 * Call this from BoardCanvas onMounted
 */
export function setStageRef(stage: Konva.Stage | null): void {
  _stageRef = stage
  logAutosaveDebug('setStageRef', { hasStage: !!stage })
}

/**
 * F29-STEALTH: BoardCanvas should call this while text edit overlay is active.
 * When true, autosave will be deferred until editing ends.
 */
export function setIsTextEditingActive(isActive: boolean): void {
  _isTextEditingActive = isActive
  logAutosaveDebug('setIsTextEditingActive', { isActive })

  if (isActive) {
    // Any active input cancels pending idle-save
    clearStableIdleSaveTimer()
    return
  }

  // On input end, schedule a single idle save
  scheduleStableIdleSave()
}

/**
 * F29-STABLE: BoardCanvas should call this for penDown/penUp (and eraser drag).
 * While active, autosave is deferred.
 */
export function setIsPointerInputActive(isActive: boolean): void {
  _isPointerInputActive = isActive
  logAutosaveDebug('setIsPointerInputActive', { isActive })

  if (isActive) {
    clearStableIdleSaveTimer()
    return
  }

  scheduleStableIdleSave()
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
  sessionId: string | null
  sessionName: string
  ownerId: string | null
  pages: Page[]
  currentPageIndex: number
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
     * Manual save (Ctrl/Cmd+S): immediate save without stealth overlay/guard.
     * Designed for Stable Board mode to avoid any visual interruption.
     */
    async manualSave(): Promise<void> {
      const syncStore = useBoardSyncStore()

      // Nothing to save
      if (!syncStore.isDirty) {
        logAutosaveDebug('manualSave.skipNotDirty', {})
        return
      }

      // Block manual save during export
      if (syncStore.isExporting) {
        logAutosaveDebug('manualSave.skipExporting', {})
        return
      }

      // Abort previous save if still pending
      if (_currentSaveController) {
        _currentSaveController.abort()
        _currentSaveController = null
        logAutosaveDebug('manualSave.abortPrevious', {})
      }

      // Clear scheduled autosave timers; manual save replaces them
      if (_autosaveTimer) {
        clearTimeout(_autosaveTimer)
        _autosaveTimer = null
      }
      clearStableIdleSaveTimer()

      // Reset pending flag
      _pendingSave = false

      _currentSaveController = new AbortController()
      const startTime = performance.now()

      logAutosaveDebug('manualSave.start', { hasSession: !!this.sessionId })
      try {
        syncStore.setStatus('syncing')

        if (this.sessionId) {
          await this.updateSession()
        } else {
          await this.createSession()
        }

        _lastSaveRTT = performance.now() - startTime
        recordSaveRtt(_lastSaveRTT)
        logAutosaveDebug('manualSave.success', { rttMs: _lastSaveRTT, sessionId: this.sessionId })
      } catch (error) {
        syncStore.setStatus('error')
        syncStore.setError((error as Error)?.message || translate('solo.sync.saveError'))
        logAutosaveDebug('manualSave.error', { message: (error as Error)?.message })
      } finally {
        _currentSaveController = null
      }
    },

    /**
     * Persist-on-exit via navigator.sendBeacon().
     * - If payload <= 64KB, use /beacon/ with { state }
     * - Else, best-effort keepalive fetch to /save-stream/ (<=2MB)
     * - Else, fallback to localStorage + heartbeat beacon
     */
    persistOnExit(): void {
      if (!this.sessionId) return

      const base = `/api/v1/solo/sessions/${this.sessionId}`
      const beaconUrl = `${base}/beacon/`
      const saveStreamUrl = `${base}/save-stream/`

      const statePayload = JSON.stringify({ state: this.serializedState })
      const stateBytes = new Blob([statePayload]).size

      const heartbeatPayload = JSON.stringify({ heartbeat: true })

      // Small payload: try beacon with state
      if (stateBytes <= SOLO_BEACON_MAX_BYTES) {
        try {
          const ok = navigator.sendBeacon(
            beaconUrl,
            new Blob([statePayload], { type: 'application/json' })
          )
          logAutosaveDebug('persistOnExit.beaconState', { ok, bytes: stateBytes })
          return
        } catch (error) {
          logAutosaveDebug('persistOnExit.beaconStateError', { error })
        }
      }

      // Medium payload: try keepalive fetch to save-stream
      if (stateBytes <= SOLO_SAVE_STREAM_MAX_BYTES) {
        try {
          void fetch(saveStreamUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: this.serializedState }),
            keepalive: true,
            credentials: 'include',
          })
          logAutosaveDebug('persistOnExit.saveStreamKeepalive', { bytes: stateBytes })
          return
        } catch (error) {
          logAutosaveDebug('persistOnExit.saveStreamKeepaliveError', { error })
        }
      }

      // Fallback: persist locally + heartbeat beacon
      try {
        const key = `board.persistOnExit.${this.sessionId}`
        localStorage.setItem(key, statePayload)
        logAutosaveDebug('persistOnExit.localStorage', { key, bytes: stateBytes })
      } catch (error) {
        logAutosaveDebug('persistOnExit.localStorageError', { error })
      }

      try {
        const ok = navigator.sendBeacon(
          beaconUrl,
          new Blob([heartbeatPayload], { type: 'application/json' })
        )
        logAutosaveDebug('persistOnExit.beaconHeartbeat', { ok })
      } catch (error) {
        logAutosaveDebug('persistOnExit.beaconHeartbeatError', { error })
      }
    },

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

      // Stable Board: while any input gate is active, do not schedule autosave timers.
      // We'll save after input ends (idle>=10s or explicit finish).
      if (_isTextEditingActive || _isPointerInputActive) {
        // Prevent any previously scheduled autosave from firing mid-input
        if (_autosaveTimer) {
          clearTimeout(_autosaveTimer)
          _autosaveTimer = null
        }
        logAutosaveDebug('markDirty.deferActiveInput', {
          seq: _markDirtySeq,
          isTextEditingActive: _isTextEditingActive,
          isPointerInputActive: _isPointerInputActive,
        })
        return
      }

      // Stable Board: if the stable idle-save scheduler is active, do not schedule
      // short debounce autosaves. Only one save after idle>=10s.
      if (_stableAutosaveStore) {
        if (_autosaveTimer) {
          clearTimeout(_autosaveTimer)
          _autosaveTimer = null
        }
        scheduleStableIdleSave()
        logAutosaveDebug('markDirty.stableIdleOnly', { seq: _markDirtySeq, idleMs: STABLE_IDLE_SAVE_MS })
        return
      }

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

      // Defer autosave while text editing is active to avoid interrupting typing
      if (_isTextEditingActive) {
        _pendingSave = true
        logAutosaveDebug('autosave.deferTextEditing', { debounceMs: _currentDebounceMs })
        if (_autosaveTimer) {
          clearTimeout(_autosaveTimer)
        }
        _autosaveTimer = window.setTimeout(() => {
          this.scheduleIdleSave()
        }, _currentDebounceMs)
        return
      }

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

      this.undoStack.push({ type: 'addStroke', stroke, index: page.strokes.length })
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

      const action = this.undoStack.pop() as
        | { type: 'addStroke'; stroke: unknown; index: number }
        | { type: 'deleteStroke'; stroke: unknown; index: number }
        | { type: 'updateStroke'; prev: unknown; next: unknown; index: number }
        | { type: 'clearBoard'; prevStrokes: unknown[]; prevAssets: unknown[] }

      if (!action) return

      if (action.type === 'addStroke') {
        const nextStrokes = page.strokes.filter((_, i) => i !== action.index)
        this.pages[pageIndex] = { ...page, strokes: nextStrokes }
        this.redoStack.push(action)
      } else if (action.type === 'deleteStroke') {
        const nextStrokes = [...page.strokes]
        nextStrokes.splice(action.index, 0, action.stroke)
        this.pages[pageIndex] = { ...page, strokes: nextStrokes }
        this.redoStack.push(action)
      } else if (action.type === 'updateStroke') {
        const nextStrokes = [...page.strokes]
        nextStrokes[action.index] = action.prev
        this.pages[pageIndex] = { ...page, strokes: nextStrokes }
        this.redoStack.push(action)
      } else if (action.type === 'clearBoard') {
        this.pages[pageIndex] = { ...page, strokes: action.prevStrokes, assets: action.prevAssets }
        this.redoStack.push(action)
      }
      this.markDirty()
    },

    redo(): void {
      if (!this.canRedo) return
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const action = this.redoStack.pop() as
        | { type: 'addStroke'; stroke: unknown; index: number }
        | { type: 'deleteStroke'; stroke: unknown; index: number }
        | { type: 'updateStroke'; prev: unknown; next: unknown; index: number }
        | { type: 'clearBoard'; prevStrokes: unknown[]; prevAssets: unknown[] }

      if (!action) return

      if (action.type === 'addStroke') {
        this.undoStack.push(action)
        const nextStrokes = [...page.strokes]
        nextStrokes.splice(action.index, 0, action.stroke)
        this.pages[pageIndex] = { ...page, strokes: nextStrokes }
      } else if (action.type === 'deleteStroke') {
        this.undoStack.push(action)
        this.pages[pageIndex] = { ...page, strokes: page.strokes.filter((_, i) => i !== action.index) }
      } else if (action.type === 'updateStroke') {
        this.undoStack.push(action)
        const nextStrokes = [...page.strokes]
        nextStrokes[action.index] = action.next
        this.pages[pageIndex] = { ...page, strokes: nextStrokes }
      } else if (action.type === 'clearBoard') {
        this.undoStack.push(action)
        this.pages[pageIndex] = { ...page, strokes: [], assets: [] }
      }
      this.markDirty()
    },

    clearBoard(): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      this.undoStack.push({ type: 'clearBoard', prevStrokes: [...page.strokes], prevAssets: [...page.assets] })
      this.redoStack = []
      // Replace page to trigger reactivity
      this.pages[pageIndex] = { ...page, strokes: [], assets: [] }
      this.markDirty()
    },
    
    updateStroke(stroke: unknown): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      const strokeObj = stroke as { id: string }
      const index = page.strokes.findIndex((s: unknown) => (s as { id: string }).id === strokeObj.id)
      if (index !== -1) {
        this.undoStack.push({ type: 'updateStroke', prev: page.strokes[index], next: stroke, index })
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
        this.undoStack.push({ type: 'deleteStroke', stroke: page.strokes[index], index })
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
