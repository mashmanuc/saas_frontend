import { describe, expect, it } from 'vitest'
import { applyDictationAction, assertDictationLine, dictationVisibility, type DictationAction, type DictationLineData } from '../board/dictationLine'
import { dictationLineSvg } from '../board/dictationLineSvg'
import { fixtureWithTokens, sentenceFixture } from './fixtures/dictationLineFixture'

const revision = 'a'.repeat(64)
const word = (id: string, hidden = true): DictationAction => ({ action: 'set_word', source_revision: revision, token_id: id, hidden })
const punctuation = (hidden = true): DictationAction => ({ action: 'set_punctuation', source_revision: revision, hidden })

describe('Речення — сталі токени й незалежна видимість', () => {
  it('приймає валідні дані, повторне слово ховається за ID, а не за текстом', () => {
    const original = sentenceFixture()
    const before = JSON.stringify(original)
    const result = applyDictationAction(original, word('w1'))
    expect(result.hidden.words).toEqual(['w1'])
    expect(dictationVisibility(result).strokes.map((s) => result.layout.glyphs[s.glyph].token)).toEqual(['w0', 'w0', 'w0', 'w0', 'p0', 'p1'])
    expect(JSON.stringify(original)).toBe(before)
    expect(result.source).toBe(original.source)
    expect(result.layout).toBe(original.layout)
  })

  it('пунктуація незалежна від слів; restore не торкається layout', () => {
    const original = sentenceFixture()
    const hiddenWord = applyDictationAction(original, word('w0'))
    const both = applyDictationAction(hiddenWord, punctuation())
    expect(dictationVisibility(both).strokes).toHaveLength(4)
    const onlyWord = applyDictationAction(both, punctuation(false))
    expect(onlyWord.hidden).toEqual({ punct: false, words: ['w0'] })
    const restored = applyDictationAction(both, { action: 'restore', source_revision: revision })
    expect(restored).toEqual(original)
    expect(restored.layout).toBe(original.layout)
  })

  it('повтор set/restore — identity no-op, canonical words незалежно від порядку натискань', () => {
    const original = sentenceFixture()
    expect(applyDictationAction(original, { action: 'restore', source_revision: revision })).toBe(original)
    const one = applyDictationAction(original, word('w1'))
    expect(applyDictationAction(one, word('w1'))).toBe(one)
    const both = applyDictationAction(one, word('w0'))
    expect(both.hidden.words).toEqual(['w0', 'w1'])
    expect(applyDictationAction(both, punctuation(false))).toBe(both)
    expect(applyDictationAction(one, word('w1', false))).toEqual(original)
  })

  it('слово з перенесенням має два пропуски, жодне інше чорнило не рухається', () => {
    const data = sentenceFixture()
    for (const [i, glyph] of data.layout.glyphs.entries()) {
      if (glyph.token === 'w1' && glyph.start >= 8) {
        glyph.line = 1
        glyph.bbox = [glyph.bbox[0] - 60, 70, 7, 20]
        data.layout.strokes[i].p = [[glyph.bbox[0], 70], [glyph.bbox[0] + 7, 90]]
      }
    }
    const visible = dictationVisibility(applyDictationAction(data, word('w1')))
    expect(visible.blanks).toEqual([
      { token: 'w1', line: 0, x: 70, y: 47, width: 17 },
      { token: 'w1', line: 1, x: 30, y: 97, width: 17 },
    ])
    expect(visible.strokes[0]).toBe(data.layout.strokes[0])
  })

  it('апостроф/внутрішній дефіс лишаються в слові, а не в пунктуації', () => {
    const data = fixtureWithTokens('п’ять-таки!', [
      { id: 'w0', kind: 'word', text: 'п’ять-таки', start: 0, end: 10 },
      { id: 'p0', kind: 'punct', text: '!', start: 10, end: 11 },
    ])
    expect(dictationVisibility(applyDictationAction(data, punctuation())).strokes).toHaveLength(10)
    expect(dictationVisibility(applyDictationAction(data, word('w0'))).strokes).toHaveLength(1)
  })

  it('code points: серверні зміщення не перетворюються на UTF-16', () => {
    const data = fixtureWithTokens('А𐐀, А.', [
      { id: 'w0', kind: 'word', text: 'А𐐀', start: 0, end: 2 },
      { id: 'p0', kind: 'punct', text: ',', start: 2, end: 3 },
      { id: 's0', kind: 'space', text: ' ', start: 3, end: 4 },
      { id: 'w1', kind: 'word', text: 'А', start: 4, end: 5 },
      { id: 'p1', kind: 'punct', text: '.', start: 5, end: 6 },
    ])
    expect(() => assertDictationLine(data)).not.toThrow()
    expect(dictationVisibility(applyDictationAction(data, word('w1'))).strokes).toHaveLength(4)
  })

  it('JSON roundtrip зберігає приховування й SVG без повторного письма', () => {
    const data = applyDictationAction(applyDictationAction(sentenceFixture(), word('w1')), punctuation())
    const reloaded = JSON.parse(JSON.stringify(data))
    expect(dictationLineSvg(reloaded)).toBe(dictationLineSvg(data))
    const svg = dictationLineSvg(reloaded)
    expect(svg.match(/<polyline /g)).toHaveLength(4)
    expect(svg.match(/<line /g)).toHaveLength(1)
    expect(svg).not.toContain('Мама')
    expect(svg).not.toContain('<script')
  })
})

