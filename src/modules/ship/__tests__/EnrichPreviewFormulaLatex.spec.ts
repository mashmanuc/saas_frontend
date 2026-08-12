/**
 * Формульні картки в прев'ю мають виглядати так само, як на дошці.
 *
 * Живий тест власника 2026-08-12: у списку висіло
 * `\log_a b + \log_a c = \log_a (bc)` сирим текстом. Перше враження —
 * «рендер відкотили». Ні: рендер на місці, річ у КОНТРАКТІ.
 *
 * Для `add_formula` промпт вимагає «body = ЛИШЕ формула, чистий LaTeX БЕЗ $»
 * (enrich.py), а `renderTextWithLatex` рендерить лише те, що між доларами.
 * Дошка обгортає у `$$…$$` сама (FormulaCardRenderer.vue:80) — прев'ю не
 * обгортало, тож показувало ГІРШЕ, ніж буде після застосування.
 *
 * Тест перевіряє КОНТРАКТ рендерера на обох формах тіла, а не розмітку
 * компонента: так він переживе будь-яку перебудову прев'ю.
 */
import { describe, it, expect } from 'vitest'
import { renderTextWithLatex } from '@/modules/learning-content/utils/contentRenderer'

/** Дзеркало `EnrichPatchesPreview::renderBody` — контракт, не реалізація. */
function renderBody(patch: { action?: string; card_data?: { body?: string } }): string {
  const body = String(patch?.card_data?.body ?? '')
  if (!body.trim()) return ''
  const bare = patch?.action === 'add_formula' && !body.includes('$')
  return renderTextWithLatex(bare ? `$$${body}$$` : body)
}

/** Видимий шар KaTeX без прихованого MathML (там LaTeX є ЗА ЗАДУМОМ). */
function visible(html: string): string {
  const host = document.createElement('div')
  host.innerHTML = html
  host.querySelectorAll('.katex-mathml').forEach((el) => el.remove())
  return host.textContent || ''
}

describe('прев\'ю enrich: формульна картка', () => {
  it('голий LaTeX (add_formula) стає KaTeX, а не текстом', () => {
    // Дослівно зі скріна власника.
    const html = renderBody({
      action: 'add_formula',
      card_data: { body: '\\log_a b + \\log_a c = \\log_a (bc)' },
    })
    expect(html).toContain('katex')
    expect(visible(html)).not.toContain('\\log')
  })

  it('без фіксу той самий рядок лишався б текстом (демонстрація дефекту)', () => {
    const raw = renderTextWithLatex('\\log_a b + \\log_a c = \\log_a (bc)')
    expect(raw).not.toContain('katex')
  })

  it('якщо модель усе-таки поставила долари — не обгортаємо вдруге', () => {
    const html = renderBody({
      action: 'add_formula',
      card_data: { body: '$a^2 + b^2 = c^2$' },
    })
    expect(html).toContain('katex')
    expect(visible(html)).not.toContain('$')
  })

  it('текстова картка (add_card) поводиться як раніше', () => {
    const html = renderBody({
      action: 'add_card',
      card_data: { body: 'Функція $\\frac{k}{x+b}$ не визначена там, де знаменник нуль.' },
    })
    expect(html).toContain('katex')
    expect(visible(html)).toContain('не визначена')
  })

  it('порожнє тіло не валить рендер', () => {
    expect(renderBody({ action: 'add_formula', card_data: { body: '' } })).toBe('')
    expect(renderBody({ action: 'add_formula' })).toBe('')
    expect(renderBody({})).toBe('')
  })

  it('дужки й дроби з реальних карток виживають', () => {
    for (const body of [
      '\\log_{a} b^n = n \\log_{a} b',
      'a^{m+n} = a^m \\cdot a^n',
      '\\sqrt{x^2} = |x|',
      'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
    ]) {
      const html = renderBody({ action: 'add_formula', card_data: { body } })
      expect(html, body).toContain('katex')
      expect(visible(html), body).not.toContain('\\')
    }
  })
})
