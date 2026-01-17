<template>
  <div class="classroom-whiteboard-host" :class="hostClasses">
    <div v-if="isLoading" class="whiteboard-host__loader">
      <div class="spinner"></div>
      <p>{{ $t('classroom.whiteboard.loading') }}</p>
    </div>

    <div v-else-if="error" class="whiteboard-host__error">
      <p>{{ error }}</p>
      <button @click="handleRetry" class="btn btn-secondary">
        {{ $t('common.retry') }}
      </button>
    </div>

    <template v-else>
      <!-- v0.93.1: Vertical layout with split mode support -->
      <div v-if="useVerticalLayout" class="whiteboard-host__split-container">
        <!-- FE-93.X.1: Board area ЗЛІВА (перша в DOM) -->
        <div class="whiteboard-host__board-area">
          <PageVerticalStack
            :pages="pages"
            :active-page-id="activePageId"
            :follow-mode="followMode"
            :presenter-page-id="presenterPageId"
            :workspace-id="workspaceId"
            :tool="currentTool"
            :color="currentColor"
            :size="currentSize"
            :readonly="readonly"
            @page-visible="handlePageVisible"
            @scroll-to-page="handleScrollToPage"
          />
        </div>

        <!-- FE-93.X.1: Tasks panel СПРАВА (друга в DOM) -->
        <TaskDock
          v-if="taskDockVisible"
          :state="taskDockState"
          :tasks="tasks"
          @toggle="handleTaskDockToggle"
          @task-drop="handleTaskDrop"
        />
      </div>

      <!-- Legacy BoardDock (non-vertical) -->
      <BoardDock
        v-else
        ref="boardDockRef"
        :board-state="legacyBoardState"
        :permissions="permissions"
        :readonly="!canDraw"
        :is-syncing="isSyncing"
        :remote-cursors="remoteCursors"
        :teacher-user-id="teacherUserId"
        :follow-teacher-enabled="followTeacherEnabled"
        @event="handleBoardEvent"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { useWhiteboardStore } from '../../stores/whiteboardStore'
import { useClassroomLayoutStore } from '../../stores/classroomLayoutStore'
import { useRoomStore } from '../../stores/roomStore'
import BoardDock from '../board/BoardDock.vue'
import PageVerticalStack from './PageVerticalStack.vue'
import TaskDock from './TaskDock.vue'
import type { WhiteboardPage } from '../../types/whiteboard'
import type { RoomPermissions } from '../../api/classroom'

interface Props {
  workspaceId: string
  permissions: RoomPermissions | null
  readonly?: boolean
  teacherUserId?: string | null
  followTeacherEnabled?: boolean
  remoteCursors?: Array<{ userId: string; x: number; y: number; tool: string; color: string; ts: number }>
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  followTeacherEnabled: false,
  remoteCursors: () => []
})

const emit = defineEmits<{
  event: [payload: any]
  ready: []
  error: [error: Error]
}>()

const whiteboardStore = useWhiteboardStore()
const layoutStore = useClassroomLayoutStore()
const roomStore = useRoomStore()

const boardDockRef = ref<InstanceType<typeof BoardDock> | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

// v0.92.1: dev-only invariant - vertical layout тільки для dev workspace + feature flag
const isDevWorkspace = computed(() => props.workspaceId.startsWith('dev-workspace-'))
const verticalFlagEnabled = computed(() => import.meta.env.VITE_VERTICAL_LAYOUT === 'true')

const useVerticalLayout = computed(() => {
  // LAW-11 + LAW-13: vertical layout тільки якщо:
  // 1) VITE_VERTICAL_LAYOUT === 'true'
  // 2) workspaceId.startsWith('dev-workspace-')
  // layoutStore.verticalLayoutEnabled НЕ може вмикати vertical для prod
  return verticalFlagEnabled.value && isDevWorkspace.value
})

