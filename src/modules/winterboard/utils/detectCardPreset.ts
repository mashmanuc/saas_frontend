/**
 * detectCardPreset — FE-дзеркало BE `_detect_preset` (apps/intent/ai/parser.py).
 * ⚠️ Мапи мусять збігатися: міняєш ключові слова тут → міняй і в parser.py.
 *
 * Render-time fallback для СТАРИХ карток (N1 Фаза 3, 2026-08-07): картки,
 * створені до появи пресетів, не мають data.preset — без цього fallback вони
 * назавжди лишалися б із дефолтним (синім) стилем. Детекція виконується на
 * льоту при рендері й НІЧОГО не пише у збережений стан дошки.
 *
 * Пріоритет полів: badge → title → body — поле з вищим пріоритетом вирішує
 * САМЕ (дзеркалить BE-фікс: «✅ Правило: …» у тілі розбору помилки не має
 * перебивати заголовок «Поширена помилка»).
 */

// 'life example' СВІДОМО перед 'example' — інакше коротший ключ «приклад»
// з'їв би довший «приклад із життя» у межах одного поля.
const PRESET_KEYWORDS: Record<string, string[]> = {
  'life example': ['приклад із життя', 'життєвий приклад'],
  definition: ['означення', 'визначення', 'теорія', 'теорема'],
  rule: ['правило', 'властивість', 'закон'],
  proof: ['доведення', 'доказ'],
  tip: ['підказка', 'порада'],
  'common mistake': ['помилка', 'поширена помилка', 'часті помилки'],
  remember: ["запам'ятай", 'важливо', 'ключове'],
  example: ['приклад', 'зразок', 'таблиця'],
  algorithm: ['алгоритм', 'порядок дій', 'покроково', 'метод'],
  summary: ['підсумок', 'резюме', 'висновок', 'підсумуй'],
}

export function detectCardPreset(
  title?: string,
  body?: string,
  badge?: string,
): string | null {
  for (const field of [badge, title, body]) {
    const text = (field || '').toLowerCase()
    if (!text) continue
    for (const [preset, keywords] of Object.entries(PRESET_KEYWORDS)) {
      if (keywords.some((kw) => text.includes(kw))) return preset
    }
  }
  return null
}
