/**
 * Розклад: «Змінити цей і всі наступні уроки серії» (власник 26.10: «урок цей був згенерований на кілька занять.
 * Я не можу його змінити щоб змінилися всі заняття… немає кнопки застосувати для наступних»).
 * Форма «Редагувати» уроку серії, після якого є ще уроки, дає вибір «Лише цей урок» (за замовчуванням, як було)
 * або «Цей і всі наступні». Скільки уроків зміниться — каже сервер (`seriesFollowingEditCount`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const store = {
  getEventDetails: vi.fn(),
  updateEvent: vi.fn(),
  updateFollowingEvents: vi.fn(),
  deleteEvent: vi.fn(),
  deleteFollowingEvents: vi.fn(),
}
const toast = { success: vi.fn(), error: vi.fn() }
const handleError = vi.fn()

vi.mock('@/modules/booking/stores/calendarWeekStore', () => ({ useCalendarWeekStore: () => store }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))
vi.mock('@/composables/useFocusTrap', () => ({ useFocusTrap: () => ({}) }))
vi.mock('@/modules/booking/composables/useErrorHandler', () => ({ useErrorHandler: () => ({ handleError }) }))

import EditLessonModal from '../EditLessonModal.vue'

const future = new Date(Date.now() + 3 * 24 * 3600 * 1000)
future.setHours(17, 0, 0, 0)

function details(extra: Record<string, unknown>) {
  return {
    event: { id: 26, start: future.toISOString(), end: future.toISOString(), durationMin: 60, clientName: 'Олексій',
      paidStatus: 'unpaid', doneStatus: 'not_done', tutorComment: '', ...extra },
    dictionaries: { durations: [30, 60, 90] },
  }
}

async function openEditForm(extra: Record<string, unknown>) {
  store.getEventDetails.mockResolvedValue(details(extra))
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  const w = mount(EditLessonModal, {
    props: { visible: true, eventId: 26 },
    global: { plugins: [i18n], stubs: { teleport: true, EventDetailsView: true, DateTimePicker: true, LoaderIcon: true } },
  })
  await flushPromises()
  await w.get('[data-testid="event-edit-button"]').trigger('click')
  await w.get('[data-testid="duration-90"]').trigger('click')
  return w
}

describe('Редагувати урок серії: лише цей або цей і всі наступні', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.updateEvent.mockResolvedValue({})
    store.updateFollowingEvents.mockResolvedValue({ updated: 4 })
  })

  it('урок без серії — вибору немає, змінюється один', async () => {
    const w = await openEditForm({ seriesId: null, seriesFollowingEditCount: 0 })
    expect(w.find('[data-testid="event-edit-scope"]').exists()).toBe(false)
    await w.get('[data-testid="event-save-button"]').trigger('click')
    await flushPromises()
    expect(store.updateEvent).toHaveBeenCalledTimes(1)
    expect(store.updateFollowingEvents).not.toHaveBeenCalled()
  })

  it('останній урок серії — вибору немає (наступних нема)', async () => {
    const w = await openEditForm({ seriesId: 5, seriesFollowingEditCount: 1 })
    expect(w.find('[data-testid="event-edit-scope"]').exists()).toBe(false)
  })

  it('урок серії — за замовчуванням «Лише цей урок»', async () => {
    const w = await openEditForm({ seriesId: 5, seriesFollowingEditCount: 4 })
    const scope = w.get('[data-testid="event-edit-scope"]')
    expect(scope.text()).toContain('Застосувати до')
    expect(scope.text()).toContain('уроків: 4')
    expect((w.get('[data-testid="event-edit-scope-one"]').element as HTMLInputElement).checked).toBe(true)
    await w.get('[data-testid="event-save-button"]').trigger('click')
    await flushPromises()
    expect(store.updateEvent).toHaveBeenCalledTimes(1)
    expect(store.updateFollowingEvents).not.toHaveBeenCalled()
  })

  it('«Цей і всі наступні» — той самий запис, один запит на всі, тост з кількістю', async () => {
    const w = await openEditForm({ seriesId: 5, seriesFollowingEditCount: 4 })
    await w.get('[data-testid="event-edit-scope-following"]').setValue(true)
    await w.get('[data-testid="event-save-button"]').trigger('click')
    await flushPromises()
    expect(store.updateEvent).not.toHaveBeenCalled()
    expect(store.updateFollowingEvents).toHaveBeenCalledTimes(1)
    const payload = store.updateFollowingEvents.mock.calls[0][0]
    expect(payload).toMatchObject({ id: 26, durationMin: 90, tutorComment: '' })
    expect(typeof payload.start).toBe('string')
    expect(toast.success).toHaveBeenCalledWith('Змінено уроків: 4')
    expect(w.emitted('updated')).toBeTruthy()
  })

  it('перетин з іншим уроком — нічого не змінено, вчитель бачить, який урок заважає', async () => {
    store.updateFollowingEvents.mockRejectedValue({ response: { data: { error: { code: 'TIME_OVERLAP',
      details: { conflicts: [{ eventId: 29, start: future.toISOString(), conflictingEventId: 40 }] } } } } })
    const w = await openEditForm({ seriesId: 5, seriesFollowingEditCount: 4 })
    await w.get('[data-testid="event-edit-scope-following"]').setValue(true)
    await w.get('[data-testid="event-save-button"]').trigger('click')
    await flushPromises()
    expect(toast.success).not.toHaveBeenCalled()
    expect(w.text()).toContain('Нічого не змінено: урок')
    expect(w.text()).toContain('ліг би на час, зайнятий іншим уроком')
    expect(w.emitted('updated')).toBeFalsy()
  })
})
