import katex from 'katex'
import {
  toKatexCompatible,
  normalizeSourceText,
  cleanTextSegment,
  splitBareMathEnvironments,
  looksLikeProse,
} from '@/utils/katexCompat'
// KaTeX CSS (KaTeX_Math + KaTeX_Main fonts, positioning rules) — required
// for `output: 'htmlAndMathml'` mode. Was unimported у `output: 'mathml'` only
// mode (native browser MathML rendering didn't need it). Switched 2026-05-25
// PR-2 fix-up so html2canvas export can capture the visible HTML branch —
// it cannot render <math> elements. MathML stays present for screen readers.
import 'katex/dist/katex.min.css'
import type { ContentItemDetail } from '../types/learningContent'
import {
  isProblem,
  isTheory,
  isTest,
  type ProblemContent,
  type TheoryContent,
  type TestContent,
} from '../schemas/contentSchemas'

// ── LaTeX segment parsing ─────────────────────────────────────
interface TextSegment {
  type: 'text'
  value: string
}
interface InlineLatex {
  type: 'inline'
  value: string
}
interface DisplayLatex {
  type: 'display'
  value: string
}
type Segment = TextSegment | InlineLatex | DisplayLatex

export function parseLatexSegments(rawText: string): Segment[] {
  // Шар 1: те, що створює межі формул — літеральний `\n`, роздільники
  // `\(…\)` і `\[…\]`, непарний `$`. Мусить відпрацювати ДО сегментації,
  // інакше сегментер просто не побачить формулу.
  const text = normalizeSourceText(rawText)
  const segments: Segment[] = []
  // ⚠️ `[^$]` замість `[^$\n]`: клас F виміру — 10 входжень, де модель
  // ставить `$` на ВЛАСНОМУ рядку навколо формули (у справжньому LaTeX
  // так пишуть постійно). Стара межа по `\n` таких блоків не бачила, і
  // формула йшла в текст сирою. Верхня межа довжини — щоб самотній `$`
  // у тексті не проковтнув документ до наступного долара.
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$]{1,800}?\$)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const raw = match[0]
    const isDisplay = raw.startsWith('$$')
    const inner = (isDisplay ? raw.slice(2, -2) : raw.slice(1, -1)).trim()

    // 🔴 Проза, випадково загорнута в долари, — це ТЕКСТ, а не формула.
    // KaTeX інакше малює кожну літеру як окрему змінну: слово
    // «перевищувала» стає добутком тринадцяти множників, курсивом і з
    // інтервалами. Помилки при цьому немає ніде — саме тому дефект і живе
    // довго. 66 таких сегментів із 98 381 у банку.
    if (looksLikeProse(inner)) {
      segments.push({ type: 'text', value: inner })
    } else if (isDisplay) {
      segments.push({ type: 'display', value: inner })
    } else {
      segments.push({ type: 'inline', value: inner })
    }
    lastIndex = match.index + raw.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

