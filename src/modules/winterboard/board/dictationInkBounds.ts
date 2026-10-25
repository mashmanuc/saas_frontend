import type { DictationLineData } from './dictationLine'
import { annotationFont } from './dictationAnalysis'

/** Обвід усієї frozen-геометрії; hidden не впливає ні на bbox, ні на переноси. */
export function dictationInkBounds(data: DictationLineData) {
  const { layout } = data
  const pad = layout.size / 2 + 1
  let left = layout.width, top = layout.height, right = 0, bottom = 0
  for (const glyph of layout.glyphs) {
    const [x, y, w, h] = glyph.bbox
    left = Math.min(left, x); top = Math.min(top, y)
    right = Math.max(right, x + w)
    bottom = Math.max(bottom, y + h, layout.baselines[glyph.line] + 2)
  }
  // Перший аналіз резервує місце; очищення/hidden не пересувають чорнило.
  if (data.analysis) { top -= annotationFont(data) + 3; bottom += 4 }
  const x = Math.max(0, left - pad), y = data.analysis ? top - pad : Math.max(0, top - pad)
  return { x, y, w: Math.min(layout.width, right + pad) - x, h: (data.analysis ? bottom + pad : Math.min(layout.height, bottom + pad)) - y }
}
