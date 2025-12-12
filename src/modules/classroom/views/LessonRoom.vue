<template>
  <div class="lesson-room" :class="[layoutMode, { reconnecting: isReconnecting }]">
    <!-- Loading State -->
    <RoomLoader v-if="connectionStatus === 'connecting'" />

    <!-- Waiting Room (v0.24.2) -->
    <WaitingRoom
      v-else-if="connectionStatus === 'waiting' || session?.status === 'waiting'"
      :session="session"
      :user-role="userRole"
      @ready="handleReady"
      @leave="handleLeave"
    />

    <!-- Session Ended (v0.24.2) -->
    <SessionEnded
      v-else-if="connectionStatus === 'terminated' || session?.status === 'completed' || session?.status === 'terminated'"
      :session="session"
      :duration="totalDuration"
      @leave="handleLeave"
      @view-history="showHistoryModal = true"
    />

    <!-- Main Content -->
    <template v-else-if="connectionStatus === 'connected' || connectionStatus === 'reconnecting'">
      <RoomHeader
        :session="session"
        :elapsed="formattedTime"
        :connection-status="connectionStatus"
        :participants-count="connectedCount"
      />

      <LayoutManager :mode="layoutMode" class="lesson-room__content">
        <template #video>
          <VideoDock
            :participants="participants"
            :local-stream="localStream"
            @toggle-video="handleToggleVideo"
            @toggle-audio="handleToggleAudio"
          />
        </template>

        <template #board>
          <BoardDock
            :board-state="boardState"
            :permissions="permissions"
            :readonly="!canDraw"
            :is-syncing="isSyncing"
            @event="handleBoardEvent"
          />
        </template>
      </LayoutManager>

      <RoomToolbar
        :is-host="isHost"
        :layout-mode="layoutMode"
        :can-terminate="canTerminate"
        :is-paused="isPaused"
        @layout-change="setLayoutMode"
        @pause="handlePause"
        @resume="handleResume"
        @terminate="handleTerminate"
        @leave="handleLeave"
        @save-snapshot="handleSaveSnapshot"
        @show-history="showHistoryModal = true"
      />

      <RoomStatusBar
        :participants="participants"
        :connection-status="connectionStatus"
        :session-status="session?.status"
      />
    </template>

    <!-- Reconnecting Overlay (v0.24.2) -->
    <ReconnectOverlay
      v-if="connectionStatus === 'reconnecting'"
      :attempt="reconnectAttempt"
      :countdown="reconnectCountdown"
      @retry="handleRetry"
      @leave="handleLeave"
    />

    <!-- History Modal (v0.24.2) -->
    <HistoryModal
      v-if="showHistoryModal && session"
      :session-id="session.uuid"
      @close="showHistoryModal = false"
      @restore="handleRestoreSnapshot"
    />

    <!-- Error State -->
    <div v-if="error" class="lesson-room__error">
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="handleRetry">
          Спробувати знову
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '../stores/roomStore'
import { useParticipantStore } from '../stores/participantStore'
import { useWebRTC } from '../composables/useWebRTC'
import { useReconnect } from '../composables/useReconnect'
import { classroomApi } from '../api/classroom'

// Components
import RoomLoader from '../components/room/RoomLoader.vue'
import RoomHeader from '../components/room/RoomHeader.vue'
import RoomToolbar from '../components/room/RoomToolbar.vue'
import RoomStatusBar from '../components/room/RoomStatusBar.vue'
import ReconnectOverlay from '../components/room/ReconnectOverlay.vue'
import WaitingRoom from '../components/room/WaitingRoom.vue'
import SessionEnded from '../components/room/SessionEnded.vue'
import LayoutManager from '../components/layout/LayoutManager.vue'
import VideoDock from '../components/video/VideoDock.vue'
import BoardDock from '../components/board/BoardDock.vue'
import HistoryModal from '../components/modals/HistoryModal.vue'

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
  isPaused,
  canTerminate,
  canDraw,
  error,
} = storeToRefs(roomStore)

