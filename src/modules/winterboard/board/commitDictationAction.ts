/** Межа дискретної дії: актуальні дані після черги, один штатний asset_update. */
import type { useWBStore } from './state/boardStore'
import type { WBAsset } from '../types/winterboard'
import { flushPendingUpdates } from './state/assetUpdateBatcher'
import { applyDictationAction, assertDictationLine, DictationLineError } from './dictationLine'

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
    host.write({ ...current, data: next })
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
