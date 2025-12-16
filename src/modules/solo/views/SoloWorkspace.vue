<template>
  <div class="solo-workspace" :class="{ 'solo-workspace--fullscreen': isFullscreen }">
    <!-- Header -->
    <header class="solo-workspace__header">
      <div class="solo-workspace__title">
        <input
          v-model="sessionName"
          class="title-input"
          placeholder="Untitled"
          @blur="handleTitleBlur"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </div>

      <div class="solo-workspace__status">
        <!-- F29-STEALTH: quiet=true for opacity-only transitions, no layout changes -->
        <CloudStatus
          :status="syncStore.syncStatus"
          :last-saved-at="syncStore.lastSavedAt"
          :quiet="true"
          :pending-count="syncStore.pendingCount"
          @retry="boardStore.retrySync"
        />
      </div>

      <div class="solo-workspace__actions">
        <button class="action-btn" :title="$t('classroom.tools.undo')" @click="handleUndo">
          <IconUndo />
        </button>
        <button class="action-btn" :title="$t('classroom.tools.redo')" @click="handleRedo">
          <IconRedo />
        </button>
        <ExportMenu
          v-if="boardStore.sessionId"
          :session-id="boardStore.sessionId"
          :stage-ref="boardDockRef"
          :board-state="boardStore.serializedState"
          @export-start="handleExportStart"
          @export-complete="handleExportComplete"
          @export-error="handleExportError"
        />
        <button class="btn btn-primary" @click="handleExit">
          {{ $t('common.exit') }}
        </button>
      </div>
    </header>

    <!-- Main content: Toolbar + Board -->
    <div class="solo-workspace__main">
      <!-- Left Toolbar (Kami-style vertical) -->
      <aside class="solo-workspace__toolbar">
        <BoardToolbarVertical
          :current-tool="boardStore.currentTool"
          :current-color="boardStore.currentColor"
          :current-size="boardStore.currentSize"
          :can-undo="boardStore.canUndo"
          :can-redo="boardStore.canRedo"
          @tool-change="handleToolChange"
          @color-change="handleColorChange"
          @size-change="handleSizeChange"
          @undo="handleUndo"
          @redo="handleRedo"
          @clear="handleClear"
        />
      </aside>

      <!-- Board Canvas -->
      <!-- F29-FLICKER-FIX: Removed @state-change - no longer needed with stable refs -->
      <div class="solo-workspace__board">
        <BoardDock
          ref="boardDockRef"
          :strokes="boardStore.currentStrokes"
          :assets="boardStore.currentAssets"
          :permissions="soloPermissions"
          :readonly="false"
          :tool="boardStore.currentTool"
          :color="boardStore.currentColor"
          :size="boardStore.currentSize"
          @event="handleBoardEvent"
        />
      </div>

      <!-- Video Preview -->
      <LocalVideoPreview
        v-if="showVideo"
        :stream="stream"
        :video-enabled="videoEnabled"
        :audio-enabled="audioEnabled"
        @toggle-video="toggleVideo"
        @toggle-audio="toggleAudio"
      />
    </div>

    <!-- Footer: Page navigation + Zoom -->
    <footer class="solo-workspace__footer">
      <div class="page-nav">
        <button class="page-btn" :disabled="currentPage <= 1" @click="prevPage">←</button>
        <span class="page-indicator">{{ currentPage }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="currentPage >= totalPages" @click="nextPage">→</button>
        <button class="page-btn" @click="addPage">+</button>
      </div>
      <div class="zoom-controls">
        <button class="zoom-btn" @click="zoomOut">−</button>
        <span class="zoom-level">{{ Math.round(boardStore.zoom * 100) }}%</span>
        <button class="zoom-btn" @click="zoomIn">+</button>
        <button class="zoom-btn" @click="toggleFullscreen">⛶</button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBoardStore } from '@/modules/classroom/board/state/boardStore'
import { useBoardSyncStore } from '@/modules/classroom/board/state/boardSyncStore'
import { DEFAULT_PERMISSIONS } from '@/modules/classroom/engine/permissionsEngine'
import type { RoomPermissions } from '@/modules/classroom/api/classroom'
import { useLocalMedia } from '../composables/useLocalMedia'

// Components
import BoardDock from '@/modules/classroom/components/board/BoardDock.vue'
import BoardToolbarVertical from '@/modules/classroom/components/board/BoardToolbarVertical.vue'
import CloudStatus from '@/modules/classroom/components/board/CloudStatus.vue'
import ExportMenu from '@/modules/classroom/components/board/ExportMenu.vue'
import IconUndo from '@/modules/classroom/components/board/icons/IconUndo.vue'
import IconRedo from '@/modules/classroom/components/board/icons/IconRedo.vue'
import LocalVideoPreview from '../components/video/LocalVideoPreview.vue'

import '../styles/solo.css'

const router = useRouter()
const route = useRoute()
const boardStore = useBoardStore()
const syncStore = useBoardSyncStore()

// Refs
const boardDockRef = ref<InstanceType<typeof BoardDock> | null>(null)
const sessionName = ref('')
const currentPage = ref(1)
const totalPages = ref(1)
const isFullscreen = ref(false)
const showVideo = ref(false)

