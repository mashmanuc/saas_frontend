import type { DictationAction } from '../board/dictationLine'
import { assertAnalysisItems, AnalysisError } from '../board/dictationAnalysis'
export interface RemoteSentence {
  page_id: string; object_id: string; source_revision: string
  words: Array<{ id: string; text: string; hidden: boolean }>; punct: boolean
}
export type SentenceRequest = DictationAction & { request_id: string; page_id: string; object_id: string }
export interface SentenceResult { request_id: string; status: 'done' | 'refused' }
const uuid = (v: unknown): v is string => typeof v === 'string' && v.length === 36 && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v)
const revision = (v: unknown) => typeof v === 'string' && v.length === 64 && /^[a-f0-9]+$/.test(v)
const id = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(v)
const obj = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const keys = (v: Record<string, unknown>, wanted: string[]) => Object.keys(v).length === wanted.length && wanted.every((k) => k in v)
export function parseRemoteSentence(v: unknown): RemoteSentence | null {
  if (!obj(v) || !keys(v, ['page_id', 'object_id', 'source_revision', 'words', 'punct']) || !id(v.page_id, 100)
    || !id(v.object_id, 128) || !revision(v.source_revision) || typeof v.punct !== 'boolean'
    || !Array.isArray(v.words) || v.words.length > 300) return null
  const ids = new Set<string>(); let length = 0
  for (const word of v.words) {
    if (!obj(word) || !keys(word, ['id', 'text', 'hidden']) || !id(word.id, 128) || !/^w[0-9]+$/.test(word.id)
      || !id(word.text, 300) || typeof word.hidden !== 'boolean' || ids.has(word.id)) return null
    ids.add(word.id); length += Array.from(word.text).length
    if (length > 300) return null
  }
  return v as unknown as RemoteSentence
}
export function readSentenceRequest(v: unknown): SentenceRequest | null {
  if (!obj(v) || !uuid(v.request_id) || !id(v.page_id, 100) || !id(v.object_id, 128) || !revision(v.source_revision)) return null
  const base = ['request_id', 'page_id', 'object_id', 'source_revision', 'action']
  if (v.action === 'set_analysis' && keys(v, [...base, 'kind', 'items'])) {
    try { assertAnalysisItems(v.kind, v.items) }
    catch (error) { if (!(error instanceof AnalysisError)) throw error; return null }
    return v as SentenceRequest
  }
  if (v.action === 'restore') return keys(v, base) ? v as SentenceRequest : null
  if (typeof v.hidden !== 'boolean') return null
  if (v.action === 'set_punctuation') return keys(v, [...base, 'hidden']) ? v as SentenceRequest : null
  if (v.action === 'set_word' && id(v.token_id, 128) && /^w[0-9]+$/.test(v.token_id)) return keys(v, [...base, 'token_id', 'hidden']) ? v as SentenceRequest : null
  return null
}
export function parseSentenceResult(v: unknown): SentenceResult | null {
  return obj(v) && keys(v, ['request_id', 'status']) && uuid(v.request_id) && (v.status === 'done' || v.status === 'refused') ? v as unknown as SentenceResult : null
}
