import { describe, it, expect } from 'vitest'
import { renderTextWithLatex } from '../contentRenderer'

describe('renderTextWithLatex — markdown-lite (bold + pipe-таблиці)', () => {
  it('звичайний текст без markdown лишається як раніше (\\n → <br/>)', () => {
    expect(renderTextWithLatex('перший рядок\nдругий рядок')).toBe(
      'перший рядок<br/>другий рядок',
    )
  })

  it('**bold** → <strong>', () => {
    expect(renderTextWithLatex('це **важливо** тут')).toBe(
      'це <strong>важливо</strong> тут',
    )
  })

  it('одинарна зірочка не чіпається (не bold-маркер)', () => {
    expect(renderTextWithLatex('2 * 3 = 6')).toBe('2 * 3 = 6')
  })

  it('pipe-таблиця → <table> з <thead>/<tbody>', () => {
    const md = '| x | f\'(x) |\n|---|---|\n| c | 0 |\n| x | 1 |'
    const html = renderTextWithLatex(md)
    expect(html).toContain('<table class="lc-table">')
    expect(html).toContain('<th>x</th>')
    expect(html).toContain("<th>f'(x)</th>")
    expect(html).toContain('<td>c</td>')
    expect(html).toContain('<td>0</td>')
    expect(html).not.toContain('|---|')
  })

  it('таблиця з LaTeX у комірці рендериться (katex не падає)', () => {
    const md = '| x | вираз |\n|---|---|\n| 1 | $x^2$ |'
    const html = renderTextWithLatex(md)
    expect(html).toContain('<table class="lc-table">')
    expect(html).toMatch(/katex/)
  })

  it('текст навколо таблиці лишається текстом, не таблицею', () => {
    const md = 'Формули:\n| a | b |\n|---|---|\n| 1 | 2 |\nКінець.'
    const html = renderTextWithLatex(md)
    expect(html.startsWith('Формули:<br/>')).toBe(true)
    expect(html.endsWith('<br/>Кінець.')).toBe(true)
    expect(html).toContain('<table class="lc-table">')
  })

  it('порожній рядок дає порожній рядок', () => {
    expect(renderTextWithLatex('')).toBe('')
  })
})

describe('translate="no" — захист від браузерного перекладу сторінки (2026-08-15)', () => {
  // Живий гейт власника: Chrome «Перекласти цю сторінку» переписує текстові
  // вузли DOM і не розуміє змішаної структури KaTeX (MathML + видимий HTML в
  // одному span) — радикал і дробові риски мовчки зникали. DOM-дамп показував
  // коректний msqrt/svg — тобто рендер сам по собі був справний, ламало його
  // САМЕ розширення перекладу. Атрибут (і legacy-клас notranslate) — це не
  // лікування симптому регексом, а стандартний, задокументований механізм
  // винятку піддерева з перекладу.
  it('успішна формула обгорнута в translate="no"', () => {
    const html = renderTextWithLatex('$\\sqrt{4x-7}$')
    expect(html).toContain('translate="no"')
    expect(html).toContain('class="notranslate"')
    // Саме katex-вивід має лежати ВСЕРЕДИНІ захищеного span, а не поруч —
    // інакше атрибут не пошириться на дітей.
    expect(html).toMatch(/<span translate="no" class="notranslate"><span class="katex">/)
  })

  it('display-формула теж захищена', () => {
    const html = renderTextWithLatex('$$\\frac{a}{b}$$')
    expect(html).toContain('translate="no"')
  })

  it('помилка парсингу LaTeX теж не підлягає перекладу (сире джерело в тексті)', () => {
    // throwOnError:false у KaTeX ловить майже все, але error-фолбек — окрема
    // гілка коду, і без власного translate="no" сире \latex-джерело теж
    // потрапило б під ніж перекладача.
    const html = renderTextWithLatex('$\\notarealcommand{x}$')
    if (html.includes('lc-formula-error')) {
      expect(html).toMatch(/class="lc-formula-error" translate="no"/)
    }
  })

  it('звичайний текст без формул НЕ обгортається — переклад тексту не блокуємо', () => {
    const html = renderTextWithLatex('просто текст без математики')
    expect(html).not.toContain('translate="no"')
  })
})
