/**
 * Сітка розкладу в режимі учня (власник 2026-10-15: урок о 16:00 за Києвом учень бачив о 13:00).
 * У режимі учня знімка тижня немає, тож пояс сітки — той, що передала сторінка учня, а не 'UTC'.
 * Клік по уроку — подія для сторінки учня; модалки вчителя учню не відкриваються.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'
import uk from '../../../../../i18n/locales/uk.json'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }), useRoute: () => ({ query: {}, params: {} }) }))

const BoardStub = defineComponent({
  name: 'CalendarBoardV2',
  props: ['days', 'events', 'timezone'],
  emits: ['event-click'],
  setup: () => () => h('div', { 'data-testid': 'board' }),
})

const EVENT = {
  id: 5,
  start: '2026-10-16T16:00:00+03:00',
  end: '2026-10-16T17:00:00+03:00',
  status: 'scheduled' as const,
  is_first: false,
  student: { id: 578, name: 'Олена' },
  lesson_link: '',
  can_reschedule: false,
  can_mark_no_show: false,
}

describe('CalendarWeekView — режим учня', () => {
  it('пояс сітки — пояс учня; клік по уроку віддається сторінці учня', async () => {
    setActivePinia(createPinia())
    const { default: CalendarWeekView } = await import('../CalendarWeekView.vue')
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
    const w = mount(CalendarWeekView, {
      props: {
        mode: 'student',
        externalDays: [{ date: '2026-10-16', dayStatus: 'working', eventsCount: 1, availableMinutes: 0, isPast: false }],
        externalEvents: [EVENT],
        externalTimezone: 'Europe/Kyiv',
      },
      global: { plugins: [i18n], stubs: { CalendarBoardV2: BoardStub, teleport: true } },
    })
    await flushPromises()
    const board = w.findComponent(BoardStub)
    expect(board.exists()).toBe(true)
    expect(board.props('timezone')).toBe('Europe/Kyiv')
    board.vm.$emit('event-click', EVENT)
    await flushPromises()
    expect(w.emitted('eventClick')?.[0]).toEqual([5])
  })
})
