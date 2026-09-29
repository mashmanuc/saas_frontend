/**
 * Вставка у звичайне поле формули (власник 2026-09-29: «формули не копіюються з поля в поле адекватно»).
 *
 * Поле MathQuill копіює формулу як LaTeX (`\left(x-2\right)^2+\left(y-4\right)^2=9`). Звичайне поле
 * зберігало цей текст як є — формат зберігання ascii (`(x-2)^2+(y-4)^2=9`), тож графік його не читав.
 * Тут: LaTeX → ascii тим самим `latexToSrc`, що й MathQuillField при наборі; звичайний текст —
 * звичайна вставка браузера. Далі — штатна подія `input`, тож кожне поле оновлює модель своїм обробником.
 */
import { latexToSrc } from './latexToSrc'

const LATEX_RE = /\\[a-zA-Z]+|\^\{|_\{/

/** Схоже на LaTeX (команда `\left`, `\frac`, `\cdot`… або `^{`/`_{`) — не звичайний запис формули. */
export function looksLikeLatex(text: string): boolean {
  return LATEX_RE.test(text)
}

/** `@paste` звичайного поля формули: LaTeX із буфера → ascii у позиції курсора + подія `input`. */
export function pasteFormulaAsSrc(e: ClipboardEvent): void {
  const text = e.clipboardData?.getData('text/plain') ?? ''
  if (!looksLikeLatex(text)) return
  let src: string
  try {
    src = latexToSrc(text)
  } catch (err) {
    console.warn('[formulaPaste] LaTeX не перетворився — звичайна вставка:', err)
    return
  }
  const input = e.target as HTMLInputElement
  e.preventDefault()
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? input.value.length
  input.value = input.value.slice(0, start) + src + input.value.slice(end)
  const caret = start + src.length
  input.setSelectionRange(caret, caret)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
