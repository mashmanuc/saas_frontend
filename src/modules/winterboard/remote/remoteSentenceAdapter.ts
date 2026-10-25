import type { useWBStore } from '../board/state/boardStore'
import { assertDictationLine, DictationLineError } from '../board/dictationLine'
import { commitDictationAction } from '../board/commitDictationAction'
import { parseRemoteSentence, sentenceRefusal, type RemoteSentence, type MechanicalSentenceRequest, type ApprovedAnalysisRequest, type SentenceResult } from './dictationLineContract'
import { loadApprovedAnalysis, type ApprovedAnalysis } from '../api/dictationAnalysis'
export interface RemoteSentenceAdapter { state: () => RemoteSentence | null; apply: (request: MechanicalSentenceRequest) => SentenceResult;
  applyAnalysis?: (request: ApprovedAnalysisRequest, canWrite?: () => boolean) => Promise<SentenceResult> }
export function makeRemoteSentenceAdapter(store: ReturnType<typeof useWBStore>, sync: { mode: string; inputLocked: boolean }, load: (proposalId: string) => Promise<ApprovedAnalysis> = loadApprovedAnalysis): RemoteSentenceAdapter {
  return {
    async applyAnalysis(request, canWrite = () => true) {
      const allowed = () => canWrite() && sync.mode === 'SYNC' && !sync.inputLocked && store.mode === 'edit'
        && store.pages[store.currentPageIndex]?.id === request.page_id && store.selectedIds.length === 1 && store.selectedIds[0] === request.object_id
      if (!allowed()) return { request_id: request.request_id, status: 'refused', reason: 'blocked' }
      const proposal = await load(request.proposal_id)
      if (!allowed() || proposal.board_id !== store.workspaceId || proposal.page_id !== request.page_id
        || proposal.object_id !== request.object_id || proposal.source_revision !== request.source_revision) return { request_id: request.request_id, status: 'refused', reason: 'stale' }
      const result = commitDictationAction(store, { pageId: request.page_id, assetId: request.object_id }, {
        action: 'set_analysis', source_revision: request.source_revision, kind: proposal.kind, items: proposal.items,
      }, { canWrite: allowed, write: (asset) => store.updateAsset(asset) })
      return result.status === 'refused' ? { request_id: request.request_id, status: 'refused', reason: sentenceRefusal(result.reason) } : { request_id: request.request_id, status: 'done' }
    },
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
