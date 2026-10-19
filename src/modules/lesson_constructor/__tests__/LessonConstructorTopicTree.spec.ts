/**
 * Дерево тем у генераторі (власник 2026-10-19: «так»): вузькі теми стоять під своєю широкою з
 * відступом і підписом батька — «Дроби → Звичайні дроби → Додавання…», а не одним рядком нарівні.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { TOPICS } from '../api/lessonConstructorApi'

async function openAll() {
  const w = mount(LessonConstructorPage)
  for (const head of w.findAll('.lc-topic-block__head')) await head.trigger('click')
  return w
}

const section = (w: any, title: string) =>
  w.findAll('.lc-topic-row').find((r: any) => r.find('.lc-topic-row__title').text() === title)
const chipsOf = (row: any) => row.findAll('.lc-topic-chip').map((c: any) => c.text().trim())

describe('дерево тем генератора', () => {
  it('«Дроби → Звичайні дроби → Додавання…»: кожен рівень — під своєю темою, глибше', async () => {
    const w = await openAll()
    const rows = section(w, 'Числа й вирази').findAll('.lc-topics')

    expect(chipsOf(rows[0])).toContain('Дійсні числа')
    expect(chipsOf(rows[0])).not.toContain('Звичайні дроби')
    expect(rows[0].find('.lc-topics__parent').exists()).toBe(false)

    const fractions = rows.findIndex((r: any) => r.find('.lc-topics__parent').exists()
      && r.find('.lc-topics__parent').text() === 'Дроби ›')
    const ordinary = rows.findIndex((r: any) => r.find('.lc-topics__parent').exists()
      && r.find('.lc-topics__parent').text() === 'Звичайні дроби ›')
    expect(chipsOf(rows[fractions])).toEqual(['Звичайні дроби', 'Десяткові дроби'])
    expect(chipsOf(rows[ordinary])).toEqual([
      'Додавання і віднімання дробів з різними знаменниками',
      'Множення і ділення звичайних дробів',
    ])
    expect(ordinary).toBeGreaterThan(fractions)
    expect(Number(rows[ordinary].attributes('data-depth'))).toBe(Number(rows[fractions].attributes('data-depth')) + 1)
    expect(rows[ordinary].classes()).toContain('lc-topics--child')
  })

  it('жодна тема не губиться й не двоїться: кнопок рівно стільки, скільки тем', async () => {
    const w = await openAll()
    const shown = w.findAll('.lc-topic-chip').map((c: any) => c.text().trim())
    expect(shown).toHaveLength(TOPICS.length)
    expect(new Set(shown).size).toBe(new Set(TOPICS.map(t => t.label)).size)
  })

  it('у рівняннях так само: підтеми квадратних — під «Квадратні рівняння»', async () => {
    const w = await openAll()
    const rows = w.findAll('.lc-topics')
    const quadratic = rows.find((r: any) => r.find('.lc-topics__parent').exists()
      && r.find('.lc-topics__parent').text() === 'Квадратні рівняння ›')
    expect(chipsOf(quadratic)).toContain('Теорема Вієта')
    expect(chipsOf(quadratic)).toContain('Неповні квадратні рівняння')
  })
})
