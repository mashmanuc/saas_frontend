/**
 * Контракт нового матеріалу Інтегралика, v1.
 * Канонічна копія: backend/math_content/contract.mjs.
 * Копії BE/FE звіряє `node math_content/check-parity.mjs <FE-копія>`.
 * Вгадування немає: відновлюється лише однозначне за правилом формул M4SH (`normalizeSource`).
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
    // Правило формул M4SH (власник 2026-10-02): перенос рядка — лише всередині багаторядкових
    // блоків. Їхні `\\` KaTeX розбирає на рядки масиву (вузла cr немає); вузол cr — це перенос
    // поза блоком, тобто заборонений. Версія рушія зафіксована.
    const inspect = (node) => {
      if (!node || typeof node !== 'object') return
      if (node.type === 'cr') fail('standalone_linebreak', path)
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

// ── Правило формул M4SH (власник 2026-10-02: «роби») ───────────────────────────────────────────
// Перенос рядка `\\` — лише всередині багаторядкових блоків (cases, aligned, gathered, split, pmatrix,
// array…); перенос `\\` поза блоком і Enter у формулі — заборонені. За цим правилом наступне
// ОДНОЗНАЧНЕ, тож відновлюється до перевірки, і кожне відновлення йде в журнал (`fixes`):
//  • JSON прочитав одинарний бекслеш як керуючий символ: \b, \f — завжди (у тексті їх не буває);
//    \t, \r — коли разом із літерами далі дають команду KaTeX (\times, \right); інакше табуляція —
//    пробіл, CR перед LF — кінець рядка, решта CR — новий рядок;
//  • у формулі: Enter + літери, що з `n` дають команду KaTeX (\neq, \nu, \nabla) — з'їдений `\n`;
//    решта Enter у формулі — пробіл (для TeX це і є пробіл);
//  • у формулі поза блоком: `\\` + назва команди (≥2 літери) — подвоєний бекслеш; `\\begin{` і
//    `\\end{` — завжди; якщо так подвоєно блок, то й `\\назва` та `\\\\` у ньому — подвоєння;
//  • у тексті поза формулою: парні `\\(`…`\\)`, `\\[`…`\\]` — подвоєні розділювачі; решта `\\` —
//    новий рядок (як `.\\` в кінці рядків картки з прода 2026-10-01);
//  • подвоєний у JSON перенос рядка — буквальні «бекслеш + n» (стенд 02.10, похідна складеної функції):
//    у тексті, якщо з літерами далі це не команда KaTeX, — новий рядок (команд поза формулою не буває);
//    у формулі — лише коли далі не літера: пробіл.
// Решту НЕ вгадуємо: що й після цього не проходить KaTeX — відмова й одна повторна генерація.
const commandCache = new Map()

/** Чи є `\name` командою KaTeX у формулі. Вирішує сам рушій, а не список, складений руками. */
export function isMathCommand(name) {
  if (!/^[A-Za-z]+$/.test(name || '')) return false
  if (commandCache.has(name)) return commandCache.get(name)
  let known = true
  try {
    katex.__parse('\\' + name + '{x}{y}', { throwOnError: true, strict: 'ignore', maxExpand: 50, macros: {} })
  } catch (e) {
    known = !/Undefined control sequence/.test(String(e?.message || ''))
  }
  commandCache.set(name, known)
  return known
}

const lettersAt = (s, i) => {
  let j = i
  while (j < s.length && /[A-Za-z]/.test(s[j])) j++
  return s.slice(i, j)
}

function restoreJsonControls(s, fixes) {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\b' || c === '\f') {
      out += c === '\b' ? '\\b' : '\\f'
      fixes.push('json_control')
    } else if (c === '\t' || c === '\r') {
      const letter = c === '\t' ? 't' : 'r'
      const run = lettersAt(s, i + 1)
      if (run && isMathCommand(letter + run)) {
        out += '\\' + letter
        fixes.push('json_control')
      } else if (c === '\t') out += ' '
      else if (s[i + 1] !== '\n') out += '\n'
    } else out += c
  }
  return out
}

function normalizeMath(latex, fixes) {
  let doubled = false
  const s = latex.replace(/(^|[^\\])\\\\(begin|end)\{/g, (_, pre, word) => {
    doubled = true
    fixes.push('double_backslash_command')
    return pre + '\\' + word + '{'
  })
  let out = ''
  let depth = 0
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (c === '\n') {
      const run = lettersAt(s, i + 1)
      if (run && isMathCommand('n' + run)) {
        out += '\\n' + run
        fixes.push('json_newline_command')
        i += 1 + run.length
      } else {
        out += ' '
        i += 1
      }
      continue
    }
    if (c !== '\\') { out += c; i += 1; continue }
    let k = 0
    while (s[i + k] === '\\') k++
    if (k === 1) {
      const name = lettersAt(s, i + 1)
      if (name === 'n') {
        out += ' '
        fixes.push('escaped_newline')
        i += 2
        continue
      }
      if (name === 'begin') depth++
      else if (name === 'end') depth = Math.max(0, depth - 1)
      const len = name ? 1 + name.length : 2
      out += s.slice(i, i + len)
      i += len
      continue
    }
    if (k === 2) {
      const name = lettersAt(s, i + 2)
      if (name.length >= 2 && (depth === 0 || doubled) && isMathCommand(name)) {
        out += '\\' + name
        fixes.push('double_backslash_command')
        i += 2 + name.length
        continue
      }
    }
    if (k === 4 && depth > 0 && doubled) {
      out += '\\\\'
      fixes.push('double_backslash_command')
      i += 4
      continue
    }
    out += s.slice(i, i + k)
    i += k
  }
  return out
}

