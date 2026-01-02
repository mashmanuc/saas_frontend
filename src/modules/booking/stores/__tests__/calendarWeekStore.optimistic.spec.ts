import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCalendarWeekStore } from '../calendarWeekStore'
import type { CalendarEvent } from '../../types/calendarV055'

describe('calendarWeekStore - Optimistic Events', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('addOptimisticEvent', () => {
    it('should add optimistic event to snapshot', () => {
      const store = useCalendarWeekStore()
      
      // Setup snapshot
      store.snapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1,
        },
      }

      const tempId = store.addOptimisticEvent({
        tempId: 'temp-123',
        start: '2025-01-08T14:00:00+02:00',
        end: '2025-01-08T15:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: {
          id: 100,
          name: 'Test Student',
        },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true,
      })

      expect(tempId).toBe('temp-123')
      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].id).toBeLessThan(0)
      expect(store.snapshot.events[0].student.name).toBe('Test Student')
    })

    it('should handle missing optional fields', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1,
        },
      }

      store.addOptimisticEvent({
        tempId: 'temp-456',
      })

      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].start).toBe('')
      expect(store.snapshot.events[0].student.name).toBe('Unknown')
    })
  })

  describe('removeOptimisticEvent', () => {
    it('should remove optimistic event from snapshot', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [],
        events: [
          {
            id: -1,
            start: '2025-01-08T14:00:00+02:00',
            end: '2025-01-08T15:00:00+02:00',
            status: 'scheduled',
            is_first: false,
            student: { id: 100, name: 'Test' },
            lesson_link: '',
            can_reschedule: true,
            can_mark_no_show: true,
          },
        ],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1,
        },
      }

      store.removeOptimisticEvent('temp-123')

      expect(store.snapshot.events).toHaveLength(0)
    })

    it('should not remove real events', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [],
        events: [
          {
            id: 100,
            start: '2025-01-08T14:00:00+02:00',
            end: '2025-01-08T15:00:00+02:00',
            status: 'scheduled',
            is_first: false,
            student: { id: 100, name: 'Test' },
            lesson_link: '',
            can_reschedule: true,
            can_mark_no_show: true,
          },
        ],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1,
        },
      }

      store.removeOptimisticEvent('temp-123')

      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].id).toBe(100)
    })
  })

  describe('replaceOptimisticEvent', () => {
    it('should replace optimistic event with real event', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [],
        events: [
          {
            id: -1,
            start: '2025-01-08T14:00:00+02:00',
            end: '2025-01-08T15:00:00+02:00',
            status: 'scheduled',
            is_first: false,
            student: { id: 100, name: 'Test' },
            lesson_link: '',
            can_reschedule: true,
            can_mark_no_show: true,
          },
        ],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1,
        },
      }

      const realEvent: CalendarEvent = {
        id: 200,
        start: '2025-01-08T14:00:00+02:00',
        end: '2025-01-08T15:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 100, name: 'Test Student' },
        lesson_link: 'https://zoom.us/j/123',
        can_reschedule: true,
        can_mark_no_show: true,
      }

      store.replaceOptimisticEvent('temp-123', realEvent)

      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].id).toBe(200)
      expect(store.snapshot.events[0].lesson_link).toBe('https://zoom.us/j/123')
    })

    it('should add real event if no optimistic event found', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1,
        },
      }

      const realEvent: CalendarEvent = {
        id: 200,
        start: '2025-01-08T14:00:00+02:00',
        end: '2025-01-08T15:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 100, name: 'Test' },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true,
      }

      store.replaceOptimisticEvent('temp-123', realEvent)

      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].id).toBe(200)
    })
  })

  describe('Optimistic flow integration', () => {
    it('should handle full optimistic create → replace flow', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1,
        },
      }

      // Step 1: Add optimistic
      const tempId = store.addOptimisticEvent({
        tempId: 'temp-789',
        start: '2025-01-08T14:00:00+02:00',
        end: '2025-01-08T15:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 100, name: 'Test' },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true,
      })

      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].id).toBeLessThan(0)

      // Step 2: Replace with real
      const realEvent: CalendarEvent = {
        id: 300,
        start: '2025-01-08T14:00:00+02:00',
        end: '2025-01-08T15:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 100, name: 'Test' },
        lesson_link: 'https://zoom.us/j/456',
        can_reschedule: true,
        can_mark_no_show: true,
      }

      store.replaceOptimisticEvent(tempId, realEvent)

      expect(store.snapshot.events).toHaveLength(1)
      expect(store.snapshot.events[0].id).toBe(300)
    })

    it('should handle optimistic create → error → remove flow', () => {
      const store = useCalendarWeekStore()
      
      store.snapshot = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: {
          weekStart: '2025-01-06',
          weekEnd: '2025-01-12',
          timezone: 'Europe/Kiev',
          currentTime: '2025-01-08T10:00:00+02:00',
          etag: 'test-etag',
          tutorId: 1,
        },
      }

      // Step 1: Add optimistic
      const tempId = store.addOptimisticEvent({
        tempId: 'temp-error',
        start: '2025-01-08T14:00:00+02:00',
        end: '2025-01-08T15:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 100, name: 'Test' },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true,
      })

      expect(store.snapshot.events).toHaveLength(1)

      // Step 2: Error occurred, remove optimistic
      store.removeOptimisticEvent(tempId)

      expect(store.snapshot.events).toHaveLength(0)
    })
  })
})
