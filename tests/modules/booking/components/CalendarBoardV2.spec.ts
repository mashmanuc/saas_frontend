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
  student: { id: 1, name: 'Test Student' },
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

describe('CalendarBoardV2', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders all layers with provided data', () => {
    const wrapper = mount(CalendarBoardV2, {
      props: defaultProps,
    })

    expect(wrapper.find('.grid-layer').exists()).toBe(true)
    expect(wrapper.find('.availability-layer').exists()).toBe(true)
    expect(wrapper.find('.events-layer').exists()).toBe(true)
  })

  it('renders events with absolute positioning', async () => {
    const wrapper = mount(CalendarBoardV2, { props: defaultProps })
    await wrapper.vm.$nextTick()

    const eventCards = wrapper.findAll('.event-card')
    expect(eventCards.length).toBe(1)
    
    const firstEvent = eventCards[0]
    expect(firstEvent.attributes('style')).toContain('top:')
    expect(firstEvent.attributes('style')).toContain('height:')
  })

  it('highlights first lesson with special color', async () => {
    const wrapper = mount(CalendarBoardV2, {
      props: {
        ...defaultProps,
        events: [{ ...baseEvent, is_first: true }],
      },
    })
    await wrapper.vm.$nextTick()

    const eventCard = wrapper.find('.event-card')
    expect(eventCard.exists()).toBe(true)
    expect(eventCard.classes()).toContain('is-first')
  })

  it('emits event-click when event is clicked', async () => {
    const wrapper = mount(CalendarBoardV2, { props: defaultProps })
    await wrapper.vm.$nextTick()

    const eventCard = wrapper.find('.event-card')
    await eventCard.trigger('click')

    expect(wrapper.emitted('event-click')).toBeTruthy()
    expect(wrapper.emitted('event-click')?.[0]).toBeDefined()
  })

  it('applies past styling to past events', async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    const wrapper = mount(CalendarBoardV2, {
      props: {
        ...defaultProps,
        days: [{
          ...baseDay,
          date: pastDate.toISOString().split('T')[0],
          isPast: true,
        }],
        events: [
          {
            ...baseEvent,
            start: pastDate.toISOString(),
            end: new Date(pastDate.getTime() + 3600000).toISOString(),
            status: 'completed',
          },
        ],
      },
    })
    await wrapper.vm.$nextTick()

    const eventCard = wrapper.find('.event-card')
    expect(eventCard.exists()).toBe(true)
    if (eventCard.exists()) {
      expect(eventCard.classes()).toContain('is-past')
    }
  })

  it('renders blocked ranges as background', async () => {
    const wrapper = mount(CalendarBoardV2, {
      props: {
        ...defaultProps,
        blockedRanges: [
          {
            id: 1,
            start: '2025-12-24T12:00:00+02:00',
            end: '2025-12-24T13:00:00+02:00',
            reason: 'Lunch break',
            type: 'manual',
          },
        ],
      },
    })

    const availabilityLayer = wrapper.find('.availability-layer')
    expect(availabilityLayer.exists()).toBe(true)
    expect(availabilityLayer.findAll('.blocked-range').length).toBe(1)
  })

  it('shows interaction layer when drag is enabled', () => {
    const wrapper = mount(CalendarBoardV2, {
      props: {
        ...defaultProps,
        isDragEnabled: true,
      },
    })

    expect(wrapper.find('.interaction-layer').exists()).toBe(true)
  })

  it('hides interaction layer when drag is disabled', () => {
    const wrapper = mount(CalendarBoardV2, {
      props: defaultProps,
    })

    expect(wrapper.find('.interaction-layer').exists()).toBe(false)
  })
})
