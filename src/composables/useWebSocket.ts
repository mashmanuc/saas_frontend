import { onMounted, onUnmounted, ref } from 'vue'
import { websocketService } from '@/services/websocket'
import type { WebSocketEvent } from '@/services/websocket'

export interface UseWebSocketOptions {
  autoConnect?: boolean
  autoReconnect?: boolean
  onMessage?: (data: any) => void
  onError?: (error: any) => void
  onReconnect?: () => void
  onStatusChange?: (status: string) => void
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    autoConnect = true,
    autoReconnect = true,
    onMessage,
    onError,
    onReconnect,
    onStatusChange
  } = options

  const status = ref('disconnected')
  const isConnected = ref(false)

  onMounted(() => {
    if (autoConnect) {
      websocketService.connect()
    }
  })

  function connect() {
    websocketService.connect()
    status.value = 'connecting'
    isConnected.value = false
    if (onStatusChange) onStatusChange('connecting')
  }

  function disconnect() {
    websocketService.disconnect()
    status.value = 'disconnected'
    isConnected.value = false
    if (onStatusChange) onStatusChange('disconnected')
  }

  return {
    status,
    isConnected,
    connect,
    disconnect,
    subscribe: websocketService.subscribe.bind(websocketService),
    unsubscribe: websocketService.unsubscribe.bind(websocketService),
    subscribeTutorSlots: websocketService.subscribeTutorSlots.bind(websocketService),
    subscribeStudentAvailability: websocketService.subscribeStudentAvailability.bind(websocketService),
    subscribeMatchUpdates: websocketService.subscribeMatchUpdates.bind(websocketService),
    subscribeStudentBookings: websocketService.subscribeStudentBookings.bind(websocketService),
    getStatus: websocketService.getStatus.bind(websocketService)
  }
}

export function useTutorSlots(tutorId: number, handler: (event: WebSocketEvent) => void) {
  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    unsubscribe = websocketService.subscribeTutorSlots(tutorId, handler)
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })
}

export function useStudentAvailability(
  studentId: number,
  tutorSlug: string,
  handler: (event: WebSocketEvent) => void
) {
  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    unsubscribe = websocketService.subscribeStudentAvailability(studentId, tutorSlug, handler)
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })
}

export function useMatchUpdates(matchId: string, handler: (event: WebSocketEvent) => void) {
  let unsubscribe: (() => void) | null = null

  onMounted(() => {
    unsubscribe = websocketService.subscribeMatchUpdates(matchId, handler)
  })

  onUnmounted(() => {
    if (unsubscribe) {
      unsubscribe()
    }
  })
}
