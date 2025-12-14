<template>
  <div class="solo-room">
    <!-- Header (Kami-style) -->
    <header class="solo-room__header">
      <!-- Left: Title editable -->
      <div class="solo-room__title">
        <input
          v-model="sessionName"
          class="title-input"
          :placeholder="$t('classroom.soloWorkspace.untitled')"
          @blur="handleTitleBlur"
          @keydown.enter="($event.target as HTMLInputElement).blur()"
        />
      </div>

      <!-- Center: Cloud status -->
      <div class="solo-room__status">
        <CloudStatus
          :status="boardStore.syncStatus"
          :last-saved-at="boardStore.lastSavedAt"
          @retry="boardStore.retrySync"
        />
      </div>

      <!-- Right: Actions -->
      <div class="solo-room__actions">
        <button class="action-btn" :title="$t('classroom.tools.undo')" @click="handleUndo">
          <IconUndo />
        </button>
        <button class="action-btn" :title="$t('classroom.tools.redo')" @click="handleRedo">
          <IconRedo />
        </button>
        <ExportMenu
          v-if="boardStore.sessionId"
          :session-id="boardStore.sessionId"
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
    <div class="solo-room__main">
      <!-- Left Toolbar (Kami-style vertical) -->
      <aside class="solo-room__toolbar">
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
      <div class="solo-room__board" @paste="handlePaste">
        <BoardDock
          ref="boardDockRef"
          :board-state="boardStore.serializedState"
          :permissions="soloPermissions"
          :readonly="false"
          @event="handleBoardEvent"
          @state-change="handleStateChange"
        />
      </div>
    </div>

    <!-- Footer: Page navigation + Zoom -->
    <footer class="solo-room__footer">
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
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useBoardStore } from '../board/state/boardStore'
import { DEFAULT_PERMISSIONS } from '../engine/permissionsEngine'
import type { RoomPermissions } from '../api/classroom'

// Components
import BoardDock from '../components/board/BoardDock.vue'
import BoardToolbarVertical from '../components/board/BoardToolbarVertical.vue'
import CloudStatus from '../components/board/CloudStatus.vue'
import ExportMenu from '../components/board/ExportMenu.vue'
import IconUndo from '../components/board/icons/IconUndo.vue'
import IconRedo from '../components/board/icons/IconRedo.vue'

const router = useRouter()
const route = useRoute()
const boardStore = useBoardStore()

// Refs
const boardDockRef = ref<InstanceType<typeof BoardDock> | null>(null)
const sessionName = ref('')
const currentPage = ref(1)
const totalPages = ref(1)

// Solo permissions (full access)
const soloPermissions: RoomPermissions = DEFAULT_PERMISSIONS.solo

// Lifecycle
onMounted(async () => {
  const sessionId = route.params.sessionId as string | undefined

  if (sessionId) {
    // Load existing session
    const loaded = await boardStore.loadSession(sessionId)
    if (loaded) {
      sessionName.value = boardStore.sessionName
      totalPages.value = boardStore.pages.length || 1
    } else {
      // Session not found, create new
      await boardStore.createSession()
      // Update URL with new session ID
      if (boardStore.sessionId) {
        router.replace(`/solo/${boardStore.sessionId}`)
      }
    }
  } else {
    // Create new session
    await boardStore.createSession()
    sessionName.value = boardStore.sessionName
    // Update URL with new session ID
    if (boardStore.sessionId) {
      router.replace(`/solo/${boardStore.sessionId}`)
    }
  }

  // Set up paste listener
  document.addEventListener('paste', handlePaste)
})

onBeforeUnmount(async () => {
  // Flush any pending changes before leaving
  await boardStore.autosave()
  document.removeEventListener('paste', handlePaste)
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
  console.log('[SoloRoom] Board event:', eventType, data)

  switch (eventType) {
    case 'stroke_add':
      boardStore.addStroke(data.stroke)
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

function handleStateChange(newState: Record<string, unknown>): void {
  // State changed from board, mark dirty for autosave
  boardStore.markDirty()
}

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
  // Save before exit
  await boardStore.autosave()
  router.push('/dashboard')
}

// Paste handler for images
function handlePaste(event: ClipboardEvent): void {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const blob = item.getAsFile()
      if (blob) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const src = e.target?.result as string
          const img = new Image()
          img.onload = () => {
            boardStore.addImageAsset(src, img.width, img.height)
          }
          img.src = src
        }
        reader.readAsDataURL(blob)
      }
      break
    }
  }
}

// Export handlers
function handleExportStart(): void {
  boardStore.setExporting(true)
}

function handleExportComplete(url: string): void {
  boardStore.setExporting(false)
  console.log('[SoloRoom] Export complete:', url)
}

function handleExportError(error: string): void {
  boardStore.setExporting(false)
  console.error('[SoloRoom] Export error:', error)
}

// Page navigation
function prevPage(): void {
  if (currentPage.value > 1) {
    currentPage.value--
    boardStore.currentPageIndex = currentPage.value - 1
  }
}

function nextPage(): void {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    boardStore.currentPageIndex = currentPage.value - 1
  }
}

function addPage(): void {
  totalPages.value++
  currentPage.value = totalPages.value
  boardStore.currentPageIndex = currentPage.value - 1
  boardStore.markDirty()
}

// Zoom
function zoomIn(): void {
  boardStore.setZoom(Math.min(3, boardStore.zoom + 0.25))
}

function zoomOut(): void {
  boardStore.setZoom(Math.max(0.5, boardStore.zoom - 0.25))
}
</script>

<style scoped>
/* Kami-style layout */
.solo-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-tertiary, #f1f5f9);
}

/* Header - ТЗ v0.28: 64px height, padding 0 24px (desktop) / 0 16px (≤1024px) */
.solo-room__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--color-brand, #7c3aed);
  color: white;
  height: 64px;
}

@media (max-width: 1024px) {
  .solo-room__header {
    padding: 0 16px;
  }
}

.solo-room__title {
  flex: 1;
  min-width: 0;
}

.title-input {
  width: 100%;
  max-width: 200px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: var(--radius-sm, 4px);
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
}

.title-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.title-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.25);
}

.solo-room__status {
  flex-shrink: 0;
}

.solo-room__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.15);
  border: none;
  border-radius: var(--radius-sm, 4px);
  color: white;
  cursor: pointer;
  transition: background 0.15s ease;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.action-btn svg {
  width: 18px;
  height: 18px;
}

/* Main content area */
.solo-room__main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Left toolbar */
.solo-room__toolbar {
  flex-shrink: 0;
  z-index: 10;
}

/* Board area */
.solo-room__board {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

/* Footer - ТЗ v0.28: 48px height, padding 0 20px */
.solo-room__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  height: 48px;
  background: var(--color-bg, #ffffff);
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--color-fg, #0f172a);
  transition: all 0.15s ease;
}

.page-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #f1f5f9);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-indicator {
  font-size: 0.8125rem;
  color: var(--color-fg-secondary, #475569);
  min-width: 40px;
  text-align: center;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.zoom-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary, #f8fafc);
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-sm, 4px);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-fg, #0f172a);
  transition: all 0.15s ease;
}

.zoom-btn:hover {
  background: var(--color-bg-hover, #f1f5f9);
}

.zoom-level {
  font-size: 0.8125rem;
  color: var(--color-fg-secondary, #475569);
  min-width: 48px;
  text-align: center;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm, 4px);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: white;
}

.btn-primary:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
