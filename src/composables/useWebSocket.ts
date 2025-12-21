import { onMounted, onUnmounted } from 'vue'
import { websocketService } from '@/services/websocket'
import type { WebSocketEvent } from '@/services/websocket'

export function useWebSocket() {
  onMounted(() => {
    websocketService.connect()
  })

  return {
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
