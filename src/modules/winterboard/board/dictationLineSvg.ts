/** Один SVG для екрана й знімка. Без тексту користувача, зовнішніх URL та повторного layout. */
import { dictationVisibility, type DictationLineData } from './dictationLine'
import { dictationInkBounds } from './dictationInkBounds'
import { annotationLabels, basisWidth, wordSegments, POS_LABELS } from './dictationAnalysis'
const xml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!))

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
    const y = data.layout.baselines[s.line] + 2
    return `<path d="M${s.x} ${y}H${s.right}${item.role === 'predicate' ? ` M${s.x} ${y + 5}H${s.right}` : ''}"/>`
  })).join('')
  const planned = annotationLabels(data)
  const labels = (data.analysis?.parts ?? []).filter((item) => !data.hidden.words.includes(item.token_id)).map((item) => {
    const s = planned.find((label) => label.tokenId === item.token_id)
    if (!s) return ''
    return `<text x="${s.center}" y="${s.y}" text-anchor="middle" font-family="sans-serif" font-weight="600" font-size="${s.font}">${xml(s.prefix + POS_LABELS[item.pos])}</text>`
  }).join('')
  const marks = data.layout.glyphs.filter((g) => !data.hidden.words.includes(g.token)
    && data.analysis?.orthograms.some((item) => item.start < g.end && g.start < item.end)).map((g) => {
    const [gx, gy, gw, gh] = g.bbox
    const w = Math.max(12, gw + 6), h = Math.max(12, gh + 6)
    return `<rect x="${gx + gw / 2 - w / 2}" y="${gy + gh / 2 - h / 2}" width="${w}" height="${h}" rx="3"/>`
  }).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" data-export-background="transparent"><g fill="#fef08a" fill-opacity=".55" stroke="#b91c1c" stroke-width="2.5">${marks}</g><g fill="none" stroke="#1e3a8a" stroke-width="${size}" stroke-linecap="round" stroke-linejoin="round">${paths}</g><g stroke="#64748b" stroke-width="1" stroke-dasharray="4 3">${gaps}</g><g fill="none" stroke="#0f766e" stroke-width="${basisWidth}">${basis}</g><g fill="#0f766e">${labels}</g></svg>`
}
