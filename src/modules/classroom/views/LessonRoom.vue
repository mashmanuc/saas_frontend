<template>
  <div class="lesson-room" :class="[layoutMode, { reconnecting: isReconnecting }]">
    <!-- Loading State -->
    <RoomLoader v-if="connectionStatus === 'connecting'" />

    <!-- Main Content -->
    <template v-else-if="connectionStatus === 'connected' || connectionStatus === 'reconnecting'">
      <RoomHeader
        :session="session"
        :elapsed="formattedTime"
        :connection-status="connectionStatus"
      />

      <LayoutManager :mode="layoutMode" class="lesson-room__content">
        <template #video>
          <VideoDock :participants="participants" />
        </template>

        <template #board>
          <BoardDock
            :board-state="boardState"
            :permissions="permissions"
            :readonly="!canDraw"
            @event="handleBoardEvent"
          />
        </template>
      </LayoutManager>

      <RoomToolbar
        :is-host="isHost"
        :layout-mode="layoutMode"
        :can-terminate="canTerminate"
        @layout-change="setLayoutMode"
        @terminate="handleTerminate"
        @leave="handleLeave"
      />

      <RoomStatusBar
        :participants="participants"
        :connection-status="connectionStatus"
      />
    </template>

    <!-- Reconnecting Overlay -->
    <ReconnectView
      v-if="connectionStatus === 'reconnecting'"
      @retry="handleRetry"
      @leave="handleLeave"
    />

    <!-- Error State -->
    <div v-if="error" class="lesson-room__error">
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <p>{{ error }}</p>
        <button class="btn btn-primary" @click="handleRetry">
          {{ $t('common.retry') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useRoomStore } from '../stores/roomStore'
import { useParticipantStore } from '../stores/participantStore'

// Components
import RoomLoader from '../components/room/RoomLoader.vue'
import RoomHeader from '../components/room/RoomHeader.vue'
import RoomToolbar from '../components/room/RoomToolbar.vue'
import RoomStatusBar from '../components/room/RoomStatusBar.vue'
import LayoutManager from '../components/layout/LayoutManager.vue'
import VideoDock from '../components/video/VideoDock.vue'
import BoardDock from '../components/board/BoardDock.vue'
import ReconnectView from './ReconnectView.vue'

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
  canTerminate,
  canDraw,
  error,
} = storeToRefs(roomStore)

const { participants } = storeToRefs(participantStore)

// Computed
const isReconnecting = computed(() => connectionStatus.value === 'reconnecting')

// Lifecycle
onMounted(async () => {
  const sessionId = route.params.sessionId as string
  if (!sessionId) {
    router.push('/dashboard')
    return
  }

  try {
    await roomStore.joinRoom(sessionId)
  } catch {
    // Error is handled in store
  }
})

onUnmounted(() => {
  roomStore.leaveRoom()
})

// Event handlers
function handleBoardEvent(eventType: string, data: Record<string, unknown>): void {
  roomStore.roomEngine?.sendBoardEvent(eventType, data)
}

function setLayoutMode(mode: string): void {
  roomStore.setLayoutMode(mode as 'side-by-side' | 'pip' | 'board-focus' | 'video-focus')
}

async function handleTerminate(): Promise<void> {
  if (confirm('Are you sure you want to terminate this session?')) {
    await roomStore.terminateSession('Host terminated session')
    router.push('/dashboard')
  }
}

async function handleLeave(): Promise<void> {
  await roomStore.leaveRoom()
  router.push('/dashboard')
}

async function handleRetry(): Promise<void> {
  const sessionId = route.params.sessionId as string
  if (sessionId) {
    await roomStore.joinRoom(sessionId)
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
