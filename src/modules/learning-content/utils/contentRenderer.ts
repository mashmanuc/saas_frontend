import katex from 'katex'
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

export function parseLatexSegments(text: string): Segment[] {
  const segments: Segment[] = []
  const regex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    const raw = match[0]
    if (raw.startsWith('$$')) {
      segments.push({ type: 'display', value: raw.slice(2, -2).trim() })
    } else {
      segments.push({ type: 'inline', value: raw.slice(1, -1).trim() })
    }
    lastIndex = match.index + raw.length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

// ── KaTeX → MathML string (no foreignObject) ─────────────────
function renderLatexToMathML(formula: string, displayMode: boolean): string {
  try {
    return katex.renderToString(formula, {
      output: 'mathml',
      displayMode,
      throwOnError: false,
    })
  } catch {
    return `<span class="lc-formula-error">${escapeHtml(formula)}</span>`
  }
}

// ── Render text line with embedded LaTeX → HTML string ────────
export function renderTextWithLatex(text: string): string {
  if (!text) return ''
  const segments = parseLatexSegments(text)
  return segments
    .map((seg) => {
      if (seg.type === 'text') return escapeHtml(seg.value)
      if (seg.type === 'inline') return renderLatexToMathML(seg.value, false)
      return `<div class="lc-display-math">${renderLatexToMathML(seg.value, true)}</div>`
    })
    .join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>')
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
