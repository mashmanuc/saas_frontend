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
            ref="boardDockRef"
            :board-state="boardState"
            :permissions="permissions"
            :readonly="!canDraw"
            :is-syncing="isSyncing"
            :remote-cursors="cursorsList"
            :teacher-user-id="teacherUserId"
            :follow-teacher-enabled="followTeacherEnabled"
            @event="handleBoardEvent"
          />
        </template>
      </LayoutManager>

      <RoomToolbar
        :is-host="isHost"
        :layout-mode="layoutMode"
        :can-terminate="canTerminate"
        :is-paused="isPaused"
        :is-follow-teacher="followTeacherEnabled"
        :has-teacher-cursor="Boolean(teacherCursor)"
        :quota-used="lessonsQuotaUsed"
        :quota-limit="lessonsQuotaLimit"
        @layout-change="setLayoutMode"
        @pause="handlePause"
        @resume="handleResume"
        @terminate="handleTerminate"
        @leave="handleLeave"
        @toggle-follow-teacher="handleToggleFollowTeacher"
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
import { usePresenceCursorsStore } from '../stores/presenceCursorsStore'
import { useWebRTC } from '../composables/useWebRTC'
import { useReconnect } from '../composables/useReconnect'
import { classroomApi } from '../api/classroom'
import { useSubscriptionStore } from '@/modules/payments/stores/subscriptionStore'
import { notifyWarning } from '@/utils/notify'

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
const presenceCursorsStore = usePresenceCursorsStore()
const subscriptionStore = useSubscriptionStore()

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

const { cursorsList, teacherCursor, teacherUserId, followTeacherEnabled } = storeToRefs(presenceCursorsStore)

const { currentSubscription, currentPlan, lessonsUsed } = storeToRefs(subscriptionStore)

const lessonsQuotaLimit = computed(() => {
  const n = currentPlan.value?.lessons_per_month
  return typeof n === 'number' ? n : null
})

const lessonsQuotaUsed = computed(() => lessonsUsed.value ?? 0)

const _warnedQuota80 = ref(false)

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
const boardDockRef = ref<InstanceType<typeof BoardDock> | null>(null)

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

    try {
      await subscriptionStore.loadCurrentSubscription()
    } catch {
      // ignore
    }

    try {
      if (session.value?.participants) {
        participantStore.setParticipants(session.value.participants)
      }
      const local = session.value?.participants?.find((p) => String(p.user_id) === String(roomStore.currentUserId))
      if (local?.user_id) {
        participantStore.setLocalUserId(local.user_id)
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const wsBaseUrl = `${wsProtocol}://${window.location.host}/ws`

      const classroomId = sessionId
      const wsSessionId = session.value?.uuid
      const localUserId = String(local?.user_id ?? roomStore.currentUserId ?? '')

      const localRoleRaw = local?.role
      const wsRole = (localRoleRaw === 'host' ? 'teacher' : localRoleRaw === 'viewer' ? 'observer' : 'student') as
        | 'teacher'
        | 'student'
        | 'observer'

      if (wsSessionId && token && localUserId) {
        await presenceCursorsStore.connect({
          wsBaseUrl,
          classId: classroomId,
          sessionId: wsSessionId,
          token,
          userId: localUserId,
          role: wsRole,
        })
      }
    } catch {
      // ignore - realtime cursors are best-effort
    }

    await startLocalStream()
  } catch {
    // Error is handled in store
  }
})

watch(
  () => [lessonsQuotaLimit.value, lessonsQuotaUsed.value, currentSubscription.value?.status] as const,
  ([limit, used]) => {
    if (_warnedQuota80.value) return
    if (!limit || limit <= 0) return
    const ratio = used / limit
    if (ratio >= 0.8) {
      _warnedQuota80.value = true
      notifyWarning('Ви використали понад 80% квоти уроків. Рекомендуємо оновити план.', {
        action: { label: 'Оновити план', href: '/plans' },
        timeout: 8000,
      })
    }
  },
  { immediate: true }
)

onUnmounted(async () => {
  presenceCursorsStore.disconnect()
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

// v0.31: Follow-teacher viewport sync
watch(
  () => [followTeacherEnabled.value, teacherCursor.value] as const,
  ([enabled, cursor]) => {
    if (!enabled || !cursor) return
    boardDockRef.value?.scrollToPosition?.(cursor.x, cursor.y)
  },
  { flush: 'post' }
)

// Event handlers
function handleBoardEvent(eventType: string, data: Record<string, unknown>): void {
  if (eventType === 'cursor_move') {
    const x = data.x
    const y = data.y
    const tool = data.tool
    const color = data.color

    if (typeof x === 'number' && typeof y === 'number' && typeof tool === 'string' && typeof color === 'string') {
      presenceCursorsStore.sendCursor(x, y, tool, color)
    }
  }
  roomStore.roomEngine?.sendBoardEvent(eventType, data)
}

function handleToggleFollowTeacher(): void {
  presenceCursorsStore.setFollowTeacher(!followTeacherEnabled.value)
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
    const res = await classroomApi.autosave(
      session.value.uuid,
      boardState.value,
      roomStore.boardVersion
    )

    if (typeof res?.version === 'number') {
      roomStore.updateBoardState(boardState.value, res.version)
    }
  } catch (error) {
    console.error('Failed to save snapshot:', error)
  }
}

async function handleRestoreSnapshot(version: number): Promise<void> {
  if (!session.value) return

  try {
    const restored = await classroomApi.restoreSnapshot(session.value.uuid, version)
    const nextState = (restored.board_state || restored.state || {}) as Record<string, unknown>
    const nextVersion = typeof restored.version === 'number' ? restored.version : version
    roomStore.updateBoardState(nextState, nextVersion)
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
