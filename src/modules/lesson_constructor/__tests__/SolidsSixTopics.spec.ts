import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { VERIFIED_TOPICS } from '../curriculum'
import { gradeTracks } from '../topicByGrade'

const ids = ['prism.parallelepiped', 'prism.right-regular', 'pyramid.measures', 'rotation-bodies.cylinder',
  'rotation-bodies.cone', 'rotation-bodies.sphere']
const labels = Object.fromEntries(TOPICS.map(t => [t.value, t.label]))

describe('Шість тем стереометрії у генераторі', () => {
  it.each(ids)('%s існує рівно раз і є добіркою', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect(VERIFIED_TOPICS).toContain(id)
  })
  it('11 клас геометрія: вузькі теми замість широкої назви, розділи без зсуву', () => {
    const units = gradeTracks(11, labels).find(t => t.track === 'geometry')!.units
    const unit = (title: string) => units.find(u => u.title === title)!.topics
    expect(unit('Призма. Паралелепіпед')).toEqual(['prism.parallelepiped', 'prism.right-regular'])
    expect(unit('Піраміда. Перерізи многогранників')).toEqual(['pyramid.measures'])
    expect(unit('Циліндр. Конус')).toEqual(['rotation-bodies.cylinder', 'rotation-bodies.cone'])
    expect(unit('Куля і сфера')).toEqual(['rotation-bodies.sphere'])
  })
})
