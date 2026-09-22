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

describe('крок типу схований', () => {
  it('кроку «Тип уроку» на екрані немає, теми — перший крок', () => {
    const w = mount(LessonConstructorPage)
    expect(w.find('.lc-type-chip').exists()).toBe(false)
    expect(w.text()).not.toContain('Тип уроку')
    expect(w.findAll('.lc-section__title')[0].text()).toMatch(/^1\. Оберіть тему/)
  })

  it('одна тема → запит із типом intro', async () => {
    const w = mount(LessonConstructorPage)
    await chip(w, 'Похідна')!.trigger('click')
    await w.find('.lc-btn-generate').trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    const body = generate.mock.calls[0]![0]
    expect(body.lesson_type).toBe('intro')
    expect(body.topics).toEqual(['derivative'])
  })

  it('клік по іншій темі замінює вибір — друга тема не додається', async () => {
    const w = mount(LessonConstructorPage)
    await chip(w, 'Похідна')!.trigger('click')
    await chip(w, 'Інтеграл')!.trigger('click')
    await w.find('.lc-btn-generate').trigger('submit')
    await new Promise(r => setTimeout(r, 0))
    expect(generate.mock.calls[0]![0].topics).toEqual(['integral'])
  })
})

describe('теми згруповані розділами', () => {
  it('заголовки розділів у порядку програми', () => {
    const w = mount(LessonConstructorPage)
    const titles = w.findAll('.lc-topic-group__title').map((h: any) => h.text())
    expect(titles[0]).toBe('Числа й вирази')
    expect(titles).toContain('Планіметрія')
    expect(titles.indexOf('Похідна та інтеграл')).toBeLessThan(titles.indexOf('Планіметрія'))
  })

  it('кожна тема показана рівно один раз', () => {
    const w = mount(LessonConstructorPage)
    expect(w.findAll('.lc-topic-chip').length).toBe(TOPICS.length)
  })

  it('площі — у планіметрії, похідна — не поруч із ними', () => {
    const w = mount(LessonConstructorPage)
    const group = (title: string) => w.findAll('.lc-topic-group')
      .find((g: any) => g.find('.lc-topic-group__title').text() === title)!
    expect(group('Планіметрія').text()).toContain('Площа круга і його частин')
    expect(group('Планіметрія').text()).not.toContain('Похідна')
  })
})
