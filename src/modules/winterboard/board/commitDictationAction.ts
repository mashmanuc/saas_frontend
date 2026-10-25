/** Межа дискретної дії: актуальні дані після черги, один штатний asset_update. */
import type { useWBStore } from './state/boardStore'
import type { WBAsset } from '../types/winterboard'
import { flushPendingUpdates } from './state/assetUpdateBatcher'
import { applyDictationAction, assertDictationLine, DictationLineError } from './dictationLine'
import { dictationInkBounds } from './dictationInkBounds'
import { SERVER_PAYLOAD_LIMIT_BYTES, serverPayloadBytes } from '../services/opsPayloadSize'

type Store = Pick<ReturnType<typeof useWBStore>, 'mode' | 'pages' | 'currentPageIndex' | 'selectedIds'>
type Result = { status: 'changed' | 'unchanged' } | { status: 'refused'; reason: string }

export function commitDictationAction(
  store: Store,
  target: { pageId: string; assetId: string },
  action: unknown,
  host: { canWrite: () => boolean; write: (asset: WBAsset) => void },
): Result {
  const permitted = () => host.canWrite() && store.mode === 'edit'
    && store.pages[store.currentPageIndex]?.id === target.pageId && store.selectedIds.includes(target.assetId)
  if (!permitted()) return { status: 'refused', reason: 'blocked' }
  flushPendingUpdates()
  if (!permitted()) return { status: 'refused', reason: 'blocked' }
  const current = store.pages[store.currentPageIndex].assets.find((asset) => asset.id === target.assetId)
  if (!current || current.type !== 'dictation_line' || current.locked) return { status: 'refused', reason: 'stale_target' }
  try {
    assertDictationLine(current.data)
    const next = applyDictationAction(current.data, action)
    if (next === current.data) return { status: 'unchanged' }
    let updated = { ...current, data: next }
    if (!current.data.analysis && next.analysis) {
      if (current.rotation) return { status: 'refused', reason: 'rotated_sentence' }
      const a = dictationInkBounds(current.data), b = dictationInkBounds(next)
      const sx = current.w / a.w, sy = current.h / a.h
      updated = { ...updated, x: current.x + (b.x - a.x) * sx, y: current.y + (b.y - a.y) * sy, w: b.w * sx, h: b.h * sy }
      if (updated.x < 0 || updated.y < 0 || updated.x + updated.w > 1920 || updated.y + updated.h > 1080) return { status: 'refused', reason: 'no_space' }
    }
    if (serverPayloadBytes({ asset: updated }) > SERVER_PAYLOAD_LIMIT_BYTES - 1024) return { status: 'refused', reason: 'payload_too_large' }
    host.write(updated)
    flushPendingUpdates()
    const saved = store.pages[store.currentPageIndex]?.assets.find((asset) => asset.id === target.assetId)
    if (saved?.type !== 'dictation_line' || JSON.stringify(saved.data) !== JSON.stringify(next)) {
      return { status: 'refused', reason: 'blocked' }
    }
    return { status: 'changed' }
  } catch (error) {
    if (!(error instanceof DictationLineError)) throw error
    return { status: 'refused', reason: error.code }
  }
}
