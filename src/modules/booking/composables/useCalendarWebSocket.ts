import { ref, onMounted, onUnmounted } from 'vue'
import { CalendarWebSocket } from '../api/calendarWebSocket'
import { useCalendarWeekStore } from '../stores/calendarWeekStore'
import { useAuthStore } from '@/stores/authStore'

export function useCalendarWebSocket() {
  const ws = ref<CalendarWebSocket | null>(null)
  const connected = ref(false)
  const connectionAttempted = ref(false)
  const store = useCalendarWeekStore()
  const authStore = useAuthStore()
  const realtimeEnabled = import.meta.env.VITE_CALENDAR_REALTIME_ENABLED !== 'false'

  const connect = async () => {
    if (!realtimeEnabled) {
      // Realtime для календаря вимкнено конфігом — не показуємо банер і не стартуємо WS
      connected.value = true
      connectionAttempted.value = false
      return
    }

    if (!authStore.access) {
      console.warn('[useCalendarWebSocket] No auth token')
      return
    }

    ws.value = new CalendarWebSocket(authStore.access)

    // Subscribe to events
    ws.value.on('event.created', (data) => {
      console.log('[useCalendarWebSocket] Event created:', data)
      store.handleEventCreated(data)
    })

    ws.value.on('event.updated', (data) => {
      console.log('[useCalendarWebSocket] Event updated:', data)
      store.handleEventUpdated(data)
    })

    ws.value.on('event.deleted', (data) => {
      console.log('[useCalendarWebSocket] Event deleted:', data)
      store.handleEventDeleted(data)
    })

    ws.value.on('week.refresh', (data) => {
      console.log('[useCalendarWebSocket] Week refresh:', data)
      if (store.currentTutorId && store.currentWeekStart) {
        store.fetchWeekSnapshot(store.currentTutorId, store.currentWeekStart)
      }
    })

    // v0.49.5: Availability slots generated event
    ws.value.on('availability.slots_generated', (data) => {
      console.log('[useCalendarWebSocket] Availability slots generated:', data)
      // Only refetch for bulk generation (multiple slots), not for single slot creation
      // Single slot creation is handled by optimistic updates
      if (data.slotsCreated > 1 || data.slotsDeleted > 0) {
        setTimeout(() => {
          if (store.currentTutorId && store.currentWeekStart) {
            store.fetchWeekSnapshot(store.currentTutorId, store.currentWeekStart)
          }
        }, 500)
      }
      // Optionally show toast notification
      if (data.tutorId === authStore.user?.id) {
        console.log(`[useCalendarWebSocket] Slots generated: ${data.slotsCreated} created, ${data.slotsDeleted} deleted`)
      }
    })

    ws.value.on('pong', () => {
      console.log('[useCalendarWebSocket] Pong received')
    })

    try {
      connectionAttempted.value = true
      await ws.value.connect()
      connected.value = true
    } catch (error) {
      console.error('[useCalendarWebSocket] Connection failed:', error)
      connected.value = false
    }
  }

  const disconnect = () => {
    if (ws.value) {
      ws.value.disconnect()
      ws.value = null
      connected.value = false
    }
  }

  onMounted(() => {
    connect()
  })

  onUnmounted(() => {
    disconnect()
  })

  return {
    connected,
    connectionAttempted,
    connect,
    disconnect,
  }
}
