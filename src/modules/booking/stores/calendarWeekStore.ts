/**
 * Calendar Week Store v0.55 - Single Source of Truth
 * 
 * Unified store for both v0.55 and legacy calendar functionality
 * Following contract: GET /v1/calendar/week/ with extended snapshot
 */

import { defineStore } from 'pinia'
import { ref, computed, triggerRef } from 'vue'
import dayjs from 'dayjs'

import { calendarV055Api } from '../api/calendarV055Api'
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
  AccessibleSlot as LegacySlot,
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
  
  // Normalized orders (залишаємо, бо використовується в CreateLessonModal)
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
  
  const ordersArray = computed(() => {
    return allOrderIds.value.map(id => ordersById.value[id]).filter(Boolean)
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
      const response = await calendarV055Api.getCalendarWeek(tutorId, weekStart)
      
      if (!response) {
        throw new Error('Backend returned null/undefined response')
      }
      
      // Backend returns v0.55 format with direct meta object
      // Normalize meta from response.meta (not response.week)
      const metaFromResponse = (response as any).meta || {}
      const normalizedMeta: SnapshotMeta = {
        tutorId: metaFromResponse.tutorId || tutorId,
        weekStart: metaFromResponse.weekStart || weekStart,
        weekEnd: metaFromResponse.weekEnd || dayjs(weekStart).add(6, 'day').format('YYYY-MM-DD'),
        timezone: metaFromResponse.timezone || 'Europe/Kiev',
        currentTime: metaFromResponse.generatedAt || metaFromResponse.currentTime || new Date().toISOString(),
        etag: metaFromResponse.etag || ''
      }

      const normalizedSnapshot: CalendarSnapshot = {
        ...(response as any),
        meta: normalizedMeta,
        days: normalizeDays((response as any).days, normalizedMeta),
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

      snapshot.value = normalizedSnapshot
      
      syncOrders(orders)
      currentTutorId.value = tutorId
      currentWeekStart.value = normalizedMeta.weekStart || weekStart
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch snapshot'
      throw err
    } finally {
      isLoading.value = false
    }
  }
  
  // fetchWeek() та normalizeLegacySnapshot() видалені - всі компоненти тепер використовують fetchWeekSnapshot() + адаптери


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

  // Старі методи addOptimisticSlot/removeOptimisticSlot видалені - нові версії нижче

  function replaceOptimisticSlot(tempSlotId: number, newSlot: AccessibleSlotV055 | LegacySlot) {
    if (!snapshot.value) {
      addOptimisticSlot(newSlot)
      return
    }

    // Конвертуємо до v0.55 формату якщо потрібно
    const v055NewSlot: AccessibleSlotV055 = 'is_recurring' in newSlot ? newSlot : {
      id: newSlot.id,
      start: newSlot.start,
      end: newSlot.end,
      is_recurring: false,
    }

    let replaced = false
    const slots = (snapshot.value.accessible || []).map(slot => {
      if (slot.id === tempSlotId) {
        replaced = true
        return v055NewSlot
      }
      return slot
    })

    if (!replaced) {
      slots.push(v055NewSlot)
    }

    snapshot.value = {
      ...snapshot.value,
      accessible: slots,
    }
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
  
  // v0.55 CRUD actions (замінили legacy)
  async function createEvent(payload: CreateEventPayload) {
    const response = await calendarV055Api.createEvent({
      orderId: payload.orderId,
      start: payload.start,
      durationMin: payload.durationMin,
      regularity: payload.regularity,
      tutorComment: payload.tutorComment,
    })
    
    // Refetch snapshot після створення
    if (currentTutorId.value && currentWeekStart.value) {
      await fetchWeekSnapshot(currentTutorId.value, currentWeekStart.value)
    }
    
    return response
  }
  
  async function deleteEvent(id: number) {
    await calendarV055Api.deleteEvent({ id })
    
    // Refetch snapshot після видалення
    if (currentTutorId.value && currentWeekStart.value) {
      await fetchWeekSnapshot(currentTutorId.value, currentWeekStart.value)
    }
  }
  
  async function updateEvent(payload: UpdateEventPayload) {
    await calendarV055Api.updateEvent({
      id: payload.id,
      start: payload.start,
      durationMin: payload.durationMin,
      tutorComment: payload.tutorComment,
      paidStatus: payload.paidStatus,
      doneStatus: payload.doneStatus,
    })
    
    // Refetch snapshot після оновлення
    if (currentTutorId.value && currentWeekStart.value) {
      await fetchWeekSnapshot(currentTutorId.value, currentWeekStart.value)
    }
  }
  
  async function getEventDetails(id: number) {
    return await calendarV055Api.getEventDetails(id)
  }
  
  
  function selectEvent(id: number | null) {
    selectedEventId.value = id
  }

  /**
   * WebSocket handlers for real-time updates
   */
  function handleEventCreated(eventData: any) {
    if (!snapshot.value) return
    
    // Додаємо нову подію до snapshot (v0.55 CalendarEvent format)
    const newEvent: CalendarEventV055 = {
      id: eventData.id,
      start: eventData.start,
      end: eventData.end || eventData.start, // fallback
      status: eventData.status || 'scheduled',
      is_first: eventData.is_first ?? false,
      student: eventData.student || { id: 0, name: 'Unknown' },
      lesson_link: eventData.lesson_link || '',
      can_reschedule: eventData.can_reschedule ?? true,
      can_mark_no_show: eventData.can_mark_no_show ?? true,
    }
    
    snapshot.value.events.push(newEvent)
    console.info('[calendarWeekStore] Event created via WebSocket:', eventData.id)
  }

  function handleEventUpdated(eventData: any) {
    if (!snapshot.value) return
    
    const index = snapshot.value.events.findIndex(e => e.id === eventData.id)
    if (index !== -1) {
      snapshot.value.events[index] = {
        ...snapshot.value.events[index],
        start: eventData.start ?? snapshot.value.events[index].start,
        end: eventData.end ?? snapshot.value.events[index].end,
        status: eventData.status ?? snapshot.value.events[index].status,
        lesson_link: eventData.lesson_link ?? snapshot.value.events[index].lesson_link,
        can_reschedule: eventData.can_reschedule ?? snapshot.value.events[index].can_reschedule,
        can_mark_no_show: eventData.can_mark_no_show ?? snapshot.value.events[index].can_mark_no_show,
      }
      console.info('[calendarWeekStore] Event updated via WebSocket:', eventData.id)
    }
  }

  function handleEventDeleted(eventData: any) {
    if (!snapshot.value) return
    
    const index = snapshot.value.events.findIndex(e => e.id === eventData.id)
    if (index !== -1) {
      snapshot.value.events.splice(index, 1)
      console.info('[calendarWeekStore] Event deleted via WebSocket:', eventData.id)
    }
  }

  /**
   * Optimistic slot updates
   */
  function addOptimisticSlot(slot: AccessibleSlotV055 | LegacySlot) {
    if (!snapshot.value) return
    
    // Конвертуємо до v0.55 формату якщо потрібно
    const v055Slot: AccessibleSlotV055 = 'is_recurring' in slot ? slot : {
      id: slot.id,
      start: slot.start,
      end: slot.end,
      is_recurring: false,
    }
    
    snapshot.value.accessible.push(v055Slot)
    console.info('[calendarWeekStore] Optimistic slot added:', slot.id)
  }

  function removeOptimisticSlot(slotId: number) {
    if (!snapshot.value) return
    
    const index = snapshot.value.accessible.findIndex(s => s.id === slotId)
    if (index !== -1) {
      snapshot.value.accessible.splice(index, 1)
    }
    console.info('[calendarWeekStore] Optimistic slot removed:', slotId)
  }
  
  function $reset() {
    snapshot.value = null
    isLoading.value = false
    error.value = null
    currentTutorId.value = null
    currentWeekStart.value = null
    ordersById.value = {}
    allOrderIds.value = []
    selectedEventId.value = null
    lastFetchedAt.value = null
  }
  
  return {
    // State
    snapshot,
    isLoading,
    error,
    currentTutorId,
    currentWeekStart,
    ordersById,
    allOrderIds,
    selectedEventId,
    lastFetchedAt,
    
    // v0.55 computed
    days,
    events,
    accessible,
    blockedRanges,
    dictionaries,
    meta,
    daySummaries,
    
    // Computed
    ordersArray,
    
    // Actions
    fetchWeekSnapshot,
    reschedulePreview,
    rescheduleConfirm,
    markNoShow,
    blockDayRange,
    unblockRange,
    createEvent,
    deleteEvent,
    updateEvent,
    getEventDetails,
    selectEvent,
    handleEventCreated,
    handleEventUpdated,
    handleEventDeleted,
    addOptimisticSlot,
    removeOptimisticSlot,
    $reset,
  }
})