/** Шість прогресій у виборі за класом і в загальному переліку. */
import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { VERIFIED_TOPICS } from '../curriculum'
import { gradeTracks } from '../topicByGrade'

const ids = ['sequences.general', 'sequences.arithmetic.term', 'sequences.arithmetic.sum',
  'sequences.geometric.term', 'sequences.geometric.sum', 'sequences.applications']

describe('послідовності в конструкторі', () => {
  it.each(ids)('%s доступна в розділі 9 класу', (id) => {
    const labels = Object.fromEntries(TOPICS.map(t => [t.value, t.label]))
    expect(labels[id]).toBeTruthy()
    expect([...VERIFIED_TOPICS]).toContain(id)
    const unit = gradeTracks(9, labels).find(t => t.track === 'algebra')!
      .units.find(u => u.title === 'Числові послідовності')!
    expect(unit.topics).toContain(id)
    expect(unit.topics).not.toContain('sequences')
  })
})
