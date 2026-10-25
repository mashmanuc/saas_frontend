/** Один SVG для екрана й знімка. Без тексту користувача, зовнішніх URL та повторного layout. */
import { dictationVisibility, type DictationLineData } from './dictationLine'
import { dictationInkBounds } from './dictationInkBounds'

export function dictationLineSvg(data: DictationLineData): string {
  const { strokes, blanks } = dictationVisibility(data)
  const { size } = data.layout
  const { x, y, w: width, h: height } = dictationInkBounds(data)
  const paths = strokes.map((stroke) => `<polyline points="${stroke.p.map(([x, y]) => `${x},${y}`).join(' ')}"/>`).join('')
  const gaps = blanks.map((blank) => `<line x1="${blank.x}" y1="${blank.y}" x2="${blank.x + blank.width}" y2="${blank.y}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}" preserveAspectRatio="none" data-export-background="transparent"><g fill="none" stroke="#1e3a8a" stroke-width="${size}" stroke-linecap="round" stroke-linejoin="round">${paths}</g><g stroke="#64748b" stroke-width="1" stroke-dasharray="4 3">${gaps}</g></svg>`
}
