/**
 * «Відкрити дошку уроку» в розкладі вчителя (власник 2026-10-15, Б-203): для уроку з учнем — вікно
 * «Почати урок з учнем» (нова дошка або готовий урок), а не кімната події, яка без живого уроку = особиста
 * дошка вчителя, куди учень не потрапить. Подія без учня — як було.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

const { push, joinEventRoom } = vi.hoisted(() => ({ push: vi.fn(), joinEventRoom: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/modules/booking/api/calendarV055Api', () => ({ calendarV055Api: { joinEventRoom } }))

import EventDetailsView from '../EventDetailsView.vue'

const DialogStub = defineComponent({
  name: 'StartLessonDialog',
  props: ['open', 'studentId', 'studentName'],
  setup: () => () => h('div'),
})

const EVENT = {
  id: 50, type: 'class', start: '2026-10-15T13:45:00+03:00', end: '2026-10-15T14:45:00+03:00', durationMin: 60,
  orderId: 212, clientName: 'Максим Учень', clientPhone: null, paidStatus: 'unpaid', doneStatus: 'not_done',
  regularity: 'single', tutorComment: '',
}

function view(event: Record<string, unknown>) {
  return mount(EventDetailsView, {
    props: { event: event as never, dictionaries: {} },
    global: { stubs: { StartLessonDialog: DialogStub, JoinLessonPicker: true }, mocks: { $t: (k: string) => k } },
  })
}

describe('Розклад учителя — «Відкрити дошку уроку»', () => {
  beforeEach(() => {
    push.mockReset()
    joinEventRoom.mockReset().mockResolvedValue({ room: { url: '/winterboard/abc' } })
  })

  it('урок з учнем → вікно «Почати урок з учнем», кімнату події не відкриваємо', async () => {
    const w = view({ ...EVENT, studentId: 580 })
    expect(w.findComponent(DialogStub).props('open')).toBe(false)
    await w.find('.classroom-join-btn').trigger('click')
    await flushPromises()
    const dialog = w.findComponent(DialogStub)
    expect(dialog.props()).toEqual({ open: true, studentId: 580, studentName: 'Максим Учень' })
    expect(joinEventRoom).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('подія без учня — як було: кімната події', async () => {
    const w = view({ ...EVENT, studentId: null })
    await w.find('.classroom-join-btn').trigger('click')
    await flushPromises()
    expect(joinEventRoom).toHaveBeenCalledWith(50)
    expect(push).toHaveBeenCalledWith('/winterboard/abc')
  })
})

// Підсумок уроку (власник 2026-10-27; BOOKING_DOMAIN_SSOT П1): лише на головній вкладці (actions), лише урок з учнем,
// що вже почався
describe('Розклад учителя — «Як пройшов урок?»', () => {
  const PanelStub = defineComponent({ name: 'LessonOutcomePanel', props: ['eventId', 'outcome'], emits: ['changed', 'extra'],
    setup: () => () => h('div', { 'data-testid': 'panel' }) })
  const past = new Date(Date.now() - 2 * 3600_000).toISOString()
  const future = new Date(Date.now() + 2 * 3600_000).toISOString()
  const withPanel = (event: Record<string, unknown>, actions = true) => mount(EventDetailsView, {
    props: { event: event as never, dictionaries: {}, actions },
    global: { stubs: { StartLessonDialog: DialogStub, JoinLessonPicker: true, LessonOutcomePanel: PanelStub },
      mocks: { $t: (k: string) => k } },
  })

  it('урок з учнем, що вже почався, — є; з підсумком — передає його; події нагору', async () => {
    const w = withPanel({ ...EVENT, start: past, studentId: 580, outcome: 'held' })
    const p = w.findComponent(PanelStub)
    expect(p.exists()).toBe(true)
    expect(p.props('outcome')).toBe('held')
    p.vm.$emit('changed', 'not_held')
    p.vm.$emit('extra')
    expect(w.emitted('outcome-changed')?.[0]).toEqual(['not_held'])
    expect(w.emitted('extra-lesson')).toHaveLength(1)
  })

  it('майбутній урок, урок без учня, інші вкладки — немає', () => {
    expect(withPanel({ ...EVENT, start: future, studentId: 580 }).findComponent(PanelStub).exists()).toBe(false)
    expect(withPanel({ ...EVENT, start: past, studentId: null }).findComponent(PanelStub).exists()).toBe(false)
    expect(withPanel({ ...EVENT, start: past, studentId: 580 }, false).findComponent(PanelStub).exists()).toBe(false)
  })
})
