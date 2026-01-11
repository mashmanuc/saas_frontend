import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { calendarV055Api } from '@/modules/booking/api/calendarV055Api'
import type { CalendarSnapshot } from '@/modules/booking/types/calendarV055'

vi.mock('@/modules/booking/api/calendarV055Api')

const mockSnapshot: CalendarSnapshot = {
  days: [
    {
      date: '2025-12-24',
      dayStatus: 'working',
      eventsCount: 1,
      availableMinutes: 240,
      isPast: false,
    },
  ],
  events: [
    {
      id: 1,
      start: '2025-12-24T10:00:00+02:00',
      end: '2025-12-24T11:00:00+02:00',
      status: 'scheduled',
      is_first: false,
      student: { id: 100, name: 'Test Student' },
      lesson_link: 'https://zoom.us/j/123',
      can_reschedule: true,
      can_mark_no_show: true,
    },
  ],
  accessible: [
    {
      id: 10,
      start: '2025-12-24T14:00:00+02:00',
      end: '2025-12-24T15:00:00+02:00',
      is_recurring: false,
    },
  ],
  blockedRanges: [],
  dictionaries: {
    noShowReasons: {},
    cancelReasons: {},
    blockReasons: {},
  },
  meta: {
    tutorId: 1,
    weekStart: '2025-12-23',
    weekEnd: '2025-12-29',
    timezone: 'Europe/Kiev',
    currentTime: '2025-12-24T09:00:00+02:00',
    etag: 'test-etag',
  },
}

const createSnapshot = (): CalendarSnapshot =>
  JSON.parse(JSON.stringify(mockSnapshot)) as CalendarSnapshot

