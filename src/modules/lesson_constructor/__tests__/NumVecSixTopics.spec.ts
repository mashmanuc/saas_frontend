import { describe, expect, it } from 'vitest'
import { TOPICS } from '../api/lessonConstructorApi'
import { CURRICULUM, VERIFIED_TOPICS } from '../curriculum'

// Шість добірок із наявних задач банку (Крокор, 28.10): теми вже були в програмі — додаються лише як добірки.
const six = [
  'real-numbers.divisibility', 'ratios-percents-word-problems.percent', 'ratios-percents-word-problems.ratio',
  'plane-vectors-coordinates.coordinates', 'plane-vectors-coordinates.dot-product', 'space-vectors-coordinates.dot-product',
]

describe('Подільність, відсотки, відношення й вектори в генераторі', () => {
  it.each(six)('%s існує рівно раз і є добіркою', id => {
    expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
    expect(VERIFIED_TOPICS).toContain(id)
  })
  it('кожна тема має розділ програми свого класу', () => {
    const covered = (id: string) => CURRICULUM.some(u => u.topics.some(t => id === t || id.startsWith(t + '.')))
    expect(six.filter(id => !covered(id))).toEqual([])
  })
})
