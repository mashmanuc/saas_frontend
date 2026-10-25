/** Тільки стенд: ті самі реальні штрихи, явно масштабовані/повторені.
 * Це не tokenizer, не новий почерк і не перевірка відповідей моделі. */
import { assertDictationLine, type DictationLineData } from '../../modules/winterboard/board/dictationLine'
import fixture from './sentence.json'
export function exampleData(kind: string): DictationLineData {
  const data = structuredClone(fixture) as DictationLineData
  data.layout.height = 600
  if (kind === 'plain') return data
  const scale = 16 / data.layout.x_height
  data.layout.x_height = 16; data.layout.size *= scale
  data.layout.baselines = data.layout.baselines.map((b) => b * scale)
  data.layout.glyphs.forEach((g) => { g.bbox = g.bbox.map((n) => n * scale) as [number, number, number, number] })
  data.layout.strokes.forEach((s) => { s.p = s.p.map(([x, y]) => [x * scale, y * scale]) })
  if (kind === 'multiline') {
    const length = Array.from(data.source.text).length, count = data.layout.glyphs.length
    data.source.text += '\n' + data.source.text
    const tokens = structuredClone(data.tokens)
    data.tokens.push({ id: 's2', kind: 'space', text: '\n', start: length, end: length + 1 },
      ...tokens.map((t) => ({ ...t, id: `${t.id[0]}${Number(t.id.slice(1)) + 100}`, start: t.start + length + 1, end: t.end + length + 1 })))
    data.layout.baselines.push(data.layout.baselines[0] + 32)
    data.layout.glyphs.push(...structuredClone(data.layout.glyphs).map((g) => ({ ...g, token: `${g.token[0]}${Number(g.token.slice(1)) + 100}`,
      start: g.start + length + 1, end: g.end + length + 1, line: 1, bbox: [g.bbox[0], g.bbox[1] + 32, g.bbox[2], g.bbox[3]] as [number, number, number, number] })))
    data.layout.strokes.push(...structuredClone(data.layout.strokes).map((s) => ({ ...s, glyph: s.glyph + count, t: s.t + 3000, p: s.p.map(([x, y]) => [x, y + 32] as [number, number]) })))
  } else if (kind === 'short') {
    const originals = [data.layout.glyphs.findIndex((g) => g.start === 9), data.layout.glyphs.findIndex((g) => g.start === 12)]
    const glyphs = originals.map((i) => data.layout.glyphs[i]), strokes = data.layout.strokes
    data.source.text = 'в у'
    data.tokens = [{ id: 'w0', kind: 'word', text: 'в', start: 0, end: 1 }, { id: 's0', kind: 'space', text: ' ', start: 1, end: 2 }, { id: 'w1', kind: 'word', text: 'у', start: 2, end: 3 }]
    data.layout.glyphs = glyphs.map((g, i) => ({ ...g, token: `w${i}`, start: i * 2, end: i * 2 + 1, bbox: [i * 35, g.bbox[1], g.bbox[2], g.bbox[3]] }))
    data.layout.strokes = originals.flatMap((original, i) => strokes.filter((s) => s.glyph === original).map((s) => ({ ...s, glyph: i,
      p: s.p.map(([x, y]) => [x - glyphs[i].bbox[0] + i * 35, y] as [number, number]) })))
  }
  data.source.revision = 'c'.repeat(64)
  assertDictationLine(data)
  return data
}
