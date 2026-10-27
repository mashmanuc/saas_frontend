/**
 * Підсумок уроку (власник 2026-10-27: «зразу після уроку або між уроками відзначити, що відбулось, не відбулось
 * заняття… або ще зробити додаткове заняття»). Правила П1–П8 — backend BOOKING_DOMAIN_SSOT.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import uk from '../../../../../i18n/locales/uk.json'

const setOutcome = vi.fn()
const eventForSession = vi.fn()
vi.mock('@/modules/booking/api/lessonOutcomeApi', () => ({
  lessonOutcomeApi: { setOutcome: (...a: unknown[]) => setOutcome(...a), eventForSession: (...a: unknown[]) => eventForSession(...a) },
}))
const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))

import LessonOutcomePanel from '../LessonOutcomePanel.vue'
import AfterLessonOutcomeDialog from '../AfterLessonOutcomeDialog.vue'
import EventsLayer from '../../calendar/layers/EventsLayer.vue'
import { requestAfterLessonOutcome } from '@/modules/booking/composables/afterLessonOutcome'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const panel = (outcome: 'held' | 'not_held' | null) =>
  mount(LessonOutcomePanel, { props: { eventId: 7, outcome }, global: { plugins: [i18n()] } })

beforeEach(() => {
  setOutcome.mockReset()
  eventForSession.mockReset()
  push.mockReset()
  document.body.innerHTML = ''
})

describe('Панель «Як пройшов урок?»', () => {
  it('«Відбувся» зберігає й підсвічується; той самий підсумок удруге не надсилається (П3)', async () => {
    setOutcome.mockResolvedValue({ id: 7, outcome: 'held' })
    const w = panel(null)
    await w.find('[data-testid="lesson-outcome-held"]').trigger('click')
    await flushPromises()
    expect(setOutcome).toHaveBeenCalledWith(7, 'held')
    expect(w.emitted('changed')?.[0]).toEqual(['held'])
    expect(w.find('[data-testid="lesson-outcome-held"]').attributes('aria-pressed')).toBe('true')
    await w.find('[data-testid="lesson-outcome-held"]').trigger('click')
    expect(setOutcome).toHaveBeenCalledTimes(1)
  })

  it('«Не відбувся» — підказка про оплату й «Призначити інший час» замість «Додаткове заняття»', async () => {
    const w = panel('not_held')
    expect(w.find('[data-testid="lesson-outcome-hint"]').text()).toContain('не рахується в оплаті')
    expect(w.find('[data-testid="lesson-outcome-extra"]').text()).toContain('Призначити інший час')
    await w.find('[data-testid="lesson-outcome-extra"]').trigger('click')
    expect(w.emitted('extra')).toHaveLength(1)
  })

  it('помилку сервера видно, підсумок не змінюється', async () => {
    setOutcome.mockRejectedValue({ response: { data: { error: { message: 'Урок ще не почався.' } } } })
    const w = panel(null)
    await w.find('[data-testid="lesson-outcome-not-held"]').trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').text()).toBe('Урок ще не почався.')
    expect(w.emitted('changed')).toBeUndefined()
  })
})

describe('Вікно одразу після «Завершити урок» (П7)', () => {
  const dialog = () => mount(AfterLessonOutcomeDialog, { global: { plugins: [i18n()] }, attachTo: document.body })
  const EV = { id: 5, start: '2026-10-27T15:00:00Z', end: '2026-10-27T16:00:00Z', studentId: 42, studentName: 'Максим Учень', outcome: null }

  it('є пара в розкладі — питає підсумок; «+ Додаткове заняття» веде в розклад з цим учнем', async () => {
    eventForSession.mockResolvedValue({ ...EV })
    const w = dialog()
    requestAfterLessonOutcome('sess-1')
    await flushPromises()
    await nextTick()
    expect(eventForSession).toHaveBeenCalledWith('sess-1')
    expect(document.body.querySelector('[data-testid="after-lesson-outcome"]')?.textContent).toContain('Максим Учень')
    ;(document.body.querySelector('[data-testid="lesson-outcome-extra"]') as HTMLButtonElement).click()
    await flushPromises()
    expect(push).toHaveBeenCalledWith(expect.objectContaining({
      path: '/tutor/schedule', query: expect.objectContaining({ extraLesson: '42' }),
    }))
    w.unmount()
  })

  it('пари немає — вікна немає', async () => {
    eventForSession.mockResolvedValue(null)
    const w = dialog()
    requestAfterLessonOutcome('sess-2')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="after-lesson-outcome"]')).toBeNull()
    w.unmount()
  })
})

describe('Картка уроку в розкладі показує підсумок (П2)', () => {
  const card = (outcome: 'held' | 'not_held' | null) => mount(EventsLayer, {
    props: {
      events: [{ id: 1, start: '2026-10-19T18:00:00+03:00', end: '2026-10-19T19:00:00+03:00', status: 'completed',
        student: { id: 9, name: 'Олексій' }, outcome }],
      pxPerMinute: 0.75, isPastFn: () => true, timezone: 'Europe/Kyiv',
    },
    global: { plugins: [i18n()] },
  }).find('[data-testid="lesson-card"]')

  it('«Відбувся» — ✓, «Не відбувся» — закреслено, без підсумку — як було', () => {
    expect(card('held').classes()).toContain('is-held')
    expect(card('held').text()).toContain('✓')
    expect(card('held').attributes('title')).toContain('Відбувся')
    expect(card('not_held').classes()).toContain('is-not-held')
    expect(card('not_held').attributes('title')).toContain('Не відбувся')
    expect(card(null).classes()).not.toContain('is-held')
    expect(card(null).classes()).not.toContain('is-not-held')
  })
})
