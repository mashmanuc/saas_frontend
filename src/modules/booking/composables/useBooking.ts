// F23: useBooking composable
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookingStore } from '../stores/bookingStore'

export function useBooking(bookingId?: number) {
  const store = useBookingStore()
  const router = useRouter()

  const booking = computed(() => store.currentBooking)
  const isLoading = computed(() => store.isLoading)
  const error = computed(() => store.error)

  // Can cancel if confirmed and in the future
  const canCancel = computed(() => {
    if (!booking.value) return false
    if (booking.value.status !== 'confirmed' && booking.value.status !== 'pending') {
      return false
    }
    const startTime = new Date(booking.value.time_slot.start_datetime)
    return startTime > new Date()
  })

  // Can reschedule if can cancel
  const canReschedule = computed(() => canCancel.value)

  // Can join if confirmed and within time window (15 min before to 60 min after)
  const canJoin = computed(() => {
    if (!booking.value || booking.value.status !== 'confirmed') return false
    const start = new Date(booking.value.time_slot.start_datetime)
    const now = new Date()
    const diffMinutes = (start.getTime() - now.getTime()) / 1000 / 60
    return diffMinutes <= 15 && diffMinutes >= -60
  })

  // Time until lesson starts
  const timeUntilStart = computed(() => {
    if (!booking.value) return null
    const start = new Date(booking.value.time_slot.start_datetime)
    const now = new Date()
    const diffMs = start.getTime() - now.getTime()

    if (diffMs < 0) return null

    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days} day${days > 1 ? 's' : ''}`
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  })

  // Actions
  async function cancel(reason?: string): Promise<void> {
    if (!booking.value) return
    await store.cancelBooking(booking.value.id, reason)
  }

  async function confirm(): Promise<void> {
    if (!booking.value) return
    await store.confirmBooking(booking.value.id)
  }

  async function reschedule(newSlotId: number, reason?: string): Promise<void> {
    if (!booking.value) return
    const newBooking = await store.rescheduleBooking(booking.value.id, newSlotId, reason)
    router.push(`/bookings/${newBooking.id}`)
  }

  function joinLesson(): void {
    if (!booking.value?.classroom_id) return
    router.push(`/classroom/${booking.value.classroom_id}`)
  }

  function goToTutor(): void {
    if (!booking.value) return
    router.push(`/tutors/${booking.value.tutor.id}`)
  }

  function goToStudent(): void {
    if (!booking.value) return
    router.push(`/users/${booking.value.student.id}`)
  }

  // Load booking on mount if ID provided
  onMounted(() => {
    if (bookingId) {
      store.loadBooking(bookingId)
    }
  })

  return {
    // State
    booking,
    isLoading,
    error,

    // Computed
    canCancel,
    canReschedule,
    canJoin,
    timeUntilStart,

    // Actions
    cancel,
    confirm,
    reschedule,
    joinLesson,
    goToTutor,
    goToStudent,
  }
}
