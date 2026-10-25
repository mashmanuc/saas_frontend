/** Один SVG для екрана й знімка. Без тексту користувача, зовнішніх URL та повторного layout. */
import { dictationVisibility, type DictationLineData } from './dictationLine'
import { dictationInkBounds } from './dictationInkBounds'
import { annotationFont, wordSegments, POS_LABELS } from './dictationAnalysis'

export function dictationLineSvg(data: DictationLineData): string {
  const { strokes, blanks } = dictationVisibility(data)
  const { size } = data.layout
  const { x, y, w: width, h: height } = dictationInkBounds(data)
  const paths = strokes.map((stroke) => {
    const glyph = data.layout.glyphs[stroke.glyph]
    const highlighted = data.analysis?.orthograms.some((item) => item.start < glyph.end && glyph.start < item.end)
    return `<polyline${highlighted ? ' stroke="#dc2626"' : ''} points="${stroke.p.map(([x, y]) => `${x},${y}`).join(' ')}"/>`
  }).join('')
  const gaps = blanks.map((blank) => `<line x1="${blank.x}" y1="${blank.y}" x2="${blank.x + blank.width}" y2="${blank.y}"/>`).join('')
  const basis = (data.analysis?.basis ?? []).filter((item) => !data.hidden.words.includes(item.token_id)).flatMap((item) => wordSegments(data, item.token_id).map((s) => {
    const y = data.layout.baselines[s.line] + 1
    return `<path d="M${s.x} ${y}H${s.right}${item.role === 'predicate' ? ` M${s.x} ${y + 3}H${s.right}` : ''}"/>`
  })).join('')
  const labels = (data.analysis?.parts ?? []).filter((item) => !data.hidden.words.includes(item.token_id)).flatMap((item) => wordSegments(data, item.token_id).map((s) =>
    `<text x="${(s.x + s.right) / 2}" y="${s.top - 3}" text-anchor="middle" font-family="sans-serif" font-size="${annotationFont(data)}" textLength="${Math.max(1, Math.min(s.right - s.x, POS_LABELS[item.pos].length * annotationFont(data) * .6))}" lengthAdjust="spacingAndGlyphs">${POS_LABELS[item.pos]}</text>`)).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" data-export-background="transparent"><g fill="none" stroke="#1e3a8a" stroke-width="${size}" stroke-linecap="round" stroke-linejoin="round">${paths}</g><g stroke="#64748b" stroke-width="1" stroke-dasharray="4 3">${gaps}</g><g fill="none" stroke="#0f766e" stroke-width="1">${basis}</g><g fill="#0f766e">${labels}</g></svg>`
}
