import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { calendarWeekApi } from '../api/calendarWeekApi'
import type {
  WeekSnapshot,
  WeekMeta,
  Day,
  CalendarEvent,
  AccessibleSlot,
  Order,
  MetaData,
  NormalizedEvents,
  NormalizedAccessible,
  NormalizedOrders,
  CalendarCell,
  CellStatus,
  CreateEventPayload,
  UpdateEventPayload,
  DeleteEventPayload,
  EventLayout,
} from '../types/calendarWeek'

// Constants
const DAY_START_MINUTES = 6 * 60      // 06:00
const DAY_END_MINUTES = 22 * 60       // 22:00
const SLOT_MINUTES = 30
const SLOTS_PER_DAY = 48
const PX_PER_MINUTE = 1.2

export const useCalendarWeekStore = defineStore('calendarWeek', () => {
  // ===== STATE =====
  
  // Week metadata
  const weekMeta = ref<WeekMeta | null>(null)
  const days = ref<Day[]>([])
  const meta = ref<MetaData | null>(null)
  
  // Normalized events
  const eventsById = ref<Record<number, CalendarEvent>>({})
  const eventIdsByDay = ref<Record<string, number[]>>({})
  const allEventIds = ref<number[]>([])
  
  // Normalized accessible slots
  const accessibleById = ref<Record<number, AccessibleSlot>>({})
  const accessibleIdsByDay = ref<Record<string, number[]>>({})
  const allAccessibleIds = ref<number[]>([])
  
  // Normalized orders
  const ordersById = ref<Record<number, Order>>({})
  const allOrderIds = ref<number[]>([])
  
  // UI state
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const selectedEventId = ref<number | null>(null)
  const lastFetchedAt = ref<Date | null>(null)
  
  // ===== GETTERS / SELECTORS =====
  
  const daysOrdered = computed(() => days.value)
  
  const eventsForDay = computed(() => (dayKey: string): CalendarEvent[] => {
    const ids = eventIdsByDay.value[dayKey] || []
    return ids.map(id => eventsById.value[id]).filter(Boolean)
  })
  
  const accessibleForDay = computed(() => (dayKey: string): AccessibleSlot[] => {
    const ids = accessibleIdsByDay.value[dayKey] || []
    return ids.map(id => accessibleById.value[id]).filter(Boolean)
  })
  
  const ordersArray = computed(() => {
    return allOrderIds.value.map(id => ordersById.value[id]).filter(Boolean)
  })
  
  const selectedEvent = computed(() => {
    return selectedEventId.value ? eventsById.value[selectedEventId.value] : null
  })
  
  /**
   * Побудувати 336 клітинок із snapshot (для сумісності з v0.49.1)
   */
  const computedCells336 = computed((): CalendarCell[] => {
    if (!weekMeta.value) return []
    
    const cells: CalendarCell[] = []
    const now = new Date()
    
    for (const day of days.value) {
      for (let slotIndex = 0; slotIndex < SLOTS_PER_DAY; slotIndex++) {
        const startMin = DAY_START_MINUTES + slotIndex * SLOT_MINUTES
        const endMin = startMin + SLOT_MINUTES
        
        const startDate = new Date(day.dayKey)
        startDate.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
        
        const endDate = new Date(day.dayKey)
        endDate.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0)
        
        const cell: CalendarCell = {
          dayKey: day.dayKey,
          slotIndex,
          startAtUTC: startDate.toISOString(),
          endAtUTC: endDate.toISOString(),
          status: getCellStatus(startDate, endDate, day.dayKey, now),
        }
        
        cells.push(cell)
      }
    }
    
    return cells
  })
  
  /**
   * Layout для overlay events
   */
  const eventLayouts = computed((): EventLayout[] => {
    const layouts: EventLayout[] = []
    
    for (const dayKey of Object.keys(eventIdsByDay.value)) {
      const dayEvents = eventsForDay.value(dayKey)
      
      for (const event of dayEvents) {
        const startDate = new Date(event.start)
        const startMin = startDate.getHours() * 60 + startDate.getMinutes()
        
        layouts.push({
          eventId: event.id,
          dayKey,
          top: (startMin - DAY_START_MINUTES) * PX_PER_MINUTE,
          height: event.durationMin * PX_PER_MINUTE,
          left: 0,
          width: '100%',
        })
      }
    }
    
    return layouts
  })
  
  // ===== HELPERS =====
  
  function getCellStatus(
    startDate: Date,
    endDate: Date,
    dayKey: string,
    now: Date
  ): CellStatus {
    // 1. Минуле
    if (endDate < now) return 'notAllow'
    
    // 2. Поза робочим часом
    const hour = startDate.getHours()
    if (hour < 6 || hour >= 22) return 'blocked'
    
    // 3. Overlap з уроком
    const dayEvents = eventsForDay.value(dayKey)
    for (const event of dayEvents) {
      const eventStart = new Date(event.start)
      const eventEnd = new Date(event.end)
      
      if (
        (startDate >= eventStart && startDate < eventEnd) ||
        (endDate > eventStart && endDate <= eventEnd) ||
        (startDate <= eventStart && endDate >= eventEnd)
      ) {
        return 'booked'
      }
    }
    
    // 4. Доступність
    const dayAccessible = accessibleForDay.value(dayKey)
    for (const slot of dayAccessible) {
      const slotStart = new Date(slot.start)
      const slotEnd = new Date(slot.end)
      
      if (startDate >= slotStart && endDate <= slotEnd) {
        return 'available'
      }
    }
    
    return 'empty'
  }
  
  function normalizeSnapshot(snapshot: WeekSnapshot) {
    // Normalize events
    const newEventsById: Record<number, CalendarEvent> = {}
    const newEventIdsByDay: Record<string, number[]> = {}
    const newAllEventIds: number[] = []
    
    for (const [dayKey, dayEvents] of Object.entries(snapshot.events)) {
      newEventIdsByDay[dayKey] = []
      
      for (const event of dayEvents) {
        newEventsById[event.id] = event
        newEventIdsByDay[dayKey].push(event.id)
        newAllEventIds.push(event.id)
      }
    }
    
    eventsById.value = newEventsById
    eventIdsByDay.value = newEventIdsByDay
    allEventIds.value = newAllEventIds
    
    // Normalize accessible
    const newAccessibleById: Record<number, AccessibleSlot> = {}
    const newAccessibleIdsByDay: Record<string, number[]> = {}
    const newAllAccessibleIds: number[] = []
    
    for (const [dayKey, daySlots] of Object.entries(snapshot.accessible)) {
      newAccessibleIdsByDay[dayKey] = []
      
      for (const slot of daySlots) {
        newAccessibleById[slot.id] = slot
        newAccessibleIdsByDay[dayKey].push(slot.id)
        newAllAccessibleIds.push(slot.id)
      }
    }
    
    accessibleById.value = newAccessibleById
    accessibleIdsByDay.value = newAccessibleIdsByDay
    allAccessibleIds.value = newAllAccessibleIds
    
    // Normalize orders
    const newOrdersById: Record<number, Order> = {}
    const newAllOrderIds: number[] = []
    
    for (const order of snapshot.orders) {
      newOrdersById[order.id] = order
      newAllOrderIds.push(order.id)
    }
    
    ordersById.value = newOrdersById
    allOrderIds.value = newAllOrderIds
    
    // Set metadata
    weekMeta.value = snapshot.week
    days.value = snapshot.days
    meta.value = snapshot.meta
    lastFetchedAt.value = new Date()
  }
  
  // ===== ACTIONS =====
  
  async function fetchWeek(page: number = 0, timezone: string = 'Europe/Kiev') {
    isLoading.value = true
    error.value = null
    
    try {
      const snapshot = await calendarWeekApi.getWeekSnapshot({ page, timezone })
      normalizeSnapshot(snapshot)
      
      console.log('[calendarWeekStore] Week loaded:', {
        weekStart: weekMeta.value?.weekStart,
        eventsCount: allEventIds.value.length,
        accessibleCount: allAccessibleIds.value.length,
      })
    } catch (err: any) {
      error.value = err.message || 'Failed to load week'
      console.error('[calendarWeekStore] Load error:', err)
    } finally {
      isLoading.value = false
    }
  }
  
  async function createEvent(payload: CreateEventPayload) {
    try {
      const eventId = await calendarWeekApi.createEvent(payload)
      
      console.log('[calendarWeekStore] Event created, refetching week...')
      
      // ОБОВ'ЯЗКОВО refetch
      await fetchWeek(weekMeta.value?.page ?? 0, weekMeta.value?.timezone)
      
      return eventId
    } catch (err: any) {
      console.error('[calendarWeekStore] Create error:', err)
      throw err
    }
  }
  
  async function deleteEvent(id: number) {
    try {
      await calendarWeekApi.deleteEvent({ id })
      
      console.log('[calendarWeekStore] Event deleted, refetching week...')
      
      // ОБОВ'ЯЗКОВО refetch
      await fetchWeek(weekMeta.value?.page ?? 0, weekMeta.value?.timezone)
    } catch (err: any) {
      console.error('[calendarWeekStore] Delete error:', err)
      throw err
    }
  }
  
  async function updateEvent(payload: UpdateEventPayload) {
    try {
      await calendarWeekApi.updateEvent(payload)
      
      console.log('[calendarWeekStore] Event updated, refetching week...')
      
      // ОБОВ'ЯЗКОВО refetch
      await fetchWeek(weekMeta.value?.page ?? 0, weekMeta.value?.timezone)
    } catch (err: any) {
      console.error('[calendarWeekStore] Update error:', err)
      throw err
    }
  }
  
  async function getEventDetails(id: number) {
    try {
      return await calendarWeekApi.getEventDetails(id)
    } catch (err: any) {
      console.error('[calendarWeekStore] Get details error:', err)
      throw err
    }
  }
  
  function selectEvent(id: number | null) {
    selectedEventId.value = id
  }
  
  function $reset() {
    weekMeta.value = null
    days.value = []
    meta.value = null
    eventsById.value = {}
    eventIdsByDay.value = {}
    allEventIds.value = []
    accessibleById.value = {}
    accessibleIdsByDay.value = {}
    allAccessibleIds.value = []
    ordersById.value = {}
    allOrderIds.value = []
    isLoading.value = false
    error.value = null
    selectedEventId.value = null
    lastFetchedAt.value = null
  }
  
  return {
    // State
    weekMeta,
    days,
    meta,
    eventsById,
    eventIdsByDay,
    accessibleById,
    accessibleIdsByDay,
    ordersById,
    isLoading,
    error,
    selectedEventId,
    lastFetchedAt,
    
    // Getters
    daysOrdered,
    eventsForDay,
    accessibleForDay,
    ordersArray,
    selectedEvent,
    computedCells336,
    eventLayouts,
    
    // Actions
    fetchWeek,
    createEvent,
    deleteEvent,
    updateEvent,
    getEventDetails,
    selectEvent,
    $reset,
  }
})
