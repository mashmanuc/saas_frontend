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
//
// v1.2 (2026-09-03, з уроку власника): «покажи задачу» (картка на екран),
// «більше/менше» (масштаб), «вгору/вниз» (скрол), «відповідь», «розбір».

export type RemoteGrammarCmd =
  | 'page.next' | 'page.prev' | 'page.new' | 'undo'
  | 'view.fit' | 'view.zoom.in' | 'view.zoom.out' | 'view.scroll.up' | 'view.scroll.down'
  | 'card.answer' | 'card.solution'

/** Довші фрази — не команди дошки, а питання/прохання до Інтегралика. */
export const REMOTE_GRAMMAR_MAX_LEN = 40

function words(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[’ʼ`]/g, '\'')            // типографські апострофи → простий (розв’язання = розв'язання)
    .replace(/[.,!?;:«»"()]/g, ' ')     // апостроф НЕ вирізаємо — він частина слова
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
 * «покажи відповідь» — картка, не «покажи задачу»; «назад» — попередня сторінка.
 */
export function matchRemotePhrase(raw: string): RemoteGrammarCmd | null {
  const text = raw.trim()
  if (!text || text.length > REMOTE_GRAMMAR_MAX_LEN) return null
  const ws = words(text)
  if (ws.length === 0) return null

  // undo — першим, бо «відміни нову сторінку» містить і «нову», і «сторінку»
  if (has(ws, ['відмін', 'скасу']) || hasExact(ws, ['undo'])) return 'undo'

  // картка: відповідь / розбір (перемикачі — «покажи» і «сховай» дають ту саму команду)
  if (has(ws, ['відповід'])) return 'card.answer'
  if (has(ws, ['розбір', 'розбор', 'розв\'яз', 'розвяз', 'рішенн'])) return 'card.solution'

  // картка на екран. Без «на»: «додай завдання НА нерівності» — це Інтегралику.
  if (has(ws, ['задач', 'завданн']) && has(ws, ['покаж', 'збільш', 'екран', 'наведи', 'виведи'])) return 'view.fit'
  if (ws.length === 1 && has(ws, ['задач'])) return 'view.fit'

  // нова сторінка
  const page = has(ws, ['сторінк']) || hasExact(ws, ['page'])
  if (page && has(ws, ['нов', 'дода', 'чист', 'new'])) return 'page.new'
  if (ws.length === 1 && hasExact(ws, ['нова'])) return 'page.new'
  if (ws.length === 2 && ws[0] === 'new' && ws[1] === 'page') return 'page.new'

  // скрол
  if (hasExact(ws, ['вгору', 'угору', 'вище']) || has(ws, ['догори'])) return 'view.scroll.up'
  if (hasExact(ws, ['вниз', 'нижче', 'донизу'])) return 'view.scroll.down'

  // масштаб
  if (hasExact(ws, ['більше', 'крупніше']) || has(ws, ['збільш'])) return 'view.zoom.in'
  if (hasExact(ws, ['менше', 'дрібніше']) || has(ws, ['зменш'])) return 'view.zoom.out'

  // попередня
  if (has(ws, ['попередн']) || hasExact(ws, ['назад', 'back', 'previous'])) return 'page.prev'

  // наступна
  if (has(ws, ['наступн']) || hasExact(ws, ['далі', 'вперед', 'next'])) return 'page.next'

  return null
}
