<template>
  <div class="solo-room">
    <!-- Header -->
    <header class="solo-room__header">
      <div class="solo-room__title">
        <span class="icon">📝</span>
        <h1>{{ $t('classroom.solo.title') }}</h1>
      </div>
      <div class="solo-room__actions">
        <button class="btn btn-ghost" @click="handleSave">
          <span class="icon">💾</span>
          {{ $t('common.save') }}
        </button>
        <button class="btn btn-ghost" @click="handleClear">
          <span class="icon">🗑️</span>
          {{ $t('common.clear') }}
        </button>
        <button class="btn btn-primary" @click="handleExit">
          {{ $t('common.exit') }}
        </button>
      </div>
    </header>

    <!-- Board -->
    <div class="solo-room__board">
      <BoardDock
        :board-state="boardState"
        :permissions="soloPermissions"
        :readonly="false"
        @event="handleBoardEvent"
        @state-change="handleStateChange"
      />
    </div>

    <!-- Toolbar -->
    <BoardToolbar
      :permissions="soloPermissions"
      @tool-change="handleToolChange"
      @undo="handleUndo"
      @redo="handleRedo"
    />

    <!-- Autosave indicator -->
    <div v-if="lastSaved" class="solo-room__autosave">
      {{ $t('classroom.solo.lastSaved') }}: {{ formatTime(lastSaved) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { StorageEngine } from '../engine/storageEngine'
import { DEFAULT_PERMISSIONS } from '../engine/permissionsEngine'
import type { RoomPermissions } from '../api/classroom'

import BoardDock from '../components/board/BoardDock.vue'
import BoardToolbar from '../components/board/BoardToolbar.vue'

const router = useRouter()

// State
const boardState = ref<Record<string, unknown>>({})
const lastSaved = ref<Date | null>(null)
const currentTool = ref('pen')
const version = ref(0)

// Solo permissions (full access)
const soloPermissions: RoomPermissions = DEFAULT_PERMISSIONS.solo

// Storage engine for local persistence
const storageEngine = new StorageEngine('solo-practice')

// Lifecycle
onMounted(() => {
  // Load saved state
  const saved = storageEngine.loadState()
  if (saved) {
    boardState.value = saved.boardState
    version.value = saved.version
    lastSaved.value = new Date(saved.savedAt)
  }

  // Start autosave
  storageEngine.startAutosave(
    () => boardState.value,
    () => version.value
  )
})

onUnmounted(() => {
  storageEngine.destroy()
})

// Handlers
function handleBoardEvent(eventType: string, data: Record<string, unknown>): void {
  // Apply event locally
  console.log('[SoloRoom] Board event:', eventType, data)
  version.value++
}

function handleStateChange(newState: Record<string, unknown>): void {
  boardState.value = newState
  version.value++
}

function handleSave(): void {
  storageEngine.saveState(boardState.value, version.value)
  lastSaved.value = new Date()
}

function handleClear(): void {
  if (confirm('Clear the board? This cannot be undone.')) {
    boardState.value = {}
    version.value++
    storageEngine.clearState()
  }
}

function handleExit(): void {
  // Save before exit
  storageEngine.saveState(boardState.value, version.value)
  router.push('/dashboard')
}

function handleToolChange(tool: string): void {
  currentTool.value = tool
}

function handleUndo(): void {
  // Would integrate with board's undo stack
  console.log('[SoloRoom] Undo')
}

function handleRedo(): void {
  // Would integrate with board's redo stack
  console.log('[SoloRoom] Redo')
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString()
}
</script>

<style scoped>
.solo-room {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-primary);
}

.solo-room__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
}

.solo-room__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.solo-room__title h1 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.solo-room__actions {
  display: flex;
  gap: 0.5rem;
}

.solo-room__board {
  flex: 1;
  overflow: hidden;
}

.solo-room__autosave {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  padding: 0.5rem 1rem;
  background: var(--color-bg-tertiary);
  border-radius: 8px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.icon {
  font-size: 1.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-ghost {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.btn-ghost:hover {
  background: var(--color-bg-hover);
}

.btn-primary {
  background: var(--color-primary);
  border: none;
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
}
</style>
