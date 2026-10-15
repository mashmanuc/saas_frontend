/**
 * Вікно «Почати урок з учнем» (власник 2026-10-15: «роби вікно вибору уроку з папками»):
 * нова дошка або готовий урок з «Моїх уроків» — шлях через папки (не весь список), пошук із папкою біля
 * результату; урок, що вже триває з цим учнем, — «Повернутися», а не другий урок; збій — помилка у вікні.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import uk from '../../../../i18n/locales/uk.json'

const { push, getFolders, getMyLessonsFiltered, quickStart, getActiveLessons } = vi.hoisted(() => ({
  push: vi.fn(),
  getFolders: vi.fn(),
  getMyLessonsFiltered: vi.fn(),
  quickStart: vi.fn(),
  getActiveLessons: vi.fn(),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../../api/lessonSaveApi', () => ({ lessonSaveApi: { getFolders, getMyLessonsFiltered } }))
vi.mock('@/api/lessons', () => ({ default: { quickStart, getActiveLessons } }))

import StartLessonDialog from '../StartLessonDialog.vue'

const SL = (uk as unknown as { startLesson: Record<string, string> }).startLesson

const ModalStub = defineComponent({
  props: ['open', 'title'],
  emits: ['close'],
  setup: (props, { slots }) => () => (props.open ? h('div', { 'data-testid': 'modal', title: props.title }, slots.default?.()) : null),
})

const F = (id: string, name: string, parent: string | null, n = 1) =>
  ({ id, name, parent, order: 0, lesson_count: n, children_count: 0, created_at: '', updated_at: '' })
const L = (id: string, title: string, folder: string | null) => ({ id, title, folder, page_count: 3 })

const FOLDERS = [F('f9', '9 клас', null, 0), F('fa', 'Алгебра', 'f9', 2), F('f5', '5 клас', null, 1)]
const BY_FOLDER: Record<string, ReturnType<typeof L>[]> = {
  root: [L('l0', 'Вступний урок', null)],
  f9: [],
  fa: [L('l1', 'Квадратні рівняння', 'fa'), L('l2', 'Теорема Вієта', 'fa')],
  f5: [L('l3', 'Дроби', 'f5')],
}

function mountDialog(props: Record<string, unknown> = {}) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  return mount(StartLessonDialog, {
    props: { open: true, studentId: 580, studentName: 'Максим Учень', ...props },
    global: { plugins: [i18n], stubs: { Modal: ModalStub } },
  })
}

const items = (w: ReturnType<typeof mountDialog>) =>
  w.findAll('button[data-testid^="start-lesson-folder-"], button[data-testid^="start-lesson-item-"]')
    .map((b) => b.attributes('data-testid')!.replace('start-lesson-', ''))

describe('Вікно «Почати урок з учнем»', () => {
  beforeEach(() => {
    push.mockReset()
    quickStart.mockReset()
    getFolders.mockReset().mockResolvedValue(FOLDERS)
    getActiveLessons.mockReset().mockResolvedValue({ results: [] })
    getMyLessonsFiltered.mockReset().mockImplementation(async (p: { folder?: string; q?: string }) => {
      if (p.q) return { lessons: [L('l1', 'Квадратні рівняння', 'fa')], has_more: false }
      return { lessons: BY_FOLDER[p.folder as string] || [], has_more: false }
    })
  })

  it('корінь: папки + уроки без папки; вхід у папку → її підпапки й уроки; шлях веде назад', async () => {
    const w = mountDialog()
    await flushPromises()
    expect(w.find('[data-testid="modal"]').attributes('title')).toBe('Почати урок — Максим Учень')
    expect(getMyLessonsFiltered).toHaveBeenLastCalledWith({ folder: 'root', offset: 0, limit: 50 })
    expect(items(w)).toEqual(['folder-f5', 'folder-f9', 'item-l0'])
    // у «9 клас» уроків прямо немає, є підпапка — не «уроків: 0»
    expect(w.find('[data-testid="start-lesson-folder-count-f9"]').text()).toBe('папок: 1')
    expect(w.find('[data-testid="start-lesson-folder-count-f5"]').text()).toBe('уроків: 1')

    await w.find('[data-testid="start-lesson-folder-f9"]').trigger('click')
    await flushPromises()
    expect(items(w)).toEqual(['folder-fa'])                      // у «9 клас» лише підпапка
    await w.find('[data-testid="start-lesson-folder-fa"]').trigger('click')
    await flushPromises()
    expect(getMyLessonsFiltered).toHaveBeenLastCalledWith({ folder: 'fa', offset: 0, limit: 50 })
    expect(items(w)).toEqual(['item-l1', 'item-l2'])
    // кроки шляху — окремі кнопки, тож у тексті без пробілів навколо «›»
    expect(w.findAll('[data-testid^="start-lesson-path-"]').map((b) => b.text())).toEqual(['Мої уроки', '9 клас', 'Алгебра'])

    await w.find('[data-testid="start-lesson-path-f9"]').trigger('click')
    await flushPromises()
    expect(items(w)).toEqual(['folder-fa'])
    await w.find('[data-testid="start-lesson-path-root"]').trigger('click')
    await flushPromises()
    expect(items(w)).toEqual(['folder-f5', 'folder-f9', 'item-l0'])
  })

  it('пошук — по всіх уроках, біля результату видно папку; папки при пошуку сховано', async () => {
    vi.useFakeTimers()
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="start-lesson-search"]').setValue('квадрат')
    vi.advanceTimersByTime(300)
    vi.useRealTimers()
    await flushPromises()
    expect(getMyLessonsFiltered).toHaveBeenLastCalledWith({ q: 'квадрат', offset: 0, limit: 50 })
    expect(items(w)).toEqual(['item-l1'])
    expect(w.find('[data-testid="start-lesson-item-path-l1"]').text()).toBe('Мої уроки › 9 клас › Алгебра')
    expect(w.find('[data-testid="start-lesson-path"]').exists()).toBe(false)
  })

  it('«Нова дошка» → урок з учнем без готового уроку', async () => {
    quickStart.mockResolvedValue({ lesson_id: 166, room_url: '/winterboard/classroom/166' })
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="start-lesson-new"]').trigger('click')
    await flushPromises()
    expect(quickStart).toHaveBeenCalledWith({ student_id: 580 })
    expect(push).toHaveBeenCalledWith('/winterboard/classroom/166')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('готовий урок → урок з учнем на копії саме цього уроку', async () => {
    quickStart.mockResolvedValue({ lesson_id: 170, room_url: '/winterboard/classroom/170' })
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="start-lesson-folder-f5"]').trigger('click')
    await flushPromises()
    await w.find('[data-testid="start-lesson-item-l3"]').trigger('click')
    await flushPromises()
    expect(quickStart).toHaveBeenCalledWith({ student_id: 580, source_knowledge_lesson_id: 'l3' })
    expect(push).toHaveBeenCalledWith('/winterboard/classroom/170')
  })

  it('готовий урок не відкрився — помилка у вікні, нікуди не веде', async () => {
    quickStart.mockRejectedValue({ response: { status: 502, data: { error: 'lesson_copy_failed', detail: 'Не вдалося відкрити готовий урок.' } } })
    const w = mountDialog()
    await flushPromises()
    await w.find('[data-testid="start-lesson-item-l0"]').trigger('click')
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
    expect(w.emitted('close')).toBeUndefined()
    expect(w.find('[data-testid="start-lesson-error"]').text()).toBe('Не вдалося відкрити готовий урок.')
  })

  it('урок з учнем уже йде — «Повернутися» в нього; давно покинутий урок не пропонуємо', async () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    getActiveLessons.mockResolvedValue({ results: [{ id: 166, has_session: true, end: soon }] })
    const w = mountDialog()
    await flushPromises()
    expect(getActiveLessons).toHaveBeenCalledWith({ status: 'IN_PROGRESS', student_id: 580 }, { silent: true })
    expect(w.find('[data-testid="start-lesson-running"]').text()).toContain(SL.running)
    await w.find('[data-testid="start-lesson-return"]').trigger('click')
    expect(push).toHaveBeenCalledWith('/winterboard/classroom/166')
    expect(quickStart).not.toHaveBeenCalled()

    const stale = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    getActiveLessons.mockResolvedValue({ results: [{ id: 99, has_session: true, end: stale }] })
    const w2 = mountDialog()
    await flushPromises()
    expect(w2.find('[data-testid="start-lesson-running"]').exists()).toBe(false)
  })

  it('порожні «Мої уроки» — підказка почати з нової дошки', async () => {
    getFolders.mockResolvedValue([])
    getMyLessonsFiltered.mockResolvedValue({ lessons: [], has_more: false })
    const w = mountDialog()
    await flushPromises()
    expect(w.find('[data-testid="start-lesson-empty"]').text()).toBe(SL.noLessons)
  })
})