// ── KaTeX → htmlAndMathml string ─────────────────────────────
// `htmlAndMathml` emits BOTH:
//   - visible HTML+CSS (uses KaTeX_Math/Main fonts from katex.min.css)
//   - hidden MathML inside .katex-mathml (for screen readers)
// Rationale (PR-2 fix-up 2026-05-25): html2canvas-based PDF export cannot
// render <math> elements at all. With pure 'mathml' mode, exported PDFs
// missed every formula. htmlAndMathml: visible HTML is captured, MathML
// stays for accessibility. Visual identity preserved.
//
// translate="no" (2026-08-15, живий гейт власника): браузерний переклад
// сторінки (Chrome «Перекласти цю сторінку») переписує текстові вузли DOM
// і не розуміє змішаної структури KaTeX (MathML + видимий HTML в одному
// span) — радикал і дробові риски мовчки зникали, лишаючи «4x-7» без
// оболонки, хоча власний DOM-дамп показував коректний msqrt/svg. Атрибут
// (і legacy-клас notranslate для старих версій рушія перекладу) виключає
// піддерево з переписування — стандартний, задокументований механізм,
// не хак під конкретний браузер.
function renderLatexToMathML(formula: string, displayMode: boolean): string {
  try {
    // ⚠️ `throwOnError: false` означає, що KaTeX на помилці НЕ кине виняток,
    // а намалює джерело червоним просто в потоці — саме так власник побачив
    // сирий egin{array} у розборі 2026-08-27. Тому несумісності треба
    // знімати ДО виклику: catch нижче на них не спрацьовує.
    const html = katex.renderToString(toKatexCompatible(formula), {
      output: 'htmlAndMathml',
      displayMode,
      throwOnError: false,
    })
    // ⚠️ Знімаємо переноси рядків з KaTeX-виводу. Живий гейт власника
    // 2026-08-15: радикал √ зникав з умов задач і карток на дошці, хоча DOM
    // був бездоганний (msqrt, svg, path, 63×20px, шрифт завантажений).
    // Причина: KaTeX кладе `\n` УСЕРЕДИНІ атрибута d="…" svg-контуру
    // радикала (єдиний багаторядковий path у KaTeX — тому ламався тільки
    // корінь; дроби — border, текст — гліфи), а `renderMarkdownTables`
    // нижче робить split('\n') → join('<br/>') по ВЖЕ склеєному html —
    // і <br/> опинявся посеред d="M95,702<br/>c-2.7…". Невалідний контур
    // браузер мовчки малює порожньо: жодної помилки, елемент є, пікселів
    // нема. Тиждень (з 2026-08-07, коли додали markdown-таблиці) корені
    // на дошці не малювались.
    //
    // Для HTML/SVG-атрибутів `\n` ≡ пробіл, тож заміна вигляд не змінює,
    // але робить KaTeX-вивід нечутливим до будь-якої порядкової обробки
    // після нього. Це межа шарів: усе, що виходить звідси, — атомарне.
    const flat = html.replace(/\r?\n/g, ' ')
    return `<span translate="no" class="notranslate">${flat}</span>`
  } catch {
    return `<span class="lc-formula-error" translate="no">${escapeHtml(formula)}</span>`
  }
}

// ── Render text line with embedded LaTeX → HTML string ────────
// Markdown-lite: **bold** і pipe-таблиці (`| a | b |` + роздільник `|---|---|`)
// — АІ (Інтегралик) генерує їх у body карток (board_add_card дозволяє
// таблиці, tooling.py), а без цього кроку вони йшли в escapeHtml як сирий
// текст із `|` і `**` (зловлено живим прогоном 2026-08-07).
// Позначки жирного, поставлені ДО розрізання на LaTeX-сегменти.
//
// Жирний застосовувався окремо в кожному текстовому шматку, а `**` пара,
// що охоплює формулу, потрапляла у два різні шматки — і не сходилась
// у жодному. Учень бачив голі зірочки: «**Друге число — це ціле, воно і
// є 100%.**» (П4, крок «Відсоткове відношення»). Зловлено живим
// прогоном; жоден із 15 тестів рендерера цього не бачив, бо всі
// перевіряли жирний і формулу ОКРЕМО.
//
// Символи керування U+0001/U+0002: у тексті занять їх не буває, вони не
// значущі ні для HTML-екранування, ні для KaTeX, тож доживають до
// складання і замінюються на теги в самому кінці.
const B_OPEN = '\u0001'
const B_CLOSE = '\u0002'

function markBold(text: string): string {
  return text.replace(/\*\*([\s\S]+?)\*\*/g, (_m, inner) => B_OPEN + inner + B_CLOSE)
}

