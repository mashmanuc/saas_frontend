import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { VERIFIED_TOPICS } from '../curriculum'
import { gradeTracks, type Grade } from '../topicByGrade'

const ids = [
  'right-triangles.pythagoras',
  'right-triangles.trigonometry',
  'areas.triangle',
  'areas.parallelogram',
  'areas.circle',
  'triangles.similarity',
  'triangles.solving',
  'triangles.congruence',
]
const labels = Object.fromEntries(TOPICS.map(t => [t.value, t.label]))
const unit = (grade: Grade, track: string, title: string) =>
  gradeTracks(grade, labels).find(t => t.track === track)!.units.find(u => u.title === title)!.topics

describe('Вісім тем геометрії у виборі «За класом»', () => {
  it.each(ids)('%s існує рівно раз і є перевіреною добіркою', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect(VERIFIED_TOPICS).toContain(id)
  })
  it('добірка витісняє лише тему-батька, сусідні теми розділу лишаються', () => {
    expect(unit(8, 'geometry', 'Чотирикутники')).toEqual(
      ['areas.parallelogram', 'parallelogram-rhombus-trapezoid', 'rectangle-square'])
    expect(unit(8, 'geometry', "Розв'язування прямокутних трикутників")).toEqual(
      ['right-triangles.pythagoras', 'right-triangles.trigonometry'])
    expect(unit(9, 'geometry', 'Правильні многокутники. Довжина кола. Площа круга')).toEqual(
      ['areas.circle', 'circle-polygon'])
  })
  it('математика й алгебра — як були: перевірені добірки розділу без сусідніх тем', () => {
    expect(unit(6, 'math', 'Коло. Круг. Відсоткові розрахунки')).toEqual(['areas.circle'])
  })
})
