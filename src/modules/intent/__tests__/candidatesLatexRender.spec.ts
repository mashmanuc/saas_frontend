/**
 * Список кандидатів у чаті показує математику, а не розмітку.
 *
 * Живий тест власника 2026-08-12: на «прибери з поточної задачі відповіді»
 * Інтегралик спитав «Який об'єкт видалити?» і дав список, у якому висіло
 * `NMT-задача: Відомо, що $\displaystyle\int_{0}^{3}f(x)\,dx=6$`. Тьютор
 * має ВПІЗНАТИ свою задачу, щоб клікнути правильну — а читає LaTeX.
 *
 * Це третя поверхня того самого класу: спершу лагодили відповіді чату
 * (І-1), потім прев'ю enrich (І-3 і формульні картки), тепер кандидатів.
 * Тому тест перевіряє КОНТРАКТ рендерера на реальних мітках, а не
 * розмітку компонента: CommandPalette тягне роутер, стори й пів дошки,
 * і монтувати його заради одного `v-html` — крихко.
 */
import { describe, it, expect } from 'vitest'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

/** Мітки — дослівно зі скріна власника. */
const LABELS = [
  'NMT-задача: Відомо, що $\\displaystyle\\int_{0}^{3}f(x)\\,dx=6$,',
  'NMT-задача: Обчисліть інтеграл $\\int\\limits_0^2(3x^2+1)\\,dx$.',
  'NMT-задача: Визначте загальний вигляд первісних для $f(x) = 3e$',
]

function visible(html: string): string {
  const host = document.createElement('div')
  host.innerHTML = html
  host.querySelectorAll('.katex-mathml').forEach((el) => el.remove())
  return host.textContent || ''
}

describe('кандидати Інтегралика', () => {
  it('формула в мітці стає KaTeX', () => {
    for (const label of LABELS) {
      const html = renderTextWithLatex(label)
      expect(html, label).toContain('katex')
      expect(visible(html), label).not.toContain('\\int')
      expect(visible(html), label).not.toContain('displaystyle')
    }
  })

  it('текстова частина мітки лишається читабельною', () => {
    // саме по ній тьютор і впізнає свою задачу
    expect(visible(renderTextWithLatex(LABELS[0]))).toContain('Відомо, що')
    expect(visible(renderTextWithLatex(LABELS[1]))).toContain('Обчисліть інтеграл')
  })

  it('мітка без формул проходить незміненою', () => {
    const plain = 'картка: Задача: Інтеграл'
    expect(visible(renderTextWithLatex(plain))).toContain(plain)
  })

  it('HTML у мітці екранується — v-html тут безпечний саме тому', () => {
    const html = renderTextWithLatex('<img src=x onerror="alert(1)">')
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toContain('onerror')
  })
})
