// WB: Winterboard Pinia store — SSOT for board state
// Ref: ARCHITECTURE.md ADR-02, ManifestWinterboard_v2.md LAW-01/02/03/19
// Based on classroom/board/state/boardStore.ts — stripped of classroom-specific code

import { defineStore } from 'pinia'
import type {
  WBPage,
  WBStroke,
  WBAsset,
  WBToolType,
  WBSyncStatus,
  WBWorkspaceState,
  WBSession,
  WBPageBackground,
  WBSelectionRect,
  WBGroup,
  WBPageGridSettings,
  WBTestObject,
  WBTestMeta,
} from '../../types/winterboard'
import { resetReplayAdoptedPages } from '../../engine/applyReplayOperation'
import type { PdfPageResult } from '../../api/winterboardApi'
import type { RecordOperationRequest } from '../../types/replay'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_UNDO_STACK = 100 // LAW-19: 50 per spec, we keep 100 for safety
const DEFAULT_PAGE_WIDTH = 1920 // LAW-20: A4 landscape
const DEFAULT_PAGE_HEIGHT = 1080

// ─── Undo/Redo Action Types ─────────────────────────────────────────────────

interface UndoAddStroke {
  type: 'addStroke'
  pageIndex: number
  stroke: WBStroke
  index: number
}

interface UndoDeleteStroke {
  type: 'deleteStroke'
  pageIndex: number
  stroke: WBStroke
  index: number
}

interface UndoUpdateStroke {
  type: 'updateStroke'
  pageIndex: number
  prev: WBStroke
  next: WBStroke
  index: number
}

interface UndoAddAsset {
  type: 'addAsset'
  pageIndex: number
  asset: WBAsset
  index: number
}

interface UndoDeleteAsset {
  type: 'deleteAsset'
  pageIndex: number
  asset: WBAsset
  index: number
}

interface UndoUpdateAsset {
  type: 'updateAsset'
  pageIndex: number
  prev: WBAsset
  next: WBAsset
  index: number
}

interface UndoClearPage {
  type: 'clearPage'
  pageIndex: number
  prevStrokes: WBStroke[]
  prevAssets: WBAsset[]
}

// v5 A2: Group undo types
interface UndoCreateGroup {
  type: 'createGroup'
  pageIndex: number
  group: WBGroup
}

interface UndoDeleteGroup {
  type: 'deleteGroup'
  pageIndex: number
  group: WBGroup
}

// v5 A3: Lock undo types
interface UndoLockItems {
  type: 'lockItems'
  pageIndex: number
  items: Array<{ id: string; prevLocked?: boolean; prevLockedBy?: string }>
}

interface UndoUnlockItems {
  type: 'unlockItems'
  pageIndex: number
  items: Array<{ id: string; prevLocked?: boolean; prevLockedBy?: string }>
}

// v5 A5: Duplicate undo type
interface UndoDuplicate {
  type: 'duplicate'
  pageIndex: number
  newIds: string[]
  originalIds: string[]
  clonedStrokes: WBStroke[]
  clonedAssets: WBAsset[]
}

// v5 A6: Align undo type (batch — one undo per align operation)
interface UndoAlign {
  type: 'align'
  pageIndex: number
  moves: Array<{ id: string; dx: number; dy: number }>
}

// v5 A7: Page management undo types
interface UndoPageReorder {
  type: 'pageReorder'
  pageIndex: number // placeholder (0) — page-level op
  previousOrder: string[] // page IDs in previous order
  newOrder: string[]      // page IDs in new order
  previousPageIndex: number
}

interface UndoAddPage {
  type: 'addPage'
  pageIndex: number // placeholder (0)
  pageId: string
  page: WBPage
}

interface UndoDeletePage {
  type: 'deletePage'
  pageIndex: number // placeholder (0)
  page: WBPage      // full page data for restore
  index: number     // original index
  wasCurrentIndex: number
}

// v5 A9: Sticky note undo types
interface UndoAddSticky {
  type: 'addSticky'
  pageIndex: number
  asset: WBAsset
  index: number
}

interface UndoUpdateStickyText {
  type: 'updateStickyText'
  pageIndex: number
  assetId: string
  prevText: string
  newText: string
}

interface UndoUpdateStickyStyle {
  type: 'updateStickyStyle'
  pageIndex: number
  assetId: string
  prevStyle: { bgColor?: string; textColor?: string; fontSize?: number }
  newStyle: { bgColor?: string; textColor?: string; fontSize?: number }
}

// v5 A8: Clear current page (locked items preserved)
interface UndoClearCurrentPage {
  type: 'clearCurrentPage'
  pageIndex: number
  clearedStrokes: WBStroke[]
  clearedAssets: WBAsset[]
}

// Phase 34: Unified object update undo
interface UndoUpdateObject {
  type: 'updateObject'
  pageIndex: number
  objectId: string
  objectKind: 'stroke' | 'asset'
  before: Record<string, unknown>
  after: Record<string, unknown>
}

// Phase 36: Batch update undo — single Ctrl+Z for multiple object updates
interface UndoBatchUpdate {
  type: 'batchUpdate'
  pageIndex: number
  entries: Array<{
    objectId: string
    objectKind: 'stroke' | 'asset'
    before: Record<string, unknown>
    after: Record<string, unknown>
  }>
}

// Phase 37: Test object undo types
interface UndoAddTestObject {
  type: 'addTestObject'
  pageIndex: number
  testObject: WBTestObject
  index: number
}

interface UndoDeleteTestObject {
  type: 'deleteTestObject'
  pageIndex: number
  testObject: WBTestObject
  index: number
}

interface UndoUpdateTestObject {
  type: 'updateTestObject'
  pageIndex: number
  objectId: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}

// Phase 34: Z-order undo
interface UndoZOrder {
  type: 'zOrder'
  pageIndex: number
  objectId: string
  objectKind: 'stroke' | 'asset'
  fromIndex: number
  toIndex: number
}

type UndoAction =
  | UndoAddStroke
  | UndoDeleteStroke
  | UndoUpdateStroke
  | UndoAddAsset
  | UndoDeleteAsset
  | UndoUpdateAsset
  | UndoClearPage
  | UndoCreateGroup
  | UndoDeleteGroup
  | UndoLockItems
  | UndoUnlockItems
  | UndoDuplicate
  | UndoAlign
  | UndoPageReorder
  | UndoAddPage
  | UndoDeletePage
  | UndoClearCurrentPage
  | UndoAddSticky
  | UndoUpdateStickyText
  | UndoUpdateStickyStyle
  | UndoUpdateObject
  | UndoBatchUpdate
  | UndoAddTestObject
  | UndoDeleteTestObject
  | UndoUpdateTestObject
  | UndoZOrder

// Command pattern: apply/revert call store methods → emit ops → replay works
interface WBCommand {
  apply: () => void
  revert: () => void
}

// ─── Store State Interface ──────────────────────────────────────────────────

export interface WBBoardState {
  // Workspace identity (LAW-01)
  workspaceId: string | null
  workspaceName: string
  ownerId: string | null

  // R0: Board runtime mode — edit (normal), replay (playback), readonly (public static)
  mode: 'edit' | 'replay' | 'readonly'

  // Sync metadata (LAW-02)
  lastSavedAt: Date | null
  isDirty: boolean
  syncStatus: WBSyncStatus
  syncError: string | null
  rev: number
  /** Phase 3: last acknowledged seq from ops queue */
  lastSeq: number

  // Board data — strokes/assets inside pages (LAW-03)
  pages: WBPage[]
  currentPageIndex: number

  // Page dimensions (LAW-20)
  pageWidth: number
  pageHeight: number

  // UI state
  currentTool: WBToolType
  currentColor: string
  currentSize: number
  zoom: number
  // A5.1: Scroll position for follow mode + viewport sync
  scrollX: number
  scrollY: number

  // History (LAW-19) — Command pattern: apply/revert emit ops for replay
  undoStack: WBCommand[]
  redoStack: WBCommand[]

  // A6.1: Collaboration mode flag
  isCollaborative: boolean

  // v5 A1: Multi-select state
  selectedIds: string[]
  selectionRect: WBSelectionRect | null

  // Responsive Phase 1 A2: Viewport container dimensions
  // INV-1: Canvas NEVER resizes — these drive stage.scale() + stage.position()
  containerWidth: number
  containerHeight: number

  // A9: Per-page grid pattern data URL (canvas tile generated by usePageGrid)
  // null = grid disabled or not yet computed
  gridPatternDataUrl: string | null

  // A10: Touch copy/paste clipboard (in-memory, session-scoped)
  clipboardAssets: WBAsset[]
  clipboardStrokes: WBStroke[]

  // Phase 35: Background control
  gridSize: number            // px, range 10-100, default 20
  backgroundColor: string     // page background, default '#ffffff'
}

// ─── Helper ─────────────────────────────────────────────────────────────────

function generatePageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function createEmptyPage(index: number): WBPage {
  return {
    id: generatePageId(),
    name: `Page ${index + 1}`,
    strokes: [],
    assets: [],
    background: 'white',
    backgroundColor: '#ffffff',
  }
}

function trimStack(stack: WBCommand[]): WBCommand[] {
  if (stack.length > MAX_UNDO_STACK) {
    return stack.slice(stack.length - MAX_UNDO_STACK)
  }
  return stack
}

// ─── Phase 20: Operation Emitter ─────────────────────────────────────────────
// Listeners receive every board-data operation emitted from store actions.
// Used by useReplayRecorder to auto-record without UI involvement.

export type OperationListener = (op: RecordOperationRequest) => void

/**
 * MODULE-LEVEL STATE — survives SPA navigation!
 *
 * _operationListeners: Callbacks from connectToStore(). Cleared via unsubscribe().
 * _currentMode: WRITE-ONLY cache. Actual mode ALWAYS read from store via _getEffectiveMode().
 *
 * INVARIANT: Any new module-level mutable state MUST be documented here
 * and reset in hydrateFromSession() + _resetOperationListeners().
 */
const _operationListeners: OperationListener[] = []
let _currentMode: 'edit' | 'replay' | 'readonly' = 'edit'  // write-only cache, see _getEffectiveMode

/** Phase 20: Reset listeners — exposed for test isolation only */
export function _resetOperationListeners(): void {
  _operationListeners.length = 0
  _currentMode = 'edit'
}

/**
 * ALWAYS read mode from Pinia store, NEVER trust module-level _currentMode.
 * Fallback to 'edit' (fail-safe: allow recording) if store not ready.
 */
function _getEffectiveMode(): 'edit' | 'replay' | 'readonly' {
  try {
    return useWBStore().mode
  } catch {
    // Store not initialized yet (app bootstrap). Fail-safe to 'edit'.
    // NEVER fall back to _currentMode — it can be stale after SPA navigation.
    return 'edit'
  }
}

function _emitOperation(op: RecordOperationRequest): void {
  const mode = _getEffectiveMode()
  if (mode !== 'edit') return
  for (const listener of _operationListeners) {
    try {
      listener(op)
    } catch (e) {
      console.warn('[WB:Store] operation listener error:', e)
    }
  }
}

/**
 * Split items into chunks, each chunk's JSON size ≤ maxBytes.
 * Used for batch ops with large stroke points arrays (prevents 64KB drop).
 * Self-contained chunks — no batch_id/reassembly needed, each applies atomically.
 */
