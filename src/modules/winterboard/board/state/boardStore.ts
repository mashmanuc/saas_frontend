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
} from '../../types/winterboard'
import type { PdfPageResult } from '../../api/winterboardApi'

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

type UndoAction =
  | UndoAddStroke
  | UndoDeleteStroke
  | UndoUpdateStroke
  | UndoAddAsset
  | UndoDeleteAsset
  | UndoUpdateAsset
  | UndoClearPage

// ─── Store State Interface ──────────────────────────────────────────────────

export interface WBBoardState {
  // Workspace identity (LAW-01)
  workspaceId: string | null
  workspaceName: string
  ownerId: string | null

  // Sync metadata (LAW-02)
  lastSavedAt: Date | null
  isDirty: boolean
  syncStatus: WBSyncStatus
  syncError: string | null
  rev: number

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

  // History (LAW-19)
  undoStack: UndoAction[]
  redoStack: UndoAction[]

  // A6.1: Collaboration mode flag
  isCollaborative: boolean
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
  }
}

function trimStack(stack: UndoAction[]): UndoAction[] {
  if (stack.length > MAX_UNDO_STACK) {
    return stack.slice(stack.length - MAX_UNDO_STACK)
  }
  return stack
}

// ─── Store Definition ───────────────────────────────────────────────────────

