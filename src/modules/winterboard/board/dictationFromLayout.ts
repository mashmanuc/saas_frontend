import type { DictationLineData } from './dictationLine'
import { createDictationLine } from './createDictationLine'

/** Нічого не токенізуємо: приймаємо саме заморожену відповідь handwriting v1. */
export function dictationFromLayout(raw: unknown, request: {
  id: string; text: string; lang: 'uk' | 'en'; align: 'left' | 'center'
  x: number; y: number; width: number; height: number
}) {
  const value = raw as Record<string, unknown> | null
  const source = value?.source as Record<string, unknown> | undefined
  if (value?.fits !== true || value.layout_version !== 1 || source?.text !== request.text) throw new Error('dictation_invalid_layout')
  const data = {
    version: 1, source: { text: source.text, revision: source.revision, lang: request.lang, hand: 'school' },
    tokens: value.tokens,
    layout: { version: 1, width: request.width, height: request.height, size: value.size, align: request.align,
      x_height: value.x_height, baselines: value.baselines, glyphs: value.glyphs, strokes: value.strokes },
    hidden: { punct: false, words: [] },
  } as DictationLineData
  return createDictationLine(request.id, request.x, request.y, data)
}
