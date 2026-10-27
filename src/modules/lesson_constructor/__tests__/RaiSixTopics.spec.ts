import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { CURRICULUM, VERIFIED_TOPICS } from '../curriculum'

const ids = ['linear-quadratic-rational-equations.rational', 'linear-quadratic-rational-equations.absolute',
  'inequalities-systems.absolute', 'inequalities-systems.trigonometric', 'integral.antiderivative', 'integral.definite']

describe('Дробово-раціональні, модуль, тригонометричні нерівності, інтеграл — у генераторі', () => {
  it.each(ids)('%s існує рівно раз і є добіркою', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect(VERIFIED_TOPICS).toContain(id)
  })
  it('теми — у наявних розділах, без нових розділів', () => {
    const unit = (g: number, title: string) => CURRICULUM.find(u => u.grade === g && u.track === 'algebra' && u.title === title)!
    expect(unit(8, 'Раціональні вирази').topics).toContain('linear-quadratic-rational-equations.rational')
    expect(unit(9, 'Нерівності').topics).toContain('inequalities-systems.absolute')
    expect(unit(10, 'Тригонометричні функції').topics).toContain('inequalities-systems.trigonometric')
    expect(unit(11, 'Інтеграл та його застосування').topics).toEqual(['integral', 'integral.antiderivative', 'integral.definite'])
  })
})
