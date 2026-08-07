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
