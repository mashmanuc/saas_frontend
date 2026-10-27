import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { CURRICULUM, VERIFIED_TOPICS } from '../curriculum'

const exp = ['exponential-log-trig-expressions.exponential', 'exponential-log-equations.exponential', 'inequalities-systems.exponential']
const log = ['exponential-log-trig-expressions.logarithmic', 'exponential-log-equations.logarithmic', 'inequalities-systems.logarithmic']

describe('Шість показникових і логарифмічних тем у генераторі', () => {
  it.each([...exp, ...log])('%s існує рівно раз і є добіркою', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect(VERIFIED_TOPICS).toContain(id)
  })
  it('теми — у наявних розділах 11 класу, без нових розділів', () => {
    const unit = (title: string) => CURRICULUM.find(u => u.grade === 11 && u.track === 'algebra' && u.title === title)!
    expect(unit('Показникова функція').topics).toEqual(expect.arrayContaining(exp))
    expect(unit('Логарифмічна функція').topics).toEqual(expect.arrayContaining(log))
    expect(CURRICULUM.filter(u => u.grade === 11 && u.track === 'algebra').map(u => u.title).slice(0, 2))
      .toEqual(['Показникова функція', 'Логарифмічна функція'])
  })
})