export const useWBStore = defineStore('wb-board', {
  state: (): WBBoardState => ({
    workspaceId: null,
    workspaceName: 'Untitled',
    ownerId: null,

    lastSavedAt: null,
    isDirty: false,
    syncStatus: 'idle',
    syncError: null,
    rev: 0,

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
  }),

  // ─── Getters ────────────────────────────────────────────────────────────

  getters: {
    canUndo: (state): boolean => state.undoStack.length > 0,
    canRedo: (state): boolean => state.redoStack.length > 0,

    currentPage: (state): WBPage | null =>
      state.pages[state.currentPageIndex] ?? null,

    pageCount: (state): number => state.pages.length,

    hasWorkspace: (state): boolean => !!state.workspaceId,

    // Return original array reference — NO copying (prevents flicker)
    currentStrokes(state): WBStroke[] {
      const page = state.pages[state.currentPageIndex]
      return page ? page.strokes : []
    },

    currentAssets(state): WBAsset[] {
      const page = state.pages[state.currentPageIndex]
      return page ? page.assets : []
    },

    // Serialize for API (LAW-02)
    serializedState(state): WBWorkspaceState {
      return {
        pages: state.pages,
        currentPageIndex: state.currentPageIndex,
      }
    },
  },

  // ─── Actions ──────────────────────────────────────────────────────────────

  actions: {
    // ── Workspace Lifecycle ───────────────────────────────────────────────

    /**
     * Hydrate store from backend session data
     */
    hydrateFromSession(session: WBSession): void {
      this.workspaceId = session.id
      this.workspaceName = session.name
      this.ownerId = session.owner_id ?? null
      this.rev = session.rev ?? 0

      if (session.state) {
        const state = session.state
        if (state.pages && Array.isArray(state.pages) && state.pages.length > 0) {
          this.pages = state.pages as WBPage[]
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

    // ── Dirty / Sync ─────────────────────────────────────────────────────

    markDirty(): void {
      this.isDirty = true
    },

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

    addStroke(stroke: WBStroke): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) {
        console.error('[WB:Store] addStroke: no page at index', pageIndex)
        return
      }

      const action: UndoAddStroke = {
        type: 'addStroke',
        pageIndex,
        stroke,
        index: page.strokes.length,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      // Replace page object to trigger Vue reactivity
      this.pages[pageIndex] = {
        ...page,
        strokes: [...page.strokes, stroke],
      }

      this.markDirty()
    },

    updateStroke(updatedStroke: WBStroke): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.strokes.findIndex((s) => s.id === updatedStroke.id)
      if (idx === -1) return

      const action: UndoUpdateStroke = {
        type: 'updateStroke',
        pageIndex,
        prev: page.strokes[idx],
        next: updatedStroke,
        index: idx,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      const newStrokes = [...page.strokes]
      newStrokes[idx] = updatedStroke
      this.pages[pageIndex] = { ...page, strokes: newStrokes }

      this.markDirty()
    },

    deleteStroke(strokeId: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.strokes.findIndex((s) => s.id === strokeId)
      if (idx === -1) return

      const action: UndoDeleteStroke = {
        type: 'deleteStroke',
        pageIndex,
        stroke: page.strokes[idx],
        index: idx,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        strokes: page.strokes.filter((_, i) => i !== idx),
      }

      this.markDirty()
    },

    // ── Asset Actions ────────────────────────────────────────────────────

    addAsset(asset: WBAsset): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const action: UndoAddAsset = {
        type: 'addAsset',
        pageIndex,
        asset,
        index: page.assets.length,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        assets: [...page.assets, asset],
      }

      this.markDirty()
    },

    updateAsset(asset: WBAsset, opts?: { skipHistory?: boolean }): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.assets.findIndex((a) => a.id === asset.id)
      if (idx === -1) return

      if (!opts?.skipHistory) {
        const action: UndoUpdateAsset = {
          type: 'updateAsset',
          pageIndex,
          prev: page.assets[idx],
          next: asset,
          index: idx,
        }
        this.undoStack = trimStack([...this.undoStack, action])
        this.redoStack = []
      }

      const newAssets = [...page.assets]
      newAssets[idx] = asset
      this.pages[pageIndex] = { ...page, assets: newAssets }

      this.markDirty()
    },

    deleteAsset(assetId: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const idx = page.assets.findIndex((a) => a.id === assetId)
      if (idx === -1) return

      const action: UndoDeleteAsset = {
        type: 'deleteAsset',
        pageIndex,
        asset: page.assets[idx],
        index: idx,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        assets: page.assets.filter((_, i) => i !== idx),
      }

      this.markDirty()
    },

    // ── Undo / Redo (LAW-19) ─────────────────────────────────────────────

    undo(): void {
      const action = this.undoStack.pop()
      if (!action) return

      const page = this.pages[action.pageIndex]
      if (!page) return

      switch (action.type) {
        case 'addStroke': {
          this.pages[action.pageIndex] = {
            ...page,
            strokes: page.strokes.filter((_, i) => i !== action.index),
          }
          break
        }
        case 'deleteStroke': {
          const strokes = [...page.strokes]
          strokes.splice(action.index, 0, action.stroke)
          this.pages[action.pageIndex] = { ...page, strokes }
          break
        }
        case 'updateStroke': {
          const strokes = [...page.strokes]
          strokes[action.index] = action.prev
          this.pages[action.pageIndex] = { ...page, strokes }
          break
        }
        case 'addAsset': {
          this.pages[action.pageIndex] = {
            ...page,
            assets: page.assets.filter((_, i) => i !== action.index),
          }
          break
        }
        case 'deleteAsset': {
          const assets = [...page.assets]
          assets.splice(action.index, 0, action.asset)
          this.pages[action.pageIndex] = { ...page, assets }
          break
        }
        case 'updateAsset': {
          const assets = [...page.assets]
          assets[action.index] = action.prev
          this.pages[action.pageIndex] = { ...page, assets }
          break
        }
        case 'clearPage': {
          this.pages[action.pageIndex] = {
            ...page,
            strokes: action.prevStrokes,
            assets: action.prevAssets,
          }
          break
        }
      }

      this.redoStack.push(action)
      this.markDirty()
    },

    redo(): void {
      const action = this.redoStack.pop()
      if (!action) return

      const page = this.pages[action.pageIndex]
      if (!page) return

      switch (action.type) {
        case 'addStroke': {
          const strokes = [...page.strokes]
          strokes.splice(action.index, 0, action.stroke)
          this.pages[action.pageIndex] = { ...page, strokes }
          break
        }
        case 'deleteStroke': {
          this.pages[action.pageIndex] = {
            ...page,
            strokes: page.strokes.filter((_, i) => i !== action.index),
          }
          break
        }
        case 'updateStroke': {
          const strokes = [...page.strokes]
          strokes[action.index] = action.next
          this.pages[action.pageIndex] = { ...page, strokes }
          break
        }
        case 'addAsset': {
          const assets = [...page.assets]
          assets.splice(action.index, 0, action.asset)
          this.pages[action.pageIndex] = { ...page, assets }
          break
        }
        case 'deleteAsset': {
          this.pages[action.pageIndex] = {
            ...page,
            assets: page.assets.filter((_, i) => i !== action.index),
          }
          break
        }
        case 'updateAsset': {
          const assets = [...page.assets]
          assets[action.index] = action.next
          this.pages[action.pageIndex] = { ...page, assets }
          break
        }
        case 'clearPage': {
          this.pages[action.pageIndex] = {
            ...page,
            strokes: [],
            assets: [],
          }
          break
        }
      }

      this.undoStack.push(action)
      this.markDirty()
    },

    // ── Page Actions (LAW-03) ────────────────────────────────────────────

    clearPage(): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const action: UndoClearPage = {
        type: 'clearPage',
        pageIndex,
        prevStrokes: [...page.strokes],
        prevAssets: [...page.assets],
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = { ...page, strokes: [], assets: [] }
      this.markDirty()
    },

    goToPage(index: number): void {
      if (!Number.isFinite(index)) return
      this.currentPageIndex = Math.max(0, Math.min(this.pages.length - 1, index))
    },

    addPage(opts?: { background?: WBPageBackground; width?: number; height?: number; name?: string }): void {
      if (this.pages.length >= 200) {
        console.warn('[WB:Store] Max 200 pages reached')
        return
      }
      const newPage: WBPage = {
        id: generatePageId(),
        name: opts?.name ?? `Page ${this.pages.length + 1}`,
        strokes: [],
        assets: [],
        background: opts?.background ?? 'white',
        width: opts?.width,
        height: opts?.height,
      }
      this.pages = [...this.pages, newPage]
      this.currentPageIndex = this.pages.length - 1
      this.markDirty()
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
      return firstIndex
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

    // ── Reset ────────────────────────────────────────────────────────────

    reset(): void {
      this.$reset()
    },
  },
})
