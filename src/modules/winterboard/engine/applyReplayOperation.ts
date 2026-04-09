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

  function reset(): void {
    ensuredPageIds.clear()
  }

  function markPagesEnsured(pageIds: string[]): void {
    for (const id of pageIds) {
      if (id) ensuredPageIds.add(id)
    }
  }

  function apply(store: ReplayStoreApi, op: BoardOperation): void {
    const payload = op.payload as Record<string, unknown>

    // REPLAY-FIX-2: Resolve page by op.page_id with lazy auto-create.
    if (op.page_id && op.op_type !== 'page_add') {
      let targetIdx = store.pages.findIndex((p) => p.id === op.page_id)
      if (targetIdx < 0) {
        if (store.pages.length === 1 && ensuredPageIds.size === 0) {
          (store.pages[0] as { id: string }).id = op.page_id
          targetIdx = 0
        } else {
          store.addPage({ background: 'white' })
          const lastPage = store.pages[store.pages.length - 1]
          if (lastPage) {
            (lastPage as { id: string }).id = op.page_id
          }
          targetIdx = store.pages.length - 1
        }
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
            store.addStroke(value as WBStroke, { skipHistory: true })
          else if (op.op_type === 'update' && value)
            store.updateStroke(value as WBStroke, { skipHistory: true })
          else if (op.op_type === 'remove' && itemId)
            store.deleteStroke(itemId, { skipHistory: true })
        } else if (kind === 'asset') {
          if (op.op_type === 'add' && value)
            store.addAsset(value as WBAsset, { skipHistory: true })
          else if (op.op_type === 'update' && value)
            store.updateAsset(value as WBAsset, { skipHistory: true })
          else if (op.op_type === 'remove' && itemId)
            store.deleteAsset(itemId, { skipHistory: true })
        }
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
