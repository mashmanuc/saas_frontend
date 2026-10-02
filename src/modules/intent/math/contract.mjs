/**
 * Контракт нового матеріалу Інтегралика, v1.
 * Канонічна копія: backend/math_content/contract.mjs.
 * Копії BE/FE звіряє contract-parity.test.mjs. Жодного ремонту LaTeX.
 */
import katex from 'katex'

export const VERSION = 1
export const KATEX_VERSION = '0.16.33'
export class MathContentError extends Error {
  constructor(code, path = '') {
    super('Не додано: математичний запис не пройшов перевірку. Спробуйте сформулювати запит ще раз.')
    this.name = 'MathContentError'
    this.code = code
    this.path = path
  }
}
const fail = (code, path) => { throw new MathContentError(code, path) }
const escape = (s) => s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]))

export function renderFormula(latex, display = false, path = '') {
  if (katex.version !== KATEX_VERSION) fail('engine_version', path)
  if (typeof latex !== 'string' || !latex.trim() || latex.length > 4000) fail('formula_size', path)
  if (/[\u0000-\u0009\u000b-\u001f\u007f]/.test(latex)) fail('control_character', path)
  try {
    const options = {
      displayMode: display, throwOnError: true, output: 'htmlAndMathml',
      strict: (code) => code === 'unicodeTextInMathMode' || code === 'unknownSymbol' ? 'ignore' : 'error',
      trust: () => { fail('untrusted_command', path) },
      maxExpand: 200, maxSize: 20, macros: {},
    }
    // Вузол cr поза масивом — окремий перенос, а не команда \frac.
    // Масиви/cases/substack KaTeX уже розібрав на рядки; їхні \\ не чіпаємо.
    // Це контракт обмеженого діалекту, НЕ виправлення. Версія рушія зафіксована.
    const inspect = (node) => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'cr' && /\\\\[A-Za-z]/.test(latex)) fail('ambiguous_linebreak', path)
      for (const [key, child] of Object.entries(node)) {
        if (key !== 'loc') {
          if (Array.isArray(child)) child.forEach(inspect)
          else if (child && typeof child === 'object') inspect(child)
        }
      }
    }
    katex.__parse(latex, options).forEach(inspect)
    const html = katex.renderToString(latex, options)
    if (/class="katex-error"/.test(html)) fail('render_error', path)
    return html
  } catch (e) {
    if (e instanceof MathContentError) throw e
    fail('latex_parse', path)
  }
}

/** Детермінований адаптер рядка: розділювачі розбираємо, вміст НЕ змінюємо. */
export function documentFromSource(source, formula = false, path = '') {
  if (typeof source !== 'string' || source.length > 12000) fail('source_size', path)
  if (/[\u0000-\u0008\u000b-\u001f\u007f]/.test(source)) fail('control_character', path)
  if (formula) {
    renderFormula(source, true, path)
    return { version: VERSION, source, nodes: [{ type: 'math', latex: source, display: true }] }
  }
  const nodes = []
  let text = '', i = 0
  const flush = () => { if (text) { nodes.push({ type: 'text', text }); text = '' } }
  while (i < source.length) {
    if (source.startsWith('\\$', i) || source.startsWith('\\%', i)) {
      text += source.slice(i, i + 2); i += 2; continue
    }
    if (source[i] === '$' && /\d/.test(source[i - 1] || '') && !source.includes('$', i + 1)) {
      text += source[i++]; continue
    }
    const open = ['$$', '\\(', '\\[', '$'].find((s) => source.startsWith(s, i))
    if (!open) {
      if (source[i] === '\\') fail('math_outside_delimiters', path)
      text += source[i++]
      continue
    }
    flush()
    const close = ({ '$$':'$$', '$':'$', '\\(':'\\)', '\\[':'\\]' })[open]
    const start = i + open.length
    i = start
    while (i < source.length) {
      if (source[i] === '\\' && !source.startsWith(close, i)) { i += 2; continue }
      if (source.startsWith(close, i)) break
      i++
    }
    if (i >= source.length) fail('unclosed_math', path)
    const latex = source.slice(start, i)
    const display = open === '$$' || open === '\\['
    renderFormula(latex, display, path)
    nodes.push({ type: 'math', latex, display })
    if (nodes.length > 128) fail('node_limit', path)
    i += close.length
  }
  flush()
  return { version: VERSION, source, nodes }
}

// Зміст вузла без порядку ключів: дошка зберігає дані в Postgres JSONB, а він повертає ключі
// об'єкта у власному порядку ({type, text} → {text, type}; прод/стенд 2026-10-02). Побайтове
// порівняння JSON відхиляло б кожну збережену картку після першого ж перезавантаження.
const canonicalNodes = (nodes) => (Array.isArray(nodes) ? nodes : [null]).map((n) => {
  if (n?.type === 'math') return ['math', n.latex, n.display === true]
  if (n?.type === 'text') return ['text', n.text]
  return ['unknown', n?.type ?? null]
})

/** Перевірка документа включає відповідність джерелу: не довіряємо прапорцю valid. */
export function verifyDocument(doc, source, formula = false, path = '') {
  if (doc?.version !== VERSION || doc.source !== source) fail('document_version_or_source', path)
  const expected = documentFromSource(source, formula, path)
  if (JSON.stringify(canonicalNodes(doc.nodes)) !== JSON.stringify(canonicalNodes(expected.nodes))) {
    fail('document_mismatch', path)
  }
  return expected
}

