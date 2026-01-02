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

describe('calendarWeekStore (v0.55.7)', () => {
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
