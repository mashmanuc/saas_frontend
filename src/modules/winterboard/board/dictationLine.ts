/** Диктант 2.0: frozen-дані з сервера, без власного tokenizer, мережі чи запису в store. */
export interface DictationToken {
  id: string
  kind: 'word' | 'punct' | 'space'
  text: string
  start: number
  end: number
}

export interface DictationGlyph {
  token: string
  start: number
  end: number
  line: number
  bbox: [number, number, number, number]
}

export interface DictationStroke {
  p: [number, number][]
  t: number
  glyph: number
}

export interface DictationLineData {
  version: 1
  source: { text: string; lang: 'uk' | 'en'; hand: 'classic' | 'school'; revision: string }
  tokens: DictationToken[]
  layout: {
    version: 1
    width: number
    height: number
    size: number
    align: 'left' | 'center'
    x_height: number
    baselines: number[]
    glyphs: DictationGlyph[]
    strokes: DictationStroke[]
  }
  hidden: { punct: boolean; words: string[] }
}

export type DictationAction =
  | { action: 'set_word'; source_revision: string; token_id: string; hidden: boolean }
  | { action: 'set_punctuation'; source_revision: string; hidden: boolean }
  | { action: 'restore'; source_revision: string }

export class DictationLineError extends Error {
  constructor(public readonly code: 'invalid_data' | 'invalid_action' | 'stale_source' | 'unknown_word') {
    super(code)
    this.name = 'DictationLineError'
  }
}

function requireValue(ok: unknown): asserts ok {
  if (!ok) throw new DictationLineError('invalid_data')
}

function record(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  requireValue(value && typeof value === 'object' && !Array.isArray(value))
  const actual = Object.keys(value as object)
  requireValue(actual.length === keys.length && actual.every((key) => keys.includes(key)))
}

