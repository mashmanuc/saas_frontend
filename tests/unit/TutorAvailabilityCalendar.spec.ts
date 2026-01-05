import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import TutorAvailabilityCalendar from '@/modules/marketplace/components/TutorAvailabilityCalendar.vue'
import { marketplaceApi } from '@/modules/marketplace/api/marketplace'

vi.mock('@/modules/marketplace/api/marketplace', () => ({
  marketplaceApi: {
    getTutorCalendar: vi.fn(),
  },
}))

describe('TutorAvailabilityCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state initially', () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockReturnValue(
      new Promise(() => {
        // never resolve to keep loading state
      }) as any
    )

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    expect(wrapper.find('.loading-state').exists()).toBe(true)
  })

  it('groups slots by date correctly', async () => {
    const mockResponse = {
      tutor_id: 123,
      week_start: '2026-01-05',
      timezone: 'Europe/Kyiv',
      cells: [
        {
          slot_id: 'slot1',
          start_at: '2026-01-06T09:00:00+02:00',
          duration: 60,
          status: 'available',
        },
        {
          slot_id: 'slot2',
          start_at: '2026-01-06T10:00:00+02:00',
          duration: 60,
          status: 'available',
        },
        {
          slot_id: 'slot3',
          start_at: '2026-01-07T09:00:00+02:00',
          duration: 60,
          status: 'available',
        },
      ],
    }

    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(mockResponse as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const dayColumns = wrapper.findAll('.day-column')
    expect(dayColumns.length).toBe(2) // 2 days with slots
  })

  it('emits slot-click event when slot is clicked', async () => {
    const mockResponse = {
      tutor_id: 123,
      week_start: '2026-01-05',
      timezone: 'Europe/Kyiv',
      cells: [
        {
          slot_id: 'slot1',
          start_at: '2026-01-06T09:00:00+02:00',
          duration: 60,
          status: 'available',
        },
      ],
    }

    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(mockResponse as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const slotButton = wrapper.find('.time-slot-btn')
    await slotButton.trigger('click')

    expect(wrapper.emitted('slotClick')).toBeTruthy()
    expect(wrapper.emitted('slotClick')?.[0]).toEqual([
      {
        slot_id: 'slot1',
        start_at: '2026-01-06T09:00:00+02:00',
        duration: 60,
        status: 'available',
      },
    ])
  })

  it('displays empty state when no slots available', async () => {
    const mockResponse = {
      tutor_id: 123,
      week_start: '2026-01-05',
      timezone: 'Europe/Kyiv',
      cells: [],
    }

    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(mockResponse as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('displays error state on API failure', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockRejectedValue(new Error('API Error'))

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(wrapper.find('.error-state').exists()).toBe(true)
  })

  it('respects maxWeeks prop for navigation', async () => {
    const mockResponse = {
      tutor_id: 123,
      week_start: '2026-01-05',
      timezone: 'Europe/Kyiv',
      cells: [],
    }

    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(mockResponse as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
        maxWeeks: 2,
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const nextButton = wrapper.findAll('.btn-icon')[1]
    
    // First click should move to next week and disable the button (max range reached)
    await nextButton.trigger('click')
    expect(nextButton.attributes('disabled')).toBe('')
    
    // Second click should disable the button (reached maxWeeks)
    await nextButton.trigger('click')
    await wrapper.vm.$nextTick()
    expect(nextButton.attributes('disabled')).toBeDefined()
  })

  it('supports keyboard navigation on slots', async () => {
    const mockResponse = {
      tutor_id: 123,
      week_start: '2026-01-05',
      timezone: 'Europe/Kyiv',
      cells: [
        {
          slot_id: 'slot1',
          start_at: '2026-01-06T09:00:00+02:00',
          duration: 60,
          status: 'available',
        },
      ],
    }

    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(mockResponse as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const slotButton = wrapper.find('.time-slot-btn')
    
    // Test Enter key
    await slotButton.trigger('keydown.enter')
    expect(wrapper.emitted('slotClick')).toBeTruthy()
    
    // Test Space key
    await slotButton.trigger('keydown.space')
    expect(wrapper.emitted('slotClick')?.length).toBe(2)
  })

  it('has proper accessibility attributes', async () => {
    const mockResponse = {
      tutor_id: 123,
      week_start: '2026-01-05',
      timezone: 'Europe/Kyiv',
      cells: [
        {
          slot_id: 'slot1',
          start_at: '2026-01-06T09:00:00+02:00',
          duration: 60,
          status: 'available',
        },
      ],
    }

    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(mockResponse as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    const slotButton = wrapper.find('.time-slot-btn')
    expect(slotButton.attributes('tabindex')).toBe('0')
    expect(slotButton.attributes('aria-label')).toBeTruthy()
  })
})
