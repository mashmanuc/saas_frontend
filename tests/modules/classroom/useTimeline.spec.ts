// Tests for useTimeline composable
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock API
vi.mock('@/modules/classroom/api/classroom', () => ({
  classroomApi: {
    getTimeline: vi.fn(),
  },
}))

import { useTimeline } from '@/modules/classroom/composables/useTimeline'
import { classroomApi } from '@/modules/classroom/api/classroom'

describe('useTimeline', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadTimeline', () => {
    it('should load timeline events', async () => {
      const mockEvents = [
        { id: 1, event_type: 'board_stroke', timestamp_ms: 1000, user: null, data: {} },
        { id: 2, event_type: 'board_stroke', timestamp_ms: 2000, user: null, data: {} },
        { id: 3, event_type: 'participant_join', timestamp_ms: 6000, user: { id: 1, name: 'Test' }, data: {} },
      ]

      vi.mocked(classroomApi.getTimeline).mockResolvedValue({
        events: mockEvents,
        total: 3,
        has_more: false,
      })

      const { loadTimeline, events, totalEvents, hasMore, isLoading } = useTimeline('session-123')

      expect(isLoading.value).toBe(false)

      const promise = loadTimeline()
      expect(isLoading.value).toBe(true)

      await promise

      expect(isLoading.value).toBe(false)
      expect(events.value).toHaveLength(3)
      expect(totalEvents.value).toBe(3)
      expect(hasMore.value).toBe(false)
    })

    it('should handle errors', async () => {
      vi.mocked(classroomApi.getTimeline).mockRejectedValue(new Error('Network error'))

      const { loadTimeline, error, isLoading } = useTimeline('session-123')

      await loadTimeline()

      expect(isLoading.value).toBe(false)
      expect(error.value).toBe('Не вдалося завантажити таймлайн')
    })
  })

  describe('groupIntoBuckets', () => {
    it('should group events into 5-second buckets', async () => {
      const mockEvents = [
        { id: 1, event_type: 'board_stroke', timestamp_ms: 1000, user: null, data: {} },
        { id: 2, event_type: 'board_stroke', timestamp_ms: 2000, user: null, data: {} },
        { id: 3, event_type: 'board_stroke', timestamp_ms: 3000, user: null, data: {} },
        { id: 4, event_type: 'board_stroke', timestamp_ms: 6000, user: null, data: {} },
        { id: 5, event_type: 'board_stroke', timestamp_ms: 7000, user: null, data: {} },
      ]

      vi.mocked(classroomApi.getTimeline).mockResolvedValue({
        events: mockEvents,
        total: 5,
        has_more: false,
      })

      const { loadTimeline, buckets } = useTimeline('session-123')
      await loadTimeline()

      // Events 1-3 should be in bucket 0-5000ms
      // Events 4-5 should be in bucket 5000-10000ms
      expect(buckets.value).toHaveLength(2)
      expect(buckets.value[0].events).toHaveLength(3)
      expect(buckets.value[1].events).toHaveLength(2)
    })
  })

  describe('availableTypes', () => {
    it('should return unique event types', async () => {
      const mockEvents = [
        { id: 1, event_type: 'board_stroke', timestamp_ms: 1000, user: null, data: {} },
        { id: 2, event_type: 'board_stroke', timestamp_ms: 2000, user: null, data: {} },
        { id: 3, event_type: 'participant_join', timestamp_ms: 3000, user: null, data: {} },
        { id: 4, event_type: 'media_toggle', timestamp_ms: 4000, user: null, data: {} },
      ]

      vi.mocked(classroomApi.getTimeline).mockResolvedValue({
        events: mockEvents,
        total: 4,
        has_more: false,
      })

      const { loadTimeline, availableTypes } = useTimeline('session-123')
      await loadTimeline()

      expect(availableTypes.value).toContain('board_stroke')
      expect(availableTypes.value).toContain('participant_join')
      expect(availableTypes.value).toContain('media_toggle')
      expect(availableTypes.value).toHaveLength(3)
    })
  })

  describe('findEventsNearTimestamp', () => {
    it('should find events within tolerance', async () => {
      const mockEvents = [
        { id: 1, event_type: 'board_stroke', timestamp_ms: 1000, user: null, data: {} },
        { id: 2, event_type: 'board_stroke', timestamp_ms: 1050, user: null, data: {} },
        { id: 3, event_type: 'board_stroke', timestamp_ms: 2000, user: null, data: {} },
      ]

      vi.mocked(classroomApi.getTimeline).mockResolvedValue({
        events: mockEvents,
        total: 3,
        has_more: false,
      })

      const { loadTimeline, findEventsNearTimestamp } = useTimeline('session-123')
      await loadTimeline()

      const nearEvents = findEventsNearTimestamp(1025, 50)
      expect(nearEvents).toHaveLength(2)
      expect(nearEvents.map(e => e.id)).toContain(1)
      expect(nearEvents.map(e => e.id)).toContain(2)
    })
  })
})
