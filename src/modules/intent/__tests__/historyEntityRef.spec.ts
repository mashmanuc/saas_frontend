/**
 * `entity_ref` — непрозоре посилання на сутність (інваріант `CLAUDE_RULES.md`,
 * 2026-09-21). Фронт перевіряє ФОРМУ нашої структури `{provider, id}`, але не
 * розбирає `id`: до цієї зміни тут стояло `/^Q\d+$/`, тобто фронт знав формат
 * Wikidata.
 */
import { describe, expect, it } from 'vitest'

import { sanitizeHistoryFields } from '../boardActions'

function valueOf(ref: unknown) {
  const fields = sanitizeHistoryFields([
    { label: 'Місце', status: 'verified', values: [{ label: 'Полтава', entity_ref: ref }] },
  ])
  return fields[0].values[0]
}

describe('entity_ref · непрозоре посилання', () => {
  it('посилання Wikidata проходить як є', () => {
    expect(valueOf({ provider: 'wikidata', id: 'Q156747' }).entity_ref)
      .toEqual({ provider: 'wikidata', id: 'Q156747' })
  })

  it('посилання ІНШОГО джерела з довільним id теж проходить — формат id не перевіряється', () => {
    expect(valueOf({ provider: 'another_source', id: 'abc-123/x' }).entity_ref)
      .toEqual({ provider: 'another_source', id: 'abc-123/x' })
  })

  it('старий плоский `qid` більше не приймається', () => {
    const fields = sanitizeHistoryFields([
      { label: 'Місце', status: 'verified', values: [{ label: 'Полтава', qid: 'Q156747' }] },
    ])
    const value = fields[0].values[0] as Record<string, unknown>
    expect(value.qid).toBeUndefined()
    expect(value.entity_ref).toBeUndefined()
  })

  it('зламана форма відкидається, а значення лишається текстом', () => {
    for (const bad of ['Q1', { id: 'Q1' }, { provider: 'Wiki Data', id: 'Q1' }, { provider: 'wikidata', id: '' }]) {
      const value = valueOf(bad)
      expect(value.entity_ref).toBeUndefined()
      expect(value.label).toBe('Полтава')
    }
  })
})
