/**
 * Розклад: «Цей і всі наступні уроки серії» (власник 22.10: «уроки повторюються багато разів… щоб я міг видалити
 * всі наступні уроки»). На вкладці «Видалити» уроку з серії — вибір «Лише цей урок» / «Цей і всі наступні»;
 * за замовчуванням — лише цей (як було). Скільки уроків піде — каже сервер (`seriesFollowingCount`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const store = {
  getEventDetails: vi.fn(),
  deleteEvent: vi.fn(),
  deleteFollowingEvents: vi.fn(),
}
const toast = { success: vi.fn(), error: vi.fn() }

vi.mock('@/modules/booking/stores/calendarWeekStore', () => ({ useCalendarWeekStore: () => store }))
vi.mock('@/composables/useToast', () => ({ useToast: () => toast }))
vi.mock('@/composables/useFocusTrap', () => ({ useFocusTrap: () => ({}) }))
vi.mock('@/modules/booking/composables/useErrorHandler', () => ({ useErrorHandler: () => ({ handleError: vi.fn() }) }))

import EditLessonModal from '../EditLessonModal.vue'

const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString()

function details(extra: Record<string, unknown>) {
  return {
    event: { id: 26, start: future, end: future, durationMin: 60, clientName: 'Emma Konrat', paidStatus: 'unpaid',
      doneStatus: 'not_done', tutorComment: '', ...extra },
    dictionaries: { durations: [30, 60, 90] },
  }
}

async function openDeleteTab(extra: Record<string, unknown>) {
  store.getEventDetails.mockResolvedValue(details(extra))
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  const w = mount(EditLessonModal, {
    props: { visible: true, eventId: 26 },
    global: {
      plugins: [i18n],
      stubs: { teleport: true, EventDetailsView: true, DateTimePicker: true, LoaderIcon: true },
    },
  })
  await flushPromises()
  await w.find('[data-testid="event-tab-delete"]').trigger('click')
  return w
}

async function deleteAndConfirm(w: ReturnType<typeof mount>) {
  await w.find('[data-testid="event-delete-button"]').trigger('click')
  const confirm = w.findAll('button').find((b) => b.text() === 'Видалити' && !b.attributes('data-testid'))
  expect(confirm, 'кнопка підтвердження').toBeTruthy()
  await confirm!.trigger('click')
  await flushPromises()
}

describe('Видалити урок серії: лише цей або цей і всі наступні', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    store.deleteFollowingEvents.mockResolvedValue({ cancelled: 4 })
    store.deleteEvent.mockResolvedValue({})
  })

  it('урок без серії — вибору немає, видаляється один', async () => {
    const w = await openDeleteTab({ seriesId: null, seriesFollowingCount: 0 })
    expect(w.find('[data-testid="event-delete-scope"]').exists()).toBe(false)
    await deleteAndConfirm(w)
    expect(store.deleteEvent).toHaveBeenCalledWith(26)
    expect(store.deleteFollowingEvents).not.toHaveBeenCalled()
  })

  it('останній урок серії — вибору немає (наступних нема)', async () => {
    const w = await openDeleteTab({ seriesId: 5, seriesFollowingCount: 1 })
    expect(w.find('[data-testid="event-delete-scope"]').exists()).toBe(false)
  })

  it('урок серії — за замовчуванням «Лише цей урок», видаляється один', async () => {
    const w = await openDeleteTab({ seriesId: 5, seriesFollowingCount: 4 })
    const scope = w.find('[data-testid="event-delete-scope"]')
    expect(scope.exists()).toBe(true)
    expect(scope.text()).toContain('Лише цей урок')
    expect(scope.text()).toContain('уроків: 4')
    expect((w.find('[data-testid="event-delete-scope-one"]').element as HTMLInputElement).checked).toBe(true)
    await deleteAndConfirm(w)
    expect(store.deleteEvent).toHaveBeenCalledWith(26)
    expect(store.deleteFollowingEvents).not.toHaveBeenCalled()
  })

  it('«Цей і всі наступні» — підтвердження з кількістю, один запит на всі, тост з кількістю', async () => {
    const w = await openDeleteTab({ seriesId: 5, seriesFollowingCount: 4 })
    await w.find('[data-testid="event-delete-scope-following"]').setValue(true)
    await w.find('[data-testid="event-delete-button"]').trigger('click')
    expect(w.text()).toContain('Видалити уроки з Emma Konrat, починаючи з')
    expect(w.text()).toContain('Уроків: 4. Попередні уроки лишаться.')
    const confirm = w.findAll('button').find((b) => b.text() === 'Видалити' && !b.attributes('data-testid'))
    await confirm!.trigger('click')
    await flushPromises()
    expect(store.deleteFollowingEvents).toHaveBeenCalledWith(26)
    expect(store.deleteEvent).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('Уроків видалено: 4')
    expect(w.emitted('deleted')).toBeTruthy()
  })
})
