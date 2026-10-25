/**
 * LAW §9 v1.55: «Речення» з переносом рядка (власник 2026-10-25: «25 жовтня ⏎ класна робота» посередині — сервер
 * відкинув, телефон завис на «Пишу на дошці…»). Перенос рядка — дозволений, інші керівні знаки — ні.
 */
import { describe, expect, it } from 'vitest'
import { assertDictationLine } from '../board/dictationLine'
import { fixtureWithTokens } from './fixtures/dictationLineFixture'

const header = (sep: string) => fixtureWithTokens(`25 жовтня${sep}Класна`, [
  { id: 'w0', kind: 'word', text: '25', start: 0, end: 2 },
  { id: 's0', kind: 'space', text: ' ', start: 2, end: 3 },
  { id: 'w1', kind: 'word', text: 'жовтня', start: 3, end: 9 },
  { id: 's1', kind: 'space', text: sep, start: 9, end: 10 },
  { id: 'w2', kind: 'word', text: 'Класна', start: 10, end: 16 },
])

describe('v1.55: речення з переносом рядка', () => {
  it('шапка у два рядки — дійсне речення', () => {
    expect(() => assertDictationLine(header('\n'))).not.toThrow()
  })

  it('інші керівні знаки, як і раніше, — ні', () => {
    expect(() => assertDictationLine(header('\t'))).toThrow()
    expect(() => assertDictationLine(header('\u0085'))).toThrow()
  })
})
