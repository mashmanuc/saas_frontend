import { describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/apiClient', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
import { TOPICS } from '../api/lessonConstructorApi'

const parent = 'linear-quadratic-rational-equations.quadratic'

describe('вісім підтем квадратних рівнянь', () => {
  it('зберігає старі id Вієта й дискримінанта та додає рівно шість нових', () => {
    const children = TOPICS.filter(t => t.value.startsWith(`${parent}.`))
    expect(children).toHaveLength(8)
    expect(children.map(t => t.value)).toEqual(expect.arrayContaining([
      `${parent}.vieta`, `${parent}.discriminant`, `${parent}.coefficients`,
      `${parent}.incomplete`, `${parent}.inverse-vieta`, `${parent}.factorization`,
      `${parent}.reducible`, `${parent}.word-problems`,
    ]))
  })

  it('має різні людські назви для прямої й оберненої теореми Вієта', () => {
    expect(TOPICS.find(t => t.value === `${parent}.vieta`)?.label).toBe('Теорема Вієта')
    expect(TOPICS.find(t => t.value === `${parent}.inverse-vieta`)?.label).toBe('Обернена теорема Вієта')
  })
})
