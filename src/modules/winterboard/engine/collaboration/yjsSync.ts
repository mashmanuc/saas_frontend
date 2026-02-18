// WB: Bidirectional sync between Yjs document and boardStore
// Ref: TASK_BOARD_PHASES.md A6.1, LAW-02 (Sync), LAW-16 (Multi-User)
//
// Sync strategy:
// 1. Yjs → Store: observe Yjs changes → patch store (skip if isYjsUpdate)
// 2. Store → Yjs: watch store actions → update Yjs doc (skip if isYjsUpdate)
// 3. Initial hydration: empty doc → from store; existing doc → to store
//
// ⚠️ Circular update prevention:
//   isYjsUpdate flag is set true when patching store FROM Yjs.
//   Store → Yjs sync checks this flag and skips if true.

import * as Y from 'yjs'
import type { WBPage, WBStroke, WBAsset } from '../../types/winterboard'
import {
  getPages,
  readAllPages,
  addPage as yjsAddPage,
  addStroke as yjsAddStroke,
  removeStroke as yjsRemoveStroke,
  updateStroke as yjsUpdateStroke,
  addAsset as yjsAddAsset,
  removeAsset as yjsRemoveAsset,
  updateAsset as yjsUpdateAsset,
  removePage as yjsRemovePage,
  hydrateFromState,
} from './yjsDocument'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:YjsSync]'

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Minimal store interface — decoupled from Pinia for testability.
 * Matches the shape of useWBStore() actions/state we need.
 */
export interface WBStoreAdapter {
  // State
  pages: WBPage[]
  currentPageIndex: number
  isDirty: boolean

  // Actions
  $patch(partial: Record<string, unknown>): void
  markDirty(): void
  goToPage(index: number): void
}

export interface YjsSyncHandle {
  /** Stop all observers and watchers */
  destroy(): void
  /** Whether sync is currently suppressing store→Yjs updates */
  readonly isYjsUpdate: boolean
  /** Push a store action to Yjs (called by store interceptors) */
  pushAddStroke(pageIndex: number, stroke: WBStroke): void
  pushRemoveStroke(pageIndex: number, strokeId: string): void
  pushUpdateStroke(pageIndex: number, strokeId: string, updates: Partial<WBStroke>): void
  pushAddAsset(pageIndex: number, asset: WBAsset): void
  pushRemoveAsset(pageIndex: number, assetId: string): void
  pushUpdateAsset(pageIndex: number, assetId: string, updates: Partial<WBAsset>): void
  pushAddPage(page: WBPage): void
  pushRemovePage(pageIndex: number): void
}

// ─── Setup ──────────────────────────────────────────────────────────────────

/**
 * Setup bidirectional sync between a Yjs document and the board store.
 *
 * @param doc - Yjs document
 * @param store - Board store adapter
 * @param userId - Current user ID (used as transaction origin for UndoManager)
 * @returns Sync handle with destroy() and push methods
 */
export function setupYjsSync(
  doc: Y.Doc,
  store: WBStoreAdapter,
  userId: string,
): YjsSyncHandle {
  let _isYjsUpdate = false
  let destroyed = false

  // ── Yjs → Store sync ─────────────────────────────────────────────────

  const yPages = getPages(doc)

  /**
   * Full re-read from Yjs → store.
   * Called on deep observe events.
   */
  function syncYjsToStore(): void {
    if (destroyed) return
    _isYjsUpdate = true
    try {
      const pages = readAllPages(doc)
      store.$patch({ pages })
    } finally {
      _isYjsUpdate = false
    }
  }

  /**
   * Observe deep changes on the pages array.
   * Any nested change (stroke added, asset moved, etc.) triggers a full re-read.
   * This is simple and correct; optimization (partial patches) can come later.
   */
  function onYjsDeepChange(events: Y.YEvent<Y.AbstractType<unknown>>[], transaction: Y.Transaction): void {
    // Skip changes originated from this client's store→Yjs push
    if (transaction.origin === userId) return
    syncYjsToStore()
  }

  yPages.observeDeep(onYjsDeepChange)

  // ── Initial hydration ─────────────────────────────────────────────────

  /**
   * Determine initial state:
   * - If Yjs doc has pages → hydrate store from Yjs (joining user)
   * - If Yjs doc is empty → hydrate Yjs from store (first user)
   */
  function performInitialHydration(): void {
    if (yPages.length > 0) {
      // Yjs has data → hydrate store
      console.info(LOG, 'Hydrating store from Yjs doc', { pageCount: yPages.length })
      syncYjsToStore()
    } else if (store.pages.length > 0) {
      // Store has data, Yjs empty → hydrate Yjs
      console.info(LOG, 'Hydrating Yjs doc from store', { pageCount: store.pages.length })
      hydrateFromState(doc, store.pages, userId)
    }
  }

  performInitialHydration()

  // ── Store → Yjs push methods ──────────────────────────────────────────
  // Called by the collaboration layer when store actions happen.
  // These skip if _isYjsUpdate is true (change came FROM Yjs).

  function pushAddStroke(pageIndex: number, stroke: WBStroke): void {
    if (_isYjsUpdate || destroyed) return
    yjsAddStroke(doc, pageIndex, stroke, userId)
  }

  function pushRemoveStroke(pageIndex: number, strokeId: string): void {
    if (_isYjsUpdate || destroyed) return
    yjsRemoveStroke(doc, pageIndex, strokeId, userId)
  }

  function pushUpdateStroke(pageIndex: number, strokeId: string, updates: Partial<WBStroke>): void {
    if (_isYjsUpdate || destroyed) return
    yjsUpdateStroke(doc, pageIndex, strokeId, updates, userId)
  }

  function pushAddAsset(pageIndex: number, asset: WBAsset): void {
    if (_isYjsUpdate || destroyed) return
    yjsAddAsset(doc, pageIndex, asset, userId)
  }

  function pushRemoveAsset(pageIndex: number, assetId: string): void {
    if (_isYjsUpdate || destroyed) return
    yjsRemoveAsset(doc, pageIndex, assetId, userId)
  }

  function pushUpdateAsset(pageIndex: number, assetId: string, updates: Partial<WBAsset>): void {
    if (_isYjsUpdate || destroyed) return
    yjsUpdateAsset(doc, pageIndex, assetId, updates, userId)
  }

  function pushAddPage(page: WBPage): void {
    if (_isYjsUpdate || destroyed) return
    yjsAddPage(doc, page, userId)
  }

  function pushRemovePage(pageIndex: number): void {
    if (_isYjsUpdate || destroyed) return
    yjsRemovePage(doc, pageIndex, userId)
  }

  // ── Cleanup ───────────────────────────────────────────────────────────

  function destroy(): void {
    destroyed = true
    yPages.unobserveDeep(onYjsDeepChange)
  }

  return {
    destroy,
    get isYjsUpdate() { return _isYjsUpdate },
    pushAddStroke,
    pushRemoveStroke,
    pushUpdateStroke,
    pushAddAsset,
    pushRemoveAsset,
    pushUpdateAsset,
    pushAddPage,
    pushRemovePage,
  }
}
