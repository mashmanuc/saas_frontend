/** Нові добірки доступні в НМТ та розділах 9 класу; форма не змінюється. */
import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { gradeTracks } from '../topicByGrade'

const ids = [
  'inequalities-systems.estimates',
  'inequalities-systems.rational',
  'inequalities-systems.systems.quadratic',
  'linear-quadratic-rational-equations.systems.nonlinear.substitution',
  'linear-quadratic-rational-equations.systems.nonlinear.graphical',
  'linear-quadratic-rational-equations.systems.nonlinear.word-problems',
]

describe('шість нових добірок у чинному виборі тем', () => {
  it.each(ids)('%s є в загальному списку та алгебрі 9 класу', (id) => {
    const labels = Object.fromEntries(TOPICS.map(t => [t.value, t.label]))
    expect(labels[id]).toBeTruthy()
    const algebra = gradeTracks(9, labels).find(t => t.track === 'algebra')!
    expect(algebra.units.some(unit => unit.topics.includes(id))).toBe(true)
  })
})
