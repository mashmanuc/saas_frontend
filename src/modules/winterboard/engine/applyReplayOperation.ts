/**
 * Apply a single replay operation to the board store.
 * Shared between WBSoloRoom, WBClassroomRoom, and WBPublicView.
 *
 * Phase 19 R5 — DRY extraction.
 * P0 FIX (2026-04-09): Instance-scoped via createReplayApplier() factory.
 * Previous global _ensuredPageIds leaked state between concurrent replay instances.
 *
 * All operations are applied with { skipHistory: true } because
 * replay operations are not undoable.
 *
 * === REPLAY INVARIANTS ===
 *
 * 1. DETERMINISTIC: same ops sequence → same final state.
 *    Adding non-determinism (Math.random, Date.now) in apply() WILL break replay.
 *
 * 2. ORDER-SENSITIVE: ops MUST be applied in seq order.
 *    Changing order → invalid state transitions → visual corruption.
 *
 * 3. NO MISSING OPS: skipping ops causes state divergence.
 *    Every recorded op MUST be applied during replay (unknown ops → console.debug, not throw).
 *
 * 4. NO SIDE EFFECTS: apply() must only mutate store state via store methods.
 *    Emitting new ops from apply() → infinite loop (use { silent: true } pattern).
 *
 * 5. NO PAGE RESOLUTION CHANGES without E2E replay testing.
 *    _resolvePageId is the most fragile part — any "cleanup" breaks multi-page replay.
 */
import type { BoardOperation } from '../types/replay'
import type { WBStroke, WBAsset, WBPageBackground, WBPageGridSettings } from '../types/winterboard'

export interface ReplayStoreApi {
  addStroke: (s: WBStroke, opts?: { skipHistory?: boolean }) => void
  updateStroke: (s: WBStroke, opts?: { skipHistory?: boolean }) => void
  deleteStroke: (id: string, opts?: { skipHistory?: boolean }) => void
  addAsset: (a: WBAsset, opts?: { skipHistory?: boolean }) => void
  updateAsset: (a: WBAsset, opts?: { skipHistory?: boolean }) => void
  deleteAsset: (id: string, opts?: { skipHistory?: boolean }) => void
  addPage: (opts?: {
    name?: string
    background?: WBPageBackground
    backgroundColor?: string
    width?: number
    height?: number
  }) => void
  goToPage: (index: number) => void
  deletePage: (index: number) => void
  clearPage: () => void
  // Phase 20+ board meta ops
  setGridSize: (size: number) => void
  updateCurrentPageGrid: (updates: Partial<WBPageGridSettings>) => void
  setBackgroundColor: (color: string) => void
  createGroup: (itemIds: string[]) => unknown
  deleteGroup: (groupId: string) => void
  lockItems: (ids: string[]) => void
  unlockItems: (ids: string[]) => void
  bringForward: (id: string) => void
  sendBackward: (id: string) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  // Text annotation on objects (interaction layer, not rendering)
  setObjectText: (objectId: string, text: string | undefined, opts?: { silent?: boolean }) => void
  // GeoBoard: granular vertex mutation
  updateGeometryVertex?: (assetId: string, vertexIndex: number, point: { x: number; y: number }, opts?: { skipEmit?: boolean }) => void
  currentPageIndex: number
  pages: Array<{ id: string }>
}

/**
 * Factory: creates an instance-scoped replay applier.
 * Each replay session gets its own page-tracking state — no global leaks.
 *
 * Usage:
 *   const applier = createReplayApplier()
 *   applier.apply(store, op)
 *   applier.markPagesEnsured(pageIds)
 *   applier.reset()
 */