describe('calendarWeekStore (v0.68)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchWeekSnapshot', () => {
    it('fetches and stores snapshot', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalledWith(
        1,
        '2025-12-23',
        undefined,
        'Europe/Kiev'
      )
      expect(store.snapshot?.events).toHaveLength(1)
      expect(store.snapshot?.meta.weekStart).toBe('2025-12-23')
      expect(store.currentTutorId).toBe(1)
      expect(store.currentWeekStart).toBe('2025-12-23')
    })

    it('handles errors gracefully', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockRejectedValue(new Error('Network error'))

      await expect(store.fetchWeekSnapshot(1, '2025-12-23')).rejects.toThrow('Network error')
      expect(store.error).toBe('Network error')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('createEvent', () => {
    it('creates event and refetches snapshot', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)
      vi.mocked(calendarV055Api.createEvent).mockResolvedValue({ id: 200 })

      await store.fetchWeekSnapshot(1, '2025-12-23')

      await store.createEvent({
        orderId: 100,
        start: '2025-12-24T10:00:00+02:00',
        durationMin: 60,
        regularity: 'single',
      })

      expect(calendarV055Api.createEvent).toHaveBeenCalledWith({
        orderId: 100,
        start: '2025-12-24T10:00:00+02:00',
        durationMin: 60,
        regularity: 'single',
        tutorComment: undefined,
        studentComment: undefined,
        lessonType: undefined,
        slotId: undefined,
        notifyStudent: undefined,
        autoGenerateZoom: undefined,
        timezone: undefined,
      })
      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalledTimes(2)
    })

    it('propagates errors from API', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.createEvent).mockRejectedValue(new Error('Create failed'))

      await expect(
        store.createEvent({
          orderId: 100,
          start: '2025-12-24T10:00:00+02:00',
          durationMin: 60,
          regularity: 'single',
        })
      ).rejects.toThrow('Create failed')
    })
  })

  describe('deleteEvent', () => {
    it('deletes event and refetches snapshot', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)
      vi.mocked(calendarV055Api.deleteEvent).mockResolvedValue({ success: true })

      await store.fetchWeekSnapshot(1, '2025-12-23')

      await store.deleteEvent(1)

      expect(calendarV055Api.deleteEvent).toHaveBeenCalledWith({ id: 1 })
      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalledTimes(2)
    })
  })

  describe('selectEvent', () => {
    it('sets selected event id', () => {
      const store = useCalendarWeekStore()

      store.selectEvent(123)

      expect(store.selectedEventId).toBe(123)
    })

    it('clears selected event id', () => {
      const store = useCalendarWeekStore()
      store.selectEvent(123)

      store.selectEvent(null)

      expect(store.selectedEventId).toBeNull()
    })
  })

  describe('updateEvent', () => {
    it('updates event and refetches snapshot', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)
      vi.mocked(calendarV055Api.updateEvent).mockResolvedValue({ success: true })

      await store.fetchWeekSnapshot(1, '2025-12-23')

      await store.updateEvent({
        id: 1,
        start: '2025-12-24T11:00:00+02:00',
        durationMin: 90,
      })

      expect(calendarV055Api.updateEvent).toHaveBeenCalledWith({
        id: 1,
        start: '2025-12-24T11:00:00+02:00',
        durationMin: 90,
      })
      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalledTimes(2)
    })
  })

  describe('rescheduleConfirm', () => {
    it('reschedules event and refetches snapshot', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)
      vi.mocked(calendarV055Api.rescheduleConfirm).mockResolvedValue({ success: true, event_id: 1 })

      await store.fetchWeekSnapshot(1, '2025-12-23')

      await store.rescheduleConfirm(1, {
        target_slot_id: 10,
      })

      expect(calendarV055Api.rescheduleConfirm).toHaveBeenCalledWith(1, {
        target_slot_id: 10,
      })
      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalledTimes(2)
    })
  })

  describe('selectors', () => {
    it('days selector returns normalized days', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      expect(store.days).toHaveLength(1)
      expect(store.days[0].date).toBe('2025-12-24')
      expect(store.days[0].dayStatus).toBe('working')
    })

    it('events selector returns all events', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      expect(store.events).toHaveLength(1)
      expect(store.events[0].id).toBe(1)
      expect(store.events[0].student.name).toBe('Test Student')
    })

    it('accessible selector returns available slots', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      expect(store.accessible).toHaveLength(1)
      expect(store.accessible[0].id).toBe(10)
    })

    it('accessibleById selector creates id map', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      expect(store.accessibleById[10]).toBeDefined()
      expect(store.accessibleById[10].start).toBe('2025-12-24T14:00:00+02:00')
    })

    it('meta selector returns snapshot metadata', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      expect(store.meta?.tutorId).toBe(1)
      expect(store.meta?.weekStart).toBe('2025-12-23')
      expect(store.meta?.timezone).toBe('Europe/Kiev')
    })
  })

  describe('optimistic updates', () => {
    it('adds optimistic event', () => {
      const store = useCalendarWeekStore()
      store.snapshot = createSnapshot()

      const tempId = store.addOptimisticEvent({
        tempId: 'temp-123',
        start: '2025-12-24T16:00:00+02:00',
        end: '2025-12-24T17:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 200, name: 'New Student' },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true,
      })

      expect(tempId).toBe('temp-123')
      expect(store.events).toHaveLength(2)
    })

    it('removes optimistic event', () => {
      const store = useCalendarWeekStore()
      store.snapshot = createSnapshot()

      store.addOptimisticEvent({
        tempId: 'temp-456',
        start: '2025-12-24T16:00:00+02:00',
        end: '2025-12-24T17:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 200, name: 'New Student' },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true,
      })

      store.removeOptimisticEvent('temp-456')

      expect(store.events).toHaveLength(1)
    })

    it('replaces optimistic event with real event', () => {
      const store = useCalendarWeekStore()
      store.snapshot = createSnapshot()

      store.addOptimisticEvent({
        tempId: 'temp-789',
        start: '2025-12-24T16:00:00+02:00',
        end: '2025-12-24T17:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 200, name: 'New Student' },
        lesson_link: '',
        can_reschedule: true,
        can_mark_no_show: true,
      })

      store.replaceOptimisticEvent('temp-789', {
        id: 300,
        start: '2025-12-24T16:00:00+02:00',
        end: '2025-12-24T17:00:00+02:00',
        status: 'scheduled',
        is_first: false,
        student: { id: 200, name: 'New Student' },
        lesson_link: 'https://zoom.us/j/456',
        can_reschedule: true,
        can_mark_no_show: true,
      })

      expect(store.events).toHaveLength(2)
      expect(store.events[1].id).toBe(300)
      expect(store.events[1].lesson_link).toBe('https://zoom.us/j/456')
    })
  })

  describe('error handling', () => {
    it('handles 304 Not Modified gracefully', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      const error304 = new Error('Not Modified')
      ;(error304 as any).response = { status: 304 }
      vi.mocked(calendarV055Api.getCalendarWeek).mockRejectedValue(error304)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      expect(store.snapshot).not.toBeNull()
      expect(store.error).toBeNull()
    })

    it('retries on 304 if no cached snapshot exists', async () => {
      const store = useCalendarWeekStore()
      const error304 = new Error('Not Modified')
      ;(error304 as any).response = { status: 304 }
      vi.mocked(calendarV055Api.getCalendarWeek)
        .mockRejectedValueOnce(error304)
        .mockResolvedValueOnce(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')

      expect(calendarV055Api.getCalendarWeek).toHaveBeenCalledTimes(2)
      expect(store.snapshot).not.toBeNull()
    })

    it('handles network errors during create', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)
      await store.fetchWeekSnapshot(1, '2025-12-23')

      const networkError = new Error('Network timeout')
      vi.mocked(calendarV055Api.createEvent).mockRejectedValue(networkError)

      await expect(
        store.createEvent({
          orderId: 100,
          start: '2025-12-24T10:00:00+02:00',
          durationMin: 60,
          regularity: 'single',
        })
      ).rejects.toThrow('Network timeout')
    })
  })

  describe('$reset', () => {
    it('resets store state', async () => {
      const store = useCalendarWeekStore()
      vi.mocked(calendarV055Api.getCalendarWeek).mockResolvedValue(mockSnapshot)

      await store.fetchWeekSnapshot(1, '2025-12-23')
      store.selectEvent(5)

      store.$reset()

      expect(store.snapshot).toBeNull()
      expect(store.currentTutorId).toBeNull()
      expect(store.currentWeekStart).toBeNull()
      expect(store.selectedEventId).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })
})
