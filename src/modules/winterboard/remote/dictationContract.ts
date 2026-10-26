// «✍️ Диктант» з пульта (LAW §9 v1.49, 2026-10-24) — спільний контракт телефона й ноутбука.
//
// Власник: «вчителька української мови казала що для неї багато часу займає написання речень на дошці для
// подальшого їх розбору… а в нас є телефон мікрофон дошка і пропис». Учитель диктує речення на телефоні — ноутбук
// пише його рукописом (той самий почерк, що ✍ розв'язку) під уже написаним на поточній сторінці.

/** Стеля речення — як на сервері (`REMOTE_DICTATE_TEXT_MAX_LEN`). */
export const DICTATE_TEXT_MAX_LEN = 300

export const DICTATION_STATUSES = ['writing', 'done', 'refused'] as const
export type DictationStatus = typeof DICTATION_STATUSES[number]

/** Причини відмови — закритий набір, як на сервері. */
export const DICTATION_REASONS = ['no_space', 'busy', 'blocked', 'unsupported', 'error'] as const
export type DictationReason = typeof DICTATION_REASONS[number]

/** `remote.state.dictation`: відповідь ноутбука на останнє речення. */
export interface RemoteDictationResult {
  request_id: string
  status: DictationStatus
  reason?: DictationReason
}

const REQUEST_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Розбір `remote.state.dictation` на телефоні — ті самі правила, що на сервері; зіпсоване — undefined. */
export function parseRemoteDictation(raw: unknown): RemoteDictationResult | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const v = raw as Record<string, unknown>
  if (Object.keys(v).some((k) => k !== 'request_id' && k !== 'status' && k !== 'reason')) return undefined
  if (typeof v.request_id !== 'string' || !REQUEST_ID_RE.test(v.request_id)) return undefined
  if (!(DICTATION_STATUSES as readonly unknown[]).includes(v.status)) return undefined
  const out: RemoteDictationResult = { request_id: v.request_id, status: v.status as DictationStatus }
  if (v.status === 'refused') {
    if (!(DICTATION_REASONS as readonly unknown[]).includes(v.reason)) return undefined
    out.reason = v.reason as DictationReason
  } else if (v.reason !== undefined) {
    return undefined
  }
  return out
}

/** v1.51: вирівнювання речення — закритий набір, як на сервері. */
export type DictateAlign = 'left' | 'center'

/** Аргументи `board.dictate` на ноутбуці: закритий набір, ті самі межі, що на сервері; інше — null. */
export function readDictateArgs(args: unknown): { requestId: string; text: string; align: DictateAlign; lang?: DictationLang; skip?: number } | null {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return null
  const a = args as Record<string, unknown>
  const keys = Object.keys(a)
  if (keys.some((k) => k !== 'request_id' && k !== 'text' && k !== 'align' && k !== 'lang' && k !== 'skip')) return null
  // v1.66: «Пропустити рядок» — скільки рядків зошита пропустити, ціле 1…3, як на сервері
  if (a.skip !== undefined && (typeof a.skip !== 'number' || !Number.isInteger(a.skip) || a.skip < 1 || a.skip > 3)) return null
  if (a.lang !== undefined && a.lang !== 'uk' && a.lang !== 'en') return null
  if (typeof a.request_id !== 'string' || typeof a.text !== 'string') return null
  if (a.align !== undefined && a.align !== 'left' && a.align !== 'center') return null
  if (!REQUEST_ID_RE.test(a.request_id)) return null
  const text = a.text.trim()
  // v1.55: з керівних — лише перенос рядка (новий рядок на дошці), як на сервері
  // eslint-disable-next-line no-control-regex
  if (!text || text.length > DICTATE_TEXT_MAX_LEN || /[\u0000-\u0009\u000b-\u001f]/.test(text)) return null
  return { requestId: a.request_id, text, align: a.align === 'center' ? 'center' : 'left', ...(a.lang ? { lang: a.lang as DictationLang } : {}),
    ...(a.skip !== undefined ? { skip: a.skip as number } : {}) }
}

