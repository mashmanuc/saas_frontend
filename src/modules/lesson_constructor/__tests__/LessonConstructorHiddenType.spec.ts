/**
 * Конструктор уроку без кроку «Тип уроку» (слово власника 2026-09-22:
 * «тип уроку зараз не використовуємо — сховати; одна тема ок; теми згрупувати»).
 *
 * Сервер і далі вимагає `lesson_type` (serializers.py) — тож перевіряємо саме
 * запит: тип за замовчуванням `intro`, рівно одна тема.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const { generate, push } = vi.hoisted(() => ({
  generate: vi.fn(async (_body: Record<string, any>) => ({ session_id: 'sess-1' })),
  push: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../api/lessonConstructorApi', async () => {
  const actual = await vi.importActual<any>('../api/lessonConstructorApi')
  return { ...actual, lessonConstructorApi: { generate } }
})

import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { TOPICS } from '../api/lessonConstructorApi'

const chip = (w: any, text: string) => w.findAll('.lc-topic-chip').find((b: any) => b.text().trim() === text)

beforeEach(() => { generate.mockClear(); push.mockClear() })

// Блоки тем (Алгебра / Геометрія) спочатку згорнуті — розгортаємо всі.
async function openAll(w: any) {
  for (const head of w.findAll('.lc-topic-block__head')) await head.trigger('click')
  return w
}

describe('крок типу схований', () => {
  it('кроку «Тип уроку» на екрані немає, теми — перший крок', async () => {
    const w = await openAll(mount(LessonConstructorPage))
    expect(w.find('.lc-type-chip').exists()).toBe(false)
    expect(w.text()).not.toContain('Тип уроку')
    expect(w.findAll('.lc-section__title')[0].text()).toMatch(/^1\. Оберіть тему/)
  })

  it('одна тема → запит із типом intro', async () => {
    const w = await openAll(mount(LessonConstructorPage))
    await chip(w, 'Похідна')!.trigger('click')
    await w.find('.lc-btn-generate').trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    const body = generate.mock.calls[0]![0]
    expect(body.lesson_type).toBe('intro')
    expect(body.topics).toEqual(['derivative'])
  })

  it('клік по іншій темі замінює вибір — друга тема не додається', async () => {
    const w = await openAll(mount(LessonConstructorPage))
    await chip(w, 'Похідна')!.trigger('click')
    await chip(w, 'Інтеграл')!.trigger('click')
    await w.find('.lc-btn-generate').trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    expect(generate.mock.calls[0]![0].topics).toEqual(['integral'])
  })
})

describe('теми: два блоки, розділ = рядок', () => {
  it('спочатку обидва блоки згорнуті — чипів не видно', () => {
    const w = mount(LessonConstructorPage)
    const titles = w.findAll('.lc-topic-block__title').map((h: any) => h.text())
    expect(titles).toEqual(['Алгебра і початки аналізу', 'Геометрія'])
    expect(w.findAll('.lc-topic-block__head')
      .every((h: any) => h.attributes('aria-expanded') === 'false')).toBe(true)
    expect(w.findAll('.lc-topic-chip').length).toBe(0)
  })

  it('розділи в порядку програми; дрібні злито', async () => {
    const w = await openAll(mount(LessonConstructorPage))
    const rows = w.findAll('.lc-topic-row__title').map((h: any) => h.text())
    expect(rows).toEqual([
      'Числа й вирази', 'Рівняння й нерівності', 'Функції та початки аналізу',
      'Комбінаторика, ймовірність, статистика', 'Планіметрія', 'Стереометрія',
    ])
  })

  it('кожна тема показана рівно один раз', async () => {
    const w = await openAll(mount(LessonConstructorPage))
    expect(w.findAll('.lc-topic-chip').length).toBe(TOPICS.length)
  })

  it('площі — у геометрії, похідна — в алгебрі', async () => {
    const w = await openAll(mount(LessonConstructorPage))
    const block = (title: string) => w.findAll('.lc-topic-block')
      .find((b: any) => b.find('.lc-topic-block__title').text() === title)!
    expect(block('Геометрія').text()).toContain('Площа круга і його частин')
    expect(block('Геометрія').text()).not.toContain('Похідна')
    expect(block('Алгебра і початки аналізу').text()).toContain('Похідна')
  })

  it('обрана тема видна в заголовку й після згортання', async () => {
    const w = await openAll(mount(LessonConstructorPage))
    await chip(w, 'Призма')!.trigger('click')
    const geo = w.findAll('.lc-topic-block__head')[1]
    await geo.trigger('click')
    expect(w.findAll('.lc-topic-block__head')[1].text()).toContain('Призма')
    expect(w.findAll('.lc-topic-block__head')[0].text()).not.toContain('Призма')
  })
})
