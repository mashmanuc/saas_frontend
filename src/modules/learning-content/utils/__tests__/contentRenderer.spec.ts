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

describe('радикал √ — svg-контур не можна різати рядковою обробкою (2026-08-15)', () => {
  // Живий гейт власника: корінь зникав з умов задач тиждень (з 2026-08-07,
  // коли додали markdown-таблиці). DOM був бездоганний — svg, path, шрифт,
  // геометрія; пікселів не було. Причина: KaTeX кладе `\n` УСЕРЕДИНІ
  // атрибута d="…" svg-радикала (єдиний багаторядковий path у KaTeX), а
  // renderMarkdownTables робить split('\n')→join('<br/>') по вже склеєному
  // html — і <br/> опинявся посеред контуру. Невалідний d браузер малює
  // порожньо, без жодної помилки. Тест стереже саме цей клас поломки — не
  // «є svg», а «svg-атрибут цілий».
  it('усередині <svg …>…</svg> немає жодного <br/>', () => {
    const html = renderTextWithLatex('Обчислити $y=\\sqrt{4x-7}$ у точці $x=2$.')
    const svgs = html.match(/<svg[\s\S]*?<\/svg>/g) || []
    expect(svgs.length, 'радикал має svg-контур').toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg, 'у svg-контурі радикала <br/> = невалідний path = порожній корінь')
        .not.toContain('<br/>')
    }
  })

  it('атрибут d контуру — валідний path без розмітки всередині', () => {
    const html = renderTextWithLatex('$\\sqrt{2}$')
    const d = html.match(/<path d="([^"]*)"/)?.[1] ?? ''
    expect(d.length).toBeGreaterThan(50)
    expect(d).not.toMatch(/<|>|\n/)
  })

  it('переноси у ТЕКСТІ навколо формул і далі стають <br/> — таблиці/абзаци не зламані', () => {
    const html = renderTextWithLatex('рядок 1 $\\sqrt{x}$\nрядок 2')
    expect(html).toContain('рядок 1')
    expect(html).toContain('<br/>рядок 2')
    // і при цьому радикал між ними цілий
    expect(html.match(/<svg[\s\S]*?<\/svg>/)?.[0]).not.toContain('<br/>')
  })

  it('display-радикал ($$…$$) теж цілий', () => {
    const html = renderTextWithLatex('$$\\sqrt{a+b}$$')
    expect(html.match(/<svg[\s\S]*?<\/svg>/)?.[0]).not.toContain('<br/>')
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

describe('жирний, що охоплює формулу', () => {
  it('пара ** навколо $...$ збирається у <strong>, а не лишає зірочки', () => {
    // саме те, що бачив учень у П4: «**Друге число — це ціле, воно і є $100\%$.**»
    const html = renderTextWithLatex('**Ціле — це $100\%$ величини.** Далі текст.')
    expect(html).not.toContain('**')
    expect(html).toContain('<strong>')
    expect(html).toContain('</strong>')
  })

  it('жирний усередині одного шматка теж працює — старий випадок не зламано', () => {
    const html = renderTextWithLatex('це **важливо** знати')
    expect(html).toContain('<strong>важливо</strong>')
  })

  it('позначки не витікають у вивід, якщо пари немає', () => {
    const html = renderTextWithLatex('одна ** зірочка і $x$')
    expect(html).not.toMatch(/[]/)
  })
})
