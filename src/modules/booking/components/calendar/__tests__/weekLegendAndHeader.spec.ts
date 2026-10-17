/**
 * Розклад учителя (власник 2026-10-17): підпис кольорів і значків — лише коли є що пояснювати (К1, О1/О2);
 * дні вгорі — одним рядком «пн, 19» (В3).
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import uk from '../../../../../i18n/locales/uk.json'
import CalendarWeekLegend from '../CalendarWeekLegend.vue'
import CalendarBoardV2 from '../CalendarBoardV2.vue'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const WL = (uk as unknown as { calendar: { weekLegend: Record<string, string> } }).calendar.weekLegend
const legend = (events: Array<{ student?: { platform?: string | null } }>, paymentLeft?: Record<string, number>) =>
  mount(CalendarWeekLegend, { props: { events, paymentLeft }, global: { plugins: [i18n()] } })

describe('Підпис кольорів під розкладом', () => {
  it('лише свої учні й без оплат — підпису немає (розклад як був)', () => {
    expect(legend([{ student: { platform: null } }]).find('[data-testid="calendar-legend"]').exists()).toBe(false)
    expect(legend([], {}).find('[data-testid="calendar-legend"]').exists()).toBe(false)
  })

  it('є учень з платформи — пояснено обидва кольори', () => {
    const w = legend([{ student: { platform: null } }, { student: { platform: 'Платформа А' } }])
    expect(w.text()).toContain(WL.own)
    expect(w.find('[data-testid="calendar-legend-platform"]').text()).toContain(WL.platform)
    expect(w.find('[data-testid="calendar-legend-pay"]').exists()).toBe(false)
  })

  it('є значки оплати — пояснено «₴3» і «₴0»', () => {
    const w = legend([{ student: { platform: null } }], { 7: 2 })
    expect(w.find('[data-testid="calendar-legend-pay"]').text()).toContain('₴3')
    expect(w.text()).toContain(WL.unpaid)
  })
})

describe('Дні над сіткою', () => {
  it('В3: одним рядком «пн, 19»', () => {
    setActivePinia(createPinia())
    const w = mount(CalendarBoardV2, {
      props: {
        days: [{ date: '2026-10-19', dayStatus: 'working', eventsCount: 0, availableMinutes: 0, isPast: false }],
        events: [], accessibleSlots: [], timezone: 'Europe/Kyiv', blockedRanges: [], currentTime: '2026-10-17T12:00:00Z',
      },
      global: { plugins: [i18n()] },
    })
    const head = w.find('[data-testid="day-header-2026-10-19"]')
    // відступ між «пн,» і «19» дає верстка (gap), тож у DOM це два шматки одного рядка
    expect(head.find('.day-name').text()).toBe('пн,')
    expect(head.find('.day-date').text()).toBe('19')
    expect(head.find('.day-header-chip').element.children).toHaveLength(2)
  })
})
