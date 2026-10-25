import type { DictationLineData } from './dictationLine'

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
  const x = Math.max(0, left - pad), y = Math.max(0, top - pad)
  return { x, y, w: Math.min(layout.width, right + pad) - x, h: Math.min(layout.height, bottom + pad) - y }
}
