// F27: useRoomEvents composable - WebSocket event handlers
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoomStore } from '../stores/roomStore'
import { useParticipantStore } from '../stores/participantStore'
import type { SessionParticipant, ClassroomSession } from '../api/classroom'

export interface RoomEventHandlers {
  onParticipantJoined?: (participant: SessionParticipant) => void
  onParticipantLeft?: (userId: number) => void
  onSessionUpdated?: (session: ClassroomSession) => void
  onBoardUpdate?: (data: Record<string, unknown>) => void
  onError?: (error: Error) => void
}

export function useRoomEvents(handlers: RoomEventHandlers = {}) {
  const roomStore = useRoomStore()
  const participantStore = useParticipantStore()

  // Event tracking
  const lastEvent = ref<string | null>(null)
  const eventCount = ref(0)

  // Internal handlers
  function handleParticipantJoined(data: { userId: number; name: string }): void {
    const participant: SessionParticipant = {
      user_id: data.userId,
      name: data.name,
      avatar: '',
      role: 'student',
      status: 'connected',
      video_enabled: true,
      audio_enabled: true,
      connection_quality: 'good',
    }

    participantStore.addParticipant(participant)
    lastEvent.value = 'participant_joined'
    eventCount.value++

    handlers.onParticipantJoined?.(participant)
  }

  function handleParticipantLeft(data: { userId: number }): void {
    participantStore.removeParticipant(data.userId)
    lastEvent.value = 'participant_left'
    eventCount.value++

    handlers.onParticipantLeft?.(data.userId)
  }

  function handleSessionUpdated(session: ClassroomSession): void {
    lastEvent.value = 'session_updated'
    eventCount.value++

    handlers.onSessionUpdated?.(session)
  }

  function handleBoardUpdate(data: Record<string, unknown>): void {
    roomStore.updateBoardState(data, (data.version as number) || 0)
    lastEvent.value = 'board_update'
    eventCount.value++

    handlers.onBoardUpdate?.(data)
  }

  function handleError(error: Error): void {
    lastEvent.value = 'error'
    eventCount.value++

    handlers.onError?.(error)
  }

  // Setup listeners
  function setupListeners(): void {
    const engine = roomStore.roomEngine
    if (!engine) return

    engine.on('participant_joined', handleParticipantJoined)
    engine.on('participant_left', handleParticipantLeft)
    engine.on('session_updated', handleSessionUpdated)
    engine.on('board_update', handleBoardUpdate)
    engine.on('error', handleError)
  }

  function removeListeners(): void {
    const engine = roomStore.roomEngine
    if (!engine) return

    engine.off('participant_joined', handleParticipantJoined)
    engine.off('participant_left', handleParticipantLeft)
    engine.off('session_updated', handleSessionUpdated)
    engine.off('board_update', handleBoardUpdate)
    engine.off('error', handleError)
  }

  // Lifecycle
  onMounted(() => {
    setupListeners()
  })

  onUnmounted(() => {
    removeListeners()
  })

  return {
    lastEvent,
    eventCount,
    setupListeners,
    removeListeners,
  }
}