const { participants, connectedCount } = storeToRefs(participantStore)

// WebRTC composable
const {
  localStream,
  toggleVideo,
  toggleAudio,
  startLocalStream,
  stopLocalStream,
} = useWebRTC()

// Reconnect composable
const {
  attempt: reconnectAttempt,
  countdown: reconnectCountdown,
  startReconnect,
} = useReconnect({
  onReconnected: () => {
    console.log('[LessonRoom] Reconnected successfully')
  },
  onFailed: () => {
    router.push({ name: 'dashboard', query: { error: 'reconnect_failed' } })
  },
})

// Local state
const showHistoryModal = ref(false)
const isSyncing = ref(false)
const totalDuration = ref(0)
const userRole = computed(() => (isHost.value ? 'host' : 'student'))

// Computed
const isReconnecting = computed(() => connectionStatus.value === 'reconnecting')

// Lifecycle
onMounted(async () => {
  const sessionId = route.params.sessionId as string
  const token = route.query.token as string

  if (!sessionId) {
    router.push('/dashboard')
    return
  }

  try {
    await roomStore.joinRoom(sessionId, token)
    await startLocalStream()
  } catch {
    // Error is handled in store
  }
})

onUnmounted(async () => {
  await stopLocalStream()
  await roomStore.leaveRoom()
})

// Watch for session status changes
watch(
  () => session.value?.status,
  (newStatus) => {
    if (newStatus === 'terminated' || newStatus === 'completed') {
      totalDuration.value = roomStore.elapsedSeconds
    }
  }
)

// Event handlers
function handleBoardEvent(eventType: string, data: Record<string, unknown>): void {
  roomStore.roomEngine?.sendBoardEvent(eventType, data)
}

function setLayoutMode(mode: string): void {
  roomStore.setLayoutMode(mode as 'side-by-side' | 'pip' | 'board-focus' | 'video-focus')
}

async function handleToggleVideo(): Promise<void> {
  await toggleVideo()
}

async function handleToggleAudio(): Promise<void> {
  await toggleAudio()
}

async function handlePause(): Promise<void> {
  await roomStore.pauseSession()
}

async function handleResume(): Promise<void> {
  await roomStore.resumeSession()
}

async function handleTerminate(): Promise<void> {
  if (confirm('Ви впевнені, що хочете завершити урок?')) {
    await roomStore.terminateSession('Host terminated session')
    router.push('/dashboard')
  }
}

async function handleLeave(): Promise<void> {
  await roomStore.leaveRoom()
  router.push('/dashboard')
}

async function handleRetry(): Promise<void> {
  await startReconnect()
}

async function handleReady(): Promise<void> {
  if (isHost.value) {
    await roomStore.startSession()
  }
}

async function handleSaveSnapshot(): Promise<void> {
  if (!session.value) return

  try {
    await classroomApi.autosave(
      session.value.uuid,
      boardState.value,
      roomStore.boardVersion
    )
  } catch (error) {
    console.error('Failed to save snapshot:', error)
  }
}

async function handleRestoreSnapshot(version: number): Promise<void> {
  if (!session.value) return

  try {
    const restoredState = await classroomApi.restoreSnapshot(session.value.uuid, version)
    roomStore.updateBoardState(restoredState, version)
    showHistoryModal.value = false
  } catch (error) {
    console.error('Failed to restore snapshot:', error)
  }
}
</script>

<style scoped>
.lesson-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-primary);
  overflow: hidden;
}

.lesson-room__content {
  flex: 1;
  overflow: hidden;
}

.lesson-room__error {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  z-index: 1000;
}

.error-message {
  text-align: center;
  padding: 2rem;
  background: var(--color-bg-secondary);
  border-radius: 12px;
  max-width: 400px;
}

.error-icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.error-message p {
  margin-bottom: 1.5rem;
  color: var(--color-text-secondary);
}

.lesson-room.reconnecting {
  opacity: 0.7;
  pointer-events: none;
}

.lesson-room.reconnecting .lesson-room__content {
  filter: blur(2px);
}
</style>
