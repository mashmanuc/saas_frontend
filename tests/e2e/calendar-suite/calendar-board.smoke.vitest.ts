import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CalendarBoardV2 from '@/modules/booking/components/calendar/CalendarBoardV2.vue'

const baseDay = {
  date: '2025-12-24',
  dayStatus: 'working' as const,
  eventsCount: 1,
  availableMinutes: 240,
  isPast: false,
}

const baseEvent = {
  id: 1,
  start: '2025-12-24T10:00:00+02:00',
  end: '2025-12-24T11:00:00+02:00',
  status: 'scheduled' as const,
  is_first: false,
  student: { id: 1, name: 'Smoke Student' },
  lesson_link: '',
  can_reschedule: true,
  can_mark_no_show: true,
}

const defaultProps = {
  days: [baseDay],
  events: [baseEvent],
  blockedRanges: [],
  accessibleSlots: [],
  currentTime: '2025-12-24T09:00:00+02:00',
  timezone: 'Europe/Kiev',
  isDragEnabled: false,
}

const mountWithPinia = (overrides = {}) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(CalendarBoardV2, {
    props: { ...defaultProps, ...overrides },
    global: { plugins: [pinia] },
  })
}

describe('CalendarBoardV2 - e2e smoke', () => {
  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
  })

  it('renders grid + events and emits event-click', async () => {
    const wrapper = mountWithPinia()

    expect(wrapper.find('.grid-layer').exists()).toBe(true)
    expect(wrapper.find('.events-layer').exists()).toBe(true)

    const eventCard = wrapper.find('.event-card')
    expect(eventCard.exists()).toBe(true)

    await eventCard.trigger('click')

    expect(wrapper.emitted('event-click')).toBeTruthy()
    expect(wrapper.emitted('event-click')?.[0]?.[0]).toMatchObject({
      id: baseEvent.id,
      student: { name: 'Smoke Student' },
    })
  })

  it('emits slot-click when user selects accessible slot', async () => {
    const wrapper = mountWithPinia({
      accessibleSlots: [
        {
          id: 501,
          start: '2025-12-24T12:00:00+02:00',
          end: '2025-12-24T12:30:00+02:00',
          is_recurring: true,
        },
      ],
    })

    const slot = wrapper.find('.accessible-slot')
    expect(slot.exists()).toBe(true)

    await slot.trigger('click')

    expect(wrapper.emitted('slot-click')).toBeTruthy()
    expect(wrapper.emitted('slot-click')?.[0]?.[0]).toMatchObject({
      id: 501,
      is_recurring: true,
    })
  })

  it('renders blocked ranges layer with labels', () => {
    const wrapper = mountWithPinia({
      blockedRanges: [
        {
          id: 301,
          start: '2025-12-24T08:00:00+02:00',
          end: '2025-12-24T09:00:00+02:00',
          reason: 'Staff meeting',
          type: 'manual',
        },
      ],
    })

    const layer = wrapper.find('.availability-layer')
    expect(layer.exists()).toBe(true)
    expect(layer.findAll('.blocked-range').length).toBe(1)
    expect(layer.find('.blocked-range').attributes('title')).toBe('Staff meeting')
  })

  it('toggles interaction layer based on drag flag', () => {
    const wrapper = mountWithPinia({ isDragEnabled: true })
    expect(wrapper.find('.interaction-layer').exists()).toBe(true)

    const wrapperDisabled = mountWithPinia({ isDragEnabled: false })
    expect(wrapperDisabled.find('.interaction-layer').exists()).toBe(false)
  })
})
