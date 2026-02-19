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

  // v5 A1: Multi-select state
  selectedIds: string[]
  selectionRect: WBSelectionRect | null
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

    selectedIds: [],
    selectionRect: null,
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
        case 'createGroup': {
          // Undo create → remove the group
          const groups = (page.groups ?? []).filter((g) => g.id !== action.group.id)
          this.pages[action.pageIndex] = { ...page, groups }
          break
        }
        case 'deleteGroup': {
          // Undo delete → restore the group
          const groups = [...(page.groups ?? []), action.group]
          this.pages[action.pageIndex] = { ...page, groups }
          break
        }
        case 'lockItems': {
          // Undo lock → restore previous lock state
          const newStrokes = [...page.strokes]
          const newAssets = [...page.assets]
          for (const item of action.items) {
            const si = newStrokes.findIndex((s) => s.id === item.id)
            if (si !== -1) {
              newStrokes[si] = { ...newStrokes[si], locked: item.prevLocked, lockedBy: item.prevLockedBy }
            }
            const ai = newAssets.findIndex((a) => a.id === item.id)
            if (ai !== -1) {
              newAssets[ai] = { ...newAssets[ai], locked: item.prevLocked, lockedBy: item.prevLockedBy }
            }
          }
          this.pages[action.pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
          break
        }
        case 'unlockItems': {
          // Undo unlock → restore previous lock state (re-lock)
          const newStrokes = [...page.strokes]
          const newAssets = [...page.assets]
          for (const item of action.items) {
            const si = newStrokes.findIndex((s) => s.id === item.id)
            if (si !== -1) {
              newStrokes[si] = { ...newStrokes[si], locked: item.prevLocked, lockedBy: item.prevLockedBy }
            }
            const ai = newAssets.findIndex((a) => a.id === item.id)
            if (ai !== -1) {
              newAssets[ai] = { ...newAssets[ai], locked: item.prevLocked, lockedBy: item.prevLockedBy }
            }
          }
          this.pages[action.pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
          break
        }
        case 'duplicate': {
          // Undo duplicate → remove cloned items, re-select originals
          const dupIds = new Set(action.newIds)
          this.pages[action.pageIndex] = {
            ...page,
            strokes: page.strokes.filter((s) => !dupIds.has(s.id)),
            assets: page.assets.filter((a) => !dupIds.has(a.id)),
          }
          this.selectedIds = [...action.originalIds]
          break
        }
        case 'align': {
          // Undo align → reverse all moves (-dx, -dy)
          const newStrokes = [...page.strokes]
          const newAssets = [...page.assets]
          for (const move of action.moves) {
            const si = newStrokes.findIndex((s) => s.id === move.id)
            if (si !== -1) {
              const s = newStrokes[si]
              newStrokes[si] = {
                ...s,
                points: s.points.map((p) => ({ ...p, x: p.x - move.dx, y: p.y - move.dy })),
              }
            }
            const ai = newAssets.findIndex((a) => a.id === move.id)
            if (ai !== -1) {
              const a = newAssets[ai]
              newAssets[ai] = { ...a, x: a.x - move.dx, y: a.y - move.dy }
            }
          }
          this.pages[action.pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
          break
        }
        case 'pageReorder': {
          // Undo reorder → restore previous order
          const pageMap = new Map(this.pages.map((p) => [p.id, p]))
          this.pages = action.previousOrder.map((id) => pageMap.get(id)!).filter(Boolean)
          this.currentPageIndex = Math.min(action.previousPageIndex, this.pages.length - 1)
          break
        }
        case 'addPage': {
          // Undo addPage → remove the page
          const idx = this.pages.findIndex((p) => p.id === action.pageId)
          if (idx !== -1) {
            this.pages = this.pages.filter((_, i) => i !== idx)
            if (this.currentPageIndex >= this.pages.length) {
              this.currentPageIndex = Math.max(0, this.pages.length - 1)
            }
          }
          break
        }
        case 'deletePage': {
          // Undo deletePage → re-insert page at original index
          const pages = [...this.pages]
          pages.splice(action.index, 0, action.page)
          this.pages = pages
          this.currentPageIndex = action.wasCurrentIndex
          break
        }
        case 'clearCurrentPage': {
          // Undo clearCurrentPage → re-add cleared items
          const cp = this.pages[action.pageIndex]
          if (cp) {
            this.pages[action.pageIndex] = {
              ...cp,
              strokes: [...cp.strokes, ...action.clearedStrokes],
              assets: [...cp.assets, ...action.clearedAssets],
            }
          }
          break
        }
        case 'addSticky': {
          // Undo addSticky → remove the sticky
          this.pages[action.pageIndex] = {
            ...page,
            assets: page.assets.filter((_, i) => i !== action.index),
          }
          break
        }
        case 'updateStickyText': {
          // Undo text update → restore previous text
          const assets = page.assets.map((a) =>
            a.id === action.assetId ? { ...a, text: action.prevText } : a,
          )
          this.pages[action.pageIndex] = { ...page, assets }
          break
        }
        case 'updateStickyStyle': {
          // Undo style update → restore previous style
          const assets = page.assets.map((a) =>
            a.id === action.assetId ? { ...a, ...action.prevStyle } : a,
          )
          this.pages[action.pageIndex] = { ...page, assets }
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
        case 'createGroup': {
          // Redo create → re-add the group
          const groups = [...(page.groups ?? []), action.group]
          this.pages[action.pageIndex] = { ...page, groups }
          break
        }
        case 'deleteGroup': {
          // Redo delete → remove the group again
          const groups = (page.groups ?? []).filter((g) => g.id !== action.group.id)
          this.pages[action.pageIndex] = { ...page, groups }
          break
        }
        case 'lockItems': {
          // Redo lock → re-apply lock
          const newStrokes = [...page.strokes]
          const newAssets = [...page.assets]
          for (const item of action.items) {
            const si = newStrokes.findIndex((s) => s.id === item.id)
            if (si !== -1) {
              newStrokes[si] = { ...newStrokes[si], locked: true, lockedBy: newStrokes[si].lockedBy ?? 'local' }
            }
            const ai = newAssets.findIndex((a) => a.id === item.id)
            if (ai !== -1) {
              newAssets[ai] = { ...newAssets[ai], locked: true, lockedBy: newAssets[ai].lockedBy ?? 'local' }
            }
          }
          this.pages[action.pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
          break
        }
        case 'unlockItems': {
          // Redo unlock → re-apply unlock
          const newStrokes = [...page.strokes]
          const newAssets = [...page.assets]
          for (const item of action.items) {
            const si = newStrokes.findIndex((s) => s.id === item.id)
            if (si !== -1) {
              newStrokes[si] = { ...newStrokes[si], locked: false, lockedBy: undefined }
            }
            const ai = newAssets.findIndex((a) => a.id === item.id)
            if (ai !== -1) {
              newAssets[ai] = { ...newAssets[ai], locked: false, lockedBy: undefined }
            }
          }
          this.pages[action.pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
          break
        }
        case 'duplicate': {
          // Redo duplicate → re-add cloned items, select them
          this.pages[action.pageIndex] = {
            ...page,
            strokes: [...page.strokes, ...action.clonedStrokes],
            assets: [...page.assets, ...action.clonedAssets],
          }
          this.selectedIds = [...action.newIds]
          break
        }
        case 'align': {
          // Redo align → re-apply all moves (dx, dy)
          const newStrokes = [...page.strokes]
          const newAssets = [...page.assets]
          for (const move of action.moves) {
            const si = newStrokes.findIndex((s) => s.id === move.id)
            if (si !== -1) {
              const s = newStrokes[si]
              newStrokes[si] = {
                ...s,
                points: s.points.map((p) => ({ ...p, x: p.x + move.dx, y: p.y + move.dy })),
              }
            }
            const ai = newAssets.findIndex((a) => a.id === move.id)
            if (ai !== -1) {
              const a = newAssets[ai]
              newAssets[ai] = { ...a, x: a.x + move.dx, y: a.y + move.dy }
            }
          }
          this.pages[action.pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
          break
        }
        case 'pageReorder': {
          // Redo reorder → apply new order
          const pageMap = new Map(this.pages.map((p) => [p.id, p]))
          this.pages = action.newOrder.map((id) => pageMap.get(id)!).filter(Boolean)
          // Restore currentPageIndex to follow active page
          const activeId = action.previousOrder[action.previousPageIndex]
          const newIdx = this.pages.findIndex((p) => p.id === activeId)
          this.currentPageIndex = newIdx !== -1 ? newIdx : Math.min(action.previousPageIndex, this.pages.length - 1)
          break
        }
        case 'addPage': {
          // Redo addPage → re-add the page
          this.pages = [...this.pages, action.page]
          this.currentPageIndex = this.pages.length - 1
          break
        }
        case 'deletePage': {
          // Redo deletePage → remove the page again
          this.pages = this.pages.filter((p) => p.id !== action.page.id)
          if (this.currentPageIndex >= this.pages.length) {
            this.currentPageIndex = Math.max(0, this.pages.length - 1)
          }
          break
        }
        case 'clearCurrentPage': {
          // Redo clearCurrentPage → remove cleared items again
          const cp = this.pages[action.pageIndex]
          if (cp) {
            const clearedIds = new Set([
              ...action.clearedStrokes.map((s) => s.id),
              ...action.clearedAssets.map((a) => a.id),
            ])
            this.pages[action.pageIndex] = {
              ...cp,
              strokes: cp.strokes.filter((s) => !clearedIds.has(s.id)),
              assets: cp.assets.filter((a) => !clearedIds.has(a.id)),
            }
          }
          break
        }
        case 'addSticky': {
          // Redo addSticky → re-add the sticky
          const assets = [...page.assets]
          assets.splice(action.index, 0, action.asset)
          this.pages[action.pageIndex] = { ...page, assets }
          break
        }
        case 'updateStickyText': {
          // Redo text update → apply new text
          const assets = page.assets.map((a) =>
            a.id === action.assetId ? { ...a, text: action.newText } : a,
          )
          this.pages[action.pageIndex] = { ...page, assets }
          break
        }
        case 'updateStickyStyle': {
          // Redo style update → apply new style
          const assets = page.assets.map((a) =>
            a.id === action.assetId ? { ...a, ...action.newStyle } : a,
          )
          this.pages[action.pageIndex] = { ...page, assets }
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

      const action: UndoPageReorder = {
        type: 'pageReorder',
        pageIndex: 0,
        previousOrder,
        newOrder,
        previousPageIndex,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []
      this.markDirty()
    },

    /**
     * Add a new empty page with undo support.
     * Navigates to the new page.
     */
    addPageUndoable(opts?: { background?: WBPageBackground; width?: number; height?: number; name?: string }): string {
      if (this.pages.length >= 200) {
        console.warn('[WB:Store] Max 200 pages reached')
        return ''
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

      const action: UndoAddPage = {
        type: 'addPage',
        pageIndex: 0,
        pageId: newPage.id,
        page: { ...newPage },
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []
      this.markDirty()
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

      const action: UndoDeletePage = {
        type: 'deletePage',
        pageIndex: 0,
        page: deletedPage,
        index,
        wasCurrentIndex,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []
      this.markDirty()
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

      const action: UndoClearCurrentPage = {
        type: 'clearCurrentPage',
        pageIndex,
        clearedStrokes: [...unlockedStrokes],
        clearedAssets: [...unlockedAssets],
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      // Keep only locked items
      this.pages[pageIndex] = { ...page, strokes: lockedStrokes, assets: lockedAssets }
      this.selectedIds = []
      this.markDirty()
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

      const action: UndoAddSticky = {
        type: 'addSticky',
        pageIndex,
        asset: { ...sticky },
        index: page.assets.length,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        assets: [...page.assets, sticky],
      }
      this.selectedIds = [sticky.id]
      this.selectionRect = null
      this.markDirty()
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

      const action: UndoUpdateStickyText = {
        type: 'updateStickyText',
        pageIndex,
        assetId: id,
        prevText: asset.text ?? '',
        newText: clampedText,
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      const newAssets = page.assets.map((a) =>
        a.id === id ? { ...a, text: clampedText } : a,
      )
      this.pages[pageIndex] = { ...page, assets: newAssets }
      this.markDirty()
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

      const action: UndoUpdateStickyStyle = {
        type: 'updateStickyStyle',
        pageIndex,
        assetId: id,
        prevStyle: prevStyle as { bgColor?: string; textColor?: string; fontSize?: number },
        newStyle: newStyle as { bgColor?: string; textColor?: string; fontSize?: number },
      }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      const newAssets = page.assets.map((a) =>
        a.id === id ? { ...a, ...newStyle } : a,
      )
      this.pages[pageIndex] = { ...page, assets: newAssets }
      this.markDirty()
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

      const action: UndoCreateGroup = { type: 'createGroup', pageIndex, group }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        groups: [...existingGroups, group],
      }
      this.markDirty()
      return group
    },

    deleteGroup(groupId: string): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page) return

      const groups = page.groups ?? []
      const group = groups.find((g) => g.id === groupId)
      if (!group) return

      const action: UndoDeleteGroup = { type: 'deleteGroup', pageIndex, group }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        groups: groups.filter((g) => g.id !== groupId),
      }
      this.markDirty()
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

      const action: UndoLockItems = { type: 'lockItems', pageIndex, items: prevStates }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
      // Clear selection — locked items should not remain selected
      this.selectedIds = []
      this.selectionRect = null
      this.markDirty()
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

      const action: UndoUnlockItems = { type: 'unlockItems', pageIndex, items: prevStates }
      this.undoStack = trimStack([...this.undoStack, action])
      this.redoStack = []

      this.pages[pageIndex] = { ...page, strokes: newStrokes, assets: newAssets }
      this.markDirty()
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

      // Push undo action
      const action: UndoDuplicate = {
        type: 'duplicate',
        pageIndex,
        newIds,
        originalIds,
        clonedStrokes,
        clonedAssets,
      }
      this.undoStack = trimStack([...this.undoStack, action])
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

      const action: UndoAlign = { type: 'align', pageIndex, moves: effectiveMoves }
      this.undoStack = trimStack([...this.undoStack, action])
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
      this.selectedIds = [...ids]
    },

    addToSelection(id: string): void {
      if (!this.selectedIds.includes(id)) {
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

      const ids = new Set(this.selectedIds)

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
    },

    deleteSelected(): void {
      const pageIndex = this.currentPageIndex
      const page = this.pages[pageIndex]
      if (!page || this.selectedIds.length === 0) return

      const ids = new Set(this.selectedIds)

      // Record undo for each deleted item
      const deletedStrokes = page.strokes.filter((s) => ids.has(s.id))
      const deletedAssets = page.assets.filter((a) => ids.has(a.id))

      for (const stroke of deletedStrokes) {
        const idx = page.strokes.indexOf(stroke)
        const action: UndoDeleteStroke = {
          type: 'deleteStroke',
          pageIndex,
          stroke,
          index: idx,
        }
        this.undoStack = trimStack([...this.undoStack, action])
      }
      for (const asset of deletedAssets) {
        const idx = page.assets.indexOf(asset)
        const action: UndoDeleteAsset = {
          type: 'deleteAsset',
          pageIndex,
          asset,
          index: idx,
        }
        this.undoStack = trimStack([...this.undoStack, action])
      }
      this.redoStack = []

      this.pages[pageIndex] = {
        ...page,
        strokes: page.strokes.filter((s) => !ids.has(s.id)),
        assets: page.assets.filter((a) => !ids.has(a.id)),
      }

      this.selectedIds = []
      this.selectionRect = null
      this.markDirty()
    },

    // ── Reset ────────────────────────────────────────────────────────────

    reset(): void {
      this.$reset()
    },
  },
})
