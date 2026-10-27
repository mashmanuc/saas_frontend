/**
 * LAW §9 v1.69 «Вільний диктант» (власник 2026-10-28: «Натиснув на посередині. Продиктував. Дальше знову посередині…
 * користувач дуже скований… щоб вільно можна було тут будувати речення»). Лише телефон:
 *  - сказане → рядки поля: розмітка голосом («з нового рядка», «пропусти рядок», «посередині» на початку рядка);
 *  - поле → шматки для звичайних `board.dictate` (≤ 300 знаків, однакове вирівнювання, `skip` перед шматком).
 * Протокол, ноутбук і письмо — як були (v1.49–v1.66). У полі «посередині» — знак «↔ » на початку рядка.
 */
import { DICTATE_TEXT_MAX_LEN, appendDictated, spokenToText, type DictateAlign, type DictationLang } from './dictationContract'

/** Позначка «посередині» на початку рядка поля; ноутбуку йде `align: 'center'`, сам знак — ні. */
export const CENTER_MARK = '↔'
/** Поле вільного диктанту; кожен шматок для дошки — як і раніше, ≤ 300 знаків. */
export const FREE_DICTATION_MAX_LEN = 2000
/** `board.dictate.skip` — закритий набір 1…3 (v1.66). */
const MAX_SKIP = 3

type LayoutCommand = 'newline' | 'skip' | 'center'
/** Довші фрази — першими («пропусти рядок» раніше за «рядок»). «Посередині» — лише на початку рядка (див. нижче). */
const SPOKEN_LAYOUT: Record<DictationLang, ReadonlyArray<[string, LayoutCommand]>> = {
  uk: [
    ['пропустити рядок', 'skip'],
    ['пропусти рядок', 'skip'],
    ['з нового рядка', 'newline'],
    ['новий рядок', 'newline'],
    ['посередині', 'center'],
    ['по центру', 'center'],
  ],
  en: [
    ['skip a line', 'skip'],
    ['skip line', 'skip'],
    ['new line', 'newline'],
    ['in the middle', 'center'],
    ['centre', 'center'],
    ['center', 'center'],
  ],
}

