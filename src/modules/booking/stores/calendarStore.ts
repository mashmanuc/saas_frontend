// Compatibility layer for legacy tests
// Delegates to calendarWeekStore for actual functionality
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCalendarWeekStore } from './calendarWeekStore'
import { bookingApi } from '../api/booking'

export const useCalendarStore = defineStore('calendar', () => {
  const calendarWeekStore = useCalendarWeekStore()
  
  // State - delegate to calendarWeekStore where possible
  const slots = ref<any[]>([])
  const settings = ref<any>(null)
  const availability = ref<any[]>([])
  const exceptions = ref<any[]>([])
  const selectedDate = ref(new Date())
  const selectedSlot = ref<any>(null)
  const viewMode = ref<'week' | 'month'>('week')
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed properties
  const slotsByDate = computed(() => {
    const grouped: Record<string, any[]> = {}
    for (const slot of slots.value) {
      const date = slot.date
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(slot)
    }
    return grouped
  })

  const availableSlots = computed(() => {
    return slots.value.filter(slot => slot.status === 'available')
  })

  const bookedSlots = computed(() => {
    return slots.value.filter(slot => slot.status === 'booked')
  })

  const weekDays = computed(() => {
    const result: Date[] = []
    const current = new Date(selectedDate.value)
    
    // Find Monday of current week
    const day = current.getDay()
    const diff = day === 0 ? -6 : 1 - day
    current.setDate(current.getDate() + diff)
    
    // Generate 7 days starting from Monday
    for (let i = 0; i < 7; i++) {
      result.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return result
  })

  // Actions
  async function loadSettings() {
    try {
      isLoading.value = true
      error.value = null
      const data = await bookingApi.getSettings()
      settings.value = data
    } catch (err: any) {
      error.value = err.message || 'Failed to load settings'
    } finally {
      isLoading.value = false
    }
  }

  async function updateSettings(updates: any) {
    try {
      isLoading.value = true
      error.value = null
      const data = await bookingApi.updateSettings(updates)
      settings.value = data
    } catch (err: any) {
      error.value = err.message || 'Failed to update settings'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function loadSlots(tutorId: number, startDate: string, endDate: string) {
    try {
      isLoading.value = true
      error.value = null
      const data = await bookingApi.getSlots(tutorId, startDate, endDate)
      slots.value = data
    } catch (err: any) {
      error.value = err.message || 'Failed to load slots'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function blockSlot(slotId: number, reason?: string) {
    try {
      error.value = null
      await bookingApi.blockSlot(slotId, reason)
      
      // Update local state
      const slot = slots.value.find(s => s.id === slotId)
      if (slot) {
        slot.status = 'blocked'
        if (reason) {
          slot.block_reason = reason
        }
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to block slot'
      throw err
    }
  }

  async function unblockSlot(slotId: number) {
    try {
      error.value = null
      await bookingApi.unblockSlot(slotId)
      
      // Update local state
      const slot = slots.value.find(s => s.id === slotId)
      if (slot) {
        slot.status = 'available'
        delete slot.block_reason
      }
    } catch (err: any) {
      error.value = err.message || 'Failed to unblock slot'
      throw err
    }
  }

  async function loadAvailability() {
    try {
      isLoading.value = true
      error.value = null
      const data = await bookingApi.getAvailability()
      availability.value = Array.isArray(data) ? data : []
    } catch (err: any) {
      error.value = err.message || 'Failed to load availability'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function setAvailability(data: any) {
    try {
      isLoading.value = true
      error.value = null
      await bookingApi.setAvailability(data)
      await loadAvailability()
    } catch (err: any) {
      error.value = err.message || 'Failed to set availability'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function deleteAvailability(id: number) {
    try {
      error.value = null
      await bookingApi.deleteAvailability(id)
      availability.value = availability.value.filter(a => a.id !== id)
    } catch (err: any) {
      error.value = err.message || 'Failed to delete availability'
      throw err
    }
  }

  async function loadExceptions(startDate: string, endDate: string) {
    try {
      isLoading.value = true
      error.value = null
      const data = await bookingApi.getExceptions(startDate, endDate)
      exceptions.value = data
    } catch (err: any) {
      error.value = err.message || 'Failed to load exceptions'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function addException(data: any) {
    try {
      error.value = null
      const newException = await bookingApi.addException(data)
      exceptions.value.push(newException)
    } catch (err: any) {
      error.value = err.message || 'Failed to add exception'
      throw err
    }
  }

  async function deleteException(id: number) {
    try {
      error.value = null
      await bookingApi.deleteException(id)
      exceptions.value = exceptions.value.filter(e => e.id !== id)
    } catch (err: any) {
      error.value = err.message || 'Failed to delete exception'
      throw err
    }
  }

  function setSelectedDate(date: Date) {
    selectedDate.value = date
  }

  function setSelectedSlot(slot: any) {
    selectedSlot.value = slot
  }

  function setViewMode(mode: 'week' | 'month') {
    viewMode.value = mode
  }

  function navigateWeek(direction: number) {
    const newDate = new Date(selectedDate.value)
    newDate.setDate(newDate.getDate() + (direction * 7))
    selectedDate.value = newDate
  }

  function navigateMonth(direction: number) {
    const newDate = new Date(selectedDate.value)
    newDate.setMonth(newDate.getMonth() + direction)
    selectedDate.value = newDate
  }

  function goToToday() {
    selectedDate.value = new Date()
  }

  function $reset() {
    slots.value = []
    settings.value = null
    availability.value = []
    exceptions.value = []
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
    selectedDate,
    selectedSlot,
    viewMode,
    isLoading,
    error,
    
    // Computed
    slotsByDate,
    availableSlots,
    bookedSlots,
    weekDays,
    
    // Actions
    loadSettings,
    updateSettings,
    loadSlots,
    blockSlot,
    unblockSlot,
    loadAvailability,
    setAvailability,
    deleteAvailability,
    loadExceptions,
    addException,
    deleteException,
    setSelectedDate,
    setSelectedSlot,
    setViewMode,
    navigateWeek,
    navigateMonth,
    goToToday,
    $reset,
  }
})