// Media
const { stream, videoEnabled, audioEnabled, startCamera, stopCamera, toggleVideo, toggleAudio } =
  useLocalMedia()

// Solo permissions (full access)
const soloPermissions: RoomPermissions = DEFAULT_PERMISSIONS.solo

// Lifecycle
onMounted(async () => {
  const sessionId = route.params.id as string | undefined

  if (sessionId) {
    // Load existing session
    const loaded = await boardStore.loadSession(sessionId)
    if (loaded) {
      sessionName.value = boardStore.sessionName
      totalPages.value = boardStore.pages.length || 1
    } else {
      // Session not found, create new
      await boardStore.createSession()
      if (boardStore.sessionId) {
        router.replace(`/solo/${boardStore.sessionId}`)
      }
    }
  } else {
    // Create new session
    await boardStore.createSession()
    sessionName.value = boardStore.sessionName
    if (boardStore.sessionId) {
      router.replace(`/solo/${boardStore.sessionId}`)
    }
  }

  // Paste is handled by BoardCanvas component directly

  // Keyboard shortcuts
  window.addEventListener('keydown', handleKeyDown)

  // Fullscreen change
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })

  // Start camera
  await startCamera()
})

onBeforeUnmount(async () => {
  // Flush any pending changes before leaving
  await boardStore.autosave()
  window.removeEventListener('keydown', handleKeyDown)
  stopCamera()
})

// Watch for name changes to update store
watch(sessionName, (newName) => {
  if (newName !== boardStore.sessionName) {
    boardStore.sessionName = newName
    boardStore.markDirty()
  }
})

// Handlers
function handleTitleBlur(): void {
  if (!sessionName.value.trim()) {
    sessionName.value = 'Untitled'
  }
}

function handleBoardEvent(eventType: string, data: Record<string, unknown>): void {
  switch (eventType) {
    case 'stroke_add':
      if (data.stroke) {
        boardStore.addStroke(data.stroke)
      }
      break
    case 'stroke_update':
      if (data.stroke) {
        boardStore.updateStroke(data.stroke)
      }
      break
    case 'stroke_delete':
      if (data.strokeId) {
        boardStore.deleteStroke(data.strokeId as string)
      }
      break
    case 'asset_add':
      if (data.asset) {
        boardStore.addAsset(data.asset)
      }
      break
    case 'asset_update':
      if (data.asset) {
        boardStore.updateAsset(data.asset)
      }
      break
    case 'asset_delete':
      if (data.assetId) {
        boardStore.deleteAsset(data.assetId as string)
      }
      break
    case 'tool_change':
      boardStore.setTool(data.tool as string)
      break
    case 'color_change':
      boardStore.setColor(data.color as string)
      break
    case 'size_change':
      boardStore.setSize(data.size as number)
      break
    case 'undo':
      boardStore.undo()
      break
    case 'redo':
      boardStore.redo()
      break
    case 'clear_all':
      boardStore.clearBoard()
      break
  }
}

// F29-FLICKER-FIX: handleStateChange removed - no longer needed with stable refs

function handleToolChange(tool: string): void {
  boardStore.setTool(tool)
}

function handleColorChange(color: string): void {
  boardStore.setColor(color)
}

function handleSizeChange(size: number): void {
  boardStore.setSize(size)
}

function handleUndo(): void {
  boardStore.undo()
}

function handleRedo(): void {
  boardStore.redo()
}

function handleClear(): void {
  if (confirm('Clear the board? This cannot be undone.')) {
    boardStore.clearBoard()
  }
}

async function handleExit(): Promise<void> {
  await boardStore.autosave()
  router.push('/solo')
}

// Paste is handled by BoardCanvas directly

// Export handlers
function handleExportStart(): void {
  boardStore.setExporting(true)
}

function handleExportComplete(url: string): void {
  boardStore.setExporting(false)
  console.log('[SoloWorkspace] Export complete:', url)
}

function handleExportError(error: string): void {
  boardStore.setExporting(false)
  console.error('[SoloWorkspace] Export error:', error)
}

// Page navigation
function prevPage(): void {
  if (currentPage.value > 1) {
    currentPage.value--
    boardStore.goToPage(currentPage.value - 1)
  }
}

function nextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    boardStore.goToPage(currentPage.value - 1)
  }
}

function addPage(): void {
  boardStore.addPage()
  totalPages.value = boardStore.pages.length
  currentPage.value = totalPages.value
}

// Zoom
function zoomIn(): void {
  boardStore.setZoom(Math.min(3, boardStore.zoom + 0.25))
}

function zoomOut(): void {
  boardStore.setZoom(Math.max(0.5, boardStore.zoom - 0.25))
}

function toggleFullscreen(): void {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

function handleKeyDown(e: KeyboardEvent): void {
  // Ctrl+Z - Undo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    handleUndo()
    return
  }

  // Ctrl+Y or Ctrl+Shift+Z - Redo
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    handleRedo()
    return
  }

  // Ctrl+S - Save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    boardStore.autosave()
    return
  }
}
</script>
