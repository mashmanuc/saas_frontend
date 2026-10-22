import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { CURRICULUM, VERIFIED_TOPICS } from '../curriculum'

const ids = [
  'powers.integer-exponents',
  'rational-irrational-expressions.nth-roots.definition',
  'rational-irrational-expressions.nth-roots.transformations',
  'powers.rational-exponents',
  'function-basics.power',
  'irrational-trig-equations.irrational',
]

describe('Шість тем степенів і коренів у генераторі', () => {
  it.each(ids)('%s існує рівно раз і є перевіреною добіркою', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect(VERIFIED_TOPICS).toContain(id)
  })
  it('вибір за класом показує погоджений навчальний порядок, не всю тригонометрію', () => {
    const unit = CURRICULUM.find(u => u.grade === 10 && u.track === 'algebra' && u.title === 'Степенева функція')!
    expect(unit.topics.slice(0, 6)).toEqual(ids)
    expect(unit.topics).not.toContain('irrational-trig-equations')
  })
})
