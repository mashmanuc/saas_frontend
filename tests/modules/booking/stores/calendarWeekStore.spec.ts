import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { calendarWeekApi } from '@/modules/booking/api/calendarWeekApi'
import type { WeekSnapshot } from '@/modules/booking/types/calendarWeek'

vi.mock('@/modules/booking/api/calendarWeekApi')

describe('calendarWeekStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mockSnapshot: WeekSnapshot = {
    week: {
      weekStart: '2025-12-22',
      weekEnd: '2025-12-28',
      timezone: 'Europe/Kiev',
      currentTime: '2025-12-24T14:00:00+02:00',
      page: 0
    },
    days: [
      { dayKey: '2025-12-22', dow: 1, label: 'Mon', day: 22, month: 12, year: 2025 },
      { dayKey: '2025-12-23', dow: 2, label: 'Tue', day: 23, month: 12, year: 2025 },
      { dayKey: '2025-12-24', dow: 3, label: 'Wed', day: 24, month: 12, year: 2025 },
      { dayKey: '2025-12-25', dow: 4, label: 'Thu', day: 25, month: 12, year: 2025 },
      { dayKey: '2025-12-26', dow: 5, label: 'Fri', day: 26, month: 12, year: 2025 },
      { dayKey: '2025-12-27', dow: 6, label: 'Sat', day: 27, month: 12, year: 2025 },
      { dayKey: '2025-12-28', dow: 0, label: 'Sun', day: 28, month: 12, year: 2025 }
    ],
    events: {
      '2025-12-24': [
        {
          id: 1,
          type: 'class',
          start: '2025-12-24T10:00:00+02:00',
          end: '2025-12-24T11:00:00+02:00',
          durationMin: 60,
          orderId: 100,
          clientName: 'Test Student',
          clientPhone: null,
          paidStatus: 'paid',
          doneStatus: 'not_done',
          regularity: 'single',
          tutorComment: null
        }
      ]
    },
    accessible: {
      '2025-12-25': [
        {
          id: 1,
          type: 'available_slot',
          start: '2025-12-25T14:00:00+02:00',
          end: '2025-12-25T15:00:00+02:00',
          regularity: 'single'
        }
      ]
    },
    orders: [
      {
        id: 100,
        clientName: 'Test Student',
        status: 6,
        durations: [30, 60, 90]
      }
    ],
    meta: {
      countHoursOnWeek: 1,
      tutorReachedFullLoad: false,
      zoomLink: 'https://zoom.us/j/123',
      salary: { amount: 100, commonClassesCount: 1 },
      billingPeriodWages: { periodStart: '2025-12-22', periodEnd: '2025-12-28', totalAmount: 100 },
      classMissedReasons: {},
      classDeletedReasons: {}
    }
  }

  describe('fetchWeek', () => {
    it('normalizes snapshot into eventsById', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      expect(store.eventsById[1]).toEqual(mockSnapshot.events['2025-12-24'][0])
      expect(store.eventIdsByDay['2025-12-24']).toEqual([1])
    })

    it('normalizes accessible slots', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      expect(store.accessibleById[1]).toEqual(mockSnapshot.accessible['2025-12-25'][0])
      expect(store.accessibleIdsByDay['2025-12-25']).toEqual([1])
    })

    it('normalizes orders', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      expect(store.ordersById[100]).toEqual(mockSnapshot.orders[0])
    })

    it('sets week metadata', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      expect(store.weekMeta).toEqual(mockSnapshot.week)
      expect(store.days).toEqual(mockSnapshot.days)
      expect(store.meta).toEqual(mockSnapshot.meta)
    })

    it('handles errors gracefully', async () => {
      const store = useCalendarWeekStore()
      const error = new Error('Network error')
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockRejectedValue(error)

      await store.fetchWeek(0)

      expect(store.error).toBe('Network error')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('computedCells336', () => {
    it('builds 336 cells from snapshot', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      expect(store.computedCells336).toHaveLength(336)
      expect(store.computedCells336[0].dayKey).toBe('2025-12-22')
      expect(store.computedCells336[0].slotIndex).toBe(0)
    })

    it('assigns correct status to cells', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      const cells = store.computedCells336
      expect(cells.length).toBe(336)
      expect(cells.some(c => c.status === 'empty')).toBe(true)
    })
  })

  describe('eventLayouts', () => {
    it('calculates correct positions for events', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      const layouts = store.eventLayouts
      expect(layouts).toHaveLength(1)
      expect(layouts[0].eventId).toBe(1)
      expect(layouts[0].dayKey).toBe('2025-12-24')
      expect(layouts[0].height).toBe(60 * 1.2) // 60 min * PX_PER_MINUTE
      expect(layouts[0].width).toBe('100%')
    })
  })

  describe('eventsForDay', () => {
    it('returns events for specific day', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      const events = store.eventsForDay('2025-12-24')
      expect(events).toHaveLength(1)
      expect(events[0].id).toBe(1)
    })

    it('returns empty array for day without events', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)

      const events = store.eventsForDay('2025-12-22')
      expect(events).toEqual([])
    })
  })

  describe('createEvent', () => {
    it('creates event and refetches week', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)
      vi.mocked(calendarWeekApi.createEvent).mockResolvedValue(123)

      await store.fetchWeek(0)

      await store.createEvent({
        orderId: 100,
        start: '2025-12-24T10:00:00+02:00',
        durationMin: 60,
        regularity: 'single'
      })

      expect(calendarWeekApi.createEvent).toHaveBeenCalled()
      expect(calendarWeekApi.getWeekSnapshot).toHaveBeenCalledTimes(2)
    })

    it('throws error on create failure', async () => {
      const store = useCalendarWeekStore()
      const error = new Error('Create failed')
      vi.mocked(calendarWeekApi.createEvent).mockRejectedValue(error)

      await expect(store.createEvent({
        orderId: 100,
        start: '2025-12-24T10:00:00+02:00',
        durationMin: 60,
        regularity: 'single'
      })).rejects.toThrow('Create failed')
    })
  })

  describe('deleteEvent', () => {
    it('deletes event and refetches week', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)
      vi.mocked(calendarWeekApi.deleteEvent).mockResolvedValue()

      await store.fetchWeek(0)

      await store.deleteEvent(1)

      expect(calendarWeekApi.deleteEvent).toHaveBeenCalledWith({ id: 1 })
      expect(calendarWeekApi.getWeekSnapshot).toHaveBeenCalledTimes(2)
    })
  })

  describe('selectEvent', () => {
    it('sets selected event id', () => {
      const store = useCalendarWeekStore()

      store.selectEvent(123)

      expect(store.selectedEventId).toBe(123)
    })

    it('clears selected event', () => {
      const store = useCalendarWeekStore()
      store.selectEvent(123)

      store.selectEvent(null)

      expect(store.selectedEventId).toBe(null)
    })
  })

  describe('$reset', () => {
    it('resets all state to initial values', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarWeekApi.getWeekSnapshot).mockResolvedValue(mockSnapshot)

      await store.fetchWeek(0)
      store.selectEvent(1)

      store.$reset()

      expect(store.weekMeta).toBe(null)
      expect(store.days).toEqual([])
      expect(store.eventsById).toEqual({})
      expect(store.selectedEventId).toBe(null)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe(null)
    })
  })
})
