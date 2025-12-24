import { ref, onMounted, onUnmounted } from 'vue'
import { CalendarWebSocket } from '../api/calendarWebSocket'
import { useCalendarWeekStore } from '../stores/calendarWeekStore'
import { useAuthStore } from '@/stores/authStore'

export function useCalendarWebSocket() {
  const ws = ref<CalendarWebSocket | null>(null)
  const connected = ref(false)
  const store = useCalendarWeekStore()
  const authStore = useAuthStore()

  const connect = async () => {
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
      store.fetchWeek()
    })

    ws.value.on('pong', () => {
      console.log('[useCalendarWebSocket] Pong received')
    })

    try {
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
    connect,
    disconnect,
  }
}
