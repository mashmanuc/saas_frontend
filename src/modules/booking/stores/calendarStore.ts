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
  const syncStatus = ref<'syncing' | 'synced' | 'error'>('synced')
  const lastSyncTime = ref<Date | null>(null)
  const pendingChanges = ref<any[]>([])

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

    // Computed
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
    setAvailability,
    syncAvailability,
    updateSlotStatus,
    deleteAvailabilitySlot,
    loadSlots,
    loadWeekSlots,
    blockSlot,
    unblockSlot,
    createCustomSlot,
    loadExceptions,
    addException,
    deleteException,
    loadCalendar,

    // Navigation
    setSelectedDate,
    setSelectedSlot,
    setViewMode,
    navigateWeek,
    navigateMonth,
    goToToday,

    $reset,
  }
})