function num(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

function index(value: unknown, max: number): value is number {
  return num(value, 0, max) && Number.isInteger(value)
}

/** Межа недовірених JSON-даних. Некоректне речення не малюємо частково. */
export function assertDictationLine(value: unknown): asserts value is DictationLineData {
  record(value, ['version', 'source', 'tokens', 'layout', 'hidden'])
  requireValue(value.version === 1)
  const source = value.source
  record(source, ['text', 'lang', 'hand', 'revision'])
  requireValue(typeof source.text === 'string')
  const chars = Array.from(source.text as string)
  requireValue(chars.length > 0 && chars.length <= 300 && (source.text as string).trim())
  requireValue(!/[\u0000-\u001f\u007f-\u009f]/u.test(source.text as string))
  requireValue(source.lang === 'uk' || source.lang === 'en')
  requireValue(source.hand === 'classic' || source.hand === 'school')
  requireValue(typeof source.revision === 'string' && source.revision.length === 64 && /^[a-f0-9]{64}$/.test(source.revision))
  requireValue(Array.isArray(value.tokens) && value.tokens.length > 0 && value.tokens.length <= 300)
  const tokens = new Map<string, DictationToken>()
  let cursor = 0
  for (const token of value.tokens as unknown[]) {
    record(token, ['id', 'kind', 'text', 'start', 'end'])
    const prefix = { word: 'w', punct: 'p', space: 's' }[String(token.kind)]
    requireValue(prefix && typeof token.id === 'string' && token.id.length <= 128
      && !/[^\x20-\x7e]/u.test(token.id) && new RegExp(`^${prefix}[0-9]+$`).test(token.id))
    requireValue(!tokens.has(token.id as string))
    requireValue(token.start === cursor && index(token.end, chars.length) && token.end > cursor)
    requireValue(token.text === chars.slice(cursor, token.end as number).join(''))
    requireValue(token.kind !== 'space' || /^\s+$/u.test(token.text as string))
    tokens.set(token.id as string, token as unknown as DictationToken)
    cursor = token.end as number
  }
  requireValue(cursor === chars.length)

  const layout = value.layout
  record(layout, ['version', 'width', 'height', 'size', 'align', 'x_height', 'baselines', 'glyphs', 'strokes'])
  requireValue(layout.version === 1 && num(layout.width, 200, 1920) && num(layout.height, 60, 1080))
  const width = layout.width as number, height = layout.height as number
  requireValue(num(layout.size, 0.1, 20) && num(layout.x_height, 0.1, height))
  requireValue(layout.align === 'left' || layout.align === 'center')
  requireValue(Array.isArray(layout.baselines) && layout.baselines.length > 0 && layout.baselines.length <= 300)
  let previousBaseline = -1
  for (const y of layout.baselines as unknown[]) {
    requireValue(num(y, 0, height) && y > previousBaseline)
    previousBaseline = y as number
  }
  requireValue(Array.isArray(layout.glyphs) && layout.glyphs.length > 0 && layout.glyphs.length <= 300)
  const covered = new Set<number>()
  for (const glyph of layout.glyphs as unknown[]) {
    record(glyph, ['token', 'start', 'end', 'line', 'bbox'])
    const token = tokens.get(glyph.token as string)
    requireValue(token && token.kind !== 'space')
    requireValue(index(glyph.start, chars.length - 1) && index(glyph.end, chars.length))
    requireValue((glyph.start as number) >= token.start && (glyph.end as number) <= token.end && (glyph.end as number) > (glyph.start as number))
    requireValue(index(glyph.line, (layout.baselines as number[]).length - 1))
    requireValue(Array.isArray(glyph.bbox) && glyph.bbox.length === 4)
    const [x, y, w, h] = glyph.bbox as unknown[]
    requireValue(num(x, 0, width) && num(y, 0, height) && num(w, 0, width) && num(h, 0, height))
    requireValue((x as number) + (w as number) <= width && (y as number) + (h as number) <= height)
    for (let pos = glyph.start as number; pos < (glyph.end as number); pos++) {
      requireValue(!covered.has(pos))
      covered.add(pos)
    }
  }
  for (const token of tokens.values()) {
    if (token.kind === 'space') continue
    for (let pos = token.start; pos < token.end; pos++) requireValue(covered.has(pos))
  }

  requireValue(Array.isArray(layout.strokes) && layout.strokes.length > 0 && layout.strokes.length <= 6000)
  let points = 0, previousTime = -1
  const inked = new Set<number>()
  for (const stroke of layout.strokes as unknown[]) {
    record(stroke, ['p', 't', 'glyph'])
    requireValue(index(stroke.glyph, (layout.glyphs as unknown[]).length - 1))
    requireValue(num(stroke.t, 0, 600000) && stroke.t >= previousTime)
    previousTime = stroke.t as number
    requireValue(Array.isArray(stroke.p) && stroke.p.length >= 2)
    points += stroke.p.length
    requireValue(points <= 100000)
    const glyph = (layout.glyphs as DictationGlyph[])[stroke.glyph as number]
    const [x, y, w, h] = glyph.bbox
    for (const point of stroke.p as unknown[]) {
      requireValue(Array.isArray(point) && point.length === 2)
      requireValue(num(point[0], x, x + w) && num(point[1], y, y + h))
    }
    inked.add(stroke.glyph as number)
  }
  requireValue(inked.size === (layout.glyphs as unknown[]).length)
  const hidden = value.hidden
  record(hidden, ['punct', 'words'])
  requireValue(typeof hidden.punct === 'boolean' && Array.isArray(hidden.words) && hidden.words.length <= tokens.size)
  const words = hidden.words as unknown[]
  requireValue(new Set(words).size === words.length)
  requireValue(words.every((id) => typeof id === 'string' && tokens.get(id)?.kind === 'word'))
  const canonical = [...tokens.values()].filter((token) => words.includes(token.id)).map((token) => token.id)
  requireValue(canonical.every((id, i) => id === words[i]))
}

/** Незмінні source/layout не копіюються і не перераховуються. No-op зберігає identity. */
export function applyDictationAction(data: DictationLineData, raw: unknown): DictationLineData {
  assertDictationLine(data)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new DictationLineError('invalid_action')
  const action = raw as Record<string, unknown>
  const expected = action.action === 'restore' ? ['action', 'source_revision']
    : action.action === 'set_punctuation' ? ['action', 'source_revision', 'hidden']
      : action.action === 'set_word' ? ['action', 'source_revision', 'token_id', 'hidden'] : []
  if (!expected.length || Object.keys(action).length !== expected.length || Object.keys(action).some((key) => !expected.includes(key))
    || (action.action !== 'restore' && typeof action.hidden !== 'boolean')) throw new DictationLineError('invalid_action')
  if (action.source_revision !== data.source.revision) throw new DictationLineError('stale_source')
  let punct = data.hidden.punct
  const words = new Set(data.hidden.words)
  if (action.action === 'restore') { punct = false; words.clear() }
  if (action.action === 'set_punctuation') punct = action.hidden as boolean
  if (action.action === 'set_word') {
    if (!data.tokens.some((token) => token.id === action.token_id && token.kind === 'word')) throw new DictationLineError('unknown_word')
    if (action.hidden) words.add(action.token_id as string)
    else words.delete(action.token_id as string)
  }
  const ordered = data.tokens.filter((token) => words.has(token.id)).map((token) => token.id)
  if (punct === data.hidden.punct && ordered.length === data.hidden.words.length && ordered.every((id, i) => id === data.hidden.words[i])) return data
  return { ...data, hidden: { punct, words: ordered } }
}

export interface DictationBlank { token: string; line: number; x: number; y: number; width: number }

/** Один пропуск на рядок, навіть коли слово перенесено. Ніякого reflow. */
export function dictationVisibility(data: DictationLineData): { strokes: DictationStroke[]; blanks: DictationBlank[] } {
  assertDictationLine(data)
  const hidden = new Set(data.hidden.words)
  if (data.hidden.punct) data.tokens.filter((token) => token.kind === 'punct').forEach((token) => hidden.add(token.id))
  const segments = new Map<string, DictationBlank>()
  for (const glyph of data.layout.glyphs) {
    if (!data.hidden.words.includes(glyph.token)) continue
    const key = `${glyph.token}:${glyph.line}`
    const [x, , width] = glyph.bbox
    const old = segments.get(key)
    const left = old ? Math.min(old.x, x) : x
    const right = old ? Math.max(old.x + old.width, x + width) : x + width
    segments.set(key, { token: glyph.token, line: glyph.line, x: left,
      y: Math.min(data.layout.height - 0.5, data.layout.baselines[glyph.line] + 2), width: right - left })
  }
  return { strokes: data.layout.strokes.filter((stroke) => !hidden.has(data.layout.glyphs[stroke.glyph].token)), blanks: [...segments.values()] }
}