describe('Речення — явні відмови без часткового результату', () => {
  it.each([
    [null, 'invalid_action'],
    [{ action: 'toggle', source_revision: revision }, 'invalid_action'],
    [{ ...word('w0'), hidden: 'true' }, 'invalid_action'],
    [{ ...word('w0'), extra: true }, 'invalid_action'],
    [{ ...word('w0'), source_revision: 'b'.repeat(64) }, 'stale_source'],
    [word('w99'), 'unknown_word'],
    [word('p0'), 'unknown_word'],
  ])('відхиляє %j (%s)', (action, code) => {
    const data = sentenceFixture()
    const before = JSON.stringify(data)
    expect(() => applyDictationAction(data, action)).toThrow(code)
    expect(JSON.stringify(data)).toBe(before)
  })

  const mutations: Array<[string, (d: DictationLineData) => void]> = [
    ['дублікат ID', (d) => { d.tokens[3].id = 'w0' }],
    ['пропуск тексту', (d) => { d.tokens[1].start = 5 }],
    ['невідповідний текст', (d) => { d.tokens[0].text = 'інше' }],
    ['вихід glyph за токен', (d) => { d.layout.glyphs[0].end = 5 }],
    ['дублікат glyph-позиції', (d) => { d.layout.glyphs[1].start = 0 }],
    ['невідомий glyph', (d) => { d.layout.strokes[0].glyph = 100 }],
    ['немає чорнила glyph', (d) => { d.layout.strokes.shift() }],
    ['NaN', (d) => { d.layout.strokes[0].p[0][0] = NaN }],
    ['вихід за bbox', (d) => { d.layout.strokes[0].p[0][0] = -1 }],
    ['довільний URL замість точки', (d) => { (d.layout.strokes[0].p[0] as unknown[])[0] = 'https://bad.invalid' }],
    ['неіснуючий рядок', (d) => { d.layout.glyphs[0].line = 2 }],
    ['неупорядковані базові лінії', (d) => { d.layout.baselines = [95, 45] }],
    ['полотно понад межі', (d) => { d.layout.height = 2000 }],
    ['невідоме hidden-слово', (d) => { d.hidden.words = ['w5'] }],
    ['дубль hidden', (d) => { d.hidden.words = ['w0', 'w0'] }],
    ['неканонічний порядок', (d) => { d.hidden.words = ['w1', 'w0'] }],
    ['число замість bool', (d) => { (d.hidden as unknown as Record<string, unknown>).punct = 1 }],
    ['невідома версія', (d) => { (d as unknown as Record<string, unknown>).version = 2 }],
    ['керівні символи', (d) => { d.source.text = 'Мама\nмама' }],
    ['підміна токенів JSON', (d) => { (d as unknown as Record<string, unknown>).tokens = {} }],
  ]
  it.each(mutations)('%s', (_, mutate) => {
    const data = sentenceFixture()
    mutate(data)
    expect(() => assertDictationLine(data)).toThrow('invalid_data')
    expect(() => dictationLineSvg(data)).toThrow('invalid_data')
  })
})
