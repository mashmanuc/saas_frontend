// F2: useTimeline composable - Timeline event management
import { ref, computed } from 'vue'
import { classroomApi } from '../api/classroom'

export interface TimelineEvent {
  id: number
  event_type: string
  timestamp_ms: number
  user: { id: number; name: string } | null
  data: Record<string, unknown>
}

export interface TimelineBucket {
  start_ms: number
  end_ms: number
  events: TimelineEvent[]
}

export interface TimelineParams {
  offset?: number
  limit?: number
  from_ms?: number
  to_ms?: number
  event_types?: string[]
}

const BUCKET_SIZE = 5000 // 5 seconds

export function useTimeline(sessionId: string) {
  const events = ref<TimelineEvent[]>([])
  const buckets = ref<TimelineBucket[]>([])
  const totalEvents = ref(0)
  const hasMore = ref(true)
  const isLoading = ref(false)
  const offset = ref(0)
  const limit = 100
  const error = ref<string | null>(null)

  const availableTypes = computed(() => {
    const types = new Set<string>()
    events.value.forEach((e) => types.add(e.event_type))
    return Array.from(types)
  })

  /**
   * Load timeline events from server.
   */
  async function loadTimeline(): Promise<void> {
    if (isLoading.value) return

    isLoading.value = true
    error.value = null

    try {
      const response = await classroomApi.getTimeline(sessionId, {
        offset: offset.value,
        limit,
      })

      events.value = [...events.value, ...response.events]
      totalEvents.value = response.total
      hasMore.value = response.has_more
      offset.value += response.events.length

      // Group into buckets
      groupIntoBuckets()
    } catch (err) {
      error.value = 'Не вдалося завантажити таймлайн'
      console.error('[useTimeline] Load failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load more events (infinite scroll).
   */
  async function loadMore(): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    await loadTimeline()
  }

  /**
   * Group events into 5-second buckets.
   */
  function groupIntoBuckets(): void {
    const bucketMap = new Map<number, TimelineEvent[]>()

    for (const event of events.value) {
      const bucketStart = Math.floor(event.timestamp_ms / BUCKET_SIZE) * BUCKET_SIZE

      if (!bucketMap.has(bucketStart)) {
        bucketMap.set(bucketStart, [])
      }
      bucketMap.get(bucketStart)!.push(event)
    }

    buckets.value = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([start, evts]) => ({
        start_ms: start,
        end_ms: start + BUCKET_SIZE,
        events: evts.sort((a, b) => a.timestamp_ms - b.timestamp_ms),
      }))
  }

  /**
   * Filter events by types.
   */
  function filterByTypes(types: string[]): void {
    // Re-group with filter applied in component
    groupIntoBuckets()
  }

  /**
   * Get events in specific time range.
   */
  async function getEventsByTimeRange(
    fromMs: number,
    toMs: number
  ): Promise<TimelineEvent[]> {
    try {
      const response = await classroomApi.getTimeline(sessionId, {
        from_ms: fromMs,
        to_ms: toMs,
        limit: 500,
      })
      return response.events
    } catch (err) {
      console.error('[useTimeline] Failed to get events by range:', err)
      return []
    }
  }

  /**
   * Reset timeline state.
   */
  function reset(): void {
    events.value = []
    buckets.value = []
    totalEvents.value = 0
    hasMore.value = true
    offset.value = 0
    error.value = null
  }

  /**
   * Find event by ID.
   */
  function findEventById(id: number): TimelineEvent | undefined {
    return events.value.find((e) => e.id === id)
  }

  /**
   * Find events near timestamp.
   */
  function findEventsNearTimestamp(
    timestampMs: number,
    toleranceMs: number = 100
  ): TimelineEvent[] {
    return events.value.filter(
      (e) =>
        e.timestamp_ms >= timestampMs - toleranceMs &&
        e.timestamp_ms <= timestampMs + toleranceMs
    )
  }

  return {
    // State
    events,
    buckets,
    totalEvents,
    availableTypes,
    hasMore,
    isLoading,
    error,

    // Actions
    loadTimeline,
    loadMore,
    filterByTypes,
    getEventsByTimeRange,
    reset,
    findEventById,
    findEventsNearTimestamp,
  }
}
