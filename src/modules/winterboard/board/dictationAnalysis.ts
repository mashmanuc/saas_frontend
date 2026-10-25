/** Мовна структура: явні token_id/діапазони, без евристики «правильності». */
import type { DictationLineData, DictationToken } from './dictationLine'
export const ANALYSIS_KINDS = ['orthograms', 'basis', 'parts'] as const
export type AnalysisKind = typeof ANALYSIS_KINDS[number]
export const POS_LABELS = { noun: 'ім.', adjective: 'прикм.', numeral: 'числ.', pronoun: 'займ.',
  verb: 'дієсл.', adverb: 'присл.', preposition: 'прийм.', conjunction: 'спол.', particle: 'част.',
  interjection: 'виг.', unclassified: '?' } as const
export type Pos = keyof typeof POS_LABELS
export interface Orthogram { start: number; end: number; rule: string }
export interface Basis { token_id: string; role: 'subject' | 'predicate' }
export interface Part { token_id: string; pos: Pos }
export type AnalysisItem = Orthogram | Basis | Part
export interface DictationAnalysis { version: 1; source_revision: string; orthograms: Orthogram[]; basis: Basis[]; parts: Part[] }
export class AnalysisError extends Error { constructor() { super('invalid_analysis') } }
const requireValue = (ok: unknown) => { if (!ok) throw new AnalysisError() }
const obj = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
const keys = (v: Record<string, unknown>, wanted: string[]) => Object.keys(v).length === wanted.length && wanted.every((k) => k in v)
export function assertAnalysisItems(kind: unknown, raw: unknown, source?: { text: string; tokens: DictationToken[] }, complete = false): asserts raw is AnalysisItem[] {
  requireValue(typeof kind === 'string' && (ANALYSIS_KINDS as readonly string[]).includes(kind))
  requireValue(Array.isArray(raw) && raw.length <= (kind === 'orthograms' ? 40 : 300))
  const words = source?.tokens.filter((t) => t.kind === 'word'), seen = new Set<string>()
  for (const item of raw as unknown[]) {
    requireValue(obj(item)); const v = item as Record<string, unknown>
    let key: string
    if (kind === 'orthograms') {
      requireValue(keys(v, ['start', 'end', 'rule']))
      const a = v.start as number, b = v.end as number
      requireValue(Number.isInteger(a) && Number.isInteger(b) && 0 <= a && a < b && b <= (source ? Array.from(source.text).length : 300) && b - a <= 40)
      requireValue(typeof v.rule === 'string' && v.rule.trim().length > 0 && Array.from(v.rule).length <= 200 && !/[\u0000-\u001f\u007f-\u009f]/u.test(v.rule))
      if (words) requireValue(words.some((t) => t.start <= a && b <= t.end))
      key = `${a}:${b}`
    } else {
      const field = kind === 'basis' ? 'role' : 'pos'
      requireValue(keys(v, ['token_id', field]) && typeof v.token_id === 'string' && /^w[0-9]{1,6}$/.test(v.token_id))
      requireValue(kind === 'basis' ? v.role === 'subject' || v.role === 'predicate' : typeof v.pos === 'string' && Object.prototype.hasOwnProperty.call(POS_LABELS, v.pos))
      if (words) requireValue(words.some((t) => t.id === v.token_id))
      key = v.token_id as string
    }
    requireValue(!seen.has(key)); seen.add(key)
  }
  if (kind === 'parts' && words && (complete || (raw as unknown[]).length)) requireValue(words.length === seen.size)
}
export function assertAnalysis(raw: unknown, source: DictationLineData['source'], tokens: DictationToken[]): asserts raw is DictationAnalysis {
  requireValue(obj(raw)); const v = raw as Record<string, unknown>
  requireValue(keys(v, ['version', 'source_revision', ...ANALYSIS_KINDS]) && v.version === 1 && v.source_revision === source.revision)
  for (const kind of ANALYSIS_KINDS) assertAnalysisItems(kind, v[kind], { text: source.text, tokens })
}
// Пікселі дошки: на 68% мінімум 16px, а не 4–7px. Ніколи не стискати до літери.
export const annotationFont = (data: DictationLineData) => Math.max(24, Math.min(32, data.layout.x_height))
export const basisWidth = 3.2

/** Окрема смуга «слово — частина мови» над усім реченням. По рядках джерела,
 * без стискання коротких слів і без ліній крізь frozen-письмо.
 * Смуги й рамка резервуються за всіма словами, навіть hidden/без parts.
 */
export function annotationLabels(data: DictationLineData) {
  const font = annotationFont(data), gap = 10
  const top = Math.min(...data.layout.glyphs.map((g) => g.bbox[1]))
  const longest = Math.max(...Object.values(POS_LABELS).map((s) => s.length))
  let row = 0, cursor = 0, previousLine = -1
  const labels = data.tokens.filter((t) => t.kind === 'word').flatMap((token) => {
    const segments = wordSegments(data, token.id)
    // Одне слово = один підпис, навіть коли сервер переніс його частину.
    if (!segments.length) return []
    const segment = segments[0]
    const prefix = `${token.text} — `
    const width = (Array.from(prefix).length + longest) * font * .7 + 12
    if (cursor && (previousLine !== segment.line || cursor + width > data.layout.width)) { row++; cursor = 0 }
    const x = cursor, right = x + width
    cursor = right + gap; previousLine = segment.line
    return [{ tokenId: token.id, prefix, x, right, center: x + width / 2, row, font }]
  })
  return labels.map((label) => {
    const y = top - gap - (row - label.row) * (font + gap)
    return { ...label, y, top: y - font }
  })
}

/** Один фрагмент на рядок; не з'єднувати підкреслення крізь перенос. */
export function wordSegments(data: DictationLineData, tokenId: string) {
  const segments = new Map<number, { line: number; x: number; right: number; top: number }>()
  for (const glyph of data.layout.glyphs) {
    if (glyph.token !== tokenId) continue
    const [x, y, w] = glyph.bbox, old = segments.get(glyph.line)
    segments.set(glyph.line, { line: glyph.line, x: Math.min(x, old?.x ?? x), right: Math.max(x + w, old?.right ?? x + w), top: Math.min(y, old?.top ?? y) })
  }
  return [...segments.values()]
}
