import type { DictationLineData } from './dictationLine'
import { annotationLabels } from './dictationAnalysis'

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
  if (data.analysis) {
    for (const label of annotationLabels(data)) {
      top = Math.min(top, label.top - 3); left = Math.min(left, label.x)
      right = Math.max(right, label.right)
    }
    // Рамка орфограми й товсті подвійні риски теж усередині viewBox.
    left -= 6; right += 6; top -= 6; bottom += 9
  }
  const x = data.analysis ? left - pad : Math.max(0, left - pad)
  const y = data.analysis ? top - pad : Math.max(0, top - pad)
  return { x, y, w: (data.analysis ? right + pad : Math.min(layout.width, right + pad)) - x,
    h: (data.analysis ? bottom + pad : Math.min(layout.height, bottom + pad)) - y }
}
