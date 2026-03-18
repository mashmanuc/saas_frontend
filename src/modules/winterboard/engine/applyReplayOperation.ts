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
import type { WBStroke, WBAsset, WBPageBackground } from '../types/winterboard'

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
  pages: Array<{ id: string }>
}

export function applyReplayOperation(
  store: ReplayStoreApi,
  op: BoardOperation,
): void {
  const payload = op.payload as Record<string, unknown>

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

    default:
      console.debug('[Replay] unknown op:', op.op_type)
  }
}
