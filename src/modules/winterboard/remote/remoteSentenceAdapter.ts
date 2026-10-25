import type { useWBStore } from '../board/state/boardStore'
import { assertDictationLine, DictationLineError } from '../board/dictationLine'
import { commitDictationAction } from '../board/commitDictationAction'
import { parseRemoteSentence, sentenceRefusal, type RemoteSentence, type SentenceRequest, type SentenceResult } from './dictationLineContract'
export interface RemoteSentenceAdapter { state: () => RemoteSentence | null; apply: (request: SentenceRequest) => SentenceResult }
export function makeRemoteSentenceAdapter(store: ReturnType<typeof useWBStore>, sync: { mode: string; inputLocked: boolean }): RemoteSentenceAdapter {
  return {
    state() {
      const page = store.pages[store.currentPageIndex]
      if (!page || store.selectedIds.length !== 1) return null
      const asset = page.assets.find((a) => a.id === store.selectedIds[0] && a.type === 'dictation_line')
      if (!asset) return null
      try { assertDictationLine(asset.data) } catch (error) {
        if (!(error instanceof DictationLineError)) throw error
        console.warn('[WB:sentence] invalid snapshot', asset.id); return null
      }
      const data = asset.data
      return parseRemoteSentence({ page_id: page.id, object_id: asset.id, source_revision: data.source.revision,
        words: data.tokens.filter((t) => t.kind === 'word').map((t) => ({ id: t.id, text: t.text, hidden: data.hidden.words.includes(t.id) })),
        punct: data.hidden.punct })
    },
    apply(request) {
      const { request_id, page_id, object_id, ...action } = request
      const result = commitDictationAction(store, { pageId: page_id, assetId: object_id }, action, {
        canWrite: () => sync.mode === 'SYNC' && !sync.inputLocked,
        write: (asset) => store.updateAsset(asset),
      })
      return result.status === 'refused'
        ? { request_id, status: 'refused', reason: sentenceRefusal(result.reason) }
        : { request_id, status: 'done' }
    },
  }
}
