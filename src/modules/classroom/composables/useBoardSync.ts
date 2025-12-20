// F5: useBoardSync - BoardEngine ↔ SyncEngine binding
import { ref, watch, onUnmounted, computed } from 'vue'
import { useRoomStore } from '../stores/roomStore'
import { classroomApi } from '../api/classroom'

export interface BoardSyncOptions {
  autosaveInterval?: number // in milliseconds
  onSyncError?: (error: Error) => void
  onVersionConflict?: (localVersion: number, remoteVersion: number) => void
}

export interface BoardOperation {
  type: string
  data: Record<string, unknown>
  timestamp: number
  userId: number
}

const DEFAULT_AUTOSAVE_INTERVAL = 30000 // 30 seconds

export function useBoardSync(options: BoardSyncOptions = {}) {
  const {
    autosaveInterval = DEFAULT_AUTOSAVE_INTERVAL,
    onSyncError,
    onVersionConflict,
  } = options

  const roomStore = useRoomStore()

  const logWarn = (...args: any[]) => {
    const isDev = Boolean((import.meta as any)?.env?.DEV)
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn(...args)
      return
    }
    // eslint-disable-next-line no-console
    console.debug(...args)
  }

  // State
  const isSyncing = ref(false)
  const lastSyncTime = ref<Date | null>(null)
  const pendingOperations = ref<BoardOperation[]>([])
  const syncError = ref<string | null>(null)
  const autosaveTimer = ref<number | null>(null)

  // Computed
  const hasPendingChanges = computed(() => pendingOperations.value.length > 0)
  const boardVersion = computed(() => roomStore.boardVersion)

  // Queue board operation for sync
  function queueOperation(type: string, data: Record<string, unknown>): void {
    const operation: BoardOperation = {
      type,
      data,
      timestamp: Date.now(),
      userId: roomStore.currentUserId,
    }

    pendingOperations.value.push(operation)

    // Send immediately through WebSocket
    roomStore.roomEngine?.sendBoardEvent(type, data)
  }

  // Handle incoming board event from SyncEngine
  function handleRemoteBoardEvent(event: {
    type: string
    data: Record<string, unknown>
    version: number
    userId: number
  }): void {
    // Check for version conflict
    if (event.version < roomStore.boardVersion) {
      logWarn('[useBoardSync] Received outdated event, ignoring')
      return
    }

    if (event.version > roomStore.boardVersion + 1) {
      // Version gap detected, need to resync
      onVersionConflict?.(roomStore.boardVersion, event.version)
      resyncBoard()
      return
    }

    // Apply the event to local board state
    applyBoardEvent(event.type, event.data)

    // Update version
    roomStore.updateBoardState(roomStore.boardState, event.version)
  }

  // Apply board event to local state
  function applyBoardEvent(type: string, data: Record<string, unknown>): void {
    const currentState = { ...roomStore.boardState }

    switch (type) {
      case 'stroke:add':
        if (!currentState.strokes) currentState.strokes = []
        ;(currentState.strokes as unknown[]).push(data)
        break

      case 'stroke:remove':
        if (currentState.strokes) {
          currentState.strokes = (currentState.strokes as { id: string }[]).filter(
            (s) => s.id !== data.strokeId
          )
        }
        break

      case 'object:add':
        if (!currentState.objects) currentState.objects = []
        ;(currentState.objects as unknown[]).push(data)
        break

      case 'object:update':
        if (currentState.objects) {
          const objects = currentState.objects as { id: string }[]
          const index = objects.findIndex((o) => o.id === data.objectId)
          if (index !== -1) {
            objects[index] = { ...objects[index], ...data }
          }
        }
        break

      case 'object:remove':
        if (currentState.objects) {
          currentState.objects = (currentState.objects as { id: string }[]).filter(
            (o) => o.id !== data.objectId
          )
        }
        break

      case 'canvas:clear':
        currentState.strokes = []
        currentState.objects = []
        break

      case 'state:full':
        // Full state replacement
        Object.assign(currentState, data.state)
        break

      default:
        logWarn('[useBoardSync] Unknown event type:', type)
    }

    roomStore.updateBoardState(currentState, roomStore.boardVersion)
  }

  // Resync board state from server
  async function resyncBoard(): Promise<void> {
    if (!roomStore.session) return

    isSyncing.value = true
    syncError.value = null

    try {
      const history = await classroomApi.getHistory(roomStore.session.uuid)
      if (history.length > 0) {
        const latestSnapshot = history[0]
        roomStore.updateBoardState(latestSnapshot.state, latestSnapshot.version)
      }
      lastSyncTime.value = new Date()
    } catch (error) {
      syncError.value = 'Не вдалося синхронізувати дошку'
      onSyncError?.(error as Error)
    } finally {
      isSyncing.value = false
    }
  }

  // Autosave board state
  async function autosave(): Promise<void> {
    if (!roomStore.session || !hasPendingChanges.value) return

    isSyncing.value = true

    try {
      const res = await classroomApi.autosave(
        roomStore.session.uuid,
        roomStore.boardState,
        roomStore.boardVersion
      )

      if (typeof res?.version === 'number') {
        roomStore.updateBoardState(roomStore.boardState, res.version)
      }

      // Clear pending operations after successful save
      pendingOperations.value = []
      lastSyncTime.value = new Date()
    } catch (error) {
      console.error('[useBoardSync] Autosave failed:', error)
      onSyncError?.(error as Error)
    } finally {
      isSyncing.value = false
    }
  }

  // Start autosave timer
  function startAutosave(): void {
    if (autosaveTimer.value) return

    autosaveTimer.value = window.setInterval(() => {
      autosave()
    }, autosaveInterval)
  }

  // Stop autosave timer
  function stopAutosave(): void {
    if (autosaveTimer.value) {
      clearInterval(autosaveTimer.value)
      autosaveTimer.value = null
    }
  }

  // Restore board to specific version
  async function restoreVersion(version: number): Promise<void> {
    if (!roomStore.session) return

    isSyncing.value = true

    try {
      const restored = await classroomApi.restoreSnapshot(
        roomStore.session.uuid,
        version
      )

      const nextState = (restored.board_state || restored.state || {}) as Record<string, unknown>
      const nextVersion = typeof restored.version === 'number' ? restored.version : version
      roomStore.updateBoardState(nextState, nextVersion)
      lastSyncTime.value = new Date()
    } catch (error) {
      syncError.value = 'Не вдалося відновити версію'
      onSyncError?.(error as Error)
    } finally {
      isSyncing.value = false
    }
  }

  // Export board
  async function exportBoard(format: 'png' | 'svg' | 'json' = 'png'): Promise<Blob | null> {
    if (!roomStore.session) return null

    try {
      const result = await classroomApi.exportBoard(roomStore.session.uuid, format)
      return result
    } catch (error) {
      console.error('[useBoardSync] Export failed:', error)
      return null
    }
  }

  // Watch for connection status
  watch(
    () => roomStore.connectionStatus,
    (status) => {
      if (status === 'connected') {
        startAutosave()
      } else {
        stopAutosave()
      }
    },
    { immediate: true }
  )

  // Cleanup
  onUnmounted(() => {
    stopAutosave()
  })

  return {
    // State
    isSyncing,
    lastSyncTime,
    hasPendingChanges,
    syncError,
    boardVersion,

    // Actions
    queueOperation,
    handleRemoteBoardEvent,
    resyncBoard,
    autosave,
    restoreVersion,
    exportBoard,
    startAutosave,
    stopAutosave,
  }
}
