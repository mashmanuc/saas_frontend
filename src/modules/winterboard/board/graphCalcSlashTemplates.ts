/**
 * Шаблони меню «/» у полі виразу графкалькулятора (P2 #9, 2026-05-08).
 *
 * Більший набір, ніж видимі кнопки швидкого додавання (8 проти 4): кнопки — щоб
 * помітити, «/» — щоб швидко набрати без миші.
 *
 * Власник 2026-10-02: меню показувало англійські назви (`/linear`, `/parabola`) і
 * шукало лише англійською — учитель, що набрав «/парабола», бачив «Нема шаблонів».
 * Тепер назва й синоніми беруться з перекладу (мова інтерфейсу), а англійські
 * `id` і `keyword` лишаються синонімами для пошуку.
 */
export const SLASH_TEMPLATES = [
  { id: 'linear',   label: 'a·x',           keyword: 'linear line',          src: 'y = a*x' },
  { id: 'sin',      label: 'a·sin(x)',      keyword: 'sin sine',             src: 'y = a*sin(x)' },
  { id: 'cos',      label: 'a·cos(x)',      keyword: 'cos cosine',           src: 'y = a*cos(x)' },
  { id: 'parabola', label: 'a·x²',          keyword: 'parabola poly2 quad',  src: 'y = a*x^2' },
  { id: 'cubic',    label: 'a·x³',          keyword: 'cubic poly3',          src: 'y = a*x^3' },
  { id: 'sqrt',     label: '√x',            keyword: 'sqrt root',            src: 'y = sqrt(x)' },
  { id: 'log',      label: 'log(x)',        keyword: 'log',                  src: 'y = log(x)' },
  { id: 'circle',   label: 'x² + y² = r²',  keyword: 'circle',               src: '(x)^2 + (y)^2 = r^2' },
] as const

export type SlashTemplate = typeof SLASH_TEMPLATES[number]
export type SlashTemplateId = SlashTemplate['id']

/** Назва шаблону й синоніми (через пробіл) мовою інтерфейсу. */
export interface SlashTemplateText {
  name: string
  keywords: string
}

/**
 * Шаблони, що відповідають запиту після «/». Порожній запит — усі. Збіг шукаємо в
 * англійських `id`/`keyword` і в перекладених назві та синонімах.
 */
export function filterSlashTemplates(
  query: string,
  textOf: (id: SlashTemplateId) => SlashTemplateText,
): readonly SlashTemplate[] {
  const q = query.toLowerCase().trim()
  if (!q) return SLASH_TEMPLATES
  return SLASH_TEMPLATES.filter((tpl) => {
    const loc = textOf(tpl.id)
    return [tpl.id, tpl.keyword, loc.name, loc.keywords].some((s) => s.toLowerCase().includes(q))
  })
}
