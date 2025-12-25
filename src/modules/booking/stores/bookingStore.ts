// F2: Booking Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bookingApi } from '../api/booking'
import type { Booking, BookingInput, BookingListParams } from '../api/booking'

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export const useBookingStore = defineStore('booking', () => {
  // State
  const bookings = ref<Booking[]>([])
  const currentBooking = ref<Booking | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const totalCount = ref(0)
  const recentStudents = ref<any[]>([])
  const searchResults = ref<any[]>([])

  // Computed
  const upcomingBookings = computed(() =>
    bookings.value
      .filter(
        (b) =>
          b.status === 'confirmed' &&
          new Date(b.time_slot.start_datetime) > new Date()
      )
      .sort(
        (a, b) =>
          new Date(a.time_slot.start_datetime).getTime() -
          new Date(b.time_slot.start_datetime).getTime()
      )
  )

  const pendingBookings = computed(() =>
    bookings.value.filter((b) => b.status === 'pending')
  )

  const pastBookings = computed(() =>
    bookings.value.filter(
      (b) =>
        b.status === 'completed' ||
        b.status === 'cancelled' ||
        new Date(b.time_slot.end_datetime) < new Date()
    )
  )

  const nextBooking = computed(() => upcomingBookings.value[0] || null)

  // Actions
  async function loadBookings(params?: BookingListParams): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await bookingApi.getBookings(params)
      bookings.value = response.results
      totalCount.value = response.count
    } catch (e: any) {
      error.value = e.message || 'Failed to load bookings'
    } finally {
      isLoading.value = false
    }
  }

  async function loadBooking(id: number): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      currentBooking.value = await bookingApi.getBooking(id)
    } catch (e: any) {
      error.value = e.message || 'Failed to load booking'
    } finally {
      isLoading.value = false
    }
  }

  async function createBooking(data: BookingInput): Promise<Booking> {
    const booking = await bookingApi.createBooking(data)
    bookings.value.unshift(booking)
    return booking
  }

  async function confirmBooking(id: number): Promise<Booking> {
    const booking = await bookingApi.confirmBooking(id)
    updateBookingInList(booking)
    if (currentBooking.value?.id === id) {
      currentBooking.value = booking
    }
    return booking
  }

  async function cancelBooking(id: number, reason?: string): Promise<Booking> {
    const booking = await bookingApi.cancelBooking(id, reason)
    updateBookingInList(booking)
    if (currentBooking.value?.id === id) {
      currentBooking.value = booking
    }
    return booking
  }

  async function rescheduleBooking(
    id: number,
    newSlotId: number,
    reason?: string
  ): Promise<Booking> {
    const booking = await bookingApi.rescheduleBooking(id, newSlotId, reason)
    // Remove old, add new
    bookings.value = bookings.value.filter((b) => b.id !== id)
    bookings.value.unshift(booking)
    if (currentBooking.value?.id === id) {
      currentBooking.value = booking
    }
    return booking
  }

  function updateBookingInList(booking: Booking): void {
    const index = bookings.value.findIndex((b) => b.id === booking.id)
    if (index !== -1) {
      bookings.value[index] = booking
    }
  }

  // WebSocket handlers
  function handleBookingCreated(booking: Booking): void {
    // Avoid duplicates
    if (!bookings.value.find((b) => b.id === booking.id)) {
      bookings.value.unshift(booking)
    }
  }

  function handleBookingUpdated(booking: Booking): void {
    updateBookingInList(booking)
    if (currentBooking.value?.id === booking.id) {
      currentBooking.value = booking
    }
  }

  function handleBookingCancelled(booking: Booking): void {
    updateBookingInList(booking)
    if (currentBooking.value?.id === booking.id) {
      currentBooking.value = booking
    }
  }

  async function createManualBooking(params: {
    studentId: number
    startAtUTC: string
    durationMin: number
    notes?: string
  }) {
    const idempotencyKey = generateUUID()
    
    const lesson = await bookingApi.createManualBooking({
      student_id: params.studentId,
      start_at_utc: params.startAtUTC,
      duration_min: params.durationMin,
      notes: params.notes,
    }, idempotencyKey)
    
    // Calendar will be refreshed via WebSocket event or manual refresh
    // No need to reload calendar here - separation of concerns
    
    return lesson
  }
  
  async function searchStudents(query: string) {
    try {
      const results = await bookingApi.searchStudents(query)
      searchResults.value = results
    } catch (err) {
      console.error('Failed to search students:', err)
      searchResults.value = []
    }
  }

  // Reset
  function $reset(): void {
    bookings.value = []
    currentBooking.value = null
    isLoading.value = false
    error.value = null
    totalCount.value = 0
  }

  return {
    // State
    bookings,
    currentBooking,
    isLoading,
    error,
    totalCount,
    recentStudents,
    searchResults,

    // Computed
    upcomingBookings,
    pendingBookings,
    pastBookings,
    nextBooking,

    // Actions
    loadBookings,
    loadBooking,
    createBooking,
    confirmBooking,
    cancelBooking,
    rescheduleBooking,
    updateBookingInList,
    createManualBooking,
    searchStudents,

    // WebSocket handlers
    handleBookingCreated,
    handleBookingUpdated,
    handleBookingCancelled,

    $reset,
  }
})
