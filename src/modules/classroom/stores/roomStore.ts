// F6: Room Store - Room state management
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { classroomApi } from '../api/classroom'
import { RoomEngine } from '../engine/roomEngine'
import type {
  ClassroomSession,
  RoomPermissions,
  SessionParticipant,
} from '../api/classroom'

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'waiting' | 'terminated'
export type LayoutMode = 'side-by-side' | 'pip' | 'board-focus' | 'video-focus'

export const useRoomStore = defineStore('room', () => {
  // State
  const session = ref<ClassroomSession | null>(null)
  const token = ref<string | null>(null)
  const permissions = ref<RoomPermissions | null>(null)
  const boardState = ref<Record<string, unknown>>({})
  const boardVersion = ref(0)

  const connectionStatus = ref<ConnectionStatus>('disconnected')
  const roomEngine = ref<RoomEngine | null>(null)

  // Layout
  const layoutMode = ref<LayoutMode>('side-by-side')

  // Timer
  const elapsedSeconds = ref(0)
  const timerInterval = ref<number | null>(null)

  // Error
  const error = ref<string | null>(null)

  // Current user (would come from auth store in real app)
  const currentUserId = ref<number>(0)

  // Computed
  const isHost = computed(() => {
    if (!session.value) return false
    return session.value.host.id === currentUserId.value
  })

  const isActive = computed(() => session.value?.status === 'active')
  const isPaused = computed(() => session.value?.status === 'paused')
  const isCompleted = computed(() => session.value?.status === 'completed')

  const canTerminate = computed(() => permissions.value?.can_terminate || false)
  const canDraw = computed(() => permissions.value?.can_draw || false)

  const formattedTime = computed(() => {
    const hours = Math.floor(elapsedSeconds.value / 3600)
    const minutes = Math.floor((elapsedSeconds.value % 3600) / 60)
    const seconds = elapsedSeconds.value % 60

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  })

  // Actions
  async function joinRoom(sessionId: string, accessCode?: string): Promise<void> {
    connectionStatus.value = 'connecting'
    error.value = null

    try {
      const response = await classroomApi.joinSession(sessionId, accessCode)

      session.value = response.session
      token.value = response.token
      permissions.value = response.permissions
      boardState.value = response.board_state

      // Initialize engine
      roomEngine.value = new RoomEngine({
        sessionId,
        token: response.token,
        permissions: response.permissions,
        initialBoardState: response.board_state,
        initialVersion: response.session.board_version,
      })

      // Setup event handlers
      setupEngineListeners()

      await roomEngine.value.connect()
      connectionStatus.value = 'connected'

      startTimer()
    } catch (err) {
      connectionStatus.value = 'disconnected'
      error.value = err instanceof Error ? err.message : 'Failed to join room'
      throw err
    }
  }

  function setupEngineListeners(): void {
    if (!roomEngine.value) return

    roomEngine.value.on('connected', () => {
      connectionStatus.value = 'connected'
    })

    roomEngine.value.on('disconnected', () => {
      connectionStatus.value = 'disconnected'
    })

    roomEngine.value.on('reconnecting', () => {
      connectionStatus.value = 'reconnecting'
    })

    roomEngine.value.on('board_update', (data) => {
      boardState.value = data
    })

    roomEngine.value.on('session_updated', (updatedSession) => {
      session.value = updatedSession
    })

    roomEngine.value.on('error', (err) => {
      error.value = err.message
    })
  }

  async function leaveRoom(): Promise<void> {
    stopTimer()
    await roomEngine.value?.disconnect()
    $reset()
  }

  async function startSession(): Promise<void> {
    if (!session.value) return

    const updated = await classroomApi.startSession(session.value.uuid)
    session.value = updated
  }

  async function pauseSession(): Promise<void> {
    if (!session.value) return

    const updated = await classroomApi.pauseSession(session.value.uuid)
    session.value = updated
    stopTimer()
  }

  async function resumeSession(): Promise<void> {
    if (!session.value) return

    const updated = await classroomApi.resumeSession(session.value.uuid)
    session.value = updated
    startTimer()
  }

  async function terminateSession(reason?: string): Promise<void> {
    if (!roomEngine.value) return

    await roomEngine.value.terminate(reason)
    $reset()
  }

  function updateBoardState(newState: Record<string, unknown>, version: number): void {
    boardState.value = newState
    boardVersion.value = version
  }

  function setLayoutMode(mode: LayoutMode): void {
    layoutMode.value = mode
  }

  function startTimer(): void {
    if (timerInterval.value) return

    timerInterval.value = window.setInterval(() => {
      elapsedSeconds.value++
    }, 1000)
  }

  function stopTimer(): void {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
      timerInterval.value = null
    }
  }

  function setCurrentUserId(userId: number): void {
    currentUserId.value = userId
  }

  // v0.24.2: Set session data from JWT response (before joining)
  function setSessionData(sessionData: ClassroomSession, perms: RoomPermissions): void {
    session.value = sessionData
    permissions.value = perms
  }

  // v0.24.2: Validate JWT token
  function validateToken(jwtToken: string): boolean {
    if (!jwtToken) return false

    try {
      // Decode JWT payload (base64)
      const payload = JSON.parse(atob(jwtToken.split('.')[1]))
      const exp = payload.exp * 1000 // Convert to milliseconds

      return Date.now() < exp
    } catch {
      return false
    }
  }

  // v0.24.2: Reconnect to room
  async function reconnect(): Promise<void> {
    if (!session.value || !token.value) return

    connectionStatus.value = 'reconnecting'

    try {
      await roomEngine.value?.connect()
      connectionStatus.value = 'connected'
    } catch (err) {
      connectionStatus.value = 'disconnected'
      error.value = err instanceof Error ? err.message : 'Reconnection failed'
    }
  }

  function $reset(): void {
    session.value = null
    token.value = null
    permissions.value = null
    boardState.value = {}
    boardVersion.value = 0
    connectionStatus.value = 'disconnected'
    roomEngine.value = null
    layoutMode.value = 'side-by-side'
    elapsedSeconds.value = 0
    error.value = null
    stopTimer()
  }

  return {
    // State
    session,
    token,
    permissions,
    boardState,
    boardVersion,
    connectionStatus,
    layoutMode,
    elapsedSeconds,
    roomEngine,
    error,
    currentUserId,

    // Computed
    isHost,
    isActive,
    isPaused,
    isCompleted,
    canTerminate,
    canDraw,
    formattedTime,

    // Actions
    joinRoom,
    leaveRoom,
    startSession,
    pauseSession,
    resumeSession,
    terminateSession,
    updateBoardState,
    setLayoutMode,
    setCurrentUserId,
    setSessionData,
    validateToken,
    reconnect,
    $reset,
  }
})
