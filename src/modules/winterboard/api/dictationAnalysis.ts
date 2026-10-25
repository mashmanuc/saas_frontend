/** Чернетка йде приватним HTTP, не через presence/remote.state. */
import apiClient from '@/utils/apiClient'
import { ANALYSIS_KINDS, assertAnalysisItems, AnalysisError, type AnalysisKind, type AnalysisItem } from '../board/dictationAnalysis'
import type { DictationToken } from '../board/dictationLine'
export interface AnalysisTarget { board_id: string; page_id: string; object_id: string; source_revision: string; kind: AnalysisKind }
export interface AnalysisDraft { source_revision: string; kind: AnalysisKind; text: string; tokens: DictationToken[]; items: AnalysisItem[] }
export type ApprovedAnalysis = AnalysisTarget & { items: AnalysisItem[] }
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)
export async function analysisAvailable(): Promise<boolean> {
  const raw = await apiClient.get('/v1/intents/dictation-analysis/availability/') as unknown as { enabled: boolean }
  if (!raw || Object.keys(raw).join() !== 'enabled' || typeof raw.enabled !== 'boolean') throw new AnalysisError()
  return raw.enabled
}
export async function approveAnalysis(target: AnalysisTarget, items: AnalysisItem[], signal: AbortSignal): Promise<string> {
  const raw = await apiClient.post('/v1/intents/dictation-analysis/', { ...target, phase: 'approve', items }, { signal }) as unknown as { proposal_id: string }
  if (!raw || Object.keys(raw).join() !== 'proposal_id' || !isUuid(raw.proposal_id)) throw new AnalysisError()
  return raw.proposal_id
}
export async function loadApprovedAnalysis(proposalId: string): Promise<ApprovedAnalysis> {
  if (!isUuid(proposalId)) throw new AnalysisError()
  const raw = await apiClient.get(`/v1/intents/dictation-analysis/proposals/${proposalId}/`) as unknown as ApprovedAnalysis
  if (!raw || Object.keys(raw).sort().join() !== ['board_id', 'page_id', 'object_id', 'source_revision', 'kind', 'items'].sort().join()) throw new AnalysisError()
  assertAnalysisItems(raw.kind, raw.items)
  return raw
}
export function readAnalysisDraft(raw: unknown, target: AnalysisTarget): AnalysisDraft {
  const v = raw as AnalysisDraft
  if (!v || typeof v !== 'object' || Object.keys(v).sort().join() !== ['source_revision', 'kind', 'text', 'tokens', 'items'].sort().join()
    || v.source_revision !== target.source_revision || v.kind !== target.kind || !ANALYSIS_KINDS.includes(v.kind)
    || typeof v.text !== 'string' || !v.text.trim() || Array.from(v.text).length > 300
    || /[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(v.text) || !Array.isArray(v.tokens) || v.tokens.length > 300) throw new AnalysisError()
  const chars = Array.from(v.text), seen = new Set<string>(); let end = 0
  for (const t of v.tokens) {
    if (!t || Object.keys(t).sort().join() !== ['id', 'kind', 'text', 'start', 'end'].sort().join()
      || t.kind !== 'word' || typeof t.id !== 'string' || !/^w[0-9]{1,6}$/.test(t.id) || seen.has(t.id)
      || !Number.isInteger(t.start) || !Number.isInteger(t.end) || t.start < end || t.start >= t.end || t.end > chars.length
      || t.text !== chars.slice(t.start, t.end).join('')) throw new AnalysisError()
    seen.add(t.id); end = t.end
  }
  assertAnalysisItems(v.kind, v.items, { text: v.text, tokens: v.tokens }, v.kind === 'parts')
  return structuredClone(v)
}
export async function requestAnalysis(target: AnalysisTarget, signal: AbortSignal): Promise<AnalysisDraft> {
  const response = await apiClient.post('/v1/intents/dictation-analysis/', target, { signal, timeout: 55000 })
  return readAnalysisDraft(response, target)
}
