/**
 * Фон дошки в генераторі (власник 2026-10-19): «дітям подобаються кольорові дошки, я щоразу їх клацаю —
 * за замовчуванням треба їх поставити, і на максимум відтінок». Вчитель нічого не чіпає — урок різнокольоровий.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { generate } = vi.hoisted(() => ({ generate: vi.fn(async (_body: Record<string, unknown>) => ({ session_id: 'bg-1' })) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../api/lessonConstructorApi', async () => {
  const actual = await vi.importActual<any>('../api/lessonConstructorApi')
  return { ...actual, lessonConstructorApi: { generate } }
})
import LessonConstructorPage from '../views/LessonConstructorPage.vue'

// Дерево тем — вигляд «НМТ»: з 2026-10-21 сторінка спершу пропонує клас учня (TopicGradePicker).
beforeEach(() => { localStorage.setItem('lc.topicView', 'nmt') })
beforeEach(() => generate.mockClear())

async function generateUntouched() {
  const w = mount(LessonConstructorPage)
  for (const head of w.findAll('.lc-topic-block__head')) await head.trigger('click')
  await w.findAll('.lc-topic-chip').find((c: any) => c.text().trim() === 'Похідна')!.trigger('click')
  // З 2026-10-21 фон — окреме слово конструктора-речення: відкриваємо його вибір.
  await w.get('[data-testid="lc-slot-bg"]').trigger('click')
  return w
}

describe('фон дошки за замовчуванням', () => {
  it('одразу «🌈 Різнокольорові» на 100%', async () => {
    const w = await generateUntouched()
    expect(w.find('.lc-bg-mode__btn--active').text()).toContain('Різнокольорові')
    expect(w.find('.lc-bg-sat__val').text()).toBe('100%')
  })

  it('не чіпаючи фону, учитель отримує урок з кольоровими сторінками найяскравішого відтінку', async () => {
    const w = await generateUntouched()
    await w.get('form').trigger('submit')
    await flushPromises()
    const body = generate.mock.calls[0][0]
    expect(body.board_bg).toBeUndefined()
    expect(body.board_bg_palette).toHaveLength(8)
    expect((body.board_bg_palette as string[])[0]).toBe('#ffc2c2')   // червоний: hsl(0, 100%, 88%)
  })

  it('«Один колір» і далі можна вибрати — тоді палітри немає', async () => {
    const w = await generateUntouched()
    await w.findAll('.lc-bg-mode__btn').find((b: any) => b.text() === 'Один колір')!.trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(generate.mock.calls[0][0].board_bg_palette).toBeUndefined()
  })
})
