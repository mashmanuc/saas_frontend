/**
 * Apply a single replay operation to the board store.
 * Shared between WBSoloRoom, WBClassroomRoom, and WBPublicView.
 *
 * Phase 19 R5 — DRY extraction.
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

export function applyReplayOperation(
  store: ReplayStoreApi,
  op: BoardOperation,
): void {
  const payload = op.payload as Record<string, unknown>

  // REPLAY-FIX-1: Resolve page by op.page_id before applying page-specific operations.
  // Without this, strokes/assets land on currentPageIndex instead of the correct page.
  if (op.page_id) {
    let targetIdx = store.pages.findIndex((p) => p.id === op.page_id)
    // After resetForReplay(), page-0 has a fresh random id that won't match recorded ops.
    // Adopt the recorded page_id so subsequent ops can find it.
    if (targetIdx < 0 && store.pages.length === 1 && op.op_type !== 'page_add') {
      (store.pages[0] as { id: string }).id = op.page_id
      targetIdx = 0
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
        store.addPage({
          name: (pageData.name as string) ?? '',
          background: (pageData.background as WBPageBackground) ?? 'white',
          width: pageData.width as number | undefined,
          height: pageData.height as number | undefined,
        })
        // REPLAY-FIX-1: Preserve original page_id so subsequent ops can find this page.
        // addPage() generates a random id; we overwrite it with the recorded one.
        const originalId = (pageData.id as string) || op.page_id
        if (originalId) {
          const lastPage = store.pages[store.pages.length - 1]
          if (lastPage) {
            (lastPage as { id: string }).id = originalId
          }
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

    // ─── Phase 20+ board meta ops ─────────────────────────────────────────────

    case 'grid_update':
      // Two forms: { gridSize } (global) or { grid } (per-page)
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

    // ─── Legacy diff-save format (op+kind+value) ──────────────────────────────
    // Ops записані старим WBSessionDiffSaveView мають op_type='add'/'update'/'remove'
    // і payload = { op, kind, id, value, page_id }. Підтримуємо для backwards compat.
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
      // meta ops (page_add, clear_page тощо) в legacy форматі пропускаємо —
      // недостатньо контексту для детермінованого відтворення
      break
    }

    default:
      console.debug('[Replay] unknown op:', op.op_type)
  }
}
