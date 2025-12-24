// F3: Calendar Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bookingApi } from '../api/booking'
import type {
  TimeSlot,
  TutorSettings,
  Availability,
  AvailabilityInput,
  DateException,
  ExceptionInput,
  CalendarDay,
} from '../api/booking'
import type { CalendarCell, WeekViewResponse } from '../types/calendar'
import { calendarApi } from '../api/calendarApi'
import { useDraftStore } from './draftStore'

// Utility functions
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Normalize date to the start of the week based on locale preference.
 * @param dateStr - ISO date string
 * @param weekStartsOn - First day of week (0=Sunday, 1=Monday, 6=Saturday)
 * @returns ISO date string of week start
 */
function normalizeToWeekStart(dateStr: string, weekStartsOn: number = 1): string {
  const date = new Date(dateStr)
  const currentDay = date.getDay()
  
  // Calculate difference to target week start
  let diff = currentDay - weekStartsOn
  if (diff < 0) diff += 7
  
  date.setDate(date.getDate() - diff)
  return date.toISOString().split('T')[0]
}

export const useCalendarStore = defineStore('calendar', () => {
  // State
  const slots = ref<TimeSlot[]>([])
  const settings = ref<TutorSettings | null>(null)
  const availability = ref<Availability[]>([])
  const exceptions = ref<DateException[]>([])
  const calendarDays = ref<CalendarDay[]>([])
  const selectedDate = ref<Date>(new Date())
  const selectedSlot = ref<TimeSlot | null>(null)
  const viewMode = ref<'week' | 'month'>('week')
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const syncStatus = ref<'idle' | 'syncing' | 'synced' | 'error'>('idle')
  const lastSyncTime = ref<Date | null>(null)
  const pendingChanges = ref<any[]>([])
  const editMode = ref(false)
  const generationJob = ref<{ job_id: string; status: string; progress?: number } | null>(null)
  const weekCells = ref<CalendarCell[]>([])
  const weekViewLoading = ref(false)
  const weekViewError = ref<string | null>(null)
  
  const draftStore = useDraftStore()

  // Computed
  const slotsByDate = computed(() => {
    const grouped: Record<string, TimeSlot[]> = {}
    for (const slot of slots.value) {
      if (!grouped[slot.date]) {
        grouped[slot.date] = []
      }
      grouped[slot.date].push(slot)
    }
    // Sort slots by time within each day
    for (const date in grouped) {
      grouped[date].sort((a, b) => a.start_time.localeCompare(b.start_time))
    }
    return grouped
  })

  const availableSlots = computed(() =>
    slots.value.filter((s) => s.status === 'available')
  )

  const bookedSlots = computed(() =>
    slots.value.filter((s) => s.status === 'booked')
  )

  const blockedSlots = computed(() =>
    slots.value.filter((s) => s.status === 'blocked')
  )

  const weekDays = computed(() => {
    const start = getWeekStart(selectedDate.value)
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start)
      date.setDate(date.getDate() + i)
      return date
    })
  })

  const currentWeekRange = computed(() => {
    const start = getWeekStart(selectedDate.value)
    const end = getWeekEnd(selectedDate.value)
    return { start, end }
  })

  const effectiveCells = computed(() => {
    return weekCells.value.map(cell => {
      const patch = draftStore.getPatch(cell.startAtUTC)
      
      if (!patch) return cell
      
      // Apply draft patch візуально
      return {
        ...cell,
        status: patch.action === 'set_available' ? 'available' as const :
                patch.action === 'set_blocked' ? 'blocked' as const :
                'empty' as const,
        isDraft: true,
      }
    })
  })

  const availabilityByDay = computed(() => {
    const byDay: Record<number, Availability[]> = {}
    for (let i = 0; i < 7; i++) {
      byDay[i] = []
    }
    for (const av of availability.value) {
      byDay[av.day_of_week].push(av)
    }
    return byDay
  })

  // Actions
  async function loadSettings(): Promise<void> {
    try {
      settings.value = await bookingApi.getSettings()
    } catch (e: any) {
      error.value = e.message || 'Failed to load settings'
    }
  }

  async function updateSettings(data: Partial<TutorSettings>): Promise<void> {
    settings.value = await bookingApi.updateSettings(data)
  }

  async function loadAvailability(): Promise<void> {
    try {
      availability.value = await bookingApi.getAvailability()
    } catch (e: any) {
      error.value = e.message || 'Failed to load availability'
    }
  }

  async function setAvailability(schedule: AvailabilityInput[]): Promise<void> {
    await bookingApi.setAvailability(schedule)
    await loadAvailability()
  }

  async function syncAvailability(): Promise<void> {
    syncStatus.value = 'syncing'
    try {
      await bookingApi.setAvailability(availability.value as any)
      lastSyncTime.value = new Date()
      syncStatus.value = 'synced'
      pendingChanges.value = []
    } catch (err) {
      syncStatus.value = 'error'
      throw err
    }
  }

  function updateSlotStatus(slotId: number, status: string): void {
    const slot = slots.value.find((s) => s.id === slotId)
    if (slot) {
      slot.status = status as any
    }
  }

  function applySlotEvent(event: { type: string; payload: any }): void {
    const { type, payload } = event

    switch (type) {
      case 'slot.booked':
        updateSlotStatus(payload.slot_id, 'booked')
        break
      case 'slot.blocked':
        updateSlotStatus(payload.slot_id, 'blocked')
        break
      case 'slot.released':
        updateSlotStatus(payload.slot_id, 'available')
        break
      case 'slot.created':
        if (payload.slot) {
          slots.value.push(payload.slot)
        }
        break
      case 'availability.updated':
        pendingChanges.value.push({ type: 'reload', timestamp: Date.now() })
        break
      case 'job.status':
        if (generationJob.value && generationJob.value.job_id === payload.job_id) {
          generationJob.value.status = payload.status
          generationJob.value.progress = payload.progress
        }
        break
      default:
        console.warn('[calendarStore] Unknown event type:', type)
    }
  }

  function enterEditMode(): void {
    editMode.value = true
    draftStore.clearAllPatches()
  }

  function exitEditMode(): void {
    editMode.value = false
    draftStore.clearAllPatches()
  }

  async function createSlot(data: { date: string; start: string; end: string }): Promise<TimeSlot> {
    const optimisticSlot: TimeSlot = {
      id: Date.now(),
      date: data.date,
      start_time: data.start,
      end_time: data.end,
      status: 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    slots.value.push(optimisticSlot)
    
    try {
      const slot = await bookingApi.createCustomSlot({
        date: data.date,
        start_time: data.start,
        end_time: data.end
      })
      
      const index = slots.value.findIndex(s => s.id === optimisticSlot.id)
      if (index !== -1) {
        slots.value[index] = slot
      }
      
      if (typeof window !== 'undefined' && (window as any).telemetry) {
        (window as any).telemetry.track('availability.slot_created', {
          slot_id: slot.id,
          date: data.date,
          duration_minutes: calculateDuration(data.start, data.end)
        })
      }
      
      return slot
    } catch (err) {
      const index = slots.value.findIndex(s => s.id === optimisticSlot.id)
      if (index !== -1) {
        slots.value.splice(index, 1)
      }
      throw err
    }
  }

  function calculateDuration(start: string, end: string): number {
    const [startHour, startMin] = start.split(':').map(Number)
    const [endHour, endMin] = end.split(':').map(Number)
    return (endHour * 60 + endMin) - (startHour * 60 + startMin)
  }

  async function updateSlot(slotId: number, data: { start?: string; end?: string }): Promise<void> {
    const slot = slots.value.find(s => s.id === slotId)
    if (!slot) return
    
    const original = { ...slot }
    
    if (data.start) slot.start_time = data.start
    if (data.end) slot.end_time = data.end
    
    try {
      await bookingApi.updateSlot(slotId, data)
    } catch (err) {
      Object.assign(slot, original)
      throw err
    }
  }

  async function deleteSlot(slotId: number): Promise<void> {
    const index = slots.value.findIndex(s => s.id === slotId)
    if (index === -1) return
    
    const backup = slots.value[index]
    slots.value.splice(index, 1)
    
    try {
      await bookingApi.deleteSlot(slotId)
      
      if (typeof window !== 'undefined' && (window as any).telemetry) {
        (window as any).telemetry.track('availability.slot_deleted', {
          slot_id: slotId
        })
      }
    } catch (err) {
      slots.value.splice(index, 0, backup)
      throw err
    }
  }

  async function pollJobStatus(jobId: string, maxAttempts = 24): Promise<void> {
    let attempts = 0
    const pollInterval = 5000
    
    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        generationJob.value = { job_id: jobId, status: 'timeout' }
        
        if (typeof window !== 'undefined' && (window as any).telemetry) {
          (window as any).telemetry.track('availability.job_failed', {
            job_id: jobId,
            reason: 'timeout',
            attempts
          })
        }
        
        throw new Error('Job polling timeout')
      }
      
      try {
        const response = await fetch(`/api/v1/availability/jobs/${jobId}`)
        const data = await response.json()
        
        generationJob.value = {
          job_id: jobId,
          status: data.status,
          progress: data.progress
        }
        
        if (data.status === 'done') {
          return
        }
        
        if (data.status === 'failed') {
          if (typeof window !== 'undefined' && (window as any).telemetry) {
            (window as any).telemetry.track('availability.job_failed', {
              job_id: jobId,
              reason: data.error || 'unknown',
              attempts
            })
          }
          throw new Error(data.error || 'Job failed')
        }
        
        if (data.status === 'queued' || data.status === 'running') {
          attempts++
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          return poll()
        }
      } catch (err) {
        generationJob.value = { job_id: jobId, status: 'error' }
        throw err
      }
    }
    
    await poll()
  }

  async function deleteAvailabilitySlot(id: number): Promise<void> {
    await bookingApi.deleteAvailability(id)
    availability.value = availability.value.filter((a) => a.id !== id)
  }

  async function loadSlots(tutorId: number, start: string, end: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      slots.value = await bookingApi.getSlots(tutorId, start, end)
    } catch (e: any) {
      error.value = e.message || 'Failed to load slots'
    } finally {
      isLoading.value = false
    }
  }

  async function loadWeekSlots(tutorId: number): Promise<void> {
    const { start, end } = currentWeekRange.value
    await loadSlots(tutorId, formatDateISO(start), formatDateISO(end))
  }

  async function blockSlot(slotId: number, reason?: string): Promise<void> {
    await bookingApi.blockSlot(slotId, reason)
    const slot = slots.value.find((s) => s.id === slotId)
    if (slot) {
      slot.status = 'blocked'
    }
  }

  async function unblockSlot(slotId: number): Promise<void> {
    await bookingApi.unblockSlot(slotId)
    const slot = slots.value.find((s) => s.id === slotId)
    if (slot) {
      slot.status = 'available'
    }
  }

  async function createCustomSlot(
    date: string,
    startTime: string,
    endTime: string
  ): Promise<TimeSlot> {
    const slot = await bookingApi.createCustomSlot({
      date,
      start_time: startTime,
      end_time: endTime,
    })
    slots.value.push(slot)
    return slot
  }

  async function loadExceptions(start: string, end: string): Promise<void> {
    try {
      exceptions.value = await bookingApi.getExceptions(start, end)
    } catch (e: any) {
      error.value = e.message || 'Failed to load exceptions'
    }
  }

  async function addException(data: ExceptionInput): Promise<DateException> {
    const exception = await bookingApi.addException(data)
    exceptions.value.push(exception)
    return exception
  }

  async function deleteException(id: number): Promise<void> {
    await bookingApi.deleteException(id)
    exceptions.value = exceptions.value.filter((e) => e.id !== id)
  }

  async function loadCalendar(
    tutorId: number,
    month: number,
    year: number
  ): Promise<void> {
    isLoading.value = true
    try {
      const response = await bookingApi.getCalendar(tutorId, month, year)
      calendarDays.value = response.days
    } catch (e: any) {
      error.value = e.message || 'Failed to load calendar'
    } finally {
      isLoading.value = false
    }
  }

  async function loadWeekView(params: {
    tutorId?: number
    weekStart: string
    timezone: string
  }): Promise<void> {
    weekViewLoading.value = true
    weekViewError.value = null
    
    try {
      // Normalize weekStart to user's preferred week start day
      // TODO: Get weekStartsOn from user settings when i18n is implemented
      const weekStartsOn = settings.value?.week_starts_on ?? 1  // Default to Monday (ISO 8601)
      const normalizedStart = normalizeToWeekStart(params.weekStart, weekStartsOn)
      
      console.log('[calendarStore] Loading week view with params:', {
        ...params,
        weekStart: normalizedStart,
        weekStartsOn,
      })
      
      const response = await calendarApi.getWeekView({
        ...params,
        weekStart: normalizedStart,
      })
      
      console.log('[calendarStore] API response:', response)
      console.log('[calendarStore] Cells received:', response.cells?.length || 0)
      weekCells.value = response.cells
      console.log('[calendarStore] weekCells updated:', weekCells.value.length)
    } catch (err: any) {
      weekViewError.value = err.message || 'Failed to load week view'
      console.error('[calendarStore] Failed to load week view:', err)
      console.error('[calendarStore] Error details:', err.response?.data || err)
    } finally {
      weekViewLoading.value = false
    }
  }

  // Navigation
  function setSelectedDate(date: Date): void {
    selectedDate.value = date
  }

  function setSelectedSlot(slot: TimeSlot | null): void {
    selectedSlot.value = slot
  }

  function setViewMode(mode: 'week' | 'month'): void {
    viewMode.value = mode
  }

  function navigateWeek(direction: 1 | -1): void {
    const newDate = new Date(selectedDate.value)
    newDate.setDate(newDate.getDate() + direction * 7)
    selectedDate.value = newDate
  }

  function navigateMonth(direction: 1 | -1): void {
    const newDate = new Date(selectedDate.value)
    newDate.setMonth(newDate.getMonth() + direction)
    selectedDate.value = newDate
  }

  function goToToday(): void {
    selectedDate.value = new Date()
  }

  // Reset
  function $reset(): void {
    slots.value = []
    settings.value = null
    availability.value = []
    exceptions.value = []
    calendarDays.value = []
    selectedDate.value = new Date()
    selectedSlot.value = null
    viewMode.value = 'week'
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    slots,
    settings,
    availability,
    exceptions,
    calendarDays,
    selectedDate,
    selectedSlot,
    viewMode,
    isLoading,
    error,
    syncStatus,
    lastSyncTime,
    pendingChanges,
    editMode,
    generationJob,
    weekCells,
    weekViewLoading,
    weekViewError,

    // Computed
    effectiveCells,
    slotsByDate,
    availableSlots,
    bookedSlots,
    blockedSlots,
    weekDays,
    currentWeekRange,
    availabilityByDay,

    // Actions
    loadSettings,
    updateSettings,
    loadAvailability,
    enterEditMode,
    exitEditMode,
    createSlot,
    updateSlot,
    deleteSlot,
    pollJobStatus,
    loadExceptions,
    loadCalendar,
    setAvailability,
    syncAvailability,
    updateSlotStatus,
    applySlotEvent,
    deleteAvailabilitySlot,
    loadSlots,
    loadWeekSlots,
    blockSlot,
    unblockSlot,
    createCustomSlot,
    addException,
    deleteException,
    setSelectedDate,
    setSelectedSlot,
    setViewMode,
    navigateWeek,
    navigateMonth,
    goToToday,
    loadWeekView,

    $reset,
  }
})
