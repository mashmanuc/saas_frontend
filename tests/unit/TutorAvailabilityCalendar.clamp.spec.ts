import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TutorAvailabilityCalendar from '@/modules/marketplace/components/TutorAvailabilityCalendar.vue'
import marketplaceApi from '@/modules/marketplace/api/marketplace'

vi.mock('@/modules/marketplace/api/marketplace', () => ({
  default: {
    getTutorCalendar: vi.fn(),
  },
}))

describe('TutorAvailabilityCalendar - FE-1 Past Navigation Clamp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createResponse = (weekStart: string) => ({
    tutor_id: 123,
    week_start: weekStart,
    week_end: weekStart,
    timezone: 'Europe/Kyiv',
    horizon_weeks: 4,
    generated_at: new Date().toISOString(),
    cells: [],
  })

  it('disables previous button when at current week', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(createResponse('2026-01-05') as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await flushPromises()

    const prevButton = wrapper.findAll('.btn-icon')[0]
    expect(prevButton.attributes('disabled')).toBeDefined()
  })

  it('prevents navigation to past weeks', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(createResponse('2026-01-05') as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await flushPromises()

    const prevButton = wrapper.findAll('.btn-icon')[0]
    await prevButton.trigger('click')
    await flushPromises()

    // Should only be called once (initial load), not twice
    expect(marketplaceApi.getTutorCalendar).toHaveBeenCalledTimes(1)
  })

  it('clamps weekStart to current Monday when attempting past navigation', async () => {
    const mockFn = vi.mocked(marketplaceApi.getTutorCalendar)
    mockFn.mockResolvedValue(createResponse('2026-01-05') as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await flushPromises()

    // Try to go back (should be clamped)
    const prevButton = wrapper.findAll('.btn-icon')[0]
    await prevButton.trigger('click')
    await flushPromises()

    // Verify weekStart param never goes before today
    const calls = mockFn.mock.calls
    calls.forEach(call => {
      const weekStart = call[0].weekStart
      const today = new Date()
      const requestedDate = new Date(weekStart)
      expect(requestedDate.getTime()).toBeGreaterThanOrEqual(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    })
  })

  it('enables previous button when navigated forward', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(createResponse('2026-01-05') as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
      },
    })

    await flushPromises()

    // Navigate forward first
    const nextButton = wrapper.findAll('.btn-icon')[1]
    await nextButton.trigger('click')
    await flushPromises()

    // Now previous should be enabled (disabled attribute should not be present or be falsy)
    const prevButton = wrapper.findAll('.btn-icon')[0]
    const disabledAttr = prevButton.attributes('disabled')
    expect(!disabledAttr || disabledAttr === 'false').toBe(true)
  })
})

describe('TutorAvailabilityCalendar - FE-2 Horizon Limit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const createResponse = (weekStart: string) => ({
    tutor_id: 123,
    week_start: weekStart,
    week_end: weekStart,
    timezone: 'Europe/Kyiv',
    horizon_weeks: 4,
    generated_at: new Date().toISOString(),
    cells: [],
  })

  it('disables next button at horizon limit (4 weeks)', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(createResponse('2026-01-05') as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
        maxWeeks: 4,
      },
    })

    await flushPromises()

    // Navigate to week 3 (offset 3 = 4th week, which is the limit)
    const nextButton = wrapper.findAll('.btn-icon')[1]
    
    for (let i = 0; i < 3; i++) {
      await nextButton.trigger('click')
      await flushPromises()
    }

    // At week 4, next should be disabled
    expect(nextButton.attributes('disabled')).toBeDefined()
  })

  it('prevents navigation beyond maxWeeks', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(createResponse('2026-01-05') as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
        maxWeeks: 4,
      },
    })

    await flushPromises()

    const nextButton = wrapper.findAll('.btn-icon')[1]
    
    // Try to navigate 5 times (should stop at 4)
    for (let i = 0; i < 5; i++) {
      await nextButton.trigger('click')
      await flushPromises()
    }

    // Should be called 5 times total: 1 initial + 3 successful navigations (weeks 0,1,2,3)
    // Week 4 click is blocked
    expect(marketplaceApi.getTutorCalendar).toHaveBeenCalledTimes(4)
  })

  it('respects custom maxWeeks prop', async () => {
    vi.mocked(marketplaceApi.getTutorCalendar).mockResolvedValue(createResponse('2026-01-05') as any)

    const wrapper = mount(TutorAvailabilityCalendar, {
      props: {
        tutorId: 123,
        timezone: 'Europe/Kyiv',
        maxWeeks: 2,
      },
    })

    await flushPromises()

    const nextButton = wrapper.findAll('.btn-icon')[1]
    
    // Navigate to week 2
    await nextButton.trigger('click')
    await flushPromises()

    // At week 2, next should be disabled
    expect(nextButton.attributes('disabled')).toBeDefined()
  })
})
