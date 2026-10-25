/** Синтетична відповідь layout: явні серверні токени, не клієнтський tokenizer. */
import type { DictationLineData, DictationToken } from '../../board/dictationLine'

export function sentenceFixture(): DictationLineData {
  return fixtureWithTokens('Мама, мама.', [
    { id: 'w0', kind: 'word', text: 'Мама', start: 0, end: 4 },
    { id: 'p0', kind: 'punct', text: ',', start: 4, end: 5 },
    { id: 's0', kind: 'space', text: ' ', start: 5, end: 6 },
    { id: 'w1', kind: 'word', text: 'мама', start: 6, end: 10 },
    { id: 'p1', kind: 'punct', text: '.', start: 10, end: 11 },
  ])
}

export function fixtureWithTokens(text: string, tokens: DictationToken[]): DictationLineData {
  const glyphs = tokens.filter((token) => token.kind !== 'space').flatMap((token) =>
    Array.from(token.text).map((_, i) => ({ token: token.id, start: token.start + i, end: token.start + i + 1,
      line: 0, bbox: [10 + (token.start + i) * 10, 20, 7, 20] as [number, number, number, number] })))
  return {
    version: 1,
    source: { text, lang: 'uk', hand: 'school', revision: 'a'.repeat(64) },
    tokens,
    layout: { version: 1, width: 400, height: 120, size: 2, align: 'left', x_height: 20,
      baselines: [45, 95], glyphs,
      strokes: glyphs.map((glyph, i) => ({ glyph: i, t: i * 20,
        p: [[glyph.bbox[0], 20], [glyph.bbox[0] + 7, 40]] as [number, number][] })) },
    hidden: { punct: false, words: [] },
  }
}
