import type { DictationAction } from '../board/dictationLine'
export interface RemoteSentence {
  page_id: string; object_id: string; source_revision: string
  words: Array<{ id: string; text: string; hidden: boolean }>; punct: boolean
  /** v1.76: увесь текст речення зі знаками — пульт показує й дає виправити (старий ноутбук поля не шле). */
  text?: string
}
export type MechanicalSentenceRequest = Exclude<DictationAction, { action: 'set_analysis' }> & { request_id: string; page_id: string; object_id: string }
export interface ApprovedAnalysisRequest { action: 'apply_analysis'; proposal_id: string; request_id: string; page_id: string; object_id: string; source_revision: string }
/** v1.76: виправлений текст речення — ноутбук переписує його на тому самому місці. */
export interface TextSentenceRequest { action: 'set_text'; text: string; request_id: string; page_id: string; object_id: string; source_revision: string }
export type SentenceRequest = MechanicalSentenceRequest | ApprovedAnalysisRequest | TextSentenceRequest
/** Причина відмови — закритий набір (як на сервері): blocked — дошку зараз не можна змінювати або речення не
 *  виділене на ноутбуці; stale — речення змінилося чи зникло; invalid — дія не підходить до речення;
 *  no_space (v1.76) — виправлений текст не вміщується до наступного запису нижче. */
export const SENTENCE_REFUSALS = ['blocked', 'stale', 'invalid', 'no_space'] as const
export type SentenceRefusal = typeof SENTENCE_REFUSALS[number]
export type SentenceResult = { request_id: string; status: 'done'; reason?: undefined }
  | { request_id: string; status: 'refused'; reason: SentenceRefusal }
const uuid = (v: unknown): v is string => typeof v === 'string' && v.length === 36 && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v)
const revision = (v: unknown) => typeof v === 'string' && v.length === 64 && /^[a-f0-9]+$/.test(v)
const id = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f-\u009f]/.test(v)
const obj = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const keys = (v: Record<string, unknown>, wanted: string[]) => Object.keys(v).length === wanted.length && wanted.every((k) => k in v)
/** v1.76: текст речення — 1…300 знаків, з керівних лише перенос рядка (як на сервері). */
// eslint-disable-next-line no-control-regex
const sentenceText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '' && Array.from(v).length <= 300 && !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/.test(v)
export function parseRemoteSentence(v: unknown): RemoteSentence | null {
  if (!obj(v) || ('text' in v && !sentenceText(v.text))) return null
  if (!keys(v, ['page_id', 'object_id', 'source_revision', 'words', 'punct', ...('text' in v ? ['text'] : [])]) || !id(v.page_id, 100)
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
  if (v.action === 'apply_analysis') return keys(v, [...base, 'proposal_id']) && uuid(v.proposal_id) ? v as unknown as ApprovedAnalysisRequest : null
  if (v.action === 'restore') return keys(v, base) ? v as SentenceRequest : null
  if (v.action === 'set_text') return keys(v, [...base, 'text']) && sentenceText(v.text) ? v as unknown as TextSentenceRequest : null
  if (typeof v.hidden !== 'boolean') return null
  if (v.action === 'set_punctuation') return keys(v, [...base, 'hidden']) ? v as SentenceRequest : null
  if (v.action === 'set_word' && id(v.token_id, 128) && /^w[0-9]+$/.test(v.token_id)) return keys(v, [...base, 'token_id', 'hidden']) ? v as SentenceRequest : null
  return null
}
export function parseSentenceResult(v: unknown): SentenceResult | null {
  if (!obj(v) || !uuid(v.request_id)) return null
  if (v.status === 'done') return keys(v, ['request_id', 'status']) ? v as unknown as SentenceResult : null
  if (v.status !== 'refused' || !keys(v, ['request_id', 'status', 'reason'])) return null
  return (SENTENCE_REFUSALS as readonly unknown[]).includes(v.reason) ? v as unknown as SentenceResult : null
}

/** Причина з ноутбука (commitDictationAction / DictationLineError) → закритий набір для телефона. */
export function sentenceRefusal(reason: string): SentenceRefusal {
  if (reason === 'blocked') return 'blocked'
  if (reason === 'stale_target' || reason === 'stale_source' || reason === 'unknown_word') return 'stale'
  if (reason === 'no_space') return 'no_space'
  return 'invalid'
}
