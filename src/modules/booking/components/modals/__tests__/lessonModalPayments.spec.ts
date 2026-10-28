/**
 * Вікно уроку в розкладі (власник 2026-10-28: «займає дохера місця і не дуже інформативне… Мені треба про оплати.
 * Окремо. Кнопку тут»): у заголовку — учень; значки «оплачено / не оплачено / з платформи / щотижня»; дії одним рядком;
 * «Оплати» відкриває огляд без форми. Учень з платформи — без «Оплати»; облік недоступний — вікно як було.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const store = { getEventDetails: vi.fn() }
const ledger = vi.fn()
vi.mock('@/modules/booking/stores/calendarWeekStore', () => ({ useCalendarWeekStore: () => store }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }))
vi.mock('@/composables/useFocusTrap', () => ({ useFocusTrap: () => ({}) }))
vi.mock('@/modules/booking/composables/useErrorHandler', () => ({ useErrorHandler: () => ({ handleError: vi.fn() }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/modules/booking/api/calendarV055Api', () => ({ calendarV055Api: { joinEventRoom: vi.fn() } }))
vi.mock('@/modules/dashboard/api/studentPayments', async (orig) => ({
  ...(await orig<any>()), studentPaymentsApi: { ledger: (...a: any[]) => ledger(...a) },
}))

import EditLessonModal from '../EditLessonModal.vue'

const Overview = defineComponent({ name: 'StudentPaymentsOverview', props: { open: Boolean, studentId: Number, studentName: String, stacked: Boolean, ledger: Object }, setup: () => () => h('div') })
const future = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString()

function details(extra: Record<string, unknown> = {}) {
  return {
    event: { id: 28, start: future, end: future, durationMin: 60, clientName: 'Аня', clientPhone: null, paidStatus: 'unpaid',
      doneStatus: 'not_done', regularity: 'once_a_week', tutorComment: '', studentId: 7, ...extra },
    dictionaries: { durations: [30, 60, 90] },
  }
}
function ownLedger(upcomingIds: number[], paidLessons = 4) {
  return {
    student_id: 7, external_platform: '', month_lessons: {}, lessons: [],
    payments: [{ id: 1, amount: 1400, lessons: paidLessons, paid_on: '2026-10-15', note: '' }],
    upcoming: upcomingIds.map((id, i) => ({ id, start: new Date(Date.now() + (i + 1) * 864e5).toISOString(), minutes: 60 })),
    balance: { tracking: true, since: '2026-10-15', paid_lessons: paidLessons, done_lessons: 0, left_lessons: paidLessons,
      last_price: 350, debt_amount: 0 },
  }
}
async function open(extra: Record<string, unknown> = {}) {
  store.getEventDetails.mockResolvedValue(details(extra))
  const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
  const w = mount(EditLessonModal, {
    props: { visible: true, eventId: 28 },
    global: {
      plugins: [i18n],
      stubs: { teleport: true, DateTimePicker: true, LoaderIcon: true, StartLessonDialog: true, JoinLessonPicker: true,
        StudentPaymentsOverview: Overview },
    },
  })
  await flushPromises()
  return w
}
const chip = (w: any, key: string) => w.find(`[data-testid="event-chip-${key}"]`)

describe('Вікно уроку в розкладі — коротко й з оплатами', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('у заголовку — учень; без вкладок і зайвого «Закрити»; дії одним рядком', async () => {
    ledger.mockResolvedValue(ownLedger([28]))
    const w = await open()
    expect(w.get('[data-testid="event-modal-title"]').text()).toBe('Аня')
    expect(w.find('.tabs-container').exists()).toBe(false)
    expect(w.findAll('button').some((b) => b.text() === 'Закрити')).toBe(false)
    expect(w.find('.classroom-join-btn').exists()).toBe(true)
    for (const id of ['event-payments-button', 'event-edit-button', 'event-tab-delete']) {
      expect(w.find(`[data-testid="${id}"]`).exists(), id).toBe(true)
    }
    expect(w.find('[data-testid="event-tab-reschedule"]').exists()).toBe(false)   // переносити не можна — кнопки немає
    expect(chip(w, 'regularity').text()).toBe('Щотижня')
  })

  it('урок у межах оплаченого — «Оплачено · лишилось»; «Оплати» відкриває огляд цього учня', async () => {
    ledger.mockResolvedValue(ownLedger([28, 35]))
    const w = await open()
    expect(ledger).toHaveBeenCalledWith(7)
    expect(chip(w, 'payment').text()).toBe('Оплачено · лишилось уроків: 4')
    expect(w.findComponent(Overview).props('open')).toBe(false)
    await w.get('[data-testid="event-payments-button"]').trigger('click')
    expect(w.findComponent(Overview).props()).toMatchObject({ open: true, studentId: 7, studentName: 'Аня', stacked: true })
    expect(w.findComponent(Overview).props('ledger')).toMatchObject({ student_id: 7 })   // другого запиту немає
    expect(ledger).toHaveBeenCalledTimes(1)
  })

  it('урок понад оплачене — «Не оплачено»', async () => {
    ledger.mockResolvedValue(ownLedger([20, 28], 1))
    const w = await open()
    expect(chip(w, 'payment').text()).toBe('Не оплачено')
  })

  it('учень з платформи — значок платформи, без «Оплати»; облік недоступний — без значка й кнопки', async () => {
    ledger.mockResolvedValue({ ...ownLedger([]), external_platform: 'Платформа А' })
    let w = await open()
    expect(chip(w, 'platform').text()).toBe('З платформи: Платформа А')
    expect(w.find('[data-testid="event-payments-button"]').exists()).toBe(false)
    ledger.mockRejectedValue({ response: { status: 403 } })
    w = await open()
    expect(chip(w, 'payment').exists()).toBe(false)
    expect(w.find('[data-testid="event-payments-button"]').exists()).toBe(false)
  })

  it('«Видалити» — сам урок без кнопки дошки; «Назад» повертає до уроку', async () => {
    ledger.mockResolvedValue(ownLedger([28]))
    const w = await open()
    await w.get('[data-testid="event-tab-delete"]').trigger('click')
    expect(w.find('.classroom-join-btn').exists()).toBe(false)
    expect(w.find('[data-testid="event-delete-button"]').exists()).toBe(true)
    await w.get('[data-testid="event-back-button"]').trigger('click')
    expect(w.find('.classroom-join-btn').exists()).toBe(true)
  })
})
