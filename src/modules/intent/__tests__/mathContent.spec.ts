import { describe, it, expect } from 'vitest'
import { documentFromSource, renderDocument, prepareActions, validateSlots, MathContentError } from '../math/contract.mjs'
import { renderMathField } from '../math/renderMathContent'

const good = [
  String.raw`\frac{-b\pm\sqrt{b^2-4ac}}{2a}`,
  String.raw`\begin{pmatrix}a\\b\end{pmatrix}`,
  String.raw`\begin{cases}x+y=2\\x-y=0\end{cases}`,
  String.raw`\begin{aligned}a&=b\\c&=d\end{aligned}`,
  String.raw`\sin^2 x+\cos^2 x=1`, String.raw`\text{±}`,
  String.raw`\sqrt{\frac{1}{2}}`, String.raw`\left|x\right|`,
  String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`, '2+2=5',
]
describe('незмінність правильного LaTeX', () => {
  it.each(good)('%s', (latex) => {
    const doc = documentFromSource(latex, true)
    expect(doc.nodes[0].latex).toBe(latex)
    expect(doc.source).toBe(latex)
    expect(renderDocument(doc, latex, true)).toContain('class="katex"')
  })
  it('переноси матриці лишаються двома бекслешами після JSON і повторного preflight', () => {
    const actions = [{ kind:'add_card', payload: { body: '$$' + good[1] + '$$' } }]
    const first = prepareActions(actions)
    expect(prepareActions(JSON.parse(JSON.stringify(first)))).toEqual(first)
    expect(actions[0].payload).not.toHaveProperty('math_content')
  })
})
describe('відмова замість ремонту', () => {
  it.each([
    String.raw`$\frac{-b\begin{pmatrix}\text{±}\sqrt{D}}{2a}$`,
    String.raw`$\frac{1}{$`, String.raw`$x`, String.raw`\(x`,
    String.raw`\\(\\frac{6}{8}\\)`, 'Крок один.\\',
    '$\frac{6}{8}$', String.raw`$\unknowncommand{x}$`,
    String.raw`$\htmlClass{evil}{x}$`, String.raw`$\href{https://example.com}{x}$`,
    String.raw`$\def\a{\a}\a$`, String.raw`$x$$`,
  ])('%s', (body) => expect(() => documentFromSource(body)).toThrow(MathContentError))
  it('план відхиляється цілим, навіть якщо зламана лише третя дія', () => {
    const actions = [
      { kind:'add_page', payload:{} },
      { kind:'add_card', payload:{body:'Готово $x=1$'} },
      { kind:'add_formula', payload:{latex:String.raw`\frac{1}{`} },
    ]
    expect(() => prepareActions(actions)).toThrow()
    expect(actions[1].payload).not.toHaveProperty('math_content')
  })
  it('вкладена картка нової сторінки перевіряється', () => {
    expect(() => prepareActions([{kind:'add_page',payload:{card:{body:'$x'}}}])).toThrow()
  })
  it('оновлення формули і картки перевіряються', () => {
    expect(() => prepareActions([{kind:'set_param',payload:{type:'formula',value:String.raw`\frac{`}}])).toThrow()
    expect(() => prepareActions([{kind:'update_card',payload:{body:'$x'}}])).toThrow()
  })
  it('сирі команди не можна сховати в текстовий штрих', () => {
    expect(() => prepareActions([{kind:'add_text',payload:{text:'$x$'}}])).toThrow()
  })
  it('не обрізає довгу правильну формулу до 500 символів', () => {
    const latex = 'x+'.repeat(300) + '1'
    const a = prepareActions([{kind:'add_formula',payload:{latex}}])[0]
    expect(a.payload.latex).toBe(latex)
  })
  it('надмірний вміст відхиляє, а не обрізає', () => {
    expect(() => validateSlots({body:'a'.repeat(12001)})).toThrow()
  })
  it('подвоєна команда не стає текстом frac; справжні рядки substack працюють', () => {
    expect(() => documentFromSource('$' + '\\\\frac{6}{8}' + '$')).toThrow()
    const source = '\\substack{a\\\\b}'
    expect(renderDocument(documentFromSource(source, true), source, true)).toContain('katex')
  })
  it('підроблений документ не обходить перевірку', () => {
    const a = prepareActions([{kind:'add_card',payload:{body:'$x$'}}])
    a[0].payload.math_content.fields.body.nodes[0].latex = 'y'
    expect(() => prepareActions(a)).toThrow()
  })
})
describe('рендер нового формату', () => {
  it('ручне редагування нової картки лишається у строгому рендері', () => {
    const p = prepareActions([{kind:'add_card',payload:{body:'$x$'}}])[0].payload
    p.body = '$y$'
    expect(renderMathField(p,'body',p.body)).toContain('class="katex"')
    expect(p.math_content.fields.body.source).toBe('$x$')
  })
  it('зламана ручна правка вчителя — його текст старим рендером, а не загальна помилка', () => {
    const p = prepareActions([{ kind: 'add_card', payload: { body: '$x$' } }])[0].payload
    p.body = 'Площа $S'
    const html = renderMathField(p, 'body', p.body)
    expect(html).toContain('Площа')
    expect(html).not.toContain('не вдалося відобразити')
  })
  it('після збереження в Postgres JSONB (ключі в іншому порядку) — той самий строгий рендер', () => {
    const p = prepareActions([{ kind: 'add_card', payload: { title: 'Корені', body: 'Маємо $x^2=4$, тож $x=\\pm 2$.' } }])[0].payload
    // JSONB: ключі об'єкта коротші — першими, рівні — за байтами ({type, text} → {text, type}).
    const jsonb = (v: any): any => Array.isArray(v) ? v.map(jsonb) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : 1)).map((k) => [k, jsonb(v[k])]))
      : v
    const stored = jsonb(JSON.parse(JSON.stringify(p)))
    expect(Object.keys(stored.math_content.fields.body.nodes[0])).toEqual(['text', 'type'])
    const html = renderMathField(stored, 'body', stored.body)
    expect(html).toContain('class="katex"')
    expect(html).not.toContain('не вдалося відобразити')
  })
  it('незмінений матеріал, що не збігся зі своїм документом, — не рендеримо', () => {
    const p = prepareActions([{ kind: 'add_card', payload: { body: '$x$' } }])[0].payload
    p.math_content.fields.body.nodes = [{ type: 'text', text: '$x$' }]
    expect(renderMathField(p, 'body', p.body)).toContain('не вдалося відобразити')
  })
  it('таблиця з формулою, вертикальними рисками і SVG не переписує математику', () => {
    const body = '| Вираз | Значення |\n| --- | --- |\n| $\\left|x\\right|$ | $\\sqrt{x}$ |'
    const html = renderDocument(documentFromSource(body), body)
    expect(html).toContain('<table>')
    expect(html).toContain('<svg')
    expect(html).not.toContain('katex-error')
    expect(html.match(/<td>/g)).toHaveLength(2)
  })
  it('HTML у тексті не виконується', () => {
    const body = '<img src=x onerror=alert(1)> $x$'
    expect(renderDocument(documentFromSource(body), body)).toContain('&lt;img')
  })
  it('старий матеріал не має нового поля і не переписується', () => {
    const old = {body:'Звичайний текст'}
    expect(renderMathField(old,'body',old.body)).toBe('Звичайний текст')
    expect(old).toEqual({body:'Звичайний текст'})
  })
  it('атрибуцію можна винести, не змінюючи збережений текст', () => {
    const body = '$x$.\nДжерело: Вікіпедія'
    const p = prepareActions([{kind:'add_card',payload:{body}}])[0].payload
    expect(renderMathField(p,'body','$x$.')).toContain('class="katex"')
    expect(p.body).toBe(body)
  })
  it('JSON reload/replay зберігає документ та ідентичний рендер', () => {
    const p = prepareActions([{kind:'add_card',payload:{body:'Корені $x=1$'}}])[0].payload
    const clone = JSON.parse(JSON.stringify(p))
    expect(renderMathField(clone,'body',clone.body)).toBe(renderMathField(p,'body',p.body))
  })
})