function normalizeText(s, fixes) {
  let out = ''
  let i = 0
  while (i < s.length) {
    if (s.startsWith('\\$', i) || s.startsWith('\\%', i)) { out += s.slice(i, i + 2); i += 2; continue }
    if (s.startsWith('\\\\', i) && s[i + 2] !== '\\') {
      const next = s[i + 2]
      if (next === '(' || next === '[') {
        const end = s.indexOf(next === '(' ? '\\\\)' : '\\\\]', i + 3)
        if (end !== -1) {
          out += '\\' + next + normalizeMath(s.slice(i + 3, end), fixes) + '\\' + (next === '(' ? ')' : ']')
          fixes.push('double_backslash_delimiters')
          i = end + 3
          continue
        }
      }
      let j = i + 2
      while (s[j] === ' ' || s[j] === '\t') j++
      if (j < s.length && s[j] !== '\n') out += '\n'
      fixes.push('text_linebreak')
      i = j
      continue
    }
    if (s[i] === '\\' && s[i + 1] === 'n' && !isMathCommand(lettersAt(s, i + 1))) {
      out += '\n'
      fixes.push('escaped_newline')
      i += 2
      continue
    }
    if (s[i] === '$' && /\d/.test(s[i - 1] || '') && !s.includes('$', i + 1)) { out += '$'; i += 1; continue }
    const open = ['$$', '\\(', '\\[', '$'].find((t) => s.startsWith(t, i))
    if (!open) { out += s[i]; i += 1; continue }
    const close = ({ '$$': '$$', '$': '$', '\\(': '\\)', '\\[': '\\]' })[open]
    const start = i + open.length
    let j = start
    while (j < s.length) {
      if (s[j] === '\\' && !s.startsWith(close, j)) { j += 2; continue }
      if (s.startsWith(close, j)) break
      j++
    }
    if (j >= s.length) { out += s.slice(i); break }   // незакрита — вирішить перевірка
    out += open + normalizeMath(s.slice(start, j), fixes) + close
    i = j + close.length
  }
  return out
}

/** Правило формул M4SH → { text, fixes }. Ідемпотентне: вже нормалізований текст не змінюється. */
export function normalizeSource(source, formula = false) {
  const fixes = []
  if (typeof source !== 'string') return { text: source, fixes }
  const restored = restoreJsonControls(source, fixes)
  return { text: formula ? normalizeMath(restored, fixes) : normalizeText(restored, fixes), fixes }
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

/**
 * Повний preflight: повертає копії дій; жодних записів або часткового результату.
 * `fixes` — журнал відновлень за правилом формул ({ code, path }), щоб бачити, як часто модель так помиляється.
 */
export function prepareActions(actions, fixes = []) {
  if (!Array.isArray(actions) || actions.length > 40) fail('action_limit')
  let count = 0
  const normalized = (value, formula, path) => {
    if (typeof value !== 'string') return value
    const result = normalizeSource(value, formula)
    for (const code of result.fixes) fixes.push({ code, path })
    return result.text
  }
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
        const value = normalized(obj[key], formula, index + '.' + key)
        obj[key] = value
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
      p.text = normalized(p.text, false, index + '.text')
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

/**
 * Сирі slots ДО резолверів, які історично обрізали рядки: правило формул M4SH, потім перевірка.
 * Повертає нормалізовану копію — саме її бачать резолвери; `fixes` — журнал відновлень.
 */
export function prepareSlots(value, fixes = [], depth = 0, path = '') {
  if (depth > 12) fail('depth', path)
  if (Array.isArray(value)) return value.map((child, i) => prepareSlots(child, fixes, depth + 1, path + '.' + i))
  if (!value || typeof value !== 'object') return value
  const out = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === '_invalid_json') fail('invalid_json', path)
    if (['body', 'title', 'text', 'latex'].includes(key) && typeof child === 'string') {
      const max = key === 'title' ? 120 : key === 'latex' ? 4000 : 12000
      const result = normalizeSource(child, key === 'latex')
      for (const code of result.fixes) fixes.push({ code, path: path + '.' + key })
      if (result.text.length > max) fail('field_size', path + '.' + key)
      const doc = documentFromSource(result.text, key === 'latex', path + '.' + key)
      if (key === 'text' && doc.nodes.some((n) => n.type === 'math')) fail('math_requires_card', path + '.' + key)
      out[key] = result.text
    } else out[key] = child && typeof child === 'object' ? prepareSlots(child, fixes, depth + 1, path + '.' + key) : child
  }
  return out
}

/** Лише перевірка (без повернення значення) — для сумісності з наявними викликами. */
export function validateSlots(value) {
  prepareSlots(value)
}
