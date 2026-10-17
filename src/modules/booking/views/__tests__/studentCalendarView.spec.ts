/**
 * Розклад учня (власник 2026-10-15: «роби спочатку розклад учня, пункти 1-4»):
 * 1) уроки в поясі учня, а не в UTC (16:00 за Києвом показувало 13:00);
 * 2) на картці — учитель, а не сам учень;
 * 3) клік по уроку відкриває картку уроку;
 * «Зайти на урок» — у живий урок із цим учителем, а коли його ще немає — пояснення, а не чужа дошка.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import uk from '../../../../i18n/locales/uk.json'

const push = vi.fn()
const getMyCalendar = vi.fn()
const joinEventRoom = vi.fn()
const getActiveLessons = vi.fn()

const route = vi.hoisted(() => ({ query: {} as Record<string, string> }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => route }))
vi.mock('@/modules/booking/composables/useScheduleDeepLink', () => ({ useScheduleDeepLink: () => {} }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 580, timezone: 'Europe/Kyiv' } }) }))
vi.mock('@/modules/booking/api/calendarV055Api', () => ({ calendarV055Api: { getMyCalendar, joinEventRoom } }))
vi.mock('@/api/lessons', () => ({ default: { getActiveLessons } }))

const EVENT = {
  id: 77,
  start: '2026-10-16T16:00:00+03:00',
  end: '2026-10-16T17:00:00+03:00',
  status: 'scheduled',
  tutor: { id: 578, name: 'Олена Вчителька' },
  student: { id: 580, name: 'Максим Учень' },
  permissions: { can_join_room: true, can_message: true },
}

const WeekStub = defineComponent({
  name: 'CalendarWeekView',
  props: ['mode', 'externalDays', 'externalEvents', 'externalTimezone'],
  emits: ['eventClick'],
  setup: () => () => h('div', { 'data-testid': 'week' }),
})
const ModalStub = defineComponent({
  props: ['open', 'title'],
  setup: (props, { slots }) => () =>
    props.open ? h('div', { 'data-testid': 'drawer' }, [slots.default?.(), slots.footer?.()]) : null,
})
const ButtonStub = defineComponent({
  setup: (_p, { slots, attrs }) => () => h('button', attrs, slots.default?.()),
})

// Сторінка велика: перше завантаження під навантаженням повного прогону не вкладалось у 5 с (тест «падав»)
let View: Awaited<typeof import('../StudentCalendarView.vue')>['default']
beforeAll(async () => {
  View = (await import('../StudentCalendarView.vue')).default
}, 60000)

async function mountView() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const w = mount(View, {
    global: { plugins: [i18n], stubs: { CalendarWeekView: WeekStub, Modal: ModalStub, Button: ButtonStub } },
  })
  await flushPromises()
  return w
}

const SC = (uk as unknown as { student: { calendar: Record<string, string> } }).student.calendar

describe('Розклад учня — посилання зі сповіщення (2026-10-17, С5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getMyCalendar.mockReset().mockResolvedValue({ results: [] })
  })

  it('?week= відкриває тиждень уроку, а не поточний', async () => {
    route.query = { week: '2026-11-02', booking: '77' }
    await mountView()
    const from = getMyCalendar.mock.calls[0][0].from as string
    // понеділок 02.11 00:00 за Києвом = 01.11 22:00 UTC
    expect(from).toBe('2026-11-01T22:00:00.000Z')
    route.query = {}
  })
})

describe('Розклад учня', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    push.mockReset()
    joinEventRoom.mockReset()
    getActiveLessons.mockReset()
    getMyCalendar.mockReset().mockResolvedValue({ results: [EVENT] })
  })

  it('уроки — у поясі учня; на картці — учитель', async () => {
    const w = await mountView()
    expect(getMyCalendar.mock.calls[0][0].tz).toBe('Europe/Kyiv')
    const week = w.findComponent(WeekStub)
    expect(week.props('externalTimezone')).toBe('Europe/Kyiv')
    expect(week.props('externalEvents')[0].student).toEqual({ id: 578, name: 'Олена Вчителька' })
  })

  it('клік по уроку відкриває картку уроку з учителем і часом у поясі учня', async () => {
    const w = await mountView()
    expect(w.find('[data-testid="drawer"]').exists()).toBe(false)
    w.findComponent(WeekStub).vm.$emit('eventClick', 77)
    await flushPromises()
    const drawer = w.find('[data-testid="drawer"]')
    expect(drawer.text()).toContain('Олена Вчителька')
    expect(drawer.text()).toContain('16:00')
    // статус словами, а не ключем перекладу (calendar.status — це підпис «Статус», а не словник)
    expect(drawer.text()).toContain((SC as unknown as { statusLabel: Record<string, string> }).statusLabel.scheduled)
    expect(drawer.text()).not.toContain('calendar.status')
  })

  it('«Зайти на урок»: учитель уже відкрив урок — у живий урок', async () => {
    getActiveLessons.mockResolvedValue({
      results: [
        { id: 'other', tutor_id: 999, has_session: true },
        { id: 'live-1', tutor_id: 578, has_session: true },
      ],
    })
    const w = await mountView()
    w.findComponent(WeekStub).vm.$emit('eventClick', 77)
    await flushPromises()
    const join = w.findAll('button').find((b) => b.text() === SC.joinLesson)!
    await join.trigger('click')
    await flushPromises()
    expect(getActiveLessons).toHaveBeenCalledWith({ status: 'IN_PROGRESS' }, { silent: true })
    expect(push).toHaveBeenCalledWith('/winterboard/classroom/live-1')
    expect(joinEventRoom).not.toHaveBeenCalled()
  })

  it('«Зайти на урок»: покинутий учителем урок (кінець давніше за 2 год) — не живий, «Урок ще не почався»', async () => {
    const stale = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    getActiveLessons.mockResolvedValue({ results: [{ id: 'old', tutor_id: 578, has_session: true, end: stale }] })
    const w = await mountView()
    w.findComponent(WeekStub).vm.$emit('eventClick', 77)
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === SC.joinLesson)!.trigger('click')
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
    expect(w.find('[data-testid="student-join-hint"]').text()).toBe(SC.notStarted)
  })

  it('«Зайти на урок»: урок ще не почався — пояснення, нікуди не веде', async () => {
    getActiveLessons.mockResolvedValue({ results: [] })
    const w = await mountView()
    w.findComponent(WeekStub).vm.$emit('eventClick', 77)
    await flushPromises()
    await w.findAll('button').find((b) => b.text() === SC.joinLesson)!.trigger('click')
    await flushPromises()
    expect(push).not.toHaveBeenCalled()
    expect(joinEventRoom).not.toHaveBeenCalled()
    expect(w.find('[data-testid="student-join-hint"]').text()).toBe(SC.notStarted)
  })
})