export function renderDocument(doc, source, formula = false) {
  const checked = verifyDocument(doc, source, formula)
  const math = []
  // Тимчасові маркери неможливі у джерелі (control_character).
  const text = checked.nodes.map((n) => {
    if (n.type === 'text') return escape(n.text)
    math.push(renderFormula(n.latex, n.display))
    return '\u0001' + (math.length - 1) + '\u0002'
  }).join('')
  const inline = (s) => s.replace(/\\([%$])/g, '$1').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  const lines = text.split('\n')
  const rendered = []
  for (let i = 0; i < lines.length; i++) {
    const cells = (s) => s.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((v) => v.trim())
    const isTable = lines[i].trim().startsWith('|') && i + 1 < lines.length
      && cells(lines[i + 1]).every((c) => /^:?-{3,}:?$/.test(c))
    if (isTable) {
      const row = (s, tag) => '<tr>' + cells(s).map((c) => '<' + tag + '>' + inline(c) + '</' + tag + '>').join('') + '</tr>'
      let table = '<table><thead>' + row(lines[i], 'th') + '</thead><tbody>'
      i += 2
      while (i < lines.length && lines[i].trim().startsWith('|')) table += row(lines[i++], 'td')
      i--
      rendered.push(table + '</tbody></table>')
    } else rendered.push(inline(lines[i]))
  }
  // Математичний HTML підставляємо ОСТАННІМ: Markdown не торкається KaTeX/SVG.
  return rendered.join('<br>').replace(/\u0001(\d+)\u0002/g, (_, i) => math[Number(i)])
}

/** Повний preflight: повертає копії дій; жодних записів або часткового результату. */
export function prepareActions(actions) {
  if (!Array.isArray(actions) || actions.length > 40) fail('action_limit')
  let count = 0
  return actions.map((action, index) => {
    const a = { ...action, payload: { ...(action.payload || {}) } }
    const p = a.payload
    // Межа операції дошки (64 КБ) стосується того, що несе документ нового матеріалу; дії без
    // математики сервер у Node не шле — фронт не має відхиляти їх за розміром сам.
    let mathPayload = true
    const attach = (obj, specs) => {
      const fields = {}
      for (const [key, limit, formula] of specs) {
        if (obj[key] === undefined || obj[key] === null) continue
        const value = obj[key]
        if (typeof value !== 'string' || value.length > limit) fail('field_size', index + '.' + key)
        const doc = documentFromSource(value, formula, index + '.' + key)
        count += doc.nodes.filter((n) => n.type === 'math').length
        if (count > 100) fail('formula_count')
        if (obj.math_content) verifyDocument(obj.math_content.fields?.[key], value, formula)
        fields[key] = doc
      }
      if (obj.math_content && obj.math_content.version !== VERSION) fail('contract_version')
      obj.math_content = { version: VERSION, fields }
    }
    if (a.kind === 'add_card' || a.kind === 'update_card') attach(p, [['title',120],['body',12000]])
    else if (a.kind === 'add_formula') attach(p, [['latex',4000,true]])
    else if (a.kind === 'set_param' && p.type === 'formula') attach(p, [['value',4000,true]])
    else if (a.kind === 'add_page' && p.card) {
      p.card = { ...p.card }
      attach(p.card, [['title',120],['body',12000]])
    } else if (a.kind === 'add_text') {
      const doc = documentFromSource(p.text, false, index + '.text')
      // Текстовий штрих не вміє KaTeX. Відмова, а не сирі команди на полотні.
      if (doc.nodes.some((n) => n.type === 'math')) fail('math_requires_card')
    } else {
      mathPayload = false
      // Поверхня без нового math-рендера не може бути обхідним шляхом.
      const checkPlain = (value, depth = 0) => {
        if (depth > 12) fail('depth')
        if (!value || typeof value !== 'object') return
        for (const [key, child] of Object.entries(value)) {
          if (['body','title','text','caption','label','description','summary','latex','formula'].includes(key)
              && typeof child === 'string') {
            const doc = documentFromSource(child, key === 'latex' || key === 'formula')
            if (doc.nodes.some((n) => n.type === 'math')) fail('math_requires_card')
          } else if (child && typeof child === 'object') checkPlain(child, depth + 1)
        }
      }
      checkPlain(p)
    }
    if (mathPayload && new TextEncoder().encode(JSON.stringify(p)).byteLength > 48 * 1024) {
      fail('operation_size', String(index))
    }
    return a
  })
}

/** Перевірка сирих slots ДО резолверів, які історично обрізали рядки. */
export function validateSlots(value, depth = 0, path = '') {
  if (depth > 12) fail('depth', path)
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === '_invalid_json') fail('invalid_json', path)
      if (['body','title','text','latex'].includes(key) && typeof child === 'string') {
        const max = key === 'title' ? 120 : key === 'latex' ? 4000 : 12000
        if (child.length > max) fail('field_size', path + '.' + key)
        const doc = documentFromSource(child, key === 'latex', path + '.' + key)
        if (key === 'text' && doc.nodes.some((n) => n.type === 'math')) fail('math_requires_card', path + '.' + key)
      } else if (child && typeof child === 'object') validateSlots(child, depth + 1, path + '.' + key)
    }
  }
}
