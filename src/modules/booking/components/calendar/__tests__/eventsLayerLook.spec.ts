/**
 * Урок у розкладі вчителя — вигляд, колір, залишок оплати (власник 2026-10-17; інваріанти в BOOKING_DOMAIN_SSOT):
 * В1 на всю ширину колонки й рівно свою тривалість; В2 годинний — імʼя й час двома рядками, коротший — одним;
 * К1 учень «З платформи» — інший колір; К2 колір від оплати не залежить; О3/О6 значок «₴N» / «₴0», не ховає імʼя;
 * О1/О2 немає даних про оплату — жодного значка.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../../i18n/locales/uk.json'
import EventsLayer from '../layers/EventsLayer.vue'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const PX = 0.75 // 45 px на годину

const ev = (id: number, start: string, end: string, platform: string | null = null, name = 'Олексій') =>
  ({ id, start, end, status: 'scheduled', student: { id: 9, name, platform } })

const EVENTS = [
  ev(1, '2026-10-19T18:00:00+03:00', '2026-10-19T19:00:00+03:00'),
  ev(2, '2026-10-19T19:00:00+03:00', '2026-10-19T19:30:00+03:00', null, 'Вероніка'),
  ev(3, '2026-10-19T20:00:00+03:00', '2026-10-19T21:00:00+03:00', 'Платформа А', 'Аня'),
  ev(4, '2026-10-19T10:00:00+03:00', '2026-10-19T11:30:00+03:00', null, 'Емма Довгоприщенко-Коваленко'),
]

function layer(paymentLeft?: Record<string, number>) {
  return mount(EventsLayer, {
    props: { events: EVENTS, pxPerMinute: PX, isPastFn: () => false, timezone: 'Europe/Kyiv', paymentLeft },
    global: { plugins: [i18n()] },
  })
}
const card = (w: ReturnType<typeof layer>, id: number) => w.find(`[data-testid="lesson-card"][data-lesson-id="${id}"]`)
const px = (style: string | undefined, prop: string) => Number(new RegExp(`${prop}:\\s*([\\d.]+)px`).exec(style || '')?.[1])

describe('Урок у розкладі вчителя', () => {
  it('В1: висота — рівно тривалість (година — 45 px, пів години — 22.5 px) мінус проміжок 1+1 px', () => {
    const w = layer()
    expect(px(card(w, 1).attributes('style'), 'height')).toBe(43)
    expect(px(card(w, 2).attributes('style'), 'height')).toBeCloseTo(20.5)
    expect(px(card(w, 2).attributes('style'), 'top') - px(card(w, 1).attributes('style'), 'top')).toBe(45)  // 19:00 рівно під 18:00
    // посилання зі сповіщення (?booking=) знаходить картку за цією міткою (2026-10-17)
    expect(card(w, 1).attributes('data-event-id')).toBe('1')
  })

  it('В2: годинний — імʼя і «18:00 – 19:00» окремими рядками; пів години — один рядок «імʼя 19:00»', () => {
    const w = layer()
    expect(card(w, 1).find('[data-testid="lesson-name"]').text()).toBe('Олексій')
    expect(card(w, 1).find('.event-time').text()).toBe('18:00 – 19:00')
    expect(card(w, 1).classes()).not.toContain('is-short')
    expect(card(w, 2).classes()).toContain('is-short')
    expect(card(w, 2).find('.event-time').exists()).toBe(false)
    expect(card(w, 2).find('.event-time-inline').text()).toBe('19:00')
    // довге імʼя на півторагодинному — у два рядки; повне імʼя й час — у підказці
    expect(card(w, 4).find('[data-testid="lesson-name"]').classes()).toContain('event-student--two')
    expect(card(w, 4).attributes('title')).toContain('Емма Довгоприщенко-Коваленко · 10:00 – 11:30')
  })

  it('К1: учень «З платформи» — синя картка, свій — зелена; у підказці — звідки', () => {
    const w = layer()
    expect(card(w, 3).classes()).toContain('is-platform')
    expect(card(w, 1).classes()).not.toContain('is-platform')
    expect(card(w, 3).attributes('title')).toContain('з платформи «Платформа А»')
  })

  it('О3/О6: «₴3», «₴1» (останній), «₴0» (не оплачено) — перед імʼям, імʼя й час на місці', () => {
    const w = layer({ 1: 3, 2: 1, 4: 0 })
    expect(card(w, 1).find('[data-testid="lesson-pay-chip-1"]').text()).toBe('₴3')
    expect(card(w, 2).find('[data-testid="lesson-pay-chip-2"]').classes()).toContain('event-pay-chip--last')
    const unpaid = card(w, 4).find('[data-testid="lesson-pay-chip-4"]')
    expect(unpaid.text()).toBe('₴0')
    expect(unpaid.classes()).toContain('event-pay-chip--unpaid')
    expect(card(w, 1).find('[data-testid="lesson-name"]').text()).toBe('Олексій')
    expect(card(w, 1).find('.event-time').text()).toBe('18:00 – 19:00')
    expect(card(w, 1).attributes('title')).toContain('оплачено ще 3 (разом із цим уроком)')
    expect(card(w, 4).attributes('title')).toContain('не оплачено')
  })

  it('К2: колір картки від оплати не залежить', () => {
    const plain = layer().findAll('[data-testid="lesson-card"]').map((c) => c.classes().join(' '))
    const paid = layer({ 1: 0, 3: 2 }).findAll('[data-testid="lesson-card"]').map((c) => c.classes().join(' '))
    expect(paid).toEqual(plain)
  })

  it('О1/О2: даних про оплату немає (вимкнено або оплат не вносили) — жодного значка', () => {
    expect(layer().findAll('.event-pay-chip')).toHaveLength(0)
    expect(layer({}).findAll('.event-pay-chip')).toHaveLength(0)
  })
})
