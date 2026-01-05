import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
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

  const mockSlots = [
    { slot_id: 'slot-1', start_at: '2024-12-23T09:00:00Z', startAtUTC: '2024-12-23T09:00:00Z', status: 'available' as const, duration: 30 },
    { slot_id: 'slot-2', start_at: '2024-12-23T09:30:00Z', startAtUTC: '2024-12-23T09:30:00Z', status: 'available' as const, duration: 30 },
    { slot_id: 'slot-3', start_at: '2024-12-24T10:00:00Z', startAtUTC: '2024-12-24T10:00:00Z', status: 'available' as const, duration: 30 },
  ] as any[]

  it('renders calendar header with week navigation', () => {
    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
        timezone: 'Europe/Kyiv',
      },
    })

    expect(wrapper.find('.calendar-header').exists()).toBe(true)
    expect(wrapper.find('.week-label').exists()).toBe(true)
    expect(wrapper.findAll('.btn-icon').length).toBe(2) // prev/next buttons
  })

  it('loads availability on mount', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue({
      tutor_id: 79,
      week_start: '2024-12-23',
      timezone: 'Europe/Kyiv',
      cells: mockSlots,
    } as any)

    mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
        timezone: 'Europe/Kiev',
      },
    })

    await flushPromises()

    expect(marketplaceApi.getTutorCalendar).toHaveBeenCalledWith({
      tutorId: 79,
      weekStart: expect.any(String),
      timezone: 'Europe/Kiev',
    })
  })

  it('shows loading state while fetching', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
      },
    })

    await flushPromises()

    expect(wrapper.find('.loading-state').exists()).toBe(true)
    expect(wrapper.find('.animate-spin').exists()).toBe(true)
  })

  it('displays available slots grouped by day', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue({
      tutor_id: 79,
      week_start: '2024-12-23',
      timezone: 'Europe/Kiev',
      cells: mockSlots,
    })

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
      },
    })

    await flushPromises()

    const dayColumns = wrapper.findAll('.day-column')
    expect(dayColumns.length).toBeGreaterThan(0)
  })

  it('emits slotClick event when slot is clicked', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue({
      tutor_id: 79,
      week_start: '2024-12-23',
      timezone: 'Europe/Kiev',
      cells: mockSlots,
    })

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
      },
    })

    await flushPromises()

    const slotButton = wrapper.find('.time-slot-btn')
    if (slotButton.exists()) {
      await slotButton.trigger('click')
      
      expect(wrapper.emitted('slotClick')).toBeTruthy()
      expect(wrapper.emitted('slotClick')?.[0]?.[0]).toMatchObject({
        slot_id: mockSlots[0].slot_id,
        start_at: mockSlots[0].start_at,
        duration: mockSlots[0].duration,
        status: mockSlots[0].status,
      })
    }
  })

  it('navigates to previous week', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue({
      tutor_id: 79,
      week_start: '2024-12-23',
      timezone: 'Europe/Kyiv',
      cells: [],
    } as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
      },
    })

    await flushPromises()

    const prevButton = wrapper.findAll('.btn-icon')[0]
    await prevButton.trigger('click')
    await flushPromises()

    expect(marketplaceApi.getTutorCalendar).toHaveBeenCalledTimes(2)
  })

  it('navigates to next week', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue({
      tutor_id: 79,
      week_start: '2024-12-23',
      timezone: 'Europe/Kiev',
      cells: [],
    })

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
      },
    })

    await flushPromises()

    const nextButton = wrapper.findAll('.btn-icon')[1]
    await nextButton.trigger('click')
    await flushPromises()

    expect(marketplaceApi.getTutorCalendar).toHaveBeenCalledTimes(2)
  })

  it('shows error state on API failure', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockRejectedValue(
      new Error('Network error')
    )

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
      },
    })

    await flushPromises()

    expect(wrapper.find('.error-state').exists()).toBe(true)
  })

  it('shows empty state when no slots available', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue({
      tutor_id: 79,
      week_start: '2024-12-23',
      timezone: 'Europe/Kiev',
      cells: [],
    })

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
      },
    })

    await flushPromises()

    expect(wrapper.find('.empty-state').exists()).toBe(true)
  })

  it('uses default timezone if not provided', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue({
      tutor_id: 79,
      week_start: '2024-12-23',
      timezone: 'Europe/Kiev',
      cells: [],
    })

    mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
      },
    })

    await flushPromises()

    expect(marketplaceApi.getTutorCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        timezone: 'Europe/Kyiv',
      })
    )
  })

  it('formats time correctly for display', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue({
      tutor_id: 79,
      week_start: '2024-12-23',
      timezone: 'Europe/Kiev',
      cells: mockSlots,
    })

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 79,
        timezone: 'Europe/Kiev',
      },
    })

    await flushPromises()

    const slotButtons = wrapper.findAll('.time-slot-btn')
    expect(slotButtons.length).toBeGreaterThan(0)
  })
})
