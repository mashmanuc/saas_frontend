/**
 * Calendar Week Store v0.55 - Single Source of Truth
 * 
 * Unified store for both v0.55 and legacy calendar functionality
 * Following contract: GET /v1/calendar/week/ with extended snapshot
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import dayjs from 'dayjs'

import { calendarV055Api } from '../api/calendarV055Api'
import { calendarWeekApi } from '../api/calendarWeekApi'
import type {
  CalendarSnapshot,
  DaySnapshot,
  CalendarEvent as CalendarEventV055,
  AccessibleSlot as AccessibleSlotV055,
  BlockedRange,
  Dictionaries,
  SnapshotMeta,
  ReschedulePreviewRequest,
  ReschedulePreviewResponse,
  RescheduleConfirmRequest,
  NoShowRequest,
  BlockRangeRequest
} from '../types/calendarV055'
import type {
  WeekSnapshot,
  CalendarEvent as LegacyEvent,
  AccessibleSlot as LegacySlot,
  Day as LegacyDay,
  WeekMeta,
  MetaData,
  Order,
  CreateEventPayload,
  UpdateEventPayload,
  DeleteEventPayload,
} from '../types/calendarWeek'

export const useCalendarWeekStore = defineStore('calendarWeek', () => {
  // ===== STATE =====
  
  // v0.55: Single snapshot source of truth
  const snapshot = ref<CalendarSnapshot | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Current context for refetch
  const currentTutorId = ref<number | null>(null)
  const currentWeekStart = ref<string | null>(null)
  
  // Legacy state for backward compatibility
  const weekMeta = ref<WeekMeta | null>(null)
  const legacyDays = ref<LegacyDay[]>([])
  const legacyMeta = ref<MetaData | null>(null)
  
  // Normalized events for legacy compatibility
  const eventsById = ref<Record<number, CalendarEventV055>>({})
  const eventIdsByDay = ref<Record<string, number[]>>({})
  const allEventIds = ref<number[]>([])
  
  // Normalized accessible slots for legacy compatibility
  const accessibleById = ref<Record<number, AccessibleSlotV055>>({})
  const accessibleIdsByDay = ref<Record<string, number[]>>({})
  const allAccessibleIds = ref<number[]>([])
  
  // Normalized orders
  const ordersById = ref<Record<number, Order>>({})
  const allOrderIds = ref<number[]>([])
  
  // UI state
  const selectedEventId = ref<number | null>(null)
  const lastFetchedAt = ref<Date | null>(null)
  
  // Legacy ETag caching
  const etag = ref<string>('')
  
  // Legacy page/timezone for refetch
  const currentPage = ref(0)
  const currentTimezone = ref('Europe/Kiev')
  
  // ===== GETTERS / SELECTORS =====
  
  // v0.55: Computed properties from snapshot
  const days = computed(() => snapshot.value?.days || [])
  const events = computed(() => snapshot.value?.events || [])
  const accessible = computed(() => snapshot.value?.accessible || [])
  const blockedRanges = computed(() => snapshot.value?.blockedRanges || [])
  const dictionaries = computed(() => snapshot.value?.dictionaries || {
    noShowReasons: {},
    cancelReasons: {},
    blockReasons: {}
  })
  const meta = computed(() => snapshot.value?.meta || null)
  
  /**
   * Day summaries with computed stats
   */
  const daySummaries = computed(() => {
    return days.value.map(day => {
      const dayEvents = events.value.filter(e => e.start.startsWith(day.date))
      const isPast = new Date(day.date) < new Date()
      return {
        ...day,
        isPast,
        eventsCount: dayEvents.length
      }
    })
  })
  
  // Legacy getters for backward compatibility
  const daysOrdered = computed(() => legacyDays.value)
  
  const eventsForDay = computed(() => (dayKey: string): CalendarEventV055[] => {
    const ids = eventIdsByDay.value[dayKey] || []
    return ids.map(id => eventsById.value[id]).filter(Boolean)
  })
  
  const accessibleForDay = computed(() => (dayKey: string): AccessibleSlotV055[] => {
    const ids = accessibleIdsByDay.value[dayKey] || []
    return ids.map(id => accessibleById.value[id]).filter(Boolean)
  })
  
  const ordersArray = computed(() => {
    return allOrderIds.value.map(id => ordersById.value[id]).filter(Boolean)
  })
  
  const selectedEvent = computed(() => {
    return selectedEventId.value ? eventsById.value[selectedEventId.value] : null
  })
  
  // ===== ACTIONS =====
  
  function ensureArray<T>(value: T[] | Record<string, T> | null | undefined): T[] {
    if (Array.isArray(value)) {
      return value
    }
    if (value && typeof value === 'object') {
      return Object.values(value)
    }
    return []
  }

  function extractDatePart(raw?: string): string {
    if (!raw) return ''
    const match = raw.match(/\d{4}-\d{2}-\d{2}/)
    return match ? match[0] : raw
  }

  function toNumber(value: unknown, fallback = 0): number {
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }

  function normalizeDaySnapshot(day: any, metaFromResponse?: SnapshotMeta | null): DaySnapshot {
    const dateRaw = day?.date ?? day?.dayKey ?? day?.day_key ?? day?.day ?? ''
    const date = extractDatePart(dateRaw)
    const availableMinutesRaw =
      day?.availableMinutes ?? day?.available_minutes ?? day?.available ?? 0
    const eventsCountRaw =
      day?.eventsCount ??
      day?.events_count ??
      (Array.isArray(day?.events) ? day.events.length : 0)
    const status = day?.dayStatus ?? day?.status ?? 'working'
    const referenceTime = metaFromResponse?.currentTime ?? new Date().toISOString()
    const isPast =
      typeof day?.isPast === 'boolean'
        ? day.isPast
        : !!date && new Date(date) < new Date(referenceTime)

    return {
      date,
      dayStatus: status,
      availableMinutes: toNumber(availableMinutesRaw),
      eventsCount: toNumber(eventsCountRaw),
      isPast,
    }
  }

  function normalizeDays(
    rawDays: DaySnapshot[] | Record<string, any> | null | undefined,
    metaFromResponse?: SnapshotMeta | null
  ): DaySnapshot[] {
    if (Array.isArray(rawDays)) {
      return rawDays.map(day => normalizeDaySnapshot(day, metaFromResponse))
    }
    if (rawDays && typeof rawDays === 'object') {
      return Object.entries(rawDays).map(([dayKey, value]) =>
        normalizeDaySnapshot({ date: dayKey, ...value }, metaFromResponse)
      )
    }
    return []
  }

  function normalizeMeta(metaRaw?: SnapshotMeta | Record<string, any> | null): SnapshotMeta | null {
    if (!metaRaw) {
      return null
    }
    const camelized = metaRaw as Record<string, any>
    return {
      tutorId: toNumber(camelized.tutorId ?? camelized.tutor_id),
      weekStart: extractDatePart(camelized.weekStart ?? camelized.week_start),
      weekEnd: extractDatePart(camelized.weekEnd ?? camelized.week_end),
      timezone: camelized.timezone ?? camelized.time_zone ?? 'Europe/Kiev',
      currentTime: camelized.currentTime ?? camelized.current_time ?? new Date().toISOString(),
      etag: camelized.etag ?? '',
    }
  }

  function normalizeMetaFromWeek(
    tutorId: number,
    weekRaw?: Record<string, any> | null,
    requestedWeekStart?: string
  ): SnapshotMeta {
    const week = (weekRaw || {}) as Record<string, any>
    const resolvedWeekStart = extractDatePart(
      week.weekStart ?? week.week_start ?? requestedWeekStart ?? ''
    )

    let resolvedWeekEnd = extractDatePart(week.weekEnd ?? week.week_end ?? '')
    if (!resolvedWeekEnd && resolvedWeekStart) {
      resolvedWeekEnd = dayjs(resolvedWeekStart).add(6, 'day').format('YYYY-MM-DD')
    }

    return {
      tutorId,
      weekStart: resolvedWeekStart,
      weekEnd: resolvedWeekEnd,
      timezone: week.timezone ?? week.time_zone ?? 'Europe/Kiev',
      currentTime: week.currentTime ?? week.current_time ?? new Date().toISOString(),
      etag: week.etag ?? '',
    }
  }

  function flattenValues<T>(value: unknown): T[] {
    if (Array.isArray(value)) {
      // value can be T[] or T[][]
      if (value.length > 0 && Array.isArray(value[0])) {
        return (value as unknown[]).flat() as T[]
      }
      return value as T[]
    }
    if (value && typeof value === 'object') {
      const vals = Object.values(value as Record<string, unknown>)
      if (vals.length > 0 && Array.isArray(vals[0])) {
        return (vals as unknown[]).flat() as T[]
      }
      return vals as T[]
    }
    return []
  }

  /**
   * Fetch week snapshot (v0.55)
   */
  async function fetchWeekSnapshot(tutorId: number, weekStart: string) {
    isLoading.value = true
    error.value = null
    
    try {
      const previousMeta = meta.value
      const etagValue =
        previousMeta && previousMeta.weekStart === weekStart ? previousMeta.etag : undefined

      console.log('[calendarWeekStore] Starting fetch for:', {
        tutorId,
        weekStart,
        hasEtag: Boolean(etagValue),
      })
      const response = await calendarV055Api.getCalendarWeek(tutorId, weekStart, etagValue)
      
      console.log('[calendarWeekStore] API response received:', {
        hasResponse: !!response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : [],
        hasDays: !!response?.days,
        daysType: typeof response?.days,
        daysLength: Array.isArray(response?.days) ? response.days.length : 'not array'
      })
      
      // Backend may return legacy-like envelope with `week` + per-day dictionaries.
      // Guarantee arrays for layers and guarantee SnapshotMeta for currentTime/weekStart.
      const metaFromWeek = normalizeMetaFromWeek(tutorId, (response as any).week, weekStart)

      const normalizedSnapshot: CalendarSnapshot = {
        ...(response as any),
        meta: metaFromWeek,
        days: normalizeDays((response as any).days, metaFromWeek),
        events: flattenValues<CalendarEventV055>((response as any).events),
        accessible: flattenValues<AccessibleSlotV055>((response as any).accessible),
        blockedRanges: flattenValues<BlockedRange>((response as any).blockedRanges),
        dictionaries: (response as any).dictionaries || {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
      }

      const orders = flattenValues<Order>((response as any).orders)

      console.log('[calendarWeekStore] Normalized snapshot:', {
        daysCount: normalizedSnapshot.days.length,
        eventsCount: normalizedSnapshot.events.length,
        accessibleCount: normalizedSnapshot.accessible.length,
        accessibleSample: normalizedSnapshot.accessible[0],
        blockedRangesCount: normalizedSnapshot.blockedRanges.length
      })

      snapshot.value = normalizedSnapshot
      syncAccessibleIndexes(normalizedSnapshot.accessible)
      syncOrders(orders)
      currentTutorId.value = tutorId
      currentWeekStart.value = metaFromWeek.weekStart || weekStart
      
      console.log('[calendarWeekStore] Snapshot fetched:', {
        days: normalizedSnapshot.days.length,
        events: normalizedSnapshot.events.length,
        accessible: normalizedSnapshot.accessible.length,
        blockedRanges: normalizedSnapshot.blockedRanges.length
      })
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch snapshot'
      console.error('[calendarWeekStore] Fetch error:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Legacy fetch week for backward compatibility
   */
  async function fetchWeek(page: number = 0, timezone: string = 'Europe/Kiev') {
    isLoading.value = true
    error.value = null
    currentPage.value = page
    currentTimezone.value = timezone
    
    try {
      const result = await calendarWeekApi.getWeekSnapshot({
        page,
        timezone,
        includePayments: true,
        includeStats: true,
        etag: etag.value,
      })
      
      if (result.cached) {
        console.log('[calendarWeekStore] Using cached snapshot (304)')
        isLoading.value = false
        return
      }
      
      etag.value = result.etag
      normalizeLegacySnapshot(result.data)
      
      console.log('[calendarWeekStore] Legacy week loaded')
    } catch (err: any) {
      error.value = err.message || 'Failed to load week'
      console.error('[calendarWeekStore] Load error:', err)
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Normalize legacy snapshot for backward compatibility
   */
  function normalizeLegacySnapshot(legacySnapshot: WeekSnapshot) {
    // Convert legacy events to v0.55 format
    const newEventsById: Record<number, CalendarEventV055> = {}
    const newEventIdsByDay: Record<string, number[]> = {}
    const newAllEventIds: number[] = []
    
    for (const [dayKey, dayEvents] of Object.entries(legacySnapshot.events || {})) {
      newEventIdsByDay[dayKey] = []
      
      for (const event of dayEvents as LegacyEvent[]) {
        const v055Event: CalendarEventV055 = {
          id: event.id,
          start: event.start,
          end: event.end,
          status: event.doneStatus === 'done' ? 'completed' : 
                  event.doneStatus === 'not_done_client_missed' ? 'no_show' :
                  event.doneStatus === 'done_client_missed' ? 'no_show' :
                  event.doneStatus === 'not_done' ? 'scheduled' : 'scheduled',
          is_first: false,
          student: {
            id: event.orderId ?? 0,
            name: event.clientName || 'Студент',
          },
          lesson_link: legacySnapshot.meta?.zoomLink || '',
          can_reschedule: true,
          can_mark_no_show: true,
        }
        
        newEventsById[event.id] = v055Event
        newEventIdsByDay[dayKey].push(event.id)
        newAllEventIds.push(event.id)
      }
    }
    
    eventsById.value = newEventsById
    eventIdsByDay.value = newEventIdsByDay
    allEventIds.value = newAllEventIds
    
    // Convert legacy accessible slots
    const newAccessibleById: Record<number, AccessibleSlotV055> = {}
    const newAccessibleIdsByDay: Record<string, number[]> = {}
    const newAllAccessibleIds: number[] = []
    
    for (const [dayKey, daySlots] of Object.entries(legacySnapshot.accessible || {})) {
      newAccessibleIdsByDay[dayKey] = []
      
      for (const slot of daySlots as LegacySlot[]) {
        const v055Slot: AccessibleSlotV055 = {
          id: slot.id,
          start: slot.start,
          end: slot.end,
          is_recurring: (slot.regularity ?? '') === 'once_a_week',
        }
        
        newAccessibleById[slot.id] = v055Slot
        newAccessibleIdsByDay[dayKey].push(slot.id)
        newAllAccessibleIds.push(slot.id)
      }
    }
    
    accessibleById.value = newAccessibleById
    accessibleIdsByDay.value = newAccessibleIdsByDay
    allAccessibleIds.value = newAllAccessibleIds
    
    // Normalize orders
    const legacyOrders = ensureArray<Order>(legacySnapshot.orders as any)
    syncOrders(legacyOrders)
    
    // Set legacy metadata
    weekMeta.value = legacySnapshot.week
    legacyDays.value = legacySnapshot.days
    legacyMeta.value = legacySnapshot.meta
    lastFetchedAt.value = new Date()
  }

  function syncAccessibleIndexes(slots: AccessibleSlotV055[] | undefined | null) {
    const byId: Record<number, AccessibleSlotV055> = {}
    const idsByDay: Record<string, number[]> = {}
    const allIds: number[] = []

    if (Array.isArray(slots)) {
      for (const slot of slots) {
        if (!slot || typeof slot.id !== 'number') {
          continue
        }
        byId[slot.id] = slot
        const dayKey = slot.start?.slice(0, 10) || slot.end?.slice(0, 10) || ''
        if (dayKey) {
          if (!idsByDay[dayKey]) {
            idsByDay[dayKey] = []
          }
          idsByDay[dayKey].push(slot.id)
        }
        allIds.push(slot.id)
      }
    }

    accessibleById.value = byId
    accessibleIdsByDay.value = idsByDay
    allAccessibleIds.value = allIds
  }

  function syncOrders(orders: Order[] | undefined | null) {
    const byId: Record<number, Order> = {}
    const ids: number[] = []

    if (Array.isArray(orders)) {
      for (const order of orders) {
        if (!order || typeof order.id !== 'number') continue
        byId[order.id] = order
        ids.push(order.id)
      }
    }

    ordersById.value = byId
    allOrderIds.value = ids
  }

  function ensureSnapshot(): CalendarSnapshot {
    if (!snapshot.value) {
      snapshot.value = {
        days: [],
        events: [],
        accessible: [],
        blockedRanges: [],
        dictionaries: {
          noShowReasons: {},
          cancelReasons: {},
          blockReasons: {},
        },
        meta: null as unknown as SnapshotMeta,
      }
    }
    return snapshot.value
  }

  function addOptimisticSlot(slot: AccessibleSlotV055) {
    const currentSnapshot = ensureSnapshot()
    const slots = [...(currentSnapshot.accessible || [])]
    const existingIndex = slots.findIndex(existing => existing.id === slot.id)

    if (existingIndex >= 0) {
      slots[existingIndex] = slot
    } else {
      slots.push(slot)
    }

    snapshot.value = {
      ...currentSnapshot,
      accessible: slots,
    }
    syncAccessibleIndexes(slots)
  }

  function removeOptimisticSlot(slotId: number) {
    if (!snapshot.value) {
      return
    }
    const slots = (snapshot.value.accessible || []).filter(slot => slot.id !== slotId)
    snapshot.value = {
      ...snapshot.value,
      accessible: slots,
    }
    syncAccessibleIndexes(slots)
  }

  function replaceOptimisticSlot(tempSlotId: number, newSlot: AccessibleSlotV055) {
    if (!snapshot.value) {
      addOptimisticSlot(newSlot)
      return
    }

    let replaced = false
    const slots = (snapshot.value.accessible || []).map(slot => {
      if (slot.id === tempSlotId) {
        replaced = true
        return newSlot
      }
      return slot
    })

    if (!replaced) {
      slots.push(newSlot)
    }

    snapshot.value = {
      ...snapshot.value,
      accessible: slots,
    }
    syncAccessibleIndexes(slots)
  }

  // v0.55: Reschedule actions
  async function reschedulePreview(eventId: number, target: { new_start: string; new_end: string }) {
    return await calendarV055Api.reschedulePreview(eventId, target)
  }
  
  async function rescheduleConfirm(eventId: number, target: { new_start: string; new_end: string }) {
    const result = await calendarV055Api.rescheduleConfirm(eventId, target)
    // ОБОВ'ЯЗКОВИЙ refetch після мутації
    if (currentTutorId.value && currentWeekStart.value) {
      await fetchWeekSnapshot(currentTutorId.value, currentWeekStart.value)
    }
    return result
  }
  
  async function markNoShow(eventId: number, payload: NoShowRequest) {
    await calendarV055Api.markNoShow(eventId, payload)
    // ОБОВ'ЯЗКОВИЙ refetch
    if (currentTutorId.value && currentWeekStart.value) {
      await fetchWeekSnapshot(currentTutorId.value, currentWeekStart.value)
    }
  }
  
  async function blockDayRange(dayKey: string, payload: BlockRangeRequest) {
    await calendarV055Api.blockDayRange(dayKey, payload)
    // ОБОВ'ЯЗКОВИЙ refetch
    if (currentTutorId.value && currentWeekStart.value) {
      await fetchWeekSnapshot(currentTutorId.value, currentWeekStart.value)
    }
  }
  
  async function unblockRange(rangeId: number) {
    await calendarV055Api.unblockRange(rangeId)
    // ОБОВ'ЯЗКОВИЙ refetch
    if (currentTutorId.value && currentWeekStart.value) {
      await fetchWeekSnapshot(currentTutorId.value, currentWeekStart.value)
    }
  }
  
  // Legacy actions
  async function createEvent(payload: CreateEventPayload) {
    const response = await calendarWeekApi.createEvent(payload)
    await fetchWeek(currentPage.value, currentTimezone.value)
    return response
  }
  
  async function deleteEvent(id: number) {
    await calendarWeekApi.deleteEvent({ id })
    await fetchWeek(currentPage.value, currentTimezone.value)
  }
  
  async function updateEvent(payload: UpdateEventPayload) {
    await calendarWeekApi.updateEvent(payload)
    await fetchWeek(currentPage.value, currentTimezone.value)
  }
  
  function selectEvent(id: number | null) {
    selectedEventId.value = id
  }
  
  function $reset() {
    snapshot.value = null
    isLoading.value = false
    error.value = null
    currentTutorId.value = null
    currentWeekStart.value = null
    weekMeta.value = null
    legacyDays.value = []
    legacyMeta.value = null
    eventsById.value = {}
    eventIdsByDay.value = {}
    allEventIds.value = []
    accessibleById.value = {}
    accessibleIdsByDay.value = {}
    allAccessibleIds.value = []
    ordersById.value = {}
    allOrderIds.value = []
    selectedEventId.value = null
    lastFetchedAt.value = null
    etag.value = ''
    currentPage.value = 0
    currentTimezone.value = 'Europe/Kiev'
  }
  
  return {
    // State
    snapshot,
    isLoading,
    error,
    currentTutorId,
    currentWeekStart,
    weekMeta,
    legacyDays,
    legacyMeta,
    eventsById,
    eventIdsByDay,
    allEventIds,
    accessibleById,
    accessibleIdsByDay,
    allAccessibleIds,
    ordersById,
    allOrderIds,
    selectedEventId,
    lastFetchedAt,
    etag,
    currentPage,
    currentTimezone,
    
    // v0.55 computed
    days,
    events,
    accessible,
    blockedRanges,
    dictionaries,
    meta,
    daySummaries,
    
    // Legacy computed
    daysOrdered,
    eventsForDay,
    accessibleForDay,
    ordersArray,
    selectedEvent,
    
    // Actions
    fetchWeekSnapshot,
    fetchWeek,
    reschedulePreview,
    rescheduleConfirm,
    markNoShow,
    blockDayRange,
    unblockRange,
    createEvent,
    deleteEvent,
    updateEvent,
    selectEvent,
    $reset,
  }
})