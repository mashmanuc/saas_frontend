// F24: useCalendar composable
import { computed, watch, onMounted } from 'vue'
import { useCalendarStore } from '../stores/calendarStore'
import type { TimeSlot } from '../api/booking'

export function useCalendar(tutorId: number) {
  const store = useCalendarStore()

  // State
  const slots = computed(() => store.slots)
  const slotsByDate = computed(() => store.slotsByDate)
  const availableSlots = computed(() => store.availableSlots)
  const selectedDate = computed(() => store.selectedDate)
  const selectedSlot = computed(() => store.selectedSlot)
  const weekDays = computed(() => store.weekDays)
  const viewMode = computed(() => store.viewMode)
  const isLoading = computed(() => store.isLoading)
  const error = computed(() => store.error)

  // Helpers
  function formatDateKey(date: Date): string {
    return date.toISOString().split('T')[0]
  }

  function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
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

  // Load slots for current week
  async function loadWeek(): Promise<void> {
    const start = getWeekStart(selectedDate.value)
    const end = getWeekEnd(selectedDate.value)
    await store.loadSlots(tutorId, formatDateKey(start), formatDateKey(end))
  }

  // Get slots for a specific date
  function getSlotsForDate(date: Date): TimeSlot[] {
    const key = formatDateKey(date)
    return slotsByDate.value[key] || []
  }

  // Get available slots for a specific date
  function getAvailableSlotsForDate(date: Date): TimeSlot[] {
    return getSlotsForDate(date).filter((s) => s.status === 'available')
  }

  // Select a slot
  function selectSlot(slot: TimeSlot | null): void {
    store.setSelectedSlot(slot)
  }

  // Navigation
  function setDate(date: Date): void {
    store.setSelectedDate(date)
  }

  function navigateWeek(direction: 1 | -1): void {
    store.navigateWeek(direction)
  }

  function navigateMonth(direction: 1 | -1): void {
    store.navigateMonth(direction)
  }

  function goToToday(): void {
    store.goToToday()
  }

  function setViewMode(mode: 'week' | 'month'): void {
    store.setViewMode(mode)
  }

  // Check if a date has available slots
  function hasAvailableSlots(date: Date): boolean {
    return getAvailableSlotsForDate(date).length > 0
  }

  // Get slot count for a date
  function getSlotCount(date: Date): number {
    return getSlotsForDate(date).length
  }

  // Watch for date changes and reload slots
  watch(selectedDate, loadWeek)

  // Initial load
  onMounted(loadWeek)

  return {
    // State
    slots,
    slotsByDate,
    availableSlots,
    selectedDate,
    selectedSlot,
    weekDays,
    viewMode,
    isLoading,
    error,

    // Methods
    loadWeek,
    getSlotsForDate,
    getAvailableSlotsForDate,
    selectSlot,
    setDate,
    navigateWeek,
    navigateMonth,
    goToToday,
    setViewMode,
    hasAvailableSlots,
    getSlotCount,
  }
}