export function renderTextWithLatex(text: string): string {
  if (!text) return ''
  const segments = parseLatexSegments(markBold(text))
  const combined = segments
    .map((seg) => {
      if (seg.type === 'text') {
        // Шар 2. Голі математичні середовища (`\begin{tabular}` зі стовпчиком,
        // `\begin{array}` без доларів) у справжньому LaTeX САМІ є display-
        // режимом, тож модель не ставить навколо них `$`. KaTeX так не вміє —
        // піднімаємо їх у формулу, решту шматка чистимо від документної
        // розмітки (`\par`, `\textbf`, `\item`…).
        return splitBareMathEnvironments(seg.value)
          .map((part) => (part.math
            ? `<div class="lc-display-math">${renderLatexToMathML(part.value, true)}</div>`
            : renderInlineMarkdown(cleanTextSegment(part.value))))
          .join('')
      }
      if (seg.type === 'inline') return renderLatexToMathML(seg.value, false)
      return `<div class="lc-display-math">${renderLatexToMathML(seg.value, true)}</div>`
    })
    .join('')
  return renderMarkdownTables(combined)
    .split(B_OPEN)
    .join('<strong>')
    .split(B_CLOSE)
    .join('</strong>')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
}

// Екранує HTML, БЕЗ переносу \n → <br/> (рядкова структура ще потрібна
// нижче для виявлення таблиць).
//
// Жирний тут більше НЕ обробляється: його позначки поставлені раніше,
// до розрізання на сегменти (див. `markBold`). Лишити тут і другий
// прохід означало б, що поведінка залежить від того, чи трапилась
// формула всередині — саме та різниця, через яку баг і виник.
function renderInlineMarkdown(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function isTableRow(line: string): boolean {
  return line.trim().includes('|')
}

// Роздільник заголовка `|---|:---:|---|` — лише `|`, `-`, `:`, пробіли,
// і хоч одне тире (інакше звичайний рядок із символом `|` теж пройшов би).
function isTableDelimiter(line: string): boolean {
  const t = line.trim()
  return /^\|?[\s:-]+\|[\s:|-]*\|?$/.test(t) && t.includes('-')
}

function splitTableRow(line: string): string[] {
  let t = line.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|')) t = t.slice(0, -1)
  return t.split('|').map((cell) => cell.trim())
}

// Рядкова обробка ПІСЛЯ вбудовування LaTeX/bold: групує послідовні
// `| … |` рядки з роздільником одразу під заголовком у `<table>`, решту
// з'єднує через `<br/>` — той самий ефект, що й старий escapeHtml(\n→<br/>).
function renderMarkdownTables(html: string): string {
  const lines = html.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (i + 1 < lines.length && isTableRow(lines[i]) && isTableDelimiter(lines[i + 1])) {
      const header = splitTableRow(lines[i])
      const rows: string[][] = []
      let j = i + 2
      while (j < lines.length && isTableRow(lines[j]) && !isTableDelimiter(lines[j])) {
        rows.push(splitTableRow(lines[j]))
        j++
      }
      const thead = `<tr>${header.map((c) => `<th>${c}</th>`).join('')}</tr>`
      const tbody = rows
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
        .join('')
      out.push(`<table class="lc-table"><thead>${thead}</thead><tbody>${tbody}</tbody></table>`)
      i = j
    } else {
      out.push(lines[i])
      i++
    }
  }
  return out.join('<br/>')
}

// ── HTML templates per content type ───────────────────────────
export function renderProblemHtml(content: ProblemContent, title: string): string {
  const statement = renderTextWithLatex(content.statement)
  const answer = content.answer
    ? `<div class="lc-answer">\u0412\u0456\u0434\u043f\u043e\u0432\u0456\u0434\u044c: ${renderTextWithLatex(content.answer)}</div>`
    : ''
  const hint = content.hint
    ? `<details class="lc-hint"><summary>\u041f\u0456\u0434\u043a\u0430\u0437\u043a\u0430</summary>${renderTextWithLatex(content.hint)}</details>`
    : ''
  return `
    <div class="lc-problem">
      <div class="lc-title">${escapeHtml(title)}</div>
      <div class="lc-statement">${statement}</div>
      ${hint}
      ${answer}
    </div>
  `
}

