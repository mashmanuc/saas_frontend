import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { CURRICULUM, VERIFIED_TOPICS } from '../curriculum'

// Сім добірок із наявних задач банку (Крокор, 28.10): теми вже були в програмі — додаються лише як добірки.
const seven = [
  'triangles.angles', 'circle-polygon.inscribed-angle', 'lines-planes-space.perpendicular',
  'function-basics.domain', 'function-basics.range', 'function-basics.evaluation', 'function-basics.composition',
]

describe('Кути, вписаний кут, перпендикулярність і функції в генераторі', () => {
  it.each(seven)('%s існує рівно раз і є добіркою', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect(VERIFIED_TOPICS).toContain(id)
  })
  it('кожна тема має розділ програми свого класу', () => {
    const covered = (id: string) => CURRICULUM.some(u => u.topics.some(t => id === t || id.startsWith(t + '.')))
    expect(seven.filter(id => !covered(id))).toEqual([])
  })
})
