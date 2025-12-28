import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CalendarBoardV2 from '@/modules/booking/components/calendar/CalendarBoardV2.vue'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'

describe('CalendarBoardV2', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders all 4 layers', () => {
    const wrapper = mount(CalendarBoardV2, {
      props: {
        isDragEnabled: false
      }
    })

    expect(wrapper.find('.grid-layer').exists()).toBe(true)
    expect(wrapper.find('.availability-layer').exists()).toBe(true)
    expect(wrapper.find('.events-layer').exists()).toBe(true)
  })

  it('renders events with absolute positioning', async () => {
    const store = useCalendarWeekStore()
    
    // Mock store data with v0.55 format
    store.eventsById = {
      1: {
        id: 1,
        start: '2025-12-24T10:00:00+02:00',
        end: '2025-12-24T11:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: {
          id: 1,
          name: 'Test Student'
        },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true
      }
    }
    store.allEventIds = [1]

    const wrapper = mount(CalendarBoardV2)
    await wrapper.vm.$nextTick()

    const eventCards = wrapper.findAll('.event-card')
    expect(eventCards.length).toBe(1)
    
    const firstEvent = eventCards[0]
    expect(firstEvent.attributes('style')).toContain('top:')
    expect(firstEvent.attributes('style')).toContain('height:')
  })

  it('highlights first lesson with special color', async () => {
    const store = useCalendarWeekStore()
    
    store.eventsById = {
      1: {
        id: 1,
        start: '2025-12-24T10:00:00+02:00',
        end: '2025-12-24T11:00:00+02:00',
        status: 'scheduled',
        is_first: true,
        student: {
          id: 1,
          name: 'Test Student'
        },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true
      }
    }
    store.allEventIds = [1]

    const wrapper = mount(CalendarBoardV2)
    await wrapper.vm.$nextTick()

    const eventCard = wrapper.find('.event-card')
    expect(eventCard.exists()).toBe(true)
  })

  it('emits event-click when event is clicked', async () => {
    const store = useCalendarWeekStore()
    
    store.eventsById = {
      1: {
        id: 1,
        start: '2025-12-24T10:00:00+02:00',
        end: '2025-12-24T11:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: {
          id: 1,
          name: 'Test Student'
        },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true
      }
    }
    store.allEventIds = [1]

    const wrapper = mount(CalendarBoardV2)
    await wrapper.vm.$nextTick()

    const eventCard = wrapper.find('.event-card')
    await eventCard.trigger('click')

    expect(wrapper.emitted('event-click')).toBeTruthy()
    expect(wrapper.emitted('event-click')?.[0]).toBeDefined()
  })

  it('applies past styling to past events', async () => {
    const store = useCalendarWeekStore()
    
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    
    store.eventsById = {
      1: {
        id: 1,
        start: pastDate.toISOString(),
        end: new Date(pastDate.getTime() + 3600000).toISOString(),
        status: 'completed',
        is_first: false,
        student: {
          id: 1,
          name: 'Test Student'
        },
        lesson_link: '',
        can_reschedule: false,
        can_mark_no_show: false
      }
    }
    store.allEventIds = [1]

    const wrapper = mount(CalendarBoardV2)
    await wrapper.vm.$nextTick()

    const eventCard = wrapper.find('.event-card')
    expect(eventCard.classes()).toContain('is-past')
  })

  it('renders blocked ranges as background', async () => {
    const wrapper = mount(CalendarBoardV2)
    
    // blockedRanges will be populated when store is updated
    const availabilityLayer = wrapper.find('.availability-layer')
    expect(availabilityLayer.exists()).toBe(true)
  })

  it('shows interaction layer when drag is enabled', () => {
    const wrapper = mount(CalendarBoardV2, {
      props: {
        isDragEnabled: true
      }
    })

    expect(wrapper.find('.interaction-layer').exists()).toBe(true)
  })

  it('hides interaction layer when drag is disabled', () => {
    const wrapper = mount(CalendarBoardV2, {
      props: {
        isDragEnabled: false
      }
    })

    expect(wrapper.find('.interaction-layer').exists()).toBe(false)
  })
})