export function createReplayApplier() {
  const ensuredPageIds = new Set<string>()
  // P0-FIX: Page ID mapping — ops may use different IDs than snapshot.
  // Example: snapshot has page-1, but ops recorded with page-175xxx (page was renamed/recreated).
  // Without mapping, applier creates new blank pages → loses background/assets.
  const pageIdMap = new Map<string, string>() // ops page_id → store page_id
  let _snapshotPageIds: string[] = [] // ordered snapshot page IDs for positional mapping

  function reset(): void {
    ensuredPageIds.clear()
    pageIdMap.clear()
    _snapshotPageIds = []
  }

  function markPagesEnsured(pageIds: string[]): void {
    _snapshotPageIds = pageIds.filter(Boolean)
    for (const id of _snapshotPageIds) {
      ensuredPageIds.add(id)
    }
  }

  /**
   * Resolve op.page_id to actual store page_id.
   * Handles mismatch between recording ops and snapshot state.
   */
  function _resolvePageId(opPageId: string, store: ReplayStoreApi): string {
    // 1. Direct match — op page_id exists in store
    if (store.pages.some(p => p.id === opPageId)) return opPageId
    // 2. Already mapped from previous op
    if (pageIdMap.has(opPageId)) return pageIdMap.get(opPageId)!
    // 3. Positional mapping — first unmapped op page_id maps to first unmapped snapshot page
    const mappedSnapshotIds = new Set(pageIdMap.values())
    const unmappedSnapshot = _snapshotPageIds.find(id => !mappedSnapshotIds.has(id))
    if (unmappedSnapshot && store.pages.some(p => p.id === unmappedSnapshot)) {
      pageIdMap.set(opPageId, unmappedSnapshot)
      ensuredPageIds.add(opPageId)
      return unmappedSnapshot
    }
    // 4. Fallback: single-page adopt (legacy compat)
    if (store.pages.length === 1 && ensuredPageIds.size === 0) {
      const adoptId = store.pages[0].id
      pageIdMap.set(opPageId, adoptId)
      ensuredPageIds.add(opPageId)
      return adoptId
    }
    // 5. No match — return original (will trigger addPage below)
    return opPageId
  }

  function apply(store: ReplayStoreApi, op: BoardOperation): void {
    const payload = op.payload as Record<string, unknown>

    // P0-FIX: Resolve page by op.page_id with ID mapping + lazy auto-create.
    if (op.page_id && op.op_type !== 'page_add') {
      const resolvedId = _resolvePageId(op.page_id, store)
      let targetIdx = store.pages.findIndex((p) => p.id === resolvedId)
      if (targetIdx < 0) {
        // Page truly doesn't exist — create new
        store.addPage({ background: 'white' })
        const lastPage = store.pages[store.pages.length - 1]
        if (lastPage) {
          (lastPage as { id: string }).id = resolvedId
        }
        targetIdx = store.pages.length - 1
        ensuredPageIds.add(op.page_id)
      }
      if (targetIdx >= 0 && targetIdx !== store.currentPageIndex) {
        store.goToPage(targetIdx)
      }
    }

    switch (op.op_type) {
      case 'stroke_add':
        if (payload.stroke)
          store.addStroke(payload.stroke as WBStroke, { skipHistory: true })
        break

      case 'stroke_update':
        if (payload.stroke)
          store.updateStroke(payload.stroke as WBStroke, { skipHistory: true })
        break

      case 'stroke_delete':
        if (payload.stroke_id)
          store.deleteStroke(payload.stroke_id as string, { skipHistory: true })
        break

      case 'asset_add':
        if (payload.asset)
          store.addAsset(payload.asset as WBAsset, { skipHistory: true })
        break

      case 'asset_update':
        if (payload.asset)
          store.updateAsset(payload.asset as WBAsset, { skipHistory: true })
        break

      case 'asset_delete':
        if (payload.asset_id)
          store.deleteAsset(payload.asset_id as string, { skipHistory: true })
        break

      case 'page_add': {
        const pageData = payload.page as Record<string, unknown> | undefined
        if (pageData) {
          const originalId = (pageData.id as string) || op.page_id || ''
          if (originalId && ensuredPageIds.has(originalId)) {
            const existingIdx = store.pages.findIndex((p) => p.id === originalId)
            if (existingIdx >= 0 && existingIdx !== store.currentPageIndex) {
              store.goToPage(existingIdx)
            }
            break
          }
          store.addPage({
            name: (pageData.name as string) ?? '',
            background: (pageData.background as WBPageBackground) ?? 'white',
            backgroundColor: (pageData.backgroundColor as string | undefined),
            width: pageData.width as number | undefined,
            height: pageData.height as number | undefined,
          })
          if (originalId) {
            const lastPage = store.pages[store.pages.length - 1]
            if (lastPage) {
              (lastPage as { id: string }).id = originalId
            }
            ensuredPageIds.add(originalId)
          }
        }
        break
      }

      case 'page_navigate':
      case 'page_change':
        if (typeof payload.pageIndex === 'number') {
          store.goToPage(payload.pageIndex)
        } else if (typeof payload.page_index === 'number') {
          store.goToPage(payload.page_index)
        }
        break

      case 'page_delete':
        if (payload.page_id) {
          const idx = store.pages.findIndex((p) => p.id === payload.page_id)
          if (idx >= 0) store.deletePage(idx)
        }
        break

      case 'clear_page':
        if (op.page_id) {
          const idx = store.pages.findIndex((p) => p.id === op.page_id)
          if (idx >= 0) {
            store.goToPage(idx)
            store.clearPage()
          }
        }
        break

      case 'grid_update':
        if (typeof payload.gridSize === 'number') {
          store.setGridSize(payload.gridSize)
        } else if (payload.grid && typeof payload.grid === 'object') {
          store.updateCurrentPageGrid(payload.grid as Partial<WBPageGridSettings>)
        }
        break

      case 'background_update':
        if (typeof payload.color === 'string') {
          store.setBackgroundColor(payload.color)
        }
        break

      case 'group_create':
        if (Array.isArray(payload.itemIds) && payload.itemIds.length > 0) {
          store.createGroup(payload.itemIds as string[])
        }
        break

      case 'group_delete':
        if (typeof payload.group_id === 'string') {
          store.deleteGroup(payload.group_id)
        }
        break

      case 'lock_update':
        if (Array.isArray(payload.ids)) {
          if (payload.locked === true) {
            store.lockItems(payload.ids as string[])
          } else {
            store.unlockItems(payload.ids as string[])
          }
        }
        break

      case 'z_order': {
        const objectId = payload.object_id as string | undefined
        const action = payload.action as string | undefined
        if (!objectId || !action) break
        switch (action) {
          case 'bringForward':  store.bringForward(objectId); break
          case 'sendBackward':  store.sendBackward(objectId); break
          case 'bringToFront':  store.bringToFront(objectId); break
          case 'sendToBack':    store.sendToBack(objectId); break
        }
        break
      }

      // Legacy diff-save format
      case 'add':
      case 'update':
      case 'remove': {
        const kind = payload.kind as string | undefined
        const value = (payload.value ?? {}) as Record<string, unknown>
        const itemId = payload.id as string | undefined
        if (kind === 'stroke') {
          if (op.op_type === 'add' && value)
            store.addStroke(value as unknown as WBStroke, { skipHistory: true })
          else if (op.op_type === 'update' && value)
            store.updateStroke(value as unknown as WBStroke, { skipHistory: true })
          else if (op.op_type === 'remove' && itemId)
            store.deleteStroke(itemId, { skipHistory: true })
        } else if (kind === 'asset') {
          if (op.op_type === 'add' && value)
            store.addAsset(value as unknown as WBAsset, { skipHistory: true })
          else if (op.op_type === 'update' && value)
            store.updateAsset(value as unknown as WBAsset, { skipHistory: true })
          else if (op.op_type === 'remove' && itemId)
            store.deleteAsset(itemId, { skipHistory: true })
        }
        break
      }

      // GeoBoard: lightweight vertex move op (replay drag animation)
      case 'geometry_vertex_move': {
        const id = payload.id as string
        const vertexIndex = payload.vertexIndex as number
        const x = payload.x as number
        const y = payload.y as number
        if (!id || typeof vertexIndex !== 'number') break
        // Apply via updateGeometryVertex if available, else fallback to updateAsset
        if ('updateGeometryVertex' in store) {
          (store as any).updateGeometryVertex(id, vertexIndex, { x, y }, { skipEmit: true })
        }
        break
      }

      // P0.5: Generic object property update (drag, resize, rotate, color, etc.)
      case 'object_update': {
        const objId = payload.id as string
        const kind = payload.kind as string
        const changes = payload.changes as Record<string, unknown>
        if (!objId || !changes) break
        const pageData = store.pages[store.currentPageIndex] as unknown as {
          strokes?: WBStroke[]; assets?: WBAsset[]
        }
        if (!pageData) break
        if (kind === 'stroke') {
          const stroke = pageData.strokes?.find((s) => s.id === objId)
          if (stroke) {
            store.updateStroke({ ...stroke, ...changes } as WBStroke, { skipHistory: true })
          }
        } else if (kind === 'asset') {
          const asset = pageData.assets?.find((a) => a.id === objId)
          if (asset) {
            store.updateAsset({ ...asset, ...changes } as WBAsset, { skipHistory: true })
          }
        }
        break
      }

      // Batch add: paste/duplicate — ONE mutation for all items (no "typing" effect)
      case 'assets_add_batch': {
        const batchAssets = payload.assets as WBAsset[]
        if (!Array.isArray(batchAssets) || batchAssets.length === 0) break
        const pageData = store.pages[store.currentPageIndex] as unknown as { assets?: WBAsset[] }
        if (!pageData) break
        // Atomic: single reactive mutation — all assets appear together
        ;(store as unknown as { pages: Array<Record<string, unknown>> }).pages[store.currentPageIndex] = {
          ...pageData,
          assets: [...(pageData.assets ?? []), ...batchAssets],
        }
        break
      }

      case 'strokes_add_batch': {
        const batchStrokes = payload.strokes as WBStroke[]
        if (!Array.isArray(batchStrokes) || batchStrokes.length === 0) break
        const pageData = store.pages[store.currentPageIndex] as unknown as { strokes?: WBStroke[] }
        if (!pageData) break
        ;(store as unknown as { pages: Array<Record<string, unknown>> }).pages[store.currentPageIndex] = {
          ...pageData,
          strokes: [...(pageData.strokes ?? []), ...batchStrokes],
        }
        break
      }

      // Move assets by absolute position (idempotent, assets only, max 50)
      case 'objects_move': {
        const moveItems = payload.items as Array<{ id: string; x: number; y: number }>
        if (!Array.isArray(moveItems)) break
        const movePage = store.pages[store.currentPageIndex] as unknown as {
          assets?: WBAsset[]
        }
        if (!movePage?.assets) break
        for (const item of moveItems) {
          const asset = movePage.assets.find((a) => a.id === item.id)
          if (!asset) continue
          store.updateAsset({ ...asset, x: item.x, y: item.y } as WBAsset, { skipHistory: true })
        }
        break
      }

      // Page reorder — set absolute page order by ID array
      case 'page_reorder': {
        const pageIds = payload.pageIds as string[]
        if (!Array.isArray(pageIds)) break
        const pageMap = new Map(store.pages.map((p) => [p.id, p]))
        const reordered = pageIds.map((id) => pageMap.get(id)).filter(Boolean)
        if (reordered.length > 0) {
          ;(store as any).pages = reordered
          // Stay on current page if possible
          const curId = store.pages[store.currentPageIndex]?.id
          if (curId) {
            const idx = store.pages.findIndex((p) => p.id === curId)
            if (idx !== -1) store.goToPage(idx)
          }
        }
        break
      }

      // PDF import — add pages with PDF backgrounds
      case 'pdf_import': {
        const importPages = payload.pages as Array<{
          id: string; name: string;
          background: { type: string; url: string; assetId?: string };
          width?: number; height?: number
        }>
        if (!Array.isArray(importPages)) break
        for (const pg of importPages) {
          store.addPage({
            name: pg.name,
            background: pg.background as WBPageBackground,
            width: pg.width,
            height: pg.height,
          })
          // Set correct ID
          const lastPage = store.pages[store.pages.length - 1]
          if (lastPage && pg.id) {
            (lastPage as { id: string }).id = pg.id
          }
        }
        break
      }

      // Text annotation on objects (interaction layer)
      case 'object_text_update': {
        const objId = payload.object_id as string
        const text = payload.text as string | null
        if (!objId) break
        // silent: true — replay НЕ створює нові ops (infinite loop guard)
        store.setObjectText(objId, text ?? undefined, { silent: true })
        break
      }

      default:
        console.debug('[Replay] unknown op:', op.op_type)
    }
  }

  return { apply, reset, markPagesEnsured }
}

// ── Backwards compat: global singleton for boardStore.resetForReplay() ──
// boardStore calls resetReplayAdoptedPages() which needs a global handle.
// Views should use createReplayApplier() instead.
const _globalApplier = createReplayApplier()

/** @deprecated Use createReplayApplier() instead */
export function applyReplayOperation(store: ReplayStoreApi, op: BoardOperation): void {
  _globalApplier.apply(store, op)
}

/** @deprecated Use createReplayApplier().reset() instead */
export function resetReplayAdoptedPages(): void {
  _globalApplier.reset()
}

/** @deprecated Use createReplayApplier().markPagesEnsured() instead */
export function markReplayPagesEnsured(pageIds: string[]): void {
  _globalApplier.markPagesEnsured(pageIds)
}