/**
 * v1.55: текст із поля телефона — для ноутбука. Enter у полі — новий рядок на дошці (власник 2026-10-25: «25 жовтня ⏎
 * класна робота» посередині); порожні рядки й пробіли по краях рядка прибираємо, інші керівні знаки (таб із вставки)
 * — пробіл: сервер їх не пропустить, а телефон чекав би відповіді, якої не буде.
 */
export function normalizeDictation(text: string): string {
  return text.replace(/\r\n?|[\u2028\u2029]/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, ' ')
    .split('\n').map((line) => line.trim()).filter(Boolean).join('\n')
    .slice(0, DICTATE_TEXT_MAX_LEN).trim()
}

/** v1.50: мова диктанту — якою телефон слухає голос і які розділові слова ставить знаками. */
export type DictationLang = 'uk' | 'en'
export const DICTATION_LANGS: readonly DictationLang[] = ['uk', 'en']
/** Мова розпізнавання на телефоні; англійська — британська, як у шкільних підручниках. */
export const DICTATION_SPEECH_LANG: Record<DictationLang, string> = { uk: 'uk-UA', en: 'en-GB' }

/**
 * Розділові знаки словами → знаки. Телефон розпізнає мову без пунктуації, а для розбору речення вона важлива:
 * учитель каже «Сонце сходило кома і птахи співали крапка». Довші назви — першими («крапка з комою» раніше за «крапка»).
 * Межу слова задаємо пробілами: `\b` у JS бачить лише латиницю.
 */
const SPOKEN_MARKS: Record<DictationLang, ReadonlyArray<[string, string]>> = {
  uk: [
    ['крапка з комою', ';'],
    ['три крапки', '…'],
    ['знак питання', '?'],
    ['знак оклику', '!'],
    ['двокрапка', ':'],
    ['крапка', '.'],
    ['кома', ','],
    ['тире', ' —'],
  ],
  // v1.50: «full stop» (британське) і «period» (американське) — обидва; «semicolon» сам не зачепить «colon» (межа — пробіл)
  en: [
    ['exclamation point', '!'],
    ['exclamation mark', '!'],
    ['question mark', '?'],
    ['full stop', '.'],
    ['semicolon', ';'],
    ['ellipsis', '…'],
    ['period', '.'],
    ['comma', ','],
    ['colon', ':'],
    ['dash', ' —'],
  ],
}

/** Продиктоване → речення: розділові слова стають знаками, перша літера велика, зайві пробіли прибрано. */
export function spokenToText(raw: string, lang: DictationLang = 'uk'): string {
  let s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  for (const [phrase, mark] of SPOKEN_MARKS[lang]) {
    const re = new RegExp(`(^|\\s)${phrase.replace(/ /g, '\\s+')}(?=$|[\\s.,!?;:…])`, 'giu')
    s = s.replace(re, mark)
  }
  s = s
    .replace(/\s+([,.;:!?…])/g, '$1')               // без пробілу перед знаком
    .replace(/([,.;:!?…])(?=[^\s,.;:!?…»)])/g, '$1 ')  // пробіл після знака
    .replace(/\s+/g, ' ')
    .trim()
  return s ? s[0].toLocaleUpperCase(lang) + s.slice(1) : ''
}

/** Новий шматок диктування — до вже набраного в полі (через пробіл), без подвійних пробілів. */
export function appendDictated(current: string, spoken: string, lang: DictationLang = 'uk'): string {
  const piece = spokenToText(spoken, lang)
  if (!piece) return current
  const base = current.replace(/\s+$/, '')
  if (!base) return piece
  // продовження речення після коми — з малої; після кінця речення — з великої (spokenToText уже зробив).
  // Англійське «I» («I'm», «I've») — велике завжди.
  const continues = !/[.!?…]$/.test(base)
  const keepCapital = lang === 'en' && /^I(?![a-z])/.test(piece)
  const next = continues && !keepCapital ? piece[0].toLocaleLowerCase(lang) + piece.slice(1) : piece
  return `${base} ${next}`
}
