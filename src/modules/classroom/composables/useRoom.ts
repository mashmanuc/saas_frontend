// F26: useRoom composable - Room lifecycle management
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '../stores/roomStore'
import { useParticipantStore } from '../stores/participantStore'

export function useRoom() {
  const route = useRoute()
  const router = useRouter()
  const roomStore = useRoomStore()
  const participantStore = useParticipantStore()

  // Store refs
  const {
    session,
    connectionStatus,
    boardState,
    permissions,
    layoutMode,
    formattedTime,
    isHost,
    isActive,
    isPaused,
    canTerminate,
    canDraw,
    error,
    roomEngine,
  } = storeToRefs(roomStore)

  const { participants, localMediaState, host, students, connectedCount } =
    storeToRefs(participantStore)

  // Local state
  const isInitialized = ref(false)
  const initError = ref<string | null>(null)

  // Computed
  const sessionId = computed(() => route.params.sessionId as string | undefined)

  const isConnected = computed(() => connectionStatus.value === 'connected')
  const isReconnecting = computed(() => connectionStatus.value === 'reconnecting')
  const isLoading = computed(() => connectionStatus.value === 'connecting')

  // Actions
  async function joinRoom(accessCode?: string): Promise<boolean> {
    if (!sessionId.value) {
      initError.value = 'No session ID provided'
      return false
    }

    try {
      await roomStore.joinRoom(sessionId.value, accessCode)
      isInitialized.value = true
      return true
    } catch (err) {
      initError.value = err instanceof Error ? err.message : 'Failed to join room'
      return false
    }
  }

  async function leaveRoom(): Promise<void> {
    await roomStore.leaveRoom()
    participantStore.$reset()
    router.push('/dashboard')
  }

  async function terminateSession(reason?: string): Promise<void> {
    if (!canTerminate.value) return

    await roomStore.terminateSession(reason)
    participantStore.$reset()
    router.push('/dashboard')
  }

  function setLayout(mode: 'side-by-side' | 'pip' | 'board-focus' | 'video-focus'): void {
    roomStore.setLayoutMode(mode)
  }

  // Board operations
  function sendBoardEvent(eventType: string, data: Record<string, unknown>): boolean {
    if (!roomEngine.value) return false
    return roomEngine.value.sendBoardEvent(eventType, data)
  }

  // Media operations
  async function toggleVideo(): Promise<void> {
    participantStore.toggleLocalVideo()
    await roomEngine.value?.toggleVideo(participantStore.localMediaState.video)
  }

  async function toggleAudio(): Promise<void> {
    participantStore.toggleLocalAudio()
    await roomEngine.value?.toggleAudio(participantStore.localMediaState.audio)
  }

  // Lifecycle
  onMounted(async () => {
    if (sessionId.value) {
      await joinRoom()
    }
  })

  onUnmounted(() => {
    if (isInitialized.value) {
      roomStore.leaveRoom()
      participantStore.$reset()
    }
  })

  return {
    // State
    session,
    sessionId,
    connectionStatus,
    boardState,
    permissions,
    layoutMode,
    formattedTime,
    error,
    initError,
    isInitialized,

    // Participants
    participants,
    localMediaState,
    host,
    students,
    connectedCount,

    // Computed
    isHost,
    isActive,
    isPaused,
    canTerminate,
    canDraw,
    isConnected,
    isReconnecting,
    isLoading,

    // Actions
    joinRoom,
    leaveRoom,
    terminateSession,
    setLayout,
    sendBoardEvent,
    toggleVideo,
    toggleAudio,
  }
}
