/**
 * «Мої уроки» відкривають вікно «Зберегти як новий шаблон» за дією з підтвердження після
 * «← Мої уроки» (?save_copy=<сесія>&save_copy_title=<назва>; власник 2026-10-03).
 * Окремий файл: тут маршрут із query, а WBMyLessonsPage.spec мокає порожній.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { reactive } from 'vue'

const mockReplace = vi.fn()
const route = reactive<{ query: Record<string, string | undefined>; params: object; path: string }>({
  query: {}, params: {}, path: '/knowledge/my-lessons',
})

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
  useRoute: () => route,
  RouterLink: { template: '<a><slot /></a>' },
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
    locale: { value: 'uk' },
  }),
}))

vi.mock('../api/lessonSaveApi', () => ({
  lessonSaveApi: {
    getMyLessons: vi.fn(),
    getMyLessonsFiltered: vi.fn(),
    createSessionFromLesson: vi.fn(),
    getFolders: vi.fn().mockResolvedValue([]),
    saveLessonFromSession: vi.fn(),
  },
}))

vi.mock('../api/lessonViewApi', () => ({
  lessonViewApi: {
    loadToSession: vi.fn(),
    prepareLesson: vi.fn(),
    listConducted: vi.fn(),
    generateShareLink: vi.fn(),
    updateSnapshot: vi.fn(),
  },
}))

vi.mock('@/utils/apiClient', () => ({ default: { patch: vi.fn(), delete: vi.fn() } }))

import WBMyLessonsPage from '../views/WBMyLessonsPage.vue'
import { lessonSaveApi } from '../api/lessonSaveApi'
import { lessonViewApi } from '../api/lessonViewApi'
import { useNotifyStore } from '@/stores/notifyStore'

const EMPTY = { lessons: [], total: 0, has_more: false, offset: 0, limit: 20 }

async function mountPage(query: Record<string, string | undefined>) {
  route.query = query
  const w = mount(WBMyLessonsPage, { global: { stubs: { teleport: true } } })
  await flushPromises()
  return w
}

describe('WBMyLessonsPage — «Зберегти як новий шаблон» із підтвердження', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(lessonSaveApi.getMyLessonsFiltered).mockResolvedValue(EMPTY as never)
    vi.mocked(lessonViewApi.listConducted).mockResolvedValue({ sessions: [], total: 0 } as never)
  })

  it('?save_copy відкриває вікно копії з назвою за замовчуванням і прибирає параметри з адреси', async () => {
    const w = await mountPage({ save_copy: 'sid-9', save_copy_title: 'VISION_1 — копія' })
    expect(w.text()).toContain('winterboard.lesson.copy.title')
    expect((w.get('.save-lesson-overlay input').element as HTMLInputElement).value).toBe('VISION_1 — копія')
    expect(mockReplace).toHaveBeenCalledWith({ query: { save_copy: undefined, save_copy_title: undefined } })
    w.unmount()
  })

  it('«Зберегти шаблон» — саме ця сесія; потім підтвердження, вкладка «Уроки» й оновлений список', async () => {
    vi.mocked(lessonSaveApi.saveLessonFromSession).mockResolvedValue({ id: 'new-1', title: 'VISION_1 — копія' } as never)
    const notify = useNotifyStore()
    const success = vi.spyOn(notify, 'success')
    const w = await mountPage({ save_copy: 'sid-9', save_copy_title: 'VISION_1 — копія' })
    const calls = vi.mocked(lessonSaveApi.getMyLessonsFiltered).mock.calls.length

    const saveBtn = w.findAll('button').find((b) => b.text().includes('winterboard.lesson.copy.save'))!
    await saveBtn.trigger('click')
    await flushPromises()

    expect(lessonSaveApi.saveLessonFromSession).toHaveBeenCalledWith({ session_id: 'sid-9', title: 'VISION_1 — копія' })
    expect(success).toHaveBeenCalledWith('winterboard.lesson.copy.savedToast {"title":"VISION_1 — копія"}')
    expect(vi.mocked(lessonSaveApi.getMyLessonsFiltered).mock.calls.length).toBeGreaterThan(calls)
    expect(w.text()).not.toContain('winterboard.lesson.copy.title')
    w.unmount()
  })

  it('без ?save_copy вікна немає', async () => {
    const w = await mountPage({})
    expect(w.text()).not.toContain('winterboard.lesson.copy.title')
    expect(lessonSaveApi.saveLessonFromSession).not.toHaveBeenCalled()
    w.unmount()
  })
})
