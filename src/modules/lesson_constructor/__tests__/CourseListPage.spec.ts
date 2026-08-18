import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import uk from '@/i18n/locales/uk.json'

vi.mock('../api/courseApi', () => ({
  default: {
    plan: vi.fn(), list: vi.fn(), create: vi.fn(),
    detail: vi.fn(), materialize: vi.fn(), publish: vi.fn(),
  },
}))
const push = vi.fn(() => Promise.resolve())
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

import courseApi from '../api/courseApi'
import CourseListPage from '../views/CourseListPage.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

const lesson = (order: number, sessionId: string | null) => ({
  order,
  topic_id: 'real-numbers.fractions',
  lesson_type: 'practice',
  checkpoint: false,
  session_id: sessionId,
})

/** 4 уроки, зібрані лише 1-й і 3-й. */
const COURSE = {
  id: 42,
  title: 'Раціональні числа',
  level: '6',
  rev: 2,
  status: 'draft',
  lessons: [lesson(1, 's1'), lesson(2, null), lesson(3, 's3'), lesson(4, null)],
  plan: { lessons: [1, 2, 3, 4].map((n) => ({ order: n, title: `Урок ${n}` })) },
}

async function mountList(course = COURSE) {
  vi.mocked(courseApi.list).mockResolvedValue({ courses: [course] } as never)
  vi.mocked(courseApi.detail).mockResolvedValue(course as never)
  const w = mount(CourseListPage, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

describe('CourseListPage · лічильник зібраних', () => {
  beforeEach(() => {
    vi.mocked(courseApi.list).mockReset()
    vi.mocked(courseApi.detail).mockReset()
    vi.mocked(courseApi.materialize).mockReset()
    vi.mocked(courseApi.publish).mockReset()
    push.mockClear()
  })

  it('рахує саме session_id != null, а не всі уроки', async () => {
    const w = await mountList()
    expect((w.vm as never as { builtOf: (c: unknown) => unknown }).builtOf(COURSE))
      .toEqual({ built: 2, total: 4 })
    expect(w.find('.course-list__built').text()).toContain('2')
  })

  it('статус курсу на лічильник НЕ впливає', async () => {
    // Опублікований курс може бути незібраним, і навпаки: це різні осі.
    const w = await mountList({ ...COURSE, status: 'published' })
    expect((w.vm as never as { builtOf: (c: unknown) => unknown }).builtOf(
      { ...COURSE, status: 'published' },
    )).toEqual({ built: 2, total: 4 })
  })

  it('порожній список каже про це прямо', async () => {
    vi.mocked(courseApi.list).mockResolvedValue({ courses: [] } as never)
    const w = mount(CourseListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(w.find('.course-list__empty').exists()).toBe(true)
  })

  it('404 дає «курс не знайдено», а не «немає прав»', async () => {
    vi.mocked(courseApi.list).mockRejectedValue({ response: { status: 404 } })
    const w = mount(CourseListPage, { global: { plugins: [i18n] } })
    await flushPromises()
    const err = w.find('.course-list__error')
    expect(err.text()).toBe(uk.lessonConstructor.courses.notFound)
  })
})

describe('CourseListPage · опублікований курс', () => {
  beforeEach(() => {
    vi.mocked(courseApi.list).mockReset()
    vi.mocked(courseApi.detail).mockReset()
    push.mockClear()
  })

  it('чернетка показує «Зібрати» для незібраних уроків', async () => {
    const w = await mountList()
    await w.find('.course-list__link').trigger('click')
    await flushPromises()
    const build = w.findAll('.course-lesson-row__btn')
      .filter((b) => b.text() === uk.lessonConstructor.courses.buildOne)
    expect(build).toHaveLength(2) // уроки 2 і 4
  })

  it('опублікований курс НЕ показує «Зібрати»', async () => {
    // C7: правки опублікованого курсу створюють ревізію, а не мутують його.
    const pub = { ...COURSE, status: 'published' }
    const w = await mountList(pub)
    await w.find('.course-list__link').trigger('click')
    await flushPromises()
    expect(w.text()).not.toContain(uk.lessonConstructor.courses.buildOne)
    expect(w.find('.course-list__revision-note').exists()).toBe(true)
  })

  it('зібраний урок веде на дошку, а не на матеріалізацію', async () => {
    const w = await mountList()
    await w.find('.course-list__link').trigger('click')
    await flushPromises()
    const conduct = w.findAll('.course-lesson-row__btn--primary')
    expect(conduct).toHaveLength(2)
    await conduct[0].trigger('click')
    expect(push).toHaveBeenCalledWith({
      name: 'winterboard-prepare', params: { id: 's1' },
    })
    expect(courseApi.materialize).not.toHaveBeenCalled()
  })

  it('опублікований курс не пропонує «Опублікувати» вдруге', async () => {
    const w = await mountList({ ...COURSE, status: 'published' })
    await w.find('.course-list__link').trigger('click')
    await flushPromises()
    expect(w.find('.course-list__detail-actions').text()).toBe('')
  })
})