export function renderTheoryHtml(content: TheoryContent, title: string): string {
  const body = renderTextWithLatex(content.body)
  return `
    <div class="lc-theory">
      <div class="lc-title">${escapeHtml(title)}</div>
      <div class="lc-body">${body}</div>
    </div>
  `
}

export function renderTestHtml(content: TestContent, title: string): string {
  const options = content.options
    .map(
      (opt, i) =>
        `<div class="lc-option">${String.fromCharCode(65 + i)}. ${renderTextWithLatex(opt)}</div>`,
    )
    .join('')
  return `
    <div class="lc-test">
      <div class="lc-title">${escapeHtml(title)}</div>
      <div class="lc-question">${renderTextWithLatex(content.question)}</div>
      <div class="lc-options">${options}</div>
    </div>
  `
}

// ── SVG data URL renderer (no foreignObject — HTML→Blob→canvas) ─
// Strategy: render HTML+MathML → Blob → OffscreenCanvas → PNG data URL
// Fallback: plain SVG <text> elements if rendering fails

const RENDER_WIDTH = 480
const RENDER_HEIGHT = 400
const RENDER_PADDING = 16

const INLINE_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Georgia', serif; }
  body { width: ${RENDER_WIDTH}px; padding: ${RENDER_PADDING}px; background: white; color: #1a1a1a; }
  .lc-title { font-size: 14px; font-weight: 700; color: #374151; margin-bottom: 12px; border-bottom: 2px solid #4F46E5; padding-bottom: 6px; }
  .lc-statement, .lc-body, .lc-question { font-size: 13px; line-height: 1.6; margin-bottom: 10px; }
  .lc-answer { font-size: 12px; background: #f0fdf4; border-left: 3px solid #22c55e; padding: 6px 10px; margin-top: 8px; }
  .lc-hint { font-size: 12px; color: #6b7280; margin-top: 6px; }
  .lc-option { font-size: 12px; padding: 4px 0; }
  .lc-display-math { text-align: center; margin: 8px 0; }
  .lc-formula-error { color: #dc2626; font-family: monospace; }
  math { font-size: 1.1em; }
`

export async function renderContentToSvgDataUrl(item: ContentItemDetail): Promise<string> {
  const { type, title, content_json: content } = item

  let html = ''
  if (type === 'problem' && isProblem(content)) {
    html = renderProblemHtml(content, title)
  } else if (type === 'theory' && isTheory(content)) {
    html = renderTheoryHtml(content, title)
  } else if (type === 'test' && isTest(content)) {
    html = renderTestHtml(content, title)
  } else {
    html = `<div class="lc-generic"><strong>${escapeHtml(title)}</strong><p>\u0422\u0438\u043f: ${type}</p></div>`
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${INLINE_STYLES}</style>
</head>
<body>${html}</body>
</html>`

  const blob = new Blob([fullHtml], { type: 'text/html' })
  const htmlUrl = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = new OffscreenCanvas(RENDER_WIDTH + 20, RENDER_HEIGHT)
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(htmlUrl)
        canvas
          .convertToBlob({ type: 'image/png' })
          .then((pngBlob) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(pngBlob)
          })
          .catch(() => {
            resolve(buildFallbackSvgDataUrl(title, type))
          })
      } catch {
        URL.revokeObjectURL(htmlUrl)
        resolve(buildFallbackSvgDataUrl(title, type))
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(htmlUrl)
      resolve(buildFallbackSvgDataUrl(title, type))
    }
    img.src = htmlUrl
  })
}

function buildFallbackSvgDataUrl(title: string, type: string): string {
  const safeTitle = escapeHtml(title).slice(0, 50)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="120">
    <rect width="400" height="120" fill="white" stroke="#e5e7eb" rx="8"/>
    <text x="12" y="28" font-size="13" font-weight="bold" fill="#374151">${safeTitle}</text>
    <text x="12" y="52" font-size="11" fill="#6b7280">\u0422\u0438\u043f: ${type}</text>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`
}
