/**
 * Коректор розпізнаного — сегменти прочитаного (ТЗ `TZ_IMAGE_READING_CORRECTOR_2026-10-08.md` §0 К2).
 *
 * Прочитане — наш контракт, не модельний: `[{type:'text', text}, {type:'formula', latex}, …]`.
 * Тут лише чисті функції: відмалювати формулу, знайти першу, що не відмальовується,
 * замінити РІВНО один сегмент.
 *
 * ⛔ Без «ремонту» (правило власника — без костилів на вихід моделі): формула
 * відмальовується KaTeX рівно такою, як збережена, без `toKatexCompatible`.
 * Що бачить учитель у блоці — те саме й перевіряється перед збереженням.
 */
import katex from 'katex'

/** HTML формули або `null`, якщо KaTeX її не бере (`throwOnError: true`). */
export function renderFormulaHtml(latex) {
  if (typeof latex !== 'string' || !latex.trim()) return null
  try {
    const html = katex.renderToString(latex, {
      output: 'htmlAndMathml',
      displayMode: false,
      throwOnError: true,
    })
    // translate="no": браузерний переклад ламає змішану розмітку KaTeX (MathExpr.vue, 2026-08-15).
    return `<span translate="no" class="notranslate">${html}</span>`
  } catch {
    // Не тиша: `null` = «не відмальовується», блок показує це вчителю й не зберігає.
    return null
  }
}

/** Чи відмальовується формула. */
export function isFormulaRenderable(latex) {
  return renderFormulaHtml(latex) !== null
}

/** Індекс першої формули, яку KaTeX не відмальовує, або -1. */
export function firstInvalidFormulaIndex(segments) {
  if (!Array.isArray(segments)) return -1
  return segments.findIndex((s) => s?.type === 'formula' && !isFormulaRenderable(s.latex))
}

/**
 * Новий масив, у якому замінено ЛИШЕ сегмент `index`; решта — ті самі об'єкти.
 * Тип сегмента не змінюється: формула лишається формулою, текст — текстом.
 */
export function replaceSegment(segments, index, value) {
  const current = segments[index]
  if (!current) throw new RangeError(`Немає сегмента з індексом ${index}`)
  const next = current.type === 'formula'
    ? { type: 'formula', latex: value }
    : { type: 'text', text: value }
  return segments.map((s, i) => (i === index ? next : s))
}
