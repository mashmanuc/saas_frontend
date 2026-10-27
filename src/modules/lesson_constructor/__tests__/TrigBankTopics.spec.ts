import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { VERIFIED_TOPICS } from '../curriculum'
import { gradeTracks, type Grade } from '../topicByGrade'

const ids = [
  'exp-log-trig-functions.trigonometric.angles',
  'exponential-log-trig-expressions.trigonometric.identities',
  'exponential-log-trig-expressions.trigonometric.reduction',
  'exponential-log-trig-expressions.trigonometric.addition-double-angle',
  'exp-log-trig-functions.trigonometric.properties',
  'irrational-trig-equations.trigonometric.elementary',
]
const labels = Object.fromEntries(TOPICS.map(t => [t.value, t.label]))

describe('Прийняті добірки тригонометрії у конструкторі', () => {
  it.each(ids)('%s є у списку та у перевірених добірках', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect(VERIFIED_TOPICS).toContain(id)
  })
  it('усі шість доступні разом у 10 класі, не сховані широкою назвою', () => {
    const unit = gradeTracks(10, labels).find(t => t.track === 'algebra')!
      .units.find(t => t.title === 'Тригонометричні функції')!
    // Шість тем — першими й разом; після них може йти інша добірка розділу (тригонометричні нерівності, 28.10).
    expect(unit.topics.slice(0, ids.length)).toEqual(ids)
  })
  it('не з’являються у 5–9 класах', () => {
    for (const grade of [5, 6, 7, 8, 9] as Grade[]) {
      const visible = gradeTracks(grade, labels).flatMap(t => t.units.flatMap(u => u.topics))
      expect(visible.filter(t => ids.includes(t))).toEqual([])
    }
  })
})
