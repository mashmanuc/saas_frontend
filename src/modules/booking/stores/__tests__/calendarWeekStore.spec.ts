/**
 * Calendar Week Store Unit Tests v0.58
 * 
 * Comprehensive test coverage for:
 * - Snapshot normalization
 * - Selectors (days, events, accessible, ordersArray)
 * - CRUD actions (fetchWeekSnapshot, createEvent, updateEvent, deleteEvent)
 * - Optimistic hash reconciliation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCalendarWeekStore } from '../calendarWeekStore'
import type { CalendarSnapshot, CalendarEvent } from '../../types/calendarV055'
import { calendarV055Api } from '../../api/calendarV055Api'

// Mock API
vi.mock('../../api/calendarV055Api', () => ({
  calendarV055Api: {
    getCalendarWeek: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  }
}))

describe('calendarWeekStore - Core Functionality', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Snapshot Normalization', () => {
    it('should normalize empty snapshot correctly', () => {
      const store = useCalendarWeekStore()
      
      const emptySnapshot: CalendarSnapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {}
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1
        }
      }

      store.snapshot = emptySnapshot

      expect(store.days).toEqual([])
      expect(store.events).toEqual([])
      expect(store.accessible).toEqual([])
      expect(store.blockedRanges).toEqual([])
      expect(store.meta?.tutorId).toBe(1)
    })

    it('should normalize snapshot with events', () => {
      const store = useCalendarWeekStore()
      
      const snapshot: CalendarSnapshot = {
        days: [
          {
            date: '2025-01-08',
            dayStatus: 'working',
            eventsCount: 2,
            availableMinutes: 120,
            isPast: false
          }
        ],
        events: [
          {
            id: 100,
            start: '2025-01-08T10:00:00+02:00',
            end: '2025-01-08T11:00:00+02:00',
            status: 'scheduled',
            is_first: false,
            student: { id: 50, name: 'John Doe' },
            lesson_link: 'https://zoom.us/j/123',
            can_reschedule: true,
            can_mark_no_show: false
          },
          {
            id: 101,
            start: '2025-01-08T14:00:00+02:00',
            end: '2025-01-08T15:00:00+02:00',
            status: 'scheduled',
            is_first: true,
            student: { id: 51, name: 'Jane Smith' },
            lesson_link: '',
            can_reschedule: true,
            can_mark_no_show: false
          }
        ],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {}
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1
        }
      }

      store.snapshot = snapshot

      expect(store.events).toHaveLength(2)
      expect(store.events[0].id).toBe(100)
      expect(store.events[0].student.name).toBe('John Doe')
      expect(store.events[1].is_first).toBe(true)
    })

    it('should normalize orders from snapshot', () => {
      const store = useCalendarWeekStore()
      
      // syncOrders is internal method, test through snapshot
      store.snapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1
        }
      }

      // Orders are synced internally via fetchWeekSnapshot
      expect(store.ordersArray).toBeDefined()
    })
  })

  describe('Selectors', () => {
    it('should compute days selector correctly', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [
          { date: '2025-01-06', dayStatus: 'working', eventsCount: 1, availableMinutes: 60, isPast: false },
          { date: '2025-01-07', dayStatus: 'day_off', eventsCount: 0, availableMinutes: 0, isPast: false }
        ],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1
        }
      }

      expect(store.days).toHaveLength(2)
      expect(store.days[0].dayStatus).toBe('working')
      expect(store.days[1].dayStatus).toBe('day_off')
    })

    it('should compute events selector correctly', () => {
      const store = useCalendarWeekStore()
      
      const events: CalendarEvent[] = [
        {
          id: 200,
          start: '2025-01-08T10:00:00+02:00',
          end: '2025-01-08T11:00:00+02:00',
          status: 'scheduled',
          is_first: false,
          student: { id: 100, name: 'Test' },
          lesson_link: '',
          can_reschedule: true,
          can_mark_no_show: false
        }
      ]

      store.snapshot = {
        days: [],
        events,
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1
        }
      }

      expect(store.events).toHaveLength(1)
      expect(store.events[0].id).toBe(200)
    })

    it('should compute accessible selector correctly', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [],
        events: [],
        accessible: [
          { id: 500, start: '2025-01-08T14:00:00+02:00', end: '2025-01-08T15:00:00+02:00', is_recurring: false }
        ],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1
        }
      }

      expect(store.accessible).toHaveLength(1)
      expect(store.accessible[0].id).toBe(500)
    })

    it('should compute ordersArray selector correctly', () => {
      const store = useCalendarWeekStore()
      
      // ordersArray is computed from internal ordersById
      expect(store.ordersArray).toBeDefined()
      expect(Array.isArray(store.ordersArray)).toBe(true)
    })

    it('should compute daySummaries with isPast flag', () => {
      const store = useCalendarWeekStore()
      
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 2)
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 2)

      store.snapshot = {
        days: [
          { date: pastDate.toISOString().split('T')[0], dayStatus: 'working', eventsCount: 1, availableMinutes: 60, isPast: false },
          { date: futureDate.toISOString().split('T')[0], dayStatus: 'working', eventsCount: 0, availableMinutes: 120, isPast: false }
        ],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: new Date().toISOString(),
          etag: 'test-etag',
          tutorId: 1
        }
      }

      const summaries = store.daySummaries
      expect(summaries[0].isPast).toBe(true)
      expect(summaries[1].isPast).toBe(false)
    })
  })

  describe('fetchWeekSnapshot', () => {
    it('should fetch and set snapshot successfully', async () => {
      const store = useCalendarWeekStore()
      
      const mockSnapshot: CalendarSnapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'new-etag',
          tutorId: 1
        }
      }

      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-01-06')

      expect(store.snapshot).toEqual(mockSnapshot)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('should handle fetch error gracefully', async () => {
      const store = useCalendarWeekStore()
      const error = new Error('Network error')
      
      vi.mocked(calendarV055Api.getCalendarWeek).mockRejectedValue(error)

      await expect(store.fetchWeekSnapshot(1, '2025-01-06')).rejects.toThrow('Network error')

      expect(store.error).toBe(error.message)
      expect(store.isLoading).toBe(false)
    })

    it('should set loading state during fetch', async () => {
      const store = useCalendarWeekStore()
      
      let resolvePromise: (value: CalendarSnapshot) => void
      const promise = new Promise<CalendarSnapshot>((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(calendarV055Api.getCalendarWeek).mockReturnValue(promise)

      const fetchPromise = store.fetchWeekSnapshot(1, '2025-01-06')
      
      expect(store.isLoading).toBe(true)

      resolvePromise!({
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1
        }
      })

      await fetchPromise

      expect(store.isLoading).toBe(false)
    })
  })

  describe('createEvent', () => {
    it('should create event and refetch snapshot', async () => {
      const store = useCalendarWeekStore()
      
      store.currentTutorId = 1
      store.currentWeekStart = '2025-01-06'

      const mockResponse = { id: 300, zoomLink: 'https://zoom.us/j/123' }
      vi.mocked(calendarV055Api.createEvent).mockResolvedValue(mockResponse)
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue({
        days: [],
        events: [
          {
            id: 300,
            start: '2025-01-08T10:00:00+02:00',
            end: '2025-01-08T11:00:00+02:00',
            status: 'scheduled',
            is_first: false,
            student: { id: 100, name: 'Test' },
            lesson_link: '',
            can_reschedule: true,
            can_mark_no_show: false
          }
        ],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'new-etag',
          tutorId: 1
        }
      })

      const result = await store.createEvent({
        orderId: 10,
        start: '2025-01-08T10:00:00+02:00',
        durationMin: 60,
        regularity: 'single'
      })

      expect(result).toBe(300)
      expect(calendarV055Api.createEvent).toHaveBeenCalled()
      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalled()
    })

    it('should handle create error', async () => {
      const store = useCalendarWeekStore()
      
      vi.mocked(calendarV055Api.createEvent).mockRejectedValue(new Error('Conflict'))

      await expect(store.createEvent({
        orderId: 10,
        start: '2025-01-08T10:00:00+02:00',
        durationMin: 60,
        regularity: 'single'
      })).rejects.toThrow('Conflict')
    })
  })

  describe('updateEvent', () => {
    it('should update event and refetch snapshot', async () => {
      const store = useCalendarWeekStore()
      
      store.currentTutorId = 1
      store.currentWeekStart = '2025-01-06'

      vi.mocked(calendarV055Api.updateEvent).mockResolvedValue({ success: true })
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue({
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'updated-etag',
          tutorId: 1
        }
      })

      await store.updateEvent({
        id: 100,
        start: '2025-01-08T11:00:00+02:00',
        durationMin: 90
      })

      expect(calendarV055Api.updateEvent).toHaveBeenCalledWith({
        id: 100,
        start: '2025-01-08T11:00:00+02:00',
        durationMin: 90
      })
      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalled()
    })
  })

  describe('deleteEvent', () => {
    it('should delete event and refetch snapshot', async () => {
      const store = useCalendarWeekStore()
      
      store.currentTutorId = 1
      store.currentWeekStart = '2025-01-06'

      vi.mocked(calendarV055Api.deleteEvent).mockResolvedValue({ success: true })
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue({
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'deleted-etag',
          tutorId: 1
        }
      })

      await store.deleteEvent(100)

      expect(calendarV055Api.deleteEvent).toHaveBeenCalledWith({ id: 100 })
      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalled()
    })
  })

  describe('Optimistic Hash Reconciliation', () => {
    it('should reconcile optimistic event with real event by hash', () => {
      const store = useCalendarWeekStore()
      
      // Add optimistic event
      store.snapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: { noShowReasons: {}, cancelReasons: {}, blockReasons: {} },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1
        }
      }

      const tempId = store.addOptimisticEvent({
        tempId: 'temp-hash-test',
        start: '2025-01-08T10:00:00+02:00',
        end: '2025-01-08T11:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 100, name: 'Test' },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: false
      })

      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].id).toBeLessThan(0)

      // Reconcile with real event
      const realEvent: CalendarEvent = {
        id: 400,
        start: '2025-01-08T10:00:00+02:00',
        end: '2025-01-08T11:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 100, name: 'Test' },
        lesson_link: 'https://zoom.us/j/789',
        can_reschedule: true,
        can_mark_no_show: false
      }

      store.replaceOptimisticEvent(tempId, realEvent)

      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].id).toBe(400)
      expect(store.snapshot.events[0].lesson_link).toBe('https://zoom.us/j/789')
    })
  })
})
