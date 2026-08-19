import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'

import uk from '@/i18n/locales/uk.json'

const push = vi.fn(() => Promise.resolve())
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))

const notifyError = vi.fn()
vi.mock('@/utils/notify', () => ({ notifyError: (...a: unknown[]) => notifyError(...a) }))

const saveCourse = vi.fn()
const saveAndMaterialize = vi.fn()
const buildPlan = vi.fn()
const state = {
  spec: ref({ title: 'К', level: '6', n_lessons: 4, topics_scope: [] }),
  plan: ref({ v: 1, lessons: [], warnings: [], density: {}, evidence_version: '1' }),
  warnings: ref([]), density: ref({}), selectedOrders: ref(new Set<number>()),
  loading: ref(false), saving: ref(false), error: ref(null), report: ref(null),
  hasPlan: ref(true), selectedCount: ref(0),
  buildPlan, toggleLesson: vi.fn(), setAllSelected: vi.fn(),
  saveCourse, saveAndMaterialize,
}
vi.mock('../composables/useCoursePlanner', () => ({ default: () => state }))

import CoursePlannerPage from '../views/CoursePlannerPage.vue'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

function mountPage() {
  return mount(CoursePlannerPage, {
    global: {
      plugins: [i18n],
      stubs: { CoursePlanPreview: true, MaterializeReport: true },
    },
  })
}

describe('CoursePlannerPage · «Зберегти курс»', () => {
  beforeEach(() => {
    push.mockClear()
    notifyError.mockClear()
    saveCourse.mockReset().mockResolvedValue({ id: 42, title: 'Раціональні числа' })
  })

  it('НЕ штовхає в маршрут — його не існує', async () => {
    // `lesson-constructor-courses` не оголошено ніде: вхід у курси — це
    // studioMode всередині WBBoardList. Раніше reject ковтав порожній catch,
    // і збереження виглядало як «нічого не сталось».
    const w = mountPage()
    await w.find('.course-planner__save button').trigger('click')
    await flushPromises()

    expect(saveCourse).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it('показує видимий сигнал успіху з назвою курсу', async () => {
    const w = mountPage()
    await w.find('.course-planner__save button').trigger('click')
    await flushPromises()

    const banner = w.find('.course-planner__saved')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Раціональні числа')
    expect(banner.attributes('role')).toBe('status')
  })

  it('сигнал лишається у формі, а не зникає сам', async () => {
    // Тост зник би через 5 с; тьютор, який відвернувся, не дізнався б нічого.
    const w = mountPage()
    await w.find('.course-planner__save button').trigger('click')
    await flushPromises()
    await w.vm.$nextTick()

    expect(w.find('.course-planner__saved').exists()).toBe(true)
  })

  it('без збереження банера немає', () => {
    expect(mountPage().find('.course-planner__saved').exists()).toBe(false)
  })

  it('невдале збереження банера не показує', async () => {
    saveCourse.mockResolvedValueOnce(null)
    const w = mountPage()
    await w.find('.course-planner__save button').trigger('click')
    await flushPromises()

    expect(w.find('.course-planner__saved').exists()).toBe(false)
  })

  it('перехід до списку йде подією, а не маршрутом', async () => {
    const w = mountPage()
    await w.find('.course-planner__save button').trigger('click')
    await flushPromises()
    await w.find('.course-planner__to-list').trigger('click')

    expect(w.emitted('go-to-list')).toHaveLength(1)
    expect(push).not.toHaveBeenCalled()
  })
})

describe('CoursePlannerPage · порожніх catch не лишилось', () => {
  beforeEach(() => {
    push.mockReset().mockResolvedValue(undefined)
    notifyError.mockClear()
  })

  it('збій переходу на дошку показується, а не глушиться', async () => {
    push.mockRejectedValueOnce(new Error('no match'))
    const w = mountPage()

    // MaterializeReport застабовано, тож смикаємо обробник напряму —
    // предмет тесту саме він, а не розмітка звіту.
    ;(w.vm as never as { openSession: (id: string) => void }).openSession('s1')
    await flushPromises()

    expect(notifyError).toHaveBeenCalledTimes(1)
  })

  it('успішний перехід нічого не повідомляє', async () => {
    const w = mountPage()
    ;(w.vm as never as { openSession: (id: string) => void }).openSession('s1')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      name: 'winterboard-prepare', params: { id: 's1' },
    })
    expect(notifyError).not.toHaveBeenCalled()
  })
})
