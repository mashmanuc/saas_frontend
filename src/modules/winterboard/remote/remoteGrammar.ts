// WB Remote: коротка граматика голосових команд пульта.
// Ref: saas_docs/domains/winterboard/CLASSROOM_REMOTE_VISION_2026-09-02.md, крок 6.
//
// Працює на ТЕЛЕФОНІ, без сервера й без моделі: розпізнаний текст (Web Speech)
// звіряється з десятком фраз керування дошкою. Збіг → команда пульта миттєво.
// Незбіг → фраза йде на ноутбук як `phrase` і далі в Інтегралика штатним шляхом.
//
// Правила навмисно вузькі: краще не впізнати команду (фраза піде Інтегралику,
// він перепитає), ніж перегорнути сторінку від «наступного разу розберемо».
//
// ⚠️ Без `\b`/`\w`: у JS-регекспах вони ASCII-only і НЕ бачать кирилицю.
// Тому текст ділиться на слова, а збіг — за префіксом слова.

export type RemoteGrammarCmd = 'page.next' | 'page.prev' | 'page.new' | 'undo'

/** Довші фрази — не команди дошки, а питання/прохання до Інтегралика. */
export const REMOTE_GRAMMAR_MAX_LEN = 40

function words(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:«»"'`()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

/** Чи є серед слів таке, що починається з одного з префіксів. */
function has(ws: string[], prefixes: string[]): boolean {
  return ws.some((w) => prefixes.some((p) => w.startsWith(p)))
}

/** Точний збіг цілого слова (для коротких, де префікс був би надто широкий). */
function hasExact(ws: string[], exact: string[]): boolean {
  return ws.some((w) => exact.includes(w))
}

/**
 * Повертає команду дошки або null (тоді фраза — для Інтегралика).
 *
 * Порядок перевірок важливий: «відміни нову сторінку» має бути undo, не page.new;
 * «назад» — попередня сторінка, «відміни/скасуй» — відміна кроку.
 */
export function matchRemotePhrase(raw: string): RemoteGrammarCmd | null {
  const text = raw.trim()
  if (!text || text.length > REMOTE_GRAMMAR_MAX_LEN) return null
  const ws = words(text)
  if (ws.length === 0) return null

  // undo — першим, бо «відміни нову сторінку» містить і «нову», і «сторінку»
  if (has(ws, ['відмін', 'скасу']) || hasExact(ws, ['undo'])) return 'undo'

  // нова сторінка
  const page = has(ws, ['сторінк']) || hasExact(ws, ['page'])
  if (page && has(ws, ['нов', 'дода', 'чист', 'new'])) return 'page.new'
  if (ws.length === 1 && hasExact(ws, ['нова'])) return 'page.new'
  if (ws.length === 2 && ws[0] === 'new' && ws[1] === 'page') return 'page.new'

  // попередня
  if (has(ws, ['попередн']) || hasExact(ws, ['назад', 'back', 'previous'])) return 'page.prev'

  // наступна
  if (has(ws, ['наступн']) || hasExact(ws, ['далі', 'вперед', 'next'])) return 'page.next'

  return null
}
