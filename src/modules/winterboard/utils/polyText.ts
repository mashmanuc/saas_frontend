/**
 * Запис многочлена в тексті віджетів дошки.
 *
 * ⚠️ ЧОМУ ОКРЕМИЙ ФАЙЛ. У математиці не пишуть ні коефіцієнт 1, ні доданок
 * з нулем: правильно `x² − x − 6 = 0`, а не `1x² − 1x − 6 = 0`. Віджет
 * квадратного рівняння писав саме друге — видно на демо-дошці лендингу.
 *
 * Той самий дефект за 2026-09-04 знайшовся ВІСІМ разів у восьми темах
 * банку задач, і причина скрізь одна: кожен генератор винаходив запис
 * многочлена заново. У банку це вилікувано спільним `render_poly`
 * (`backend/tools/corpus_gen/templates_common.py`). Тут — те саме
 * лікування для фронтенду.
 *
 * ⚠️ Дубль цієї логіки свідомо лишається у `vendor/quad/quad-card.js`:
 * той файл — самодостатній IIFE без жодного імпорту (так він і
 * задуманий), тому взяти звідси не може. Правки — в обидва місця, і в
 * ньому стоїть покажчик сюди.
 */

/** Число у вигляді, звичному для української школи (кома як роздільник). */
export function fmtNum(n: number, digits = 2): string {
  const p = 10 ** digits
  const r = Math.round(n * p) / p
  return r.toString().replace('.', ',')
}

/**
 * Один доданок: коефіцієнт + змінна.
 *
 * Порожній рядок означає, що доданка немає взагалі (нульовий коефіцієнт).
 *
 * @param coef  коефіцієнт (може бути від'ємним або нулем)
 * @param varPart  змінна з показником: '', 'x', 'x²'
 * @param first  чи це перший доданок (тоді «+» не пишемо)
 */
export function renderTerm(coef: number, varPart = '', first = false): string {
  if (Math.abs(coef) < 1e-9) return ''
  const abs = Math.abs(coef)
  // ⚠️ Одиницю перед змінною не пишуть, але перед ПОРОЖНЬОЮ змінною
  // (вільний член) — пишуть: «x² + 1» це не «x² + ».
  const body = varPart
    ? (Math.abs(abs - 1) < 1e-9 ? varPart : `${fmtNum(abs)}${varPart}`)
    : fmtNum(abs)
  if (first) return coef < 0 ? `−${body}` : body
  return coef < 0 ? ` − ${body}` : ` + ${body}`
}

/**
 * Многочлен рядком: `terms` — пари [коефіцієнт, змінна] у порядку запису.
 *
 * Многочлен із самих нулів — це `0`, а не порожній рядок.
 */
export function renderPoly(terms: Array<[number, string]>): string {
  const out: string[] = []
  for (const [coef, varPart] of terms) {
    const piece = renderTerm(coef, varPart, out.length === 0)
    if (piece) out.push(piece)
  }
  return out.join('') || '0'
}