function _splitBatchBySize<T>(items: T[], maxBytes = 50_000): T[][] {
  const chunks: T[][] = []
  let current: T[] = []
  let currentSize = 200  // JSON wrapper overhead

  for (const item of items) {
    const itemSize = JSON.stringify(item).length
    if (itemSize > maxBytes) {
      // Single item exceeds limit — put alone (will be dropped at recorder, but logged)
      if (current.length > 0) { chunks.push(current); current = []; currentSize = 200 }
      chunks.push([item])
      continue
    }
    if (currentSize + itemSize > maxBytes && current.length > 0) {
      chunks.push(current)
      current = []
      currentSize = 200
    }
    current.push(item)
    currentSize += itemSize
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

// ─── Store Definition ───────────────────────────────────────────────────────

export const useWBStore = defineStore('wb-board', {
  state: (): WBBoardState => ({
    workspaceId: null,
    workspaceName: 'Untitled',
    ownerId: null,

    mode: 'edit',

    lastSavedAt: null,
    isDirty: false,
    syncStatus: 'idle',
    syncError: null,
    rev: 0,
    lastSeq: 0,

    pages: [createEmptyPage(0)],
    currentPageIndex: 0,

    pageWidth: DEFAULT_PAGE_WIDTH,
    pageHeight: DEFAULT_PAGE_HEIGHT,

    currentTool: 'pen',
    currentColor: '#1e293b',
    currentSize: 2,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,

    undoStack: [],
    redoStack: [],

    isCollaborative: false,

    selectedIds: [],
    selectionRect: null,

    containerWidth: 0,
    containerHeight: 0,

    gridPatternDataUrl: null,

    clipboardAssets: [],
    clipboardStrokes: [],

    // Phase 35: Background control
    gridSize: 20,                    // px, range 10-100
    backgroundColor: '#ffffff',      // page background
  }),

  // ─── Getters ────────────────────────────────────────────────────────────

  getters: {
    canUndo: (state): boolean => state.undoStack.length > 0,
    canRedo: (state): boolean => state.redoStack.length > 0,

    currentPage: (state): WBPage | null =>
      state.pages[state.currentPageIndex] ?? null,

    pageCount: (state): number => state.pages.length,

    hasWorkspace: (state): boolean => !!state.workspaceId,

    // v5 A1: Selection getters
    hasSelection: (state): boolean => state.selectedIds.length > 0,
    selectedCount: (state): number => state.selectedIds.length,

    getSelectedStrokes(state): WBStroke[] {
      const page = state.pages[state.currentPageIndex]
      if (!page) return []
      const ids = new Set(state.selectedIds)
      return page.strokes.filter((s) => ids.has(s.id))
    },

    getSelectedAssets(state): WBAsset[] {
      const page = state.pages[state.currentPageIndex]
      if (!page) return []
      const ids = new Set(state.selectedIds)
      return page.assets.filter((a) => ids.has(a.id))
    },

    // Return original array reference — NO copying (prevents flicker)
    currentStrokes(state): WBStroke[] {
      const page = state.pages[state.currentPageIndex]
      return page ? page.strokes : []
    },

    currentAssets(state): WBAsset[] {
      const page = state.pages[state.currentPageIndex]
      return page ? page.assets : []
    },

    // Phase 35 B6: Per-page background color (fallback to global)
    currentPageBgColor(state): string {
      const page = state.pages[state.currentPageIndex]
      return page?.backgroundColor ?? state.backgroundColor ?? '#ffffff'
    },

    // Serialize for API (LAW-02)
    serializedState(state): WBWorkspaceState {
      return {
        pages: state.pages,
        currentPageIndex: state.currentPageIndex,
      }
    },

    /**
     * Serialized state stripped of data: URL assets — safe to send to server.
     * Assets with src starting with "data:" failed to upload to S3 (CORS/rate-limit)
     * and are kept only locally for display. Sending them would inflate the payload
     * by ~1.3 MB per image and cause 413 errors on save-stream.
     */
    serializedStateForSave(state): WBWorkspaceState {
      const pages = state.pages.map(page => ({
        ...page,
        assets: page.assets.map(asset => {
          // Strip data: URLs (too large for backend)
          if (typeof asset.src === 'string' && asset.src.startsWith('data:')) {
            return { ...asset, src: '', _localOnly: true }
          }
          // document_viewer: strip pages[] — NOT persisted, fetched on demand
          if (asset.type === 'document_viewer') {
            const { pages: _pages, ...rest } = asset
            return rest
          }
          return asset
        }),
      }))
      return { pages, currentPageIndex: state.currentPageIndex }
    },

    // Responsive Phase 1 A2: Viewport transform getters (INV-1)
    /** Optimal zoom to fit entire page in current container */
    optimalZoom(state): number {
      if (state.containerWidth <= 0 || state.containerHeight <= 0) return 1
      const scaleX = state.containerWidth / state.pageWidth
      const scaleY = state.containerHeight / state.pageHeight
      return Math.min(scaleX, scaleY)
    },

    /** Current viewport scale (alias for zoom — used by stageConfig) */
    viewportScale(state): number {
      return state.zoom
    },

    /** Offset to center page in container at current zoom */
    viewportOffset(state): { x: number; y: number } {
      const scaledW = state.pageWidth * state.zoom
      const scaledH = state.pageHeight * state.zoom
      return {
        x: Math.max(0, (state.containerWidth - scaledW) / 2) + state.scrollX,
        y: Math.max(0, (state.containerHeight - scaledH) / 2) + state.scrollY,
      }
    },

    /** Canvas offset for stage.position() (combines center + scroll) */
    canvasOffset(state): { x: number; y: number } {
      const scaledW = state.pageWidth * state.zoom
      const scaledH = state.pageHeight * state.zoom
      return {
        x: Math.max(0, (state.containerWidth - scaledW) / 2) + state.scrollX,
        y: Math.max(0, (state.containerHeight - scaledH) / 2) + state.scrollY,
      }
    },

    // Phase 34: Unified object access
    getObjectById(state): (id: string) => WBStroke | WBAsset | null {
      return (id: string) => {
        const page = state.pages[state.currentPageIndex]
        if (!page) return null
        const stroke = page.strokes.find(s => s.id === id)
        if (stroke) return stroke
        const asset = page.assets.find(a => a.id === id)
        if (asset) return asset
        return null
      }
    },

    // Phase 34: Performance limits
    objectCount(state): number {
      const page = state.pages[state.currentPageIndex]
      if (!page) return 0
      return page.strokes.length + page.assets.length
    },

    canAddObject(state): boolean {
      const page = state.pages[state.currentPageIndex]
      if (!page) return false
      return page.strokes.length + page.assets.length < 600
    },

    isNearObjectLimit(state): boolean {
      const page = state.pages[state.currentPageIndex]
      if (!page) return false
      return page.strokes.length + page.assets.length >= 280
    },
  },

  // ─── Actions ──────────────────────────────────────────────────────────────

  actions: {
    // ── Workspace Lifecycle ───────────────────────────────────────────────

    /**
     * Hydrate store from backend session data
     */
    hydrateFromSession(session: WBSession): void {
      // P0 FIX: Reset module-level _currentMode on session switch.
      // Without this, navigating from replay mode (session A) to edit mode (session B)
      // leaves _currentMode === 'replay', silently blocking ALL _emitOperation calls.
      // This caused zero replay/batch during entire lessons.
      this.mode = 'edit'
      _currentMode = 'edit'

      this.workspaceId = session.id
      this.workspaceName = session.name
      this.ownerId = session.owner_id ?? null
      this.rev = session.rev ?? 0
      this.lastSeq = (session as any).last_op_seq ?? 0

      if (session.state) {
        const state = session.state
        if (state.pages && Array.isArray(state.pages) && state.pages.length > 0) {
          // Strip pages[] from document_viewer assets (legacy sessions may have them)
          // INV: ensure every page has background field (backend may omit it)
          this.pages = (state.pages as WBPage[]).map(page => ({
            ...page,
            background: page.background ?? 'white',
            assets: page.assets.map(asset => {
              if (asset.type === 'document_viewer' && asset.pages) {
                const { pages: _p, ...rest } = asset
                return rest
              }
              return asset
            }),
          }))
        } else {
          this.pages = [createEmptyPage(0)]
        }
        this.currentPageIndex = state.currentPageIndex ?? 0
      } else {
        this.pages = [createEmptyPage(0)]
        this.currentPageIndex = 0
      }

      this.isDirty = false
      this.syncStatus = 'saved'
      this.lastSavedAt = new Date(session.updated_at)
      this.undoStack = []
      this.redoStack = []
    },

    // ── R0: Mode & Replay Lifecycle ──────────────────────────────────────

    setMode(mode: 'edit' | 'replay' | 'readonly'): void {
      this.mode = mode
      _currentMode = mode  // REPLAY-INV-9: синхронізуємо module-level mirror
    },

    // Phase 20: Subscribe to board operations. Returns unsubscribe function.
    onOperation(listener: OperationListener): () => void {
      _operationListeners.push(listener)
      return () => {
        const idx = _operationListeners.indexOf(listener)
        if (idx >= 0) _operationListeners.splice(idx, 1)
      }
    },

    /** Reset board state for replay playback — clean slate with single empty page */
    resetForReplay(): void {
      this.pages = [createEmptyPage(0)]
      this.currentPageIndex = 0
      this.undoStack = []
      this.redoStack = []
      this.isDirty = false
      this.selectedIds = []
      resetReplayAdoptedPages()
    },

    /** Load full board state from snapshot (for seek optimization) */
    loadSnapshot(state: { pages: WBPage[]; currentPageIndex: number }): void {
      if (state.pages && Array.isArray(state.pages)) {
        // INV: ensure every page has background field (backend may omit it for page[0])
        this.pages = state.pages.map(p => ({
          ...p,
          background: p.background ?? 'white',
        })) as WBPage[]
      }
      this.currentPageIndex = state.currentPageIndex ?? 0
      this.undoStack = []
      this.redoStack = []
      this.selectedIds = []
    },

    /** Get serializable state for snapshot creation */
    getSnapshotState(): { pages: WBPage[]; currentPageIndex: number } {
      return {
        pages: JSON.parse(JSON.stringify(this.pages)),
        currentPageIndex: this.currentPageIndex,
      }
    },

    // ── Dirty / Sync ─────────────────────────────────────────────────────

    markDirty(): void {
      this.isDirty = true
    },

    // Responsive Phase 1 A2: Container sync + fit-to-container
    /** Update container dimensions (called by useCanvasResize) */
    setContainerSize(width: number, height: number): void {
      this.containerWidth = width
      this.containerHeight = height
    },

    /** Fit page to container: set zoom to optimalZoom, reset scroll (INV-1) */
    fitToContainer(): void {
      if (this.containerWidth <= 0 || this.containerHeight <= 0) return
      const scaleX = this.containerWidth / this.pageWidth
      const scaleY = this.containerHeight / this.pageHeight
      this.zoom = Math.min(scaleX, scaleY)
      this.scrollX = 0
      this.scrollY = 0
    },

    // Phase 35: Grid size control
    setGridSize(size: number): void {
      this.gridSize = Math.max(10, Math.min(100, size))
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({ op_type: 'grid_update', payload: { gridSize: this.gridSize } })
      }
    },

    // Phase 35: Background color (per-page only — no global fallback leak)
    setBackgroundColor(color: string): void {
      const page = this.pages[this.currentPageIndex]
      if (page) {
        page.backgroundColor = color
      }
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'background_update',
          page_id: page?.id ?? '',
          payload: { color },
        })
      }
    },

    // A9: Per-page grid actions ──────────────────────────────────────────────

    /**
     * Update grid settings for the current page.
     * Grid is per-page — stored in page.grid (not global/localStorage).
     * Ref: DAY12-13_PHASE6.md A9 — Bug fix: grid was global
     */
    updateCurrentPageGrid(updates: Partial<WBPageGridSettings>): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return
      const DEFAULT_GRID: WBPageGridSettings = {
        enabled: false,
        size: 20,
        style: 'dots',
        color: '#000000',
        // 0.4 = matches DEFAULT_PAGE_GRID in usePageGrid.ts
        opacity: 0.4,
      }
      const existing: WBPageGridSettings = page.grid ?? DEFAULT_GRID
      this.pages[pageIndex] = {
        ...page,
        grid: { ...existing, ...updates },
      }
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'grid_update',
          page_id: page.id ?? '',
          payload: { grid: { ...existing, ...updates } },
        })
      }
    },

    /**
     * Store the canvas tile data URL generated by usePageGrid._applyGridToCanvas.
     * WBCanvas.vue watches this to load the pattern image for Konva rendering.
     */
    setGridPattern(dataUrl: string | null): void {
      this.gridPatternDataUrl = dataUrl
    },

    // A10: Touch parity — object manipulation actions ────────────────────────

    /**
     * Scale an asset by (scaleX, scaleY) relative to its current size.
     * Uses skipHistory=true for smooth real-time gesture interaction.
     * Caller should call updateAsset with full history on gesture end if needed.
     * Min size clamped to 20×20px.
     */
    resizeSelectedObject(assetId: string, scaleX: number, scaleY: number): void {
      const page = this.currentPage
      if (!page) return
      const asset = page.assets.find((a) => a.id === assetId)
      if (!asset || asset.locked) return
      const newW = Math.max(20, asset.w * scaleX)
      const newH = Math.max(20, asset.h * scaleY)
      this.updateAsset({ ...asset, w: newW, h: newH }, { skipHistory: true })
    },

    /**
     * Rotate an asset by angleDeltaRad (radians, converted to degrees internally).
     * Uses skipHistory=true for smooth real-time gesture interaction.
     */
    rotateSelectedObject(assetId: string, angleDeltaRad: number): void {
      const page = this.currentPage
      if (!page) return
      const asset = page.assets.find((a) => a.id === assetId)
      if (!asset || asset.locked) return
      const angleDeltaDeg = (angleDeltaRad * 180) / Math.PI
      const newRotation = ((asset.rotation + angleDeltaDeg) % 360 + 360) % 360
      this.updateAsset({ ...asset, rotation: newRotation }, { skipHistory: true })
    },

    /**
     * Copy currently selected assets AND strokes to in-memory clipboard.
     * Clipboard is session-scoped (not persisted across refreshes).
     */
    copySelectedToClipboard(): void {
      const page = this.currentPage
      if (!page || this.selectedIds.length === 0) return
      this.clipboardAssets = page.assets
        .filter((a) => this.selectedIds.includes(a.id))
        .map((a) => ({ ...a }))
      this.clipboardStrokes = page.strokes
        .filter((s) => this.selectedIds.includes(s.id))
        .map((s) => ({ ...s, points: s.points ? [...s.points.map(p => ({ ...p }))] : [] }))
    },

    /**
     * Paste clipboard assets AND strokes onto the current page with +20px offset.
     * New items get fresh IDs. Selection updated to pasted items.
     */
    pasteFromClipboard(): void {
      const page = this.currentPage
      if (!page || (this.clipboardAssets.length === 0 && this.clipboardStrokes.length === 0)) return
      const pageId = page.id ?? ''
      const OFFSET = 20
      const now = Date.now()
      const newIds: string[] = []

      // Paste assets — ONE batch op (avoid "typing" effect in replay)
      if (this.clipboardAssets.length > 0) {
        const newAssets: WBAsset[] = this.clipboardAssets.map((a, i) => {
          const id = `asset-paste-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`
          newIds.push(id)
          return { ...a, id, x: a.x + OFFSET, y: a.y + OFFSET }
        })
        const pageIndex = this.currentPageIndex
        this.pages[pageIndex] = {
          ...page,
          assets: [...page.assets, ...newAssets],
        }
        _emitOperation({ op_type: 'assets_add_batch', page_id: pageId, payload: { assets: newAssets } })
      }

      // Paste strokes (text, shapes, etc.) — ONE batch op
      if (this.clipboardStrokes.length > 0) {
        const pageIndex = this.currentPageIndex
        const currentPage = this.pages[pageIndex]
        const newStrokes: WBStroke[] = this.clipboardStrokes.map((s, i) => {
          const id = `stroke-paste-${now}-${i}-${Math.random().toString(36).slice(2, 6)}`
          newIds.push(id)
          return {
            ...s,
            id,
            points: s.points
              ? s.points.map(p => ({ ...p, x: p.x + OFFSET, y: p.y + OFFSET }))
              : [],
          }
        })
        this.pages[pageIndex] = {
          ...currentPage,
          strokes: [...currentPage.strokes, ...newStrokes],
        }
        _emitOperation({ op_type: 'strokes_add_batch', page_id: pageId, payload: { strokes: newStrokes } })
      }

      this.selectedIds = newIds
      this.markDirty()
    },

    // Phase 34: bringToFront/sendToBack moved below with undo support + strokes

    setSyncStatus(status: WBSyncStatus): void {
      this.syncStatus = status
    },

    setSyncError(error: string | null): void {
      this.syncError = error
    },

    setLastSaved(date: Date): void {
      this.lastSavedAt = date
      this.isDirty = false
      this.syncStatus = 'saved'
      this.syncError = null
    },

    // ── Stroke Actions ───────────────────────────────────────────────────

    addStroke(stroke: WBStroke, opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) {
        console.error('[WB:Store] addStroke: no page at index', pageIndex)
        return
      }

      // Dedup: skip if stroke with same ID already exists on this page
      if (stroke.id && page.strokes.some(s => s.id === stroke.id)) {
        return
      }

      // Phase 34: object limit guard
      if (!this.canAddObject) {
        console.warn('[WB] Object limit reached (600), cannot add stroke')
        return
      }

      if (!opts?.skipHistory) {
        const _s = { ...stroke }
        const cmd: WBCommand = {
          apply: () => this.addStroke(_s, { skipHistory: true }),
          revert: () => this.deleteStroke(_s.id, { skipHistory: true }),
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      // Replace page object to trigger Vue reactivity
      this.pages[pageIndex] = {
        ...page,
        strokes: [...page.strokes, stroke],
      }

      this.markDirty()

      // _emitOperation already guards on mode !== 'edit' — no skipHistory check needed
      _emitOperation({
        op_type: 'stroke_add',
        page_id: this.pages[pageIndex]?.id ?? '',
        payload: { stroke },
      })
    },

    updateStroke(updatedStroke: WBStroke, opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.strokes.findIndex((s) => s.id === updatedStroke.id)
      if (idx === -1) return

      if (!opts?.skipHistory) {
        const _prev = { ...page.strokes[idx] }
        const _next = { ...updatedStroke }
        const cmd: WBCommand = {
          apply: () => this.updateStroke(_next, { skipHistory: true }),
          revert: () => this.updateStroke(_prev, { skipHistory: true }),
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      const newStrokes = [...page.strokes]
      newStrokes[idx] = updatedStroke
      this.pages[pageIndex] = { ...page, strokes: newStrokes }

      this.markDirty()
      _emitOperation({
        op_type: 'stroke_update',
        page_id: this.pages[pageIndex]?.id ?? '',
        payload: { stroke: updatedStroke },
      })
    },

    deleteStroke(strokeId: string, opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.strokes.findIndex((s) => s.id === strokeId)
      if (idx === -1) return

      if (!opts?.skipHistory) {
        const _s = { ...page.strokes[idx] }
        const cmd: WBCommand = {
          apply: () => this.deleteStroke(_s.id, { skipHistory: true }),
          revert: () => this.addStroke(_s, { skipHistory: true }),
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      this.pages[pageIndex] = {
        ...page,
        strokes: page.strokes.filter((_, i) => i !== idx),
      }

      this.markDirty()

      _emitOperation({
        op_type: 'stroke_delete',
        page_id: this.pages[pageIndex]?.id ?? '',
        payload: { stroke_id: strokeId },
      })
    },

    // ── Asset Actions ────────────────────────────────────────────────────

    addAsset(asset: WBAsset, opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      // Phase 34: object limit guard
      if (!this.canAddObject) {
        console.warn('[WB] Object limit reached (600), cannot add asset')
        return
      }

      if (!opts?.skipHistory) {
        const _a = { ...asset }
        const cmd: WBCommand = {
          apply: () => this.addAsset(_a, { skipHistory: true }),
          revert: () => this.deleteAsset(_a.id, { skipHistory: true }),
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      this.pages[pageIndex] = {
        ...page,
        assets: [...page.assets, asset],
      }

      this.markDirty()
      _emitOperation({
        op_type: 'asset_add',
        page_id: this.pages[pageIndex]?.id ?? '',
        payload: { asset },
      })
    },

    /** Add asset to a specific page (used for drag-to-thumbnail). */
    addAssetToPage(pageIndex: number, asset: WBAsset, opts?: { skipHistory?: boolean }): void {
      const page = this.pages[pageIndex]
      if (!page) return

      if (page.assets.length >= 600) {
        console.warn('[WB] Object limit reached (600) on page %d', pageIndex)
        return
      }

      if (!opts?.skipHistory) {
        const _a = { ...asset }
        const cmd: WBCommand = {
          apply: () => this.addAssetToPage(pageIndex, _a, { skipHistory: true }),
          revert: () => this.deleteAsset(_a.id, { skipHistory: true }),
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      this.pages[pageIndex] = {
        ...page,
        assets: [...page.assets, asset],
      }

      this.markDirty()
      _emitOperation({
        op_type: 'asset_add',
        page_id: page.id ?? '',
        payload: { asset },
      })
    },

    updateAsset(asset: WBAsset, opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.assets.findIndex((a) => a.id === asset.id)
      if (idx === -1) return

      if (!opts?.skipHistory) {
        const _prev = { ...page.assets[idx] }
        const _next = { ...asset }
        const cmd: WBCommand = {
          apply: () => this.updateAsset(_next, { skipHistory: true }),
          revert: () => this.updateAsset(_prev, { skipHistory: true }),
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      const newAssets = [...page.assets]
      newAssets[idx] = asset
      this.pages[pageIndex] = { ...page, assets: newAssets }

      this.markDirty()
      _emitOperation({
        op_type: 'asset_update',
        page_id: this.pages[pageIndex]?.id ?? '',
        payload: { asset },
      })
    },

    /**
     * Replay animation ONLY: batch-apply positions to multiple assets
     * in ONE reactive mutation per call.
     *
     * Used by SimpleMoveAnimator (engine/animation/) for smooth replay
     * transitions without per-object rAF thrashing (N × frames × mutations).
     * One mutation per frame keeps Konva reconciliation manageable even
     * for 6+ cube (50+ asset) group moves.
     *
     * ❗ HARD INVARIANTS (do not relax without animator redesign):
     *   - NO _emitOperation — transient frames are visual-only, not recorded
     *   - NO history / undo stack push — not a user-level action
     *   - ONE page mutation — spread page with mapped assets array
     *   - UNTOUCHED items keep reference (Vue skips their re-render)
     *   - IDEMPOTENT — same input → same output, no side-effects
     *   - ASSETS ONLY — strokes are NOT animated (see MoveAnimator contract)
     *
     * @param items - absolute positions; only id/x/y are applied
     */
    applyTransientPositions(
      items: Array<{ id: string; x: number; y: number }>,
    ): void {
      if (!Array.isArray(items) || items.length === 0) return
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const byId = new Map(items.map((it) => [it.id, it]))
      let changed = false
      const newAssets = page.assets.map((a) => {
        const pos = byId.get(a.id)
        if (!pos) return a // untouched → keep reference
        if (a.x === pos.x && a.y === pos.y) return a // no-op → keep reference
        changed = true
        return { ...a, x: pos.x, y: pos.y }
      })
      if (!changed) return // nothing actually moved — skip page mutation
      this.pages[pageIndex] = { ...page, assets: newAssets }
      this.markDirty()
    },

    /** Change document_viewer page without polluting undo stack. */
    updateDocViewerPage(assetId: string, page: number): void {
      const pageIdx = this.currentPageIndex
      const pg = this.pages[pageIdx]
      if (!pg) return
      const idx = pg.assets.findIndex(a => a.id === assetId)
      if (idx === -1) return
      const asset = pg.assets[idx]
      if (asset.type !== 'document_viewer') return
      const clamped = Math.max(0, Math.min(page, (asset.totalPages ?? 1) - 1))
      if (clamped === (asset.currentPage ?? 0)) return
      const updated = { ...asset, currentPage: clamped }
      const newAssets = [...pg.assets]
      newAssets[idx] = updated
      this.pages[pageIdx] = { ...pg, assets: newAssets }
      this.markDirty()
    },

    /**
     * GeoBoard S1: Granular vertex mutation — updates only vertices[i],
     * not the whole asset. Vue reactivity re-renders only the affected vertex.
     * Emits lightweight geometry_vertex_move op (not full asset_update).
     * No undo history — undo handled via undo_group on mouseup (AD-2).
     */
    updateGeometryVertex(
      assetId: string,
      vertexIndex: number,
      point: { x: number; y: number },
      opts?: { skipEmit?: boolean },
    ): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.assets.findIndex((a) => a.id === assetId)
      if (idx === -1) return

      const asset = page.assets[idx]
      if (asset.type !== 'geometry_2d' || !asset.geometryParams?.vertices) return
      if (vertexIndex < 0 || vertexIndex >= asset.geometryParams.vertices.length) return

      // S1: point mutation — only update the specific vertex
      asset.geometryParams.vertices[vertexIndex] = { x: point.x, y: point.y }

      // No undo push — handled by undo_group on drag end (AD-2)
      this.markDirty()

      // Emit lightweight op for recording
      if (this.mode === 'edit' && !opts?.skipEmit) {
        _emitOperation({
          op_type: 'geometry_vertex_move',
          page_id: this.pages[pageIndex]?.id ?? '',
          payload: { id: assetId, vertexIndex, x: point.x, y: point.y },
          timestamp: Date.now(),
        })
      }
    },

    deleteAsset(assetId: string, opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.assets.findIndex((a) => a.id === assetId)
      if (idx === -1) return

      if (!opts?.skipHistory) {
        const _a = { ...page.assets[idx] }
        const cmd: WBCommand = {
          apply: () => this.deleteAsset(_a.id, { skipHistory: true }),
          revert: () => this.addAsset(_a, { skipHistory: true }),
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      this.pages[pageIndex] = {
        ...page,
        assets: page.assets.filter((_, i) => i !== idx),
      }

      this.markDirty()
      _emitOperation({
        op_type: 'asset_delete',
        page_id: this.pages[pageIndex]?.id ?? '',
        payload: { asset_id: assetId },
      })
    },

    /**
     * Atomic batch add for strokes — single reactive mutation, single op.
     * Used by paste/duplicate to avoid "typing" effect in replay.
     * One undo entry rolls back ALL added strokes at once.
     */
    addStrokesBatch(strokes: WBStroke[], opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || strokes.length === 0) return

      if (!opts?.skipHistory) {
        const _strokes = strokes.map(s => ({ ...s }))
        const _ids = _strokes.map(s => s.id)
        const _pi = pageIndex
        const cmd: WBCommand = {
          apply: () => this.addStrokesBatch(_strokes, { skipHistory: true }),
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idSet = new Set(_ids)
            this.pages[_pi] = {
              ...p,
              strokes: p.strokes.filter(s => !idSet.has(s.id)),
            }
            this.markDirty()
            const pageId = p.id ?? ''
            for (const id of _ids) {
              _emitOperation({ op_type: 'stroke_delete', page_id: pageId, payload: { stroke_id: id } })
            }
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      // ONE mutation — all strokes appear together locally (no "typing" effect)
      this.pages[pageIndex] = {
        ...page,
        strokes: [...page.strokes, ...strokes],
      }
      this.markDirty()
      // Emit: split by payload size (64KB limit on recorder).
      // Each chunk is self-contained atomic batch — replay applies each in ONE render.
      // For typical paste (~5 cubes = 30 strokes) = 1-3 chunks, near-atomic replay.
      const pageId = page.id ?? ''
      const chunks = _splitBatchBySize(strokes, 50_000)
      for (const chunk of chunks) {
        _emitOperation({
          op_type: 'strokes_add_batch',
          page_id: pageId,
          payload: { strokes: chunk },
        })
      }
    },

    /**
     * Atomic batch add for assets — same pattern as addStrokesBatch.
     */
    addAssetsBatch(assets: WBAsset[], opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || assets.length === 0) return

      if (!opts?.skipHistory) {
        const _assets = assets.map(a => ({ ...a }))
        const _ids = _assets.map(a => a.id)
        const _pi = pageIndex
        const cmd: WBCommand = {
          apply: () => this.addAssetsBatch(_assets, { skipHistory: true }),
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idSet = new Set(_ids)
            this.pages[_pi] = {
              ...p,
              assets: p.assets.filter(a => !idSet.has(a.id)),
            }
            this.markDirty()
            const pageId = p.id ?? ''
            for (const id of _ids) {
              _emitOperation({ op_type: 'asset_delete', page_id: pageId, payload: { asset_id: id } })
            }
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      this.pages[pageIndex] = {
        ...page,
        assets: [...page.assets, ...assets],
      }
      this.markDirty()
      // Split by size — assets usually small, but dataURLs/metadata can grow.
      const pageId = page.id ?? ''
      const chunks = _splitBatchBySize(assets, 50_000)
      for (const chunk of chunks) {
        _emitOperation({
          op_type: 'assets_add_batch',
          page_id: pageId,
          payload: { assets: chunk },
        })
      }
    },

    /**
     * Same as addStrokesBatch but targets a specific page by index.
     * Used by "send to page" flow from selection toolbar — клон виділених
     * strokes стає частиною іншої сторінки без перемикання currentPageIndex.
     */
    addStrokesBatchToPage(pageIndex: number, strokes: WBStroke[], opts?: { skipHistory?: boolean }): void {
      const page = this.pages[pageIndex]
      if (!page || strokes.length === 0) return

      if (!opts?.skipHistory) {
        const _strokes = strokes.map(s => ({ ...s }))
        const _ids = _strokes.map(s => s.id)
        const _pi = pageIndex
        const cmd: WBCommand = {
          apply: () => this.addStrokesBatchToPage(_pi, _strokes, { skipHistory: true }),
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idSet = new Set(_ids)
            this.pages[_pi] = {
              ...p,
              strokes: p.strokes.filter(s => !idSet.has(s.id)),
            }
            this.markDirty()
            const pageId = p.id ?? ''
            for (const id of _ids) {
              _emitOperation({ op_type: 'stroke_delete', page_id: pageId, payload: { stroke_id: id } })
            }
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      this.pages[pageIndex] = {
        ...page,
        strokes: [...page.strokes, ...strokes],
      }
      this.markDirty()
      const pageId = page.id ?? ''
      const chunks = _splitBatchBySize(strokes, 50_000)
      for (const chunk of chunks) {
        _emitOperation({
          op_type: 'strokes_add_batch',
          page_id: pageId,
          payload: { strokes: chunk },
        })
      }
    },

    /** Same as addAssetsBatch but targets a specific page by index. */
    addAssetsBatchToPage(pageIndex: number, assets: WBAsset[], opts?: { skipHistory?: boolean }): void {
      const page = this.pages[pageIndex]
      if (!page || assets.length === 0) return

      if (!opts?.skipHistory) {
        const _assets = assets.map(a => ({ ...a }))
        const _ids = _assets.map(a => a.id)
        const _pi = pageIndex
        const cmd: WBCommand = {
          apply: () => this.addAssetsBatchToPage(_pi, _assets, { skipHistory: true }),
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idSet = new Set(_ids)
            this.pages[_pi] = {
              ...p,
              assets: p.assets.filter(a => !idSet.has(a.id)),
            }
            this.markDirty()
            const pageId = p.id ?? ''
            for (const id of _ids) {
              _emitOperation({ op_type: 'asset_delete', page_id: pageId, payload: { asset_id: id } })
            }
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
      }

      this.pages[pageIndex] = {
        ...page,
        assets: [...page.assets, ...assets],
      }
      this.markDirty()
      const pageId = page.id ?? ''
      const chunks = _splitBatchBySize(assets, 50_000)
      for (const chunk of chunks) {
        _emitOperation({
          op_type: 'assets_add_batch',
          page_id: pageId,
          payload: { assets: chunk },
        })
      }
    },

    // ── Undo / Redo (LAW-19) ─────────────────────────────────────────────

    undo(): void {
      const cmd = this.undoStack.pop()
      if (!cmd) return
      cmd.revert()
      this.redoStack.push(cmd)
    },

    redo(): void {
      const cmd = this.redoStack.pop()
      if (!cmd) return
      cmd.apply()
      this.undoStack.push(cmd)
    },

    // ── Page Actions (LAW-03) ────────────────────────────────────────────

    clearPage(): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const _pi = pageIndex
      const _prevStrokes = [...page.strokes]
      const _prevAssets = [...page.assets]
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, strokes: [], assets: [] }
          this.markDirty()
          _emitOperation({ op_type: 'clear_page', page_id: _pageId, payload: {} })
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, strokes: _prevStrokes, assets: _prevAssets }
          this.markDirty()
          for (const s of _prevStrokes) {
            _emitOperation({ op_type: 'stroke_add', page_id: _pageId, payload: { stroke: s } })
          }
          for (const a of _prevAssets) {
            _emitOperation({ op_type: 'asset_add', page_id: _pageId, payload: { asset: a } })
          }
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = { ...page, strokes: [], assets: [] }
      this.markDirty()

      // Phase 20: emit operation for recording
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'clear_page',
          page_id: page.id ?? '',
          payload: {},
          timestamp: Date.now(),
        })
      }
    },

    goToPage(index: number): void {
      if (!Number.isFinite(index)) return
      const prevIndex = this.currentPageIndex
      this.currentPageIndex = Math.max(0, Math.min(this.pages.length - 1, index))

      // Phase 20: emit only if page actually changed and in edit mode
      if (this.mode === 'edit' && this.currentPageIndex !== prevIndex) {
        _emitOperation({
          op_type: 'page_navigate',
          page_id: this.pages[this.currentPageIndex]?.id ?? '',
          payload: { pageIndex: this.currentPageIndex },
          timestamp: Date.now(),
        })
      }
    },

    /**
     * R0: Delete page by index without undo support.
     * Used by replay engine — replay operations are not undoable.
     * Cannot delete last remaining page.
     */
    deletePage(index: number): void {
      if (this.pages.length <= 1) return
      if (index < 0 || index >= this.pages.length) return

      this.pages = this.pages.filter((_, i) => i !== index)

      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = this.pages.length - 1
      } else if (this.currentPageIndex > index) {
        this.currentPageIndex--
      }
    },

    addPage(opts?: { background?: WBPageBackground; backgroundColor?: string; width?: number; height?: number; name?: string }): void {
      if (this.pages.length >= 50) {
        console.warn('[WB:Store] Max 50 pages reached')
        return
      }
      // A1: Inherit grid from current page so tutor's grid preference carries over
      const currentPage = this.pages[this.currentPageIndex]
      const newPage: WBPage = {
        id: generatePageId(),
        name: opts?.name ?? `Page ${this.pages.length + 1}`,
        strokes: [],
        assets: [],
        background: opts?.background ?? 'white',
        backgroundColor: opts?.backgroundColor ?? '#ffffff',
        width: opts?.width,
        height: opts?.height,
        grid: currentPage?.grid ? { ...currentPage.grid } : undefined,
      }
      this.pages = [...this.pages, newPage]
      this.currentPageIndex = this.pages.length - 1
      this.markDirty()

      // Phase 20: emit operation for recording
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'page_add',
          page_id: newPage.id,
          payload: {
            page: {
              id: newPage.id,
              name: newPage.name,
              background: newPage.background,
              backgroundColor: newPage.backgroundColor,
              width: newPage.width,
              height: newPage.height,
            },
          },
          timestamp: Date.now(),
        })
      }
    },

    /**
     * Duplicate a page: deep-copy strokes, assets, settings.
     * Inserts the copy right after the source page and navigates to it.
     */
    duplicatePage(sourceIndex: number): void {
      if (this.pages.length >= 50) {
        console.warn('[WB:Store] Max 50 pages reached — cannot duplicate')
        return
      }
      const source = this.pages[sourceIndex]
      if (!source) return

      const newPage: WBPage = {
        id: generatePageId(),
        name: `${source.name} (copy)`,
        strokes: source.strokes.map(s => ({
          ...s,
          id: `${s.id}-cp-${Date.now()}`,
          points: s.points.map(p => ({ ...p })),
        })),
        assets: source.assets.map(a => ({
          ...a,
          id: `${a.id}-cp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        })),
        background: source.background,
        backgroundColor: source.backgroundColor,
        width: source.width,
        height: source.height,
        grid: source.grid ? { ...source.grid } : undefined,
        testObjects: source.testObjects
          ? source.testObjects.map(t => ({ ...t, id: `${t.id}-cp-${Date.now()}` }))
          : undefined,
        testMeta: source.testMeta ? { ...source.testMeta } : undefined,
      }

      // Insert after source page
      const insertAt = sourceIndex + 1
      const pagesCopy = [...this.pages]
      pagesCopy.splice(insertAt, 0, newPage)
      this.pages = pagesCopy
      this.currentPageIndex = insertAt
      this.markDirty()

      // Phase 20: emit operation for recording (include full content for diff-save)
      if (this.mode === 'edit') {
        // Strip document_viewer pages[] from assets (not persisted)
        const cleanAssets = newPage.assets.map(a => {
          if (a.type === 'document_viewer' && a.pages) {
            const { pages: _p, ...rest } = a
            return rest
          }
          return a
        })
        _emitOperation({
          op_type: 'page_add',
          page_id: newPage.id,
          payload: {
            page: {
              id: newPage.id,
              name: newPage.name,
              background: newPage.background,
              backgroundColor: newPage.backgroundColor,
              width: newPage.width,
              height: newPage.height,
              grid: newPage.grid,
              strokes: newPage.strokes,
              assets: cleanAssets,
            },
            insertAt,
          },
          timestamp: Date.now(),
        })
      }
    },

    /**
     * A5.1: Batch import PDF pages — creates pages with PDF backgrounds.
     * Does NOT navigate (caller decides).
     * Returns index of first imported page.
     */
    importPdfPages(pdfPages: PdfPageResult[]): number {
      if (pdfPages.length === 0) return this.currentPageIndex

      const maxAllowed = 200 - this.pages.length
      const toImport = pdfPages.slice(0, maxAllowed)
      if (toImport.length < pdfPages.length) {
        console.warn(`[WB:Store] PDF import truncated: ${pdfPages.length} pages requested, ${toImport.length} allowed`)
      }

      const firstIndex = this.pages.length
      const newPages: WBPage[] = toImport.map((p, i) => ({
        id: generatePageId(),
        name: `PDF ${p.page_index + 1}`,
        strokes: [],
        assets: [],
        background: { type: 'pdf' as const, url: p.url, assetId: p.asset_id },
        width: p.width,
        height: p.height,
      }))

      this.pages = [...this.pages, ...newPages]
      this.markDirty()
      _emitOperation({
        op_type: 'pdf_import',
        page_id: '',
        payload: {
          pages: newPages.map(p => ({
            id: p.id,
            name: p.name,
            background: p.background,
            width: p.width,
            height: p.height,
          })),
        },
      })
      return firstIndex
    },

    // ── v5 A7: Page Management Actions ──────────────────────────────────

    /**
     * Reorder pages by moving page from one index to another.
     * Validates indices, updates currentPageIndex to follow active page.
     */
    reorderPages(fromIndex: number, toIndex: number): void {
      if (fromIndex === toIndex) return
      if (fromIndex < 0 || fromIndex >= this.pages.length) return
      if (toIndex < 0 || toIndex >= this.pages.length) return

      const previousOrder = this.pages.map((p) => p.id)
      const previousPageIndex = this.currentPageIndex
      const currentPageId = this.pages[this.currentPageIndex]?.id

      // Splice and insert
      const pages = [...this.pages]
      const [page] = pages.splice(fromIndex, 1)
      pages.splice(toIndex, 0, page)
      this.pages = pages

      const newOrder = this.pages.map((p) => p.id)

      // Update currentPageIndex to follow the active page
      if (currentPageId) {
        const newIdx = this.pages.findIndex((p) => p.id === currentPageId)
        if (newIdx !== -1) this.currentPageIndex = newIdx
      }

      const _previousOrder = [...previousOrder]
      const _newOrder = [...newOrder]
      const _prevPageIdx = previousPageIndex

      const cmd: WBCommand = {
        apply: () => {
          const pageMap = new Map(this.pages.map((p) => [p.id, p]))
          const reordered = _newOrder.map((id) => pageMap.get(id)).filter(Boolean) as WBPage[]
          if (reordered.length > 0) this.pages = reordered
          const curId = this.pages[this.currentPageIndex]?.id
          if (curId) {
            const idx = this.pages.findIndex((p) => p.id === curId)
            if (idx !== -1) this.currentPageIndex = idx
          }
          this.markDirty()
          _emitOperation({ op_type: 'page_reorder', page_id: '', payload: { pageIds: _newOrder } })
        },
        revert: () => {
          const pageMap = new Map(this.pages.map((p) => [p.id, p]))
          const reordered = _previousOrder.map((id) => pageMap.get(id)).filter(Boolean) as WBPage[]
          if (reordered.length > 0) this.pages = reordered
          this.currentPageIndex = _prevPageIdx
          this.markDirty()
          _emitOperation({ op_type: 'page_reorder', page_id: '', payload: { pageIds: _previousOrder } })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []
      this.markDirty()
      _emitOperation({ op_type: 'page_reorder', page_id: '', payload: { pageIds: newOrder } })
    },

    /**
     * Add a new empty page with undo support.
     * Navigates to the new page.
     */
    addPageUndoable(opts?: { background?: WBPageBackground; width?: number; height?: number; name?: string }): string {
      if (this.pages.length >= 50) {
        console.warn('[WB:Store] Max 50 pages reached')
        return ''
      }
      // A1: Inherit grid from current page so tutor's grid preference carries over
      const currentPage = this.pages[this.currentPageIndex]
      const newPage: WBPage = {
        id: generatePageId(),
        name: opts?.name ?? `Page ${this.pages.length + 1}`,
        strokes: [],
        assets: [],
        background: opts?.background ?? 'white',
        backgroundColor: '#ffffff',
        width: opts?.width,
        height: opts?.height,
        grid: currentPage?.grid ? { ...currentPage.grid } : undefined,
      }

      this.pages = [...this.pages, newPage]
      this.currentPageIndex = this.pages.length - 1

      const _page = { ...newPage }
      const _pageId = newPage.id

      const cmd: WBCommand = {
        apply: () => {
          // Re-add the page
          this.pages = [...this.pages, _page]
          this.currentPageIndex = this.pages.length - 1
          this.markDirty()
          _emitOperation({
            op_type: 'page_add',
            page_id: _pageId,
            payload: {
              page: {
                id: _page.id,
                name: _page.name,
                background: _page.background,
                width: _page.width,
                height: _page.height,
              },
            },
          })
        },
        revert: () => {
          // Remove the page by ID
          const idx = this.pages.findIndex((p) => p.id === _pageId)
          if (idx === -1) return
          this.pages = this.pages.filter((_, i) => i !== idx)
          if (this.currentPageIndex >= this.pages.length) {
            this.currentPageIndex = Math.max(0, this.pages.length - 1)
          }
          this.markDirty()
          _emitOperation({
            op_type: 'page_delete',
            page_id: _pageId,
            payload: { page_id: _pageId },
          })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []
      this.markDirty()

      // Phase 20: emit operation for recording
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'page_add',
          page_id: newPage.id,
          payload: {
            page: {
              id: newPage.id,
              name: newPage.name,
              background: newPage.background,
              width: newPage.width,
              height: newPage.height,
            },
          },
          timestamp: Date.now(),
        })
      }
      return newPage.id
    },

    /**
     * Delete a page by index with undo support.
     * Cannot delete last remaining page.
     */
    deletePageUndoable(index: number): boolean {
      if (this.pages.length <= 1) return false
      if (index < 0 || index >= this.pages.length) return false

      const deletedPage = { ...this.pages[index], strokes: [...this.pages[index].strokes], assets: [...this.pages[index].assets] }
      const wasCurrentIndex = this.currentPageIndex

      this.pages = this.pages.filter((_, i) => i !== index)

      // Update currentPageIndex
      if (this.currentPageIndex >= this.pages.length) {
        this.currentPageIndex = this.pages.length - 1
      } else if (this.currentPageIndex > index) {
        this.currentPageIndex--
      }

      const _deletedPage = { ...deletedPage, strokes: [...deletedPage.strokes], assets: [...deletedPage.assets] }
      const _index = index
      const _wasCurrentIndex = wasCurrentIndex

      const cmd: WBCommand = {
        apply: () => {
          // Re-delete the page by ID
          const idx = this.pages.findIndex((p) => p.id === _deletedPage.id)
          if (idx === -1) return
          this.pages = this.pages.filter((_, i) => i !== idx)
          if (this.currentPageIndex >= this.pages.length) {
            this.currentPageIndex = Math.max(0, this.pages.length - 1)
          } else if (this.currentPageIndex > idx) {
            this.currentPageIndex--
          }
          this.markDirty()
          _emitOperation({
            op_type: 'page_delete',
            page_id: _deletedPage.id,
            payload: {
              page_id: _deletedPage.id,
              background: _deletedPage.background,
              backgroundColor: _deletedPage.backgroundColor,
            },
          })
        },
        revert: () => {
          // Re-insert the deleted page at original index
          const pagesCopy = [...this.pages]
          pagesCopy.splice(_index, 0, { ..._deletedPage, strokes: [..._deletedPage.strokes], assets: [..._deletedPage.assets] })
          this.pages = pagesCopy
          this.currentPageIndex = _wasCurrentIndex
          this.markDirty()
          _emitOperation({
            op_type: 'page_add',
            page_id: _deletedPage.id,
            payload: {
              page: {
                id: _deletedPage.id,
                name: _deletedPage.name,
                background: _deletedPage.background,
                backgroundColor: _deletedPage.backgroundColor,
                width: _deletedPage.width,
                height: _deletedPage.height,
                strokes: _deletedPage.strokes,
                assets: _deletedPage.assets,
              },
              insertAt: _index,
            },
          })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []
      this.markDirty()

      // Phase 20: emit operation for recording
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'page_delete',
          page_id: deletedPage.id,
          payload: {
            page_id: deletedPage.id,
            // INV-T2: зберігаємо bg видаленої сторінки для коректного replay/seek
            background: deletedPage.background,
            backgroundColor: deletedPage.backgroundColor,
          },
          timestamp: Date.now(),
        })
      }
      return true
    },

    /**
     * Handle remote page reorder from WS.
     * Reorders local pages to match the given order.
     */
    handleRemotePageReorder(pageOrder: string[]): void {
      const pageMap = new Map(this.pages.map((p) => [p.id, p]))
      const currentPageId = this.pages[this.currentPageIndex]?.id
      const reordered = pageOrder.map((id) => pageMap.get(id)).filter(Boolean) as WBPage[]
      if (reordered.length > 0) {
        this.pages = reordered
        if (currentPageId) {
          const idx = this.pages.findIndex((p) => p.id === currentPageId)
          if (idx !== -1) this.currentPageIndex = idx
        }
      }
    },

    // ── v5 A8: Clear Current Page (locked items preserved) ───────────────

    /**
     * Clear current page: removes all unlocked strokes and assets.
     * Locked items are preserved. Undoable.
     */
    clearCurrentPage(): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      // Separate locked and unlocked items
      const lockedStrokes = page.strokes.filter((s) => s.locked)
      const unlockedStrokes = page.strokes.filter((s) => !s.locked)
      const lockedAssets = page.assets.filter((a) => a.locked)
      const unlockedAssets = page.assets.filter((a) => !a.locked)

      // Nothing to clear?
      if (unlockedStrokes.length === 0 && unlockedAssets.length === 0) return

      const _pi = pageIndex
      const _clearedStrokes = [...unlockedStrokes]
      const _clearedAssets = [...unlockedAssets]
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = {
            ...p,
            strokes: p.strokes.filter((s) => s.locked),
            assets: p.assets.filter((a) => a.locked),
          }
          this.selectedIds = []
          this.markDirty()
          _emitOperation({ op_type: 'clear_page', page_id: _pageId, payload: {} })
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = {
            ...p,
            strokes: [...p.strokes, ..._clearedStrokes],
            assets: [...p.assets, ..._clearedAssets],
          }
          this.markDirty()
          for (const s of _clearedStrokes) {
            _emitOperation({ op_type: 'stroke_add', page_id: _pageId, payload: { stroke: s } })
          }
          for (const a of _clearedAssets) {
            _emitOperation({ op_type: 'asset_add', page_id: _pageId, payload: { asset: a } })
          }
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      // Keep only locked items
      this.pages[pageIndex] = { ...page, strokes: lockedStrokes, assets: lockedAssets }
      this.selectedIds = []
      this.markDirty()

      // Phase 20: emit operation for recording
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'clear_page',
          page_id: page.id ?? '',
          payload: {},
          timestamp: Date.now(),
        })
      }
    },

    /**
     * Handle remote page clear from WS.
     */
    handleRemotePageClear(pageId: string): void {
      const pageIndex = this.pages.findIndex((p) => p.id === pageId)
      if (pageIndex === -1) return
      const page = this.pages[pageIndex]
      this.pages[pageIndex] = {
        ...page,
        strokes: page.strokes.filter((s) => s.locked),
        assets: page.assets.filter((a) => a.locked),
      }
    },

    // ── v5 A9: Sticky Note Actions ──────────────────────────────────────

    /**
     * Add a sticky note to the current page.
     * Pushes to assets array, selects it, undoable.
     */
    addStickyNote(sticky: WBAsset): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const _sticky = { ...sticky }
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => this.addAsset(_sticky, { skipHistory: true }),
        revert: () => this.deleteAsset(_sticky.id, { skipHistory: true }),
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        assets: [...page.assets, sticky],
      }
      this.selectedIds = [sticky.id]
      this.selectionRect = null
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'asset_add',
          page_id: _pageId,
          payload: { asset: sticky },
        })
      }
    },

    /**
     * Update sticky note text. Locked check, max 500 chars, undoable.
     */
    updateStickyText(id: string, text: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const asset = page.assets.find((a) => a.id === id)
      if (!asset || asset.type !== 'sticky') return
      if (asset.locked) return

      const clampedText = text.slice(0, 500)
      if (asset.text === clampedText) return

      const _pi = pageIndex
      const _id = id
      const _prevText = asset.text ?? ''
      const _newText = clampedText
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          const updated = p.assets.find((a) => a.id === _id)
          if (!updated) return
          const upd = { ...updated, text: _newText }
          this.pages[_pi] = { ...p, assets: p.assets.map((a) => a.id === _id ? upd : a) }
          this.markDirty()
          _emitOperation({ op_type: 'asset_update', page_id: _pageId, payload: { asset: upd } })
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          const updated = p.assets.find((a) => a.id === _id)
          if (!updated) return
          const upd = { ...updated, text: _prevText }
          this.pages[_pi] = { ...p, assets: p.assets.map((a) => a.id === _id ? upd : a) }
          this.markDirty()
          _emitOperation({ op_type: 'asset_update', page_id: _pageId, payload: { asset: upd } })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      const updatedAsset = { ...asset, text: clampedText }
      const newAssets = page.assets.map((a) =>
        a.id === id ? updatedAsset : a,
      )
      this.pages[pageIndex] = { ...page, assets: newAssets }
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'asset_update',
          page_id: page.id ?? '',
          payload: { asset: updatedAsset },
        })
      }
    },

    /**
     * Set text metadata on any object (stroke or asset).
     * Text = interaction layer metadata, NOT canvas rendering.
     *
     * INV: op.page_id = реальна сторінка об'єкта (findInAllPages)
     * INV: silent=true → replay НЕ створює нові ops (infinite loop guard)
     * INV: text?.trim() || undefined → без пустих значень
     */
    setObjectText(objectId: string, text: string | undefined, options?: { silent?: boolean }): void {
      const trimmed = text?.trim() || undefined

      let targetPageId = ''
      for (const page of this.pages) {
        const stroke = page.strokes.find(s => s.id === objectId)
        if (stroke) { stroke.text = trimmed; targetPageId = page.id; break }
        const asset = page.assets.find(a => a.id === objectId)
        if (asset) { asset.text = trimmed; targetPageId = page.id; break }
      }

      if (!targetPageId) {
        console.warn('[WB:store] setObjectText: object not found', objectId)
        return
      }

      this.markDirty()

      // Op → replay + sync (ТІЛЬКИ якщо не silent — replay calls with silent=true)
      if (!options?.silent && this.mode === 'edit') {
        _emitOperation({
          op_type: 'object_text_update',
          page_id: targetPageId,
          payload: { object_id: objectId, text: trimmed ?? null },
        })
      }
    },

    /**
     * Update sticky note style (bgColor, textColor, fontSize). Undoable.
     */
    updateStickyStyle(id: string, style: { bgColor?: string; textColor?: string; fontSize?: number }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const asset = page.assets.find((a) => a.id === id)
      if (!asset || asset.type !== 'sticky') return
      if (asset.locked) return

      // Clamp fontSize
      const newStyle: Record<string, unknown> = {}
      const prevStyle: Record<string, unknown> = {}

      if (style.bgColor !== undefined) {
        prevStyle.bgColor = asset.bgColor
        newStyle.bgColor = style.bgColor
      }
      if (style.textColor !== undefined) {
        prevStyle.textColor = asset.textColor
        newStyle.textColor = style.textColor
      }
      if (style.fontSize !== undefined) {
        prevStyle.fontSize = asset.fontSize
        newStyle.fontSize = Math.max(10, Math.min(32, style.fontSize))
      }

      if (Object.keys(newStyle).length === 0) return

      const _pi = pageIndex
      const _id = id
      const _prevStyle = { ...prevStyle }
      const _newStyle = { ...newStyle }
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          const a = p.assets.find((x) => x.id === _id)
          if (!a) return
          const upd = { ...a, ..._newStyle }
          this.pages[_pi] = { ...p, assets: p.assets.map((x) => x.id === _id ? upd : x) }
          this.markDirty()
          _emitOperation({ op_type: 'asset_update', page_id: _pageId, payload: { asset: upd } })
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          const a = p.assets.find((x) => x.id === _id)
          if (!a) return
          const upd = { ...a, ..._prevStyle }
          this.pages[_pi] = { ...p, assets: p.assets.map((x) => x.id === _id ? upd : x) }
          this.markDirty()
          _emitOperation({ op_type: 'asset_update', page_id: _pageId, payload: { asset: upd } })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      const updatedAsset = { ...asset, ...newStyle }
      const newAssets = page.assets.map((a) =>
        a.id === id ? updatedAsset : a,
      )
      this.pages[pageIndex] = { ...page, assets: newAssets }
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'asset_update',
          page_id: page.id ?? '',
          payload: { asset: updatedAsset },
        })
      }
    },

    /**
     * Handle remote sticky text update from WS.
     */
    handleRemoteStickyTextUpdate(data: { pageId: string; assetId: string; text: string }): void {
      const pageIndex = this.pages.findIndex((p) => p.id === data.pageId)
      if (pageIndex === -1) return
      const page = this.pages[pageIndex]
      const newAssets = page.assets.map((a) =>
        a.id === data.assetId ? { ...a, text: data.text } : a,
      )
      this.pages[pageIndex] = { ...page, assets: newAssets }
    },

    /**
     * Handle remote sticky style update from WS.
     */
    handleRemoteStickyStyleUpdate(data: { pageId: string; assetId: string; bgColor?: string; textColor?: string; fontSize?: number }): void {
      const pageIndex = this.pages.findIndex((p) => p.id === data.pageId)
      if (pageIndex === -1) return
      const page = this.pages[pageIndex]
      const styleUpdate: Record<string, unknown> = {}
      if (data.bgColor !== undefined) styleUpdate.bgColor = data.bgColor
      if (data.textColor !== undefined) styleUpdate.textColor = data.textColor
      if (data.fontSize !== undefined) styleUpdate.fontSize = data.fontSize
      const newAssets = page.assets.map((a) =>
        a.id === data.assetId ? { ...a, ...styleUpdate } : a,
      )
      this.pages[pageIndex] = { ...page, assets: newAssets }
    },

    // ── Tool State ───────────────────────────────────────────────────────

    setTool(tool: WBToolType): void {
      this.currentTool = tool
    },

    setColor(color: string): void {
      this.currentColor = color
    },

    setSize(size: number): void {
      this.currentSize = Math.max(1, Math.min(50, size))
    },

    setZoom(zoom: number): void {
      // LAW-20: Zoom range 10%–500%
      this.zoom = Math.max(0.1, Math.min(5, zoom))
    },

    // A5.1: Set scroll position for follow mode + viewport sync
    setScroll(x: number, y: number): void {
      this.scrollX = x
      this.scrollY = y
    },

    // ── v5 A2: Group Actions ───────────────────────────────────────────

    createGroup(itemIds: string[], createdBy = 'local'): WBGroup | null {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return null
      if (itemIds.length < 2) return null

      // No nested groups: check none of the items are already in a group
      const existingGroups = page.groups ?? []
      for (const id of itemIds) {
        if (existingGroups.some((g) => g.itemIds.includes(id))) {
          return null
        }
      }

      const group: WBGroup = {
        id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        itemIds: [...itemIds],
        createdBy,
      }

      const _pi = pageIndex
      const _group = { ...group, itemIds: [...group.itemIds] }
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          const groups = p.groups ?? []
          this.pages[_pi] = { ...p, groups: [...groups, _group] }
          this.markDirty()
          _emitOperation({ op_type: 'group_create', page_id: _pageId, payload: { group_id: _group.id, itemIds: _group.itemIds } })
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, groups: (p.groups ?? []).filter((g) => g.id !== _group.id) }
          this.markDirty()
          _emitOperation({ op_type: 'group_delete', page_id: _pageId, payload: { group_id: _group.id } })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        groups: [...existingGroups, group],
      }
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'group_create',
          page_id: page.id ?? '',
          payload: { group_id: group.id, itemIds: group.itemIds },
        })
      }
      return group
    },

    deleteGroup(groupId: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const groups = page.groups ?? []
      const group = groups.find((g) => g.id === groupId)
      if (!group) return

      const _pi = pageIndex
      const _group = { ...group, itemIds: [...group.itemIds] }
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, groups: (p.groups ?? []).filter((g) => g.id !== _group.id) }
          this.markDirty()
          _emitOperation({ op_type: 'group_delete', page_id: _pageId, payload: { group_id: _group.id } })
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, groups: [...(p.groups ?? []), _group] }
          this.markDirty()
          _emitOperation({ op_type: 'group_create', page_id: _pageId, payload: { group_id: _group.id, itemIds: _group.itemIds } })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        groups: groups.filter((g) => g.id !== groupId),
      }
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'group_delete',
          page_id: page.id ?? '',
          payload: { group_id: groupId },
        })
      }
    },

    /**
     * v5 A2: Remove specific item IDs from groups.
     * If a group drops below 2 items, auto-delete it.
     */
    removeItemsFromGroups(removedIds: string[]): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const groups = page.groups ?? []
      if (groups.length === 0) return

      const removedSet = new Set(removedIds)
      const newGroups: WBGroup[] = []

      for (const g of groups) {
        const remaining = g.itemIds.filter((id) => !removedSet.has(id))
        if (remaining.length >= 2) {
          newGroups.push({ ...g, itemIds: remaining })
        }
        // else: group auto-deleted (< 2 items)
      }

      if (newGroups.length !== groups.length || newGroups.some((g, i) => g !== groups[i])) {
        this.pages[pageIndex] = { ...page, groups: newGroups }
        this.markDirty()
      }
    },

    // ── v5 A3: Lock Actions ─────────────────────────────────────────────

    lockItems(ids: string[], lockedBy = 'local'): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || ids.length === 0) return

      const idSet = new Set(ids)
      const prevStates: Array<{ id: string; prevLocked?: boolean; prevLockedBy?: string }> = []

      const newStrokes = page.strokes.map((s) => {
        if (!idSet.has(s.id) || s.locked) return s
        prevStates.push({ id: s.id, prevLocked: s.locked, prevLockedBy: s.lockedBy })
        return { ...s, locked: true, lockedBy }
      })

      const newAssets = page.assets.map((a) => {
        if (!idSet.has(a.id) || a.locked) return a
        prevStates.push({ id: a.id, prevLocked: a.locked, prevLockedBy: a.lockedBy })
        return { ...a, locked: true, lockedBy }
      })

      if (prevStates.length === 0) return // all already locked

      const _pi = pageIndex
      const _prevStates = prevStates.map((s) => ({ ...s }))
      const _ids = [...ids]
      const _lockedBy = lockedBy
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          const idSet2 = new Set(_ids)
          this.pages[_pi] = {
            ...p,
            strokes: p.strokes.map((s) => idSet2.has(s.id) ? { ...s, locked: true, lockedBy: _lockedBy } : s),
            assets: p.assets.map((a) => idSet2.has(a.id) ? { ...a, locked: true, lockedBy: _lockedBy } : a),
          }
          this.selectedIds = []
          this.selectionRect = null
          this.markDirty()
          _emitOperation({ op_type: 'lock_update', page_id: _pageId, payload: { ids: _ids, locked: true, lockedBy: _lockedBy } })
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          const stateMap = new Map(_prevStates.map((s) => [s.id, s]))
          this.pages[_pi] = {
            ...p,
            strokes: p.strokes.map((s) => {
              const prev = stateMap.get(s.id)
              return prev ? { ...s, locked: prev.prevLocked ?? false, lockedBy: prev.prevLockedBy } : s
            }),
            assets: p.assets.map((a) => {
              const prev = stateMap.get(a.id)
              return prev ? { ...a, locked: prev.prevLocked ?? false, lockedBy: prev.prevLockedBy } : a
            }),
          }
          this.markDirty()
          _emitOperation({ op_type: 'lock_update', page_id: _pageId, payload: { ids: _ids, locked: false } })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
      // Clear selection — locked items should not remain selected
      this.selectedIds = []
      this.selectionRect = null
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'lock_update',
          page_id: page.id ?? '',
          payload: { ids, locked: true, lockedBy },
        })
      }
    },

    unlockItems(ids: string[]): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || ids.length === 0) return

      const idSet = new Set(ids)
      const prevStates: Array<{ id: string; prevLocked?: boolean; prevLockedBy?: string }> = []

      const newStrokes = page.strokes.map((s) => {
        if (!idSet.has(s.id) || !s.locked) return s
        prevStates.push({ id: s.id, prevLocked: s.locked, prevLockedBy: s.lockedBy })
        return { ...s, locked: false, lockedBy: undefined }
      })

      const newAssets = page.assets.map((a) => {
        if (!idSet.has(a.id) || !a.locked) return a
        prevStates.push({ id: a.id, prevLocked: a.locked, prevLockedBy: a.lockedBy })
        return { ...a, locked: false, lockedBy: undefined }
      })

      if (prevStates.length === 0) return // none were locked

      const _pi = pageIndex
      const _prevStates = prevStates.map((s) => ({ ...s }))
      const _ids = [...ids]
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          const idSet2 = new Set(_ids)
          this.pages[_pi] = {
            ...p,
            strokes: p.strokes.map((s) => idSet2.has(s.id) ? { ...s, locked: false, lockedBy: undefined } : s),
            assets: p.assets.map((a) => idSet2.has(a.id) ? { ...a, locked: false, lockedBy: undefined } : a),
          }
          this.markDirty()
          _emitOperation({ op_type: 'lock_update', page_id: _pageId, payload: { ids: _ids, locked: false } })
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          const stateMap = new Map(_prevStates.map((s) => [s.id, s]))
          this.pages[_pi] = {
            ...p,
            strokes: p.strokes.map((s) => {
              const prev = stateMap.get(s.id)
              return prev ? { ...s, locked: prev.prevLocked ?? false, lockedBy: prev.prevLockedBy } : s
            }),
            assets: p.assets.map((a) => {
              const prev = stateMap.get(a.id)
              return prev ? { ...a, locked: prev.prevLocked ?? false, lockedBy: prev.prevLockedBy } : a
            }),
          }
          this.markDirty()
          _emitOperation({ op_type: 'lock_update', page_id: _pageId, payload: { ids: _ids, locked: true, lockedBy: _prevStates[0]?.prevLockedBy } })
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
      this.markDirty()
      if (this.mode === 'edit') {
        _emitOperation({
          op_type: 'lock_update',
          page_id: page.id ?? '',
          payload: { ids, locked: false },
        })
      }
    },

    isItemLocked(id: string): boolean {
      const page = this.pages[this.currentPageIndex]
      if (!page) return false
      const stroke = page.strokes.find((s) => s.id === id)
      if (stroke) return !!stroke.locked
      const asset = page.assets.find((a) => a.id === id)
      if (asset) return !!asset.locked
      return false
    },

    // ── v5 A5: Duplicate Action ─────────────────────────────────────────

    /**
     * Duplicate selected strokes and assets.
     * Clones get new IDs, +20px offset, unlocked state.
     * Returns array of new IDs (empty if nothing selected).
     */
    duplicateSelected(): string[] {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || this.selectedIds.length === 0) return []

      const ids = new Set(this.selectedIds)
      const originalIds = [...this.selectedIds]
      const newIds: string[] = []
      const clonedStrokes: WBStroke[] = []
      const clonedAssets: WBAsset[] = []

      // Clone strokes
      for (const stroke of page.strokes) {
        if (!ids.has(stroke.id)) continue
        const clone: WBStroke = {
          ...stroke,
          id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          locked: false,
          lockedBy: undefined,
          points: stroke.points.map((p) => ({ ...p, x: p.x + 20, y: p.y + 20 })),
        }
        if (clone.width !== undefined) clone.width = stroke.width
        if (clone.height !== undefined) clone.height = stroke.height
        clonedStrokes.push(clone)
        newIds.push(clone.id)
      }

      // Clone assets
      for (const asset of page.assets) {
        if (!ids.has(asset.id)) continue
        const clone: WBAsset = {
          ...asset,
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          locked: false,
          lockedBy: undefined,
          x: asset.x + 20,
          y: asset.y + 20,
        }
        clonedAssets.push(clone)
        newIds.push(clone.id)
      }

      if (newIds.length === 0) return []

      const _pi = pageIndex
      const _clonedStrokes = clonedStrokes.map((s) => ({ ...s }))
      const _clonedAssets = clonedAssets.map((a) => ({ ...a }))
      const _newIds = [...newIds]
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = {
            ...p,
            strokes: [...p.strokes, ..._clonedStrokes],
            assets: [...p.assets, ..._clonedAssets],
          }
          this.selectedIds = [..._newIds]
          this.selectionRect = null
          this.markDirty()
          for (const s of _clonedStrokes) {
            _emitOperation({ op_type: 'stroke_add', page_id: _pageId, payload: { stroke: s } })
          }
          for (const a of _clonedAssets) {
            _emitOperation({ op_type: 'asset_add', page_id: _pageId, payload: { asset: a } })
          }
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          const idSet = new Set(_newIds)
          this.pages[_pi] = {
            ...p,
            strokes: p.strokes.filter((s) => !idSet.has(s.id)),
            assets: p.assets.filter((a) => !idSet.has(a.id)),
          }
          this.selectedIds = []
          this.markDirty()
          for (const s of _clonedStrokes) {
            _emitOperation({ op_type: 'stroke_delete', page_id: _pageId, payload: { stroke_id: s.id } })
          }
          for (const a of _clonedAssets) {
            _emitOperation({ op_type: 'asset_delete', page_id: _pageId, payload: { asset_id: a.id } })
          }
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      // Add clones to page
      this.pages[pageIndex] = {
        ...page,
        strokes: [...page.strokes, ...clonedStrokes],
        assets: [...page.assets, ...clonedAssets],
      }

      // Select only new items
      this.selectedIds = [...newIds]
      this.selectionRect = null
      this.markDirty()
      if (this.mode === 'edit') {
        for (const s of clonedStrokes) {
          _emitOperation({ op_type: 'stroke_add', page_id: page.id ?? '', payload: { stroke: s } })
        }
        for (const a of clonedAssets) {
          _emitOperation({ op_type: 'asset_add', page_id: page.id ?? '', payload: { asset: a } })
        }
      }
      return newIds
    },

    // ── v5 A6: Align Action ──────────────────────────────────────────────

    /**
     * Apply alignment moves as a single undo-able batch.
     * Each move is { id, dx, dy } — delta to apply.
     * Locked items are skipped.
     */
    applyAlign(moves: Array<{ id: string; dx: number; dy: number }>): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || moves.length === 0) return

      // Filter out zero-delta moves and locked items
      const effectiveMoves = moves.filter((m) => {
        if (m.dx === 0 && m.dy === 0) return false
        // Skip locked items
        const stroke = page.strokes.find((s) => s.id === m.id)
        if (stroke?.locked) return false
        const asset = page.assets.find((a) => a.id === m.id)
        if (asset?.locked) return false
        return true
      })

      if (effectiveMoves.length === 0) return

      const _pi = pageIndex
      const _moves = effectiveMoves.map((m) => ({ ...m }))
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          const mm = new Map(_moves.map((m) => [m.id, m]))
          this.pages[_pi] = {
            ...p,
            strokes: p.strokes.map((s) => {
              const m = mm.get(s.id)
              if (!m) return s
              return { ...s, points: s.points.map((pt) => ({ ...pt, x: pt.x + m.dx, y: pt.y + m.dy })) }
            }),
            assets: p.assets.map((a) => {
              const m = mm.get(a.id)
              if (!m) return a
              return { ...a, x: a.x + m.dx, y: a.y + m.dy }
            }),
          }
          this.markDirty()
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          const mm = new Map(_moves.map((m) => [m.id, m]))
          this.pages[_pi] = {
            ...p,
            strokes: p.strokes.map((s) => {
              const m = mm.get(s.id)
              if (!m) return s
              return { ...s, points: s.points.map((pt) => ({ ...pt, x: pt.x - m.dx, y: pt.y - m.dy })) }
            }),
            assets: p.assets.map((a) => {
              const m = mm.get(a.id)
              if (!m) return a
              return { ...a, x: a.x - m.dx, y: a.y - m.dy }
            }),
          }
          this.markDirty()
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      // Apply moves
      const moveMap = new Map(effectiveMoves.map((m) => [m.id, m]))
      const newStrokes = page.strokes.map((s) => {
        const m = moveMap.get(s.id)
        if (!m) return s
        return {
          ...s,
          points: s.points.map((p) => ({ ...p, x: p.x + m.dx, y: p.y + m.dy })),
        }
      })
      const newAssets = page.assets.map((a) => {
        const m = moveMap.get(a.id)
        if (!m) return a
        return { ...a, x: a.x + m.dx, y: a.y + m.dy }
      })

      this.pages[pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
      this.markDirty()
    },

    // ── v5 A1: Selection Actions ──────────────────────────────────────────

    selectItems(ids: string[]): void {
      // Phase 34: cap selection at 50
      const limited = ids.slice(0, 50)
      this.selectedIds = [...limited]
    },

    addToSelection(id: string): void {
      if (!this.selectedIds.includes(id)) {
        // Phase 34: cap selection at 50
        if (this.selectedIds.length >= 50) return
        this.selectedIds = [...this.selectedIds, id]
      }
    },

    removeFromSelection(id: string): void {
      this.selectedIds = this.selectedIds.filter((sid) => sid !== id)
    },

    toggleSelection(id: string): void {
      if (this.selectedIds.includes(id)) {
        this.removeFromSelection(id)
      } else {
        this.addToSelection(id)
      }
    },

    clearSelection(): void {
      this.selectedIds = []
      this.selectionRect = null
    },

    setSelectionRect(rect: WBSelectionRect | null): void {
      this.selectionRect = rect
    },

    moveSelected(dx: number, dy: number): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || this.selectedIds.length === 0) return

      const ids = new Set<string>(this.selectedIds)

      // Move strokes
      const newStrokes = page.strokes.map((s) => {
        if (!ids.has(s.id)) return s
        return {
          ...s,
          points: s.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
        }
      })

      // Move assets
      const newAssets = page.assets.map((a) => {
        if (!ids.has(a.id)) return a
        return { ...a, x: a.x + dx, y: a.y + dy }
      })

      this.pages[pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
      this.markDirty()
      // NO ops here — called per-frame during drag. Ops emitted at drag END.
    },

    // Phase 34 A2 FIX-1: Move only unlocked selected items
    moveSelectedUnlocked(dx: number, dy: number): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || this.selectedIds.length === 0) return

      const unlockedIds = this.selectedIds.filter(id => !this.isItemLocked(id))
      if (unlockedIds.length === 0) return
      const ids = new Set<string>(unlockedIds)

      const newStrokes = page.strokes.map((s) => {
        if (!ids.has(s.id)) return s
        return {
          ...s,
          points: s.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
        }
      })

      const newAssets = page.assets.map((a) => {
        if (!ids.has(a.id)) return a
        return { ...a, x: a.x + dx, y: a.y + dy }
      })

      this.pages[pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
      this.markDirty()
      // NO ops here — called per-frame during drag. Ops emitted at drag END.
    },

    /** Emit move ops for selected objects — call at drag END only (not per-frame).
     *  Strokes: one stroke_update per stroke (full points). Huge strokes (>64KB) will
     *  be dropped at recorder level with warning — acceptable tradeoff for rare case.
     *  Assets: one objects_move op with absolute x/y (cheap, atomic). */
    emitMoveOpsForSelected(): void {
      const page = this.currentPage
      if (!page || this.selectedIds.length === 0) return
      const ids = new Set<string>(this.selectedIds)
      const pageId = page.id ?? ''

      // Strokes: reuse existing stroke_update op (replay engine already handles)
      for (const s of page.strokes) {
        if (!ids.has(s.id)) continue
        _emitOperation({
          op_type: 'stroke_update',
          page_id: pageId,
          payload: { stroke: s },
        })
      }

      // Assets: batch in one objects_move op
      const movedAssets = page.assets.filter(a => ids.has(a.id))
      if (movedAssets.length > 0 && movedAssets.length <= 50) {
        _emitOperation({
          op_type: 'objects_move',
          page_id: pageId,
          payload: { items: movedAssets.map(a => ({ id: a.id, x: a.x, y: a.y })) },
        })
      }
    },

    // Phase 34 A1.2: Object type resolver
    getObjectType(obj: WBStroke | WBAsset): string {
      if ('tool' in obj) {
        return (obj as WBStroke).tool || 'unknown'
      }
      if ('type' in obj && typeof (obj as WBAsset).type === 'string') {
        return (obj as WBAsset).type || 'image'
      }
      return 'unknown'
    },

    // Phase 34 A1.3: Unified object update with undo
    updateObject(id: string, updates: Record<string, unknown>): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      // Lock guard: if locked, only allow 'locked' field change (for unlock)
      if (this.isItemLocked(id)) {
        const isUnlockOnly = Object.keys(updates).length === 1 && 'locked' in updates
        if (!isUnlockOnly) return
      }

      // Try strokes
      const strokeIdx = page.strokes.findIndex(s => s.id === id)
      if (strokeIdx !== -1) {
        const old = page.strokes[strokeIdx]
        const before: Record<string, unknown> = {}
        const after: Record<string, unknown> = {}
        for (const key of Object.keys(updates)) {
          before[key] = (old as Record<string, unknown>)[key]
          after[key] = updates[key]
        }

        const _pi = pageIndex
        const _id = id
        const _before = { ...before }
        const _after = { ...after }
        const _pageId = page.id ?? ''

        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            this.pages[_pi] = { ...p, strokes: p.strokes.map(s => s.id === _id ? { ...s, ..._after } : s) }
            this.markDirty()
            _emitOperation({ op_type: 'object_update', page_id: _pageId, payload: { id: _id, kind: 'stroke', changes: _after } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            this.pages[_pi] = { ...p, strokes: p.strokes.map(s => s.id === _id ? { ...s, ..._before } : s) }
            this.markDirty()
            _emitOperation({ op_type: 'object_update', page_id: _pageId, payload: { id: _id, kind: 'stroke', changes: _before } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []

        const updatedStroke = { ...page.strokes[strokeIdx], ...updates }
        this.pages[pageIndex] = {
          ...page,
          strokes: page.strokes.map((s, i) => i === strokeIdx ? updatedStroke : s),
        }
        this.markDirty()
        _emitOperation({
          op_type: 'object_update',
          page_id: page.id ?? '',
          payload: { id, kind: 'stroke', changes: updates },
        })
        return
      }

      // Try assets
      const assetIdx = page.assets.findIndex(a => a.id === id)
      if (assetIdx !== -1) {
        const old = page.assets[assetIdx]
        const before: Record<string, unknown> = {}
        const after: Record<string, unknown> = {}
        for (const key of Object.keys(updates)) {
          before[key] = (old as Record<string, unknown>)[key]
          after[key] = updates[key]
        }

        const _pi = pageIndex
        const _id = id
        const _before = { ...before }
        const _after = { ...after }
        const _pageId = page.id ?? ''

        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            this.pages[_pi] = { ...p, assets: p.assets.map(a => a.id === _id ? { ...a, ..._after } : a) }
            this.markDirty()
            _emitOperation({ op_type: 'object_update', page_id: _pageId, payload: { id: _id, kind: 'asset', changes: _after } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            this.pages[_pi] = { ...p, assets: p.assets.map(a => a.id === _id ? { ...a, ..._before } : a) }
            this.markDirty()
            _emitOperation({ op_type: 'object_update', page_id: _pageId, payload: { id: _id, kind: 'asset', changes: _before } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []

        this.pages[pageIndex] = {
          ...page,
          assets: page.assets.map((a, i) => i === assetIdx ? { ...a, ...updates } : a),
        }
        this.markDirty()
        _emitOperation({
          op_type: 'object_update',
          page_id: page.id ?? '',
          payload: { id, kind: 'asset', changes: updates },
        })
        return
      }
    },

    // Phase 36: Batch update multiple objects — single undo entry
    batchUpdateObjects(updates: Array<{ id: string; changes: Record<string, unknown> }>): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || updates.length === 0) return

      const entries: UndoBatchUpdate['entries'] = []
      let newStrokes = [...page.strokes]
      let newAssets = [...page.assets]

      for (const { id, changes } of updates) {
        // Lock guard: skip locked unless unlocking
        if (this.isItemLocked(id)) {
          const isUnlockOnly = Object.keys(changes).length === 1 && 'locked' in changes
          if (!isUnlockOnly) continue
        }

        const strokeIdx = newStrokes.findIndex(s => s.id === id)
        if (strokeIdx !== -1) {
          const old = newStrokes[strokeIdx]
          const before: Record<string, unknown> = {}
          const after: Record<string, unknown> = {}
          for (const key of Object.keys(changes)) {
            before[key] = (old as Record<string, unknown>)[key]
            after[key] = changes[key]
          }
          entries.push({ objectId: id, objectKind: 'stroke', before, after })
          newStrokes = newStrokes.map((s, i) => i === strokeIdx ? { ...s, ...changes } : s)
          continue
        }

        const assetIdx = newAssets.findIndex(a => a.id === id)
        if (assetIdx !== -1) {
          const old = newAssets[assetIdx]
          const before: Record<string, unknown> = {}
          const after: Record<string, unknown> = {}
          for (const key of Object.keys(changes)) {
            before[key] = (old as Record<string, unknown>)[key]
            after[key] = changes[key]
          }
          entries.push({ objectId: id, objectKind: 'asset', before, after })
          newAssets = newAssets.map((a, i) => i === assetIdx ? { ...a, ...changes } : a)
        }
      }

      if (entries.length === 0) return

      const _pi = pageIndex
      const _entries = entries.map((e) => ({ ...e, before: { ...e.before }, after: { ...e.after } }))
      const _pageId = page.id ?? ''

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          let strokes = [...p.strokes]
          let assets = [...p.assets]
          for (const e of _entries) {
            if (e.objectKind === 'stroke') {
              strokes = strokes.map((s) => s.id === e.objectId ? { ...s, ...e.after } : s)
            } else {
              assets = assets.map((a) => a.id === e.objectId ? { ...a, ...e.after } : a)
            }
          }
          this.pages[_pi] = { ...p, strokes, assets }
          this.markDirty()
          for (const e of _entries) {
            _emitOperation({ op_type: 'object_update', page_id: _pageId, payload: { id: e.objectId, kind: e.objectKind, changes: e.after } })
          }
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          let strokes = [...p.strokes]
          let assets = [...p.assets]
          for (const e of _entries) {
            if (e.objectKind === 'stroke') {
              strokes = strokes.map((s) => s.id === e.objectId ? { ...s, ...e.before } : s)
            } else {
              assets = assets.map((a) => a.id === e.objectId ? { ...a, ...e.before } : a)
            }
          }
          this.pages[_pi] = { ...p, strokes, assets }
          this.markDirty()
          for (const e of _entries) {
            _emitOperation({ op_type: 'object_update', page_id: _pageId, payload: { id: e.objectId, kind: e.objectKind, changes: e.before } })
          }
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
      this.markDirty()
      for (const entry of entries) {
        _emitOperation({
          op_type: 'object_update',
          page_id: page.id ?? '',
          payload: { id: entry.objectId, kind: entry.objectKind, changes: entry.after },
        })
      }
    },

    // ── Phase 37: Test Object CRUD ──────────────────────────────────────────

    addTestObject(obj: WBTestObject): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const testObjects = [...(page.testObjects ?? []), obj]
      const index = testObjects.length - 1

      const _pi = pageIndex
      const _obj = { ...obj }

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, testObjects: [...(p.testObjects ?? []), _obj] }
          this.markDirty()
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, testObjects: (p.testObjects ?? []).filter((t) => t.id !== _obj.id) }
          this.markDirty()
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = { ...page, testObjects }
      this.markDirty()
    },

    deleteTestObject(id: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page?.testObjects) return

      const idx = page.testObjects.findIndex(t => t.id === id)
      if (idx === -1) return

      const _pi = pageIndex
      const _obj = { ...page.testObjects[idx] }

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, testObjects: (p.testObjects ?? []).filter((t) => t.id !== _obj.id) }
          this.markDirty()
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p) return
          this.pages[_pi] = { ...p, testObjects: [...(p.testObjects ?? []), _obj] }
          this.markDirty()
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        testObjects: page.testObjects.filter((_, i) => i !== idx),
      }
      this.markDirty()
    },

    updateTestObject(id: string, updates: Record<string, unknown>): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page?.testObjects) return

      const idx = page.testObjects.findIndex(t => t.id === id)
      if (idx === -1) return

      const old = page.testObjects[idx]
      const before: Record<string, unknown> = {}
      const after: Record<string, unknown> = {}
      for (const key of Object.keys(updates)) {
        before[key] = (old as Record<string, unknown>)[key]
        after[key] = updates[key]
      }

      const _pi = pageIndex
      const _id = id
      const _before = { ...before }
      const _after = { ...after }

      const cmd: WBCommand = {
        apply: () => {
          const p = this.pages[_pi]
          if (!p?.testObjects) return
          this.pages[_pi] = { ...p, testObjects: p.testObjects.map((t) => t.id === _id ? { ...t, ..._after } as WBTestObject : t) }
          this.markDirty()
        },
        revert: () => {
          const p = this.pages[_pi]
          if (!p?.testObjects) return
          this.pages[_pi] = { ...p, testObjects: p.testObjects.map((t) => t.id === _id ? { ...t, ..._before } as WBTestObject : t) }
          this.markDirty()
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        testObjects: page.testObjects.map((t, i) => i === idx ? { ...t, ...updates } as WBTestObject : t),
      }
      this.markDirty()
    },

    getTestObjectById(id: string): WBTestObject | null {
      const page = this.currentPage
      if (!page?.testObjects) return null
      return page.testObjects.find(t => t.id === id) ?? null
    },

    /** Дублювати тестовий об'єкт з офсетом +20px */
    duplicateTestObject(id: string): string | null {
      const page = this.currentPage
      if (!page?.testObjects) return null
      const src = page.testObjects.find(t => t.id === id)
      if (!src) return null

      const newId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const clone: WBTestObject = {
        ...JSON.parse(JSON.stringify(src)),
        id: newId,
        x: src.x + 20,
        y: src.y + 20,
        locked: false,
      }

      this.addTestObject(clone)
      return newId
    },

    // Phase 34 A3: Z-order actions with undo
    bringForward(id: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const _pi = pageIndex
      const _id = id
      const _pageId = page.id ?? ''

      // Check strokes
      const si = page.strokes.findIndex(s => s.id === id)
      if (si !== -1 && si < page.strokes.length - 1) {
        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.strokes.findIndex(s => s.id === _id)
            if (idx === -1 || idx >= p.strokes.length - 1) return
            const arr = [...p.strokes]
            ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
            this.pages[_pi] = { ...p, strokes: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'bringForward' } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.strokes.findIndex(s => s.id === _id)
            if (idx <= 0) return
            const arr = [...p.strokes]
            ;[arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]
            this.pages[_pi] = { ...p, strokes: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'sendBackward' } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
        const arr = [...page.strokes]
        ;[arr[si], arr[si + 1]] = [arr[si + 1], arr[si]]
        this.pages[pageIndex] = { ...page, strokes: arr }
        this.markDirty()
        if (this.mode === 'edit') {
          _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: id, action: 'bringForward' } })
        }
        return
      }

      // Check assets
      const ai = page.assets.findIndex(a => a.id === id)
      if (ai !== -1 && ai < page.assets.length - 1) {
        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.assets.findIndex(a => a.id === _id)
            if (idx === -1 || idx >= p.assets.length - 1) return
            const arr = [...p.assets]
            ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
            this.pages[_pi] = { ...p, assets: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'bringForward' } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.assets.findIndex(a => a.id === _id)
            if (idx <= 0) return
            const arr = [...p.assets]
            ;[arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]
            this.pages[_pi] = { ...p, assets: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'sendBackward' } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
        const arr = [...page.assets]
        ;[arr[ai], arr[ai + 1]] = [arr[ai + 1], arr[ai]]
        this.pages[pageIndex] = { ...page, assets: arr }
        this.markDirty()
        if (this.mode === 'edit') {
          _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: id, action: 'bringForward' } })
        }
        return
      }
    },

    sendBackward(id: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const _pi = pageIndex
      const _id = id
      const _pageId = page.id ?? ''

      const si = page.strokes.findIndex(s => s.id === id)
      if (si > 0) {
        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.strokes.findIndex(s => s.id === _id)
            if (idx <= 0) return
            const arr = [...p.strokes]
            ;[arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]
            this.pages[_pi] = { ...p, strokes: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'sendBackward' } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.strokes.findIndex(s => s.id === _id)
            if (idx === -1 || idx >= p.strokes.length - 1) return
            const arr = [...p.strokes]
            ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
            this.pages[_pi] = { ...p, strokes: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'bringForward' } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
        const arr = [...page.strokes]
        ;[arr[si], arr[si - 1]] = [arr[si - 1], arr[si]]
        this.pages[pageIndex] = { ...page, strokes: arr }
        this.markDirty()
        if (this.mode === 'edit') {
          _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: id, action: 'sendBackward' } })
        }
        return
      }

      const ai = page.assets.findIndex(a => a.id === id)
      if (ai > 0) {
        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.assets.findIndex(a => a.id === _id)
            if (idx <= 0) return
            const arr = [...p.assets]
            ;[arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]
            this.pages[_pi] = { ...p, assets: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'sendBackward' } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.assets.findIndex(a => a.id === _id)
            if (idx === -1 || idx >= p.assets.length - 1) return
            const arr = [...p.assets]
            ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
            this.pages[_pi] = { ...p, assets: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'bringForward' } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
        const arr = [...page.assets]
        ;[arr[ai], arr[ai - 1]] = [arr[ai - 1], arr[ai]]
        this.pages[pageIndex] = { ...page, assets: arr }
        this.markDirty()
        if (this.mode === 'edit') {
          _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: id, action: 'sendBackward' } })
        }
        return
      }
    },

    // Phase 34: Override existing bringToFront with undo support + strokes
    bringToFront(id: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const _pi = pageIndex
      const _id = id
      const _pageId = page.id ?? ''

      const si = page.strokes.findIndex(s => s.id === id)
      if (si !== -1 && si < page.strokes.length - 1) {
        const _fromIndex = si
        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.strokes.findIndex(s => s.id === _id)
            if (idx === -1 || idx >= p.strokes.length - 1) return
            const arr = [...p.strokes]
            const [item] = arr.splice(idx, 1)
            arr.push(item)
            this.pages[_pi] = { ...p, strokes: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'bringToFront' } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.strokes.findIndex(s => s.id === _id)
            if (idx === -1) return
            const arr = [...p.strokes]
            const [item] = arr.splice(idx, 1)
            arr.splice(_fromIndex, 0, item)
            this.pages[_pi] = { ...p, strokes: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'sendToBack' } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
        const arr = [...page.strokes]
        const [item] = arr.splice(si, 1)
        arr.push(item)
        this.pages[pageIndex] = { ...page, strokes: arr }
        this.markDirty()
        if (this.mode === 'edit') {
          _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: id, action: 'bringToFront' } })
        }
        return
      }

      const ai = page.assets.findIndex(a => a.id === id)
      if (ai !== -1 && ai < page.assets.length - 1) {
        const _fromIndex = ai
        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.assets.findIndex(a => a.id === _id)
            if (idx === -1 || idx >= p.assets.length - 1) return
            const arr = [...p.assets]
            const [item] = arr.splice(idx, 1)
            arr.push(item)
            this.pages[_pi] = { ...p, assets: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'bringToFront' } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.assets.findIndex(a => a.id === _id)
            if (idx === -1) return
            const arr = [...p.assets]
            const [item] = arr.splice(idx, 1)
            arr.splice(_fromIndex, 0, item)
            this.pages[_pi] = { ...p, assets: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'sendToBack' } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
        const arr = [...page.assets]
        const [item] = arr.splice(ai, 1)
        arr.push(item)
        this.pages[pageIndex] = { ...page, assets: arr }
        this.markDirty()
        if (this.mode === 'edit') {
          _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: id, action: 'bringToFront' } })
        }
        return
      }
    },

    // Phase 34: Override existing sendToBack with undo support + strokes
    sendToBack(id: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const _pi = pageIndex
      const _id = id
      const _pageId = page.id ?? ''

      const si = page.strokes.findIndex(s => s.id === id)
      if (si > 0) {
        const _fromIndex = si
        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.strokes.findIndex(s => s.id === _id)
            if (idx <= 0) return
            const arr = [...p.strokes]
            const [item] = arr.splice(idx, 1)
            arr.unshift(item)
            this.pages[_pi] = { ...p, strokes: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'sendToBack' } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.strokes.findIndex(s => s.id === _id)
            if (idx === -1) return
            const arr = [...p.strokes]
            const [item] = arr.splice(idx, 1)
            arr.splice(_fromIndex, 0, item)
            this.pages[_pi] = { ...p, strokes: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'bringToFront' } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
        const arr = [...page.strokes]
        const [item] = arr.splice(si, 1)
        arr.unshift(item)
        this.pages[pageIndex] = { ...page, strokes: arr }
        this.markDirty()
        if (this.mode === 'edit') {
          _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: id, action: 'sendToBack' } })
        }
        return
      }

      const ai = page.assets.findIndex(a => a.id === id)
      if (ai > 0) {
        const _fromIndex = ai
        const cmd: WBCommand = {
          apply: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.assets.findIndex(a => a.id === _id)
            if (idx <= 0) return
            const arr = [...p.assets]
            const [item] = arr.splice(idx, 1)
            arr.unshift(item)
            this.pages[_pi] = { ...p, assets: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'sendToBack' } })
          },
          revert: () => {
            const p = this.pages[_pi]
            if (!p) return
            const idx = p.assets.findIndex(a => a.id === _id)
            if (idx === -1) return
            const arr = [...p.assets]
            const [item] = arr.splice(idx, 1)
            arr.splice(_fromIndex, 0, item)
            this.pages[_pi] = { ...p, assets: arr }
            this.markDirty()
            _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: _id, action: 'bringToFront' } })
          },
        }
        this.undoStack = trimStack([...this.undoStack, cmd])
        this.redoStack = []
        const arr = [...page.assets]
        const [item] = arr.splice(ai, 1)
        arr.unshift(item)
        this.pages[pageIndex] = { ...page, assets: arr }
        this.markDirty()
        if (this.mode === 'edit') {
          _emitOperation({ op_type: 'z_order', page_id: _pageId, payload: { object_id: id, action: 'sendToBack' } })
        }
        return
      }
    },

    deleteSelected(): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || this.selectedIds.length === 0) return

      const ids = new Set(this.selectedIds)

      // Record undo for each deleted item
      const deletedStrokes = page.strokes.filter((s) => ids.has(s.id))
      const deletedAssets = page.assets.filter((a) => ids.has(a.id))

      const _deletedStrokes = deletedStrokes.map((s) => ({ ...s }))
      const _deletedAssets = deletedAssets.map((a) => ({ ...a }))
      const _pageId = page.id ?? ''

      // Single command for entire batch delete (one Ctrl+Z restores all)
      const cmd: WBCommand = {
        apply: () => {
          for (const s of _deletedStrokes) {
            this.deleteStroke(s.id, { skipHistory: true })
          }
          for (const a of _deletedAssets) {
            this.deleteAsset(a.id, { skipHistory: true })
          }
          this.selectedIds = []
          this.selectionRect = null
        },
        revert: () => {
          for (const s of _deletedStrokes) {
            this.addStroke(s, { skipHistory: true })
          }
          for (const a of _deletedAssets) {
            this.addAsset(a, { skipHistory: true })
          }
        },
      }
      this.undoStack = trimStack([...this.undoStack, cmd])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        strokes: page.strokes.filter((s) => !ids.has(s.id)),
        assets: page.assets.filter((a) => !ids.has(a.id)),
      }

      this.selectedIds = []
      this.selectionRect = null
      this.markDirty()
      if (this.mode === 'edit') {
        for (const s of deletedStrokes) {
          _emitOperation({ op_type: 'stroke_delete', page_id: _pageId, payload: { stroke_id: s.id } })
        }
        for (const a of deletedAssets) {
          _emitOperation({ op_type: 'asset_delete', page_id: _pageId, payload: { asset_id: a.id } })
        }
      }
    },

    // ── Reset ────────────────────────────────────────────────────────────

    reset(): void {
      this.$reset()
    },
  },
})
