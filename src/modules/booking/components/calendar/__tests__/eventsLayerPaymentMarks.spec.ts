/**
 * Залишок передоплати на уроці в розкладі (власник 2026-10-15: «роби — залишок на уроці в розкладі»):
 * на картці уроку — «останній оплачений» чи «не оплачено»; оплачені й без обліку — без позначки.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../../i18n/locales/uk.json'
import EventsLayer from '../layers/EventsLayer.vue'

const PM = (uk as unknown as { calendar: { paymentMark: Record<string, string> } }).calendar.paymentMark
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

const EVENTS = [
  { id: 1, start: '2026-10-20T07:00:00Z', end: '2026-10-20T08:00:00Z', status: 'scheduled', student: { id: 9, name: 'Оля' } },
  { id: 2, start: '2026-10-21T07:00:00Z', end: '2026-10-21T08:00:00Z', status: 'scheduled', student: { id: 9, name: 'Оля' } },
  { id: 3, start: '2026-10-22T07:00:00Z', end: '2026-10-22T08:00:00Z', status: 'scheduled', student: { id: 9, name: 'Оля' } },
]

function layer(paymentMarks?: Record<string, 'last' | 'unpaid'>, pxPerMinute = 1) {
  return mount(EventsLayer, {
    props: { events: EVENTS, pxPerMinute, isPastFn: () => false, timezone: 'Europe/Kyiv', paymentMarks },
    global: { plugins: [i18n()] },
  })
}

describe('EventsLayer — залишок передоплати на картці уроку', () => {
  it('«останній оплачений» і «не оплачено»; оплачений — без позначки', () => {
    const w = layer({ 2: 'last', 3: 'unpaid' })
    expect(w.find('[data-testid="lesson-pay-1"]').exists()).toBe(false)
    expect(w.find('[data-testid="lesson-pay-2"]').text()).toBe(PM.last)
    expect(w.find('[data-testid="lesson-pay-2"]').classes()).toContain('event-pay--last')
    expect(w.find('[data-testid="lesson-pay-3"]').text()).toBe(PM.unpaid)
    expect(w.find('[data-testid="lesson-pay-3"]').classes()).toContain('event-pay--unpaid')
    // 60-хв картка низька: позначка — на місці часу, смуга ліворуч і пояснення в підказці
    const cards = w.findAll('[data-testid="lesson-card"]')
    expect(cards[0].find('[data-testid="lesson-time"]').exists()).toBe(true)
    expect(cards[1].find('[data-testid="lesson-time"]').exists()).toBe(false)
    expect(cards[1].classes()).toContain('event-card--pay-last')
    expect(cards[2].classes()).toContain('event-card--pay-unpaid')
    expect(cards[1].attributes('title')).toBe(PM.lastTitle)
    expect(cards[0].attributes('title')).toBeUndefined()
    expect(cards[1].find('[data-testid="lesson-pay-chip-2"]').classes()).toContain('event-pay-chip--last')
    expect(cards[0].find('.event-pay-chip').exists()).toBe(false)
  })

  it('низька картка (60 хв ≈ 36 px): лише ₴ і смуга, без плашки, чий край визирав би знизу', () => {
    const w = layer({ 2: 'last' }, 0.6)
    const card = w.findAll('[data-testid="lesson-card"]')[1]
    expect(card.find('[data-testid="lesson-pay-chip-2"]').exists()).toBe(true)
    expect(card.find('[data-testid="lesson-pay-2"]').exists()).toBe(false)
    expect(card.classes()).toContain('event-card--pay-last')
  })

  it('облік вимкнено чи позначок немає — картки як були', () => {
    expect(layer().findAll('.event-pay')).toHaveLength(0)
    expect(layer({}).findAll('.event-pay')).toHaveLength(0)
  })
})