export interface FieldLine {
  text: string
  center: boolean
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function commandRegex(lang: DictationLang): RegExp {
  const alts = SPOKEN_LAYOUT[lang].map(([p]) => escape(p).replace(/ /g, '\\s+')).join('|')
  // Межа слова — пробіл або знак: `\b` у JS бачить лише латиницю (як SPOKEN_MARKS).
  return new RegExp(`(^|\\s)(${alts})(?=$|[\\s.,!?;:…])`, 'giu')
}

function commandOf(found: string, lang: DictationLang): LayoutCommand {
  const norm = found.toLocaleLowerCase(lang).replace(/\s+/g, ' ')
  return SPOKEN_LAYOUT[lang].find(([p]) => p === norm)?.[1] ?? 'newline'
}

export interface ParsedSpoken {
  /** Перший шматок продовжує останній рядок поля (сказане почалося не з команди). */
  continues: boolean
  /** Рядки сказаного; порожній текст — пропущений рядок. Перший — продовження, якщо `continues`. */
  lines: FieldLine[]
}

/**
 * Сказане → рядки. «з нового рядка» / «новий рядок» — новий рядок; «пропусти рядок» — порожній рядок і новий;
 * «посередині» / «по центру» — команда лише на початку рядка (на початку сказаного, після іншої команди): посеред
 * речення «стояли посередині поля» — звичайне слово. Розділові слова (v1.50) — знаками в кожному рядку.
 */
export function parseSpoken(raw: string, lang: DictationLang = 'uk'): ParsedSpoken {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  const lines: FieldLine[] = [{ text: '', center: false }]
  let continues = true
  let cursor = 0
  const re = commandRegex(lang)
  const cur = () => lines[lines.length - 1]
  const pushText = (piece: string) => {
    const t = piece.trim()
    if (t) cur().text = cur().text ? `${cur().text} ${t}` : t
  }
  for (const m of s.matchAll(re)) {
    const start = (m.index ?? 0) + m[1].length
    pushText(s.slice(cursor, start))
    const cmd = commandOf(m[2], lang)
    const atLineStart = !cur().text
    if (cmd === 'center' && !atLineStart) {
      pushText(m[2])                       // посеред рядка — звичайне слово
    } else if (cmd === 'center') {
      // «посередині» на самому початку сказаного — новий рядок посередині (не продовження останнього рядка поля)
      if (lines.length === 1 && continues) continues = false
      cur().center = true
    } else {
      if (lines.length === 1 && !cur().text && !cur().center) continues = false
      if (cmd === 'skip') lines.push({ text: '', center: false })
      lines.push({ text: '', center: false })
    }
    cursor = start + m[2].length
  }
  pushText(s.slice(cursor))
  // Сказане почалося з «з нового рядка» / «пропусти рядок»: нульовий рядок — це залишок останнього рядка поля, якого
  // ніхто не диктував; він не стає порожнім рядком (інакше «з нового рядка» пропускав би рядок).
  if (!continues && !lines[0].text && !lines[0].center) lines.shift()
  // Розділові слова → знаки, рядок — з великої; продовження поля стане з малої в mergeSpoken (appendDictated).
  // Порожній хвіст (сказали «з нового рядка» наприкінці) лишається: наступне сказане піде з нового рядка.
  return { continues, lines: lines.map((line) => ({ center: line.center, text: spokenToText(line.text, lang) })) }
}

/** Рядки поля (порожні — пропущені рядки). */
export function fieldLines(field: string): FieldLine[] {
  if (!field) return []
  return field.replace(/\r\n?/g, '\n').split('\n').map((raw) => {
    const t = raw.trim()
    const center = t.startsWith(CENTER_MARK)
    return { center, text: center ? t.slice(CENTER_MARK.length).trim() : t }
  })
}

export function renderField(lines: FieldLine[]): string {
  return lines.map((l) => (l.center ? `${CENTER_MARK} ${l.text}`.trimEnd() + (l.text ? '' : ' ') : l.text)).join('\n')
}

/** Сказане (уже з розставленими знаками) — до поля: продовження дописуємо до останнього рядка, решта — нові рядки. */
export function mergeSpoken(field: string, parsed: ParsedSpoken, lang: DictationLang = 'uk'): string {
  const lines = fieldLines(field)
  const add = parsed.lines.map((l) => ({ ...l }))
  if (!add.length) return field
  if (parsed.continues && lines.length) {
    const last = lines[lines.length - 1]
    const first = add.shift() as FieldLine
    if (first.text) last.text = appendDictated(last.text, first.text, lang)
  } else if (lines.length && !lines[lines.length - 1].text && !lines[lines.length - 1].center) {
    // поле закінчується порожнім рядком (Enter / «Новий рядок»): нове сказане стає в нього, а не нижче
    const first = add.shift() as FieldLine
    lines[lines.length - 1] = first
  } else if (lines.length && !lines[lines.length - 1].text && lines[lines.length - 1].center) {
    // «Посередині» натиснуто на порожньому рядку — сказане стає в цей рядок посередині
    const first = add.shift() as FieldLine
    lines[lines.length - 1] = { center: true, text: first.text }
  }
  return renderField([...lines, ...add]).slice(0, FREE_DICTATION_MAX_LEN)
}

/** Непорожні рядки сказаного — для «Розставити знаки» (без «↔» і порожніх рядків), і назад на свої місця. */
export function textForPunctuation(parsed: ParsedSpoken): string {
  return parsed.lines.map((l) => l.text).filter(Boolean).join('\n')
}
export function withPunctuated(parsed: ParsedSpoken, punctuated: string): ParsedSpoken {
  const fixed = punctuated.split('\n')
  let i = 0
  return {
    continues: parsed.continues,
    lines: parsed.lines.map((l) => (l.text ? { ...l, text: fixed[i++] ?? l.text } : l)),
  }
}

/**
 * Рядки для «Розставити знаки» порціями ≤ 300 знаків (стеля сервера), рядки не ріжемо. Рядок, довший за стелю, — окрема
 * порція з `send: false`: його лишаємо, як є (сервер такого не прийме). Порції в тому самому порядку, що й рядки.
 */
export function punctuationBatches(texts: string[]): { lines: string[]; send: boolean }[] {
  const out: { lines: string[]; send: boolean }[] = []
  let cur: string[] = []
  let len = 0
  const flush = () => { if (cur.length) out.push({ lines: cur, send: true }); cur = []; len = 0 }
  for (const t of texts) {
    if (t.length > DICTATE_TEXT_MAX_LEN) {
      flush()
      out.push({ lines: [t], send: false })
      continue
    }
    if (cur.length && len + 1 + t.length > DICTATE_TEXT_MAX_LEN) flush()
    len = cur.length ? len + 1 + t.length : t.length
    cur.push(t)
  }
  flush()
  return out
}

/** «Посередині» кнопкою: ставить або знімає «↔» на останньому рядку (порожнє поле — новий рядок посередині). */
export function toggleCenterLast(field: string): string {
  const lines = fieldLines(field)
  if (!lines.length) return `${CENTER_MARK} `
  const last = lines[lines.length - 1]
  last.center = !last.center
  return renderField(lines)
}
export function lastLineCentered(field: string): boolean {
  const lines = fieldLines(field)
  return !!lines.length && lines[lines.length - 1].center
}
/** «Новий рядок» кнопкою — порожній рядок у кінці (наступне сказане стане в нього). */
export function addNewLine(field: string): string {
  const lines = fieldLines(field)
  if (!lines.length || (!lines[lines.length - 1].text && !lines[lines.length - 1].center)) return field
  return `${renderField(lines)}\n`
}
/** «Пропустити рядок» кнопкою — порожній рядок і новий (≤ 3 пропущених, як `skip`). */
export function addSkippedLine(field: string): string {
  const lines = fieldLines(field)
  let blanks = 0
  for (let i = lines.length - 1; i >= 0 && !lines[i].text && !lines[i].center; i--) blanks++
  if (!lines.length || blanks > MAX_SKIP) return field
  const base = blanks ? renderField(lines) : `${renderField(lines)}\n`
  return `${base}\n`
}

export interface DictationChunk {
  text: string
  align: DictateAlign
  /** Скільки ліній пропустити перед шматком (0 — без пропуску). */
  skip: number
}

/** Рядок довший за 300 знаків — частинами за кінцем речення, далі за пробілом (кожна ≤ 300). */
function splitLong(text: string): string[] {
  const parts: string[] = []
  let rest = text.trim()
  while (rest.length > DICTATE_TEXT_MAX_LEN) {
    const head = rest.slice(0, DICTATE_TEXT_MAX_LEN + 1)
    let cut = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '), head.lastIndexOf('… '))
    cut = cut > 0 ? cut + 1 : head.lastIndexOf(' ')
    if (cut <= 0) cut = DICTATE_TEXT_MAX_LEN
    parts.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

/**
 * Поле → шматки для `board.dictate` по одному: рядки з однаковим вирівнюванням підряд — один шматок (Enter усередині,
 * v1.55), ≤ 300 знаків; порожні рядки перед шматком → `skip` (≤ 3); «↔» → `center` (лише коли ноутбук уміє).
 */
export function fieldToChunks(field: string, canCenter = true): DictationChunk[] {
  const chunks: DictationChunk[] = []
  let skip = 0
  let open: DictationChunk | null = null
  for (const line of fieldLines(field)) {
    if (!line.text) {
      if (!line.center) { skip += 1; open = null }
      continue
    }
    const align: DictateAlign = line.center && canCenter ? 'center' : 'left'
    for (const part of splitLong(line.text)) {
      if (open && open.align === align && open.text.length + 1 + part.length <= DICTATE_TEXT_MAX_LEN) {
        open.text = `${open.text}\n${part}`
        continue
      }
      open = { text: part, align, skip: Math.min(skip, MAX_SKIP) }
      chunks.push(open)
      skip = 0
    }
  }
  return chunks
}

/** Ще не написані шматки — назад у поле (написаний шматок зникає з поля). */
export function chunksToField(chunks: DictationChunk[]): string {
  const lines: FieldLine[] = []
  chunks.forEach((c) => {
    for (let k = 0; k < c.skip; k++) lines.push({ text: '', center: false })
    for (const t of c.text.split('\n')) lines.push({ text: t, center: c.align === 'center' })
  })
  return renderField(lines)
}