const pages = computed(() => whiteboardStore.pages)
const activePageId = computed(() => whiteboardStore.activePageId)
const followMode = computed(() => whiteboardStore.isFollowModeActive)
const presenterPageId = computed(() => whiteboardStore.presenterPageId)
const canDraw = computed(() => !props.readonly && props.permissions?.can_draw)
const isSyncing = computed(() => whiteboardStore.status === 'saving')

const taskDockVisible = computed(() => layoutStore.taskDockState !== 'hidden')
const taskDockState = computed(() => layoutStore.taskDockState)
const tasks = computed(() => [])

// v0.93.0: Current tool state (можна розширити для реального tool picker)
const currentTool = ref('pen')
const currentColor = ref('#111111')
const currentSize = ref(4)

const legacyBoardState = computed(() => ({
  strokes: whiteboardStore.currentPageData?.state?.strokes || [],
  assets: whiteboardStore.currentPageData?.state?.assets || []
}))

const hostClasses = computed(() => ({
  'whiteboard-host--vertical': useVerticalLayout.value,
  'whiteboard-host--legacy': !useVerticalLayout.value,
  'whiteboard-host--readonly': props.readonly,
  'whiteboard-host--syncing': isSyncing.value
}))

async function bootstrap() {
  isLoading.value = true
  error.value = null

  try {
    await whiteboardStore.bootstrap(props.workspaceId)
    emit('ready')
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    emit('error', err instanceof Error ? err : new Error(String(err)))
  } finally {
    isLoading.value = false
  }
}

function handleRetry() {
  bootstrap()
}

function handlePageVisible(pageId: string) {
  if (!followMode.value) {
    whiteboardStore.switchToPage(pageId)
  }
}

function handleScrollToPage(pageId: string) {
  whiteboardStore.switchToPage(pageId)
}

function handleBoardEvent(payload: any) {
  emit('event', payload)
}

function handleTaskDockToggle() {
  layoutStore.toggleTaskDock()
}

function handleTaskDrop(taskId: string, pageId: string) {
  console.log('Task dropped:', taskId, 'on page:', pageId)
}

// FE-92.1.3: Tripwire - сигнал тривоги якщо vertical увімкнувся для non-dev workspace
watchEffect(() => {
  if (useVerticalLayout.value && !isDevWorkspace.value) {
    console.error('[WINTERBOARD] ILLEGAL_VERTICAL_LAYOUT_NON_DEV_WORKSPACE', {
      workspaceId: props.workspaceId,
      verticalFlagEnabled: verticalFlagEnabled.value,
      isDevWorkspace: isDevWorkspace.value,
    })
  }
})

onMounted(() => {
  bootstrap()
})

onUnmounted(() => {
  whiteboardStore.reset()
})
</script>

<style scoped>
.classroom-whiteboard-host {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
  background: var(--color-bg-primary, #ffffff);
}

/* v0.93.1: Split container for Board + Tasks layout */
.whiteboard-host__split-container {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
  gap: 0;
}

/* v0.93.1: Board area - ЗЛІВА, перша в DOM */
.whiteboard-host__board-area {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  background: var(--color-bg-secondary, #f9fafb);
}

.whiteboard-host--vertical {
  /* Vertical layout uses split-container */
}

.whiteboard-host--legacy {
  /* Legacy layout uses single column */
}

.whiteboard-host__loader,
.whiteboard-host__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 1rem;
  grid-column: 1 / -1;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.whiteboard-host__error p {
  color: var(--color-error, #ef4444);
  font-size: 0.875rem;
}

.whiteboard-host--syncing::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--color-primary, #3b82f6), transparent);
  animation: syncProgress 1.5s ease-in-out infinite;
  z-index: 10;
}

@keyframes syncProgress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Responsive: collapse to single column on small screens */
@media (max-width: 768px) {
  .whiteboard-host--vertical {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
}

/* Readonly mode styling */
.whiteboard-host--readonly {
  cursor: not-allowed;
}

.whiteboard-host--readonly::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.02);
  pointer-events: none;
  z-index: 1;
}
</style>
