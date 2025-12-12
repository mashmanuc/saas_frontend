<template>
  <div class="board-dock" :class="{ 'board-dock--readonly': readonly }">
    <!-- Board container -->
    <div ref="boardContainer" class="board-dock__canvas">
      <!-- Whiteboard would be rendered here -->
      <div class="board-placeholder">
        <span class="icon">📝</span>
        <p>{{ $t('classroom.board.placeholder') }}</p>
      </div>
    </div>

    <!-- Toolbar -->
    <BoardToolbar
      v-if="!readonly"
      :permissions="permissions"
      :current-tool="currentTool"
      :current-color="currentColor"
      :current-size="currentSize"
      @tool-change="handleToolChange"
      @color-change="handleColorChange"
      @size-change="handleSizeChange"
      @undo="handleUndo"
      @redo="handleRedo"
      @clear="handleClear"
    />

    <!-- Zoom controls -->
    <div class="board-dock__zoom">
      <button class="zoom-btn" @click="handleZoomOut" :disabled="zoom <= 0.5">
        −
      </button>
      <span class="zoom-level">{{ Math.round(zoom * 100) }}%</span>
      <button class="zoom-btn" @click="handleZoomIn" :disabled="zoom >= 3">
        +
      </button>
      <button class="zoom-btn" @click="handleZoomReset">
        ⟲
      </button>
    </div>

    <!-- Layer indicator -->
    <div v-if="permissions?.can_add_layers" class="board-dock__layers">
      <span class="layer-count">
        {{ $t('classroom.board.layers') }}: {{ layerCount }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { RoomPermissions } from '../../api/classroom'
import BoardToolbar from './BoardToolbar.vue'

interface Props {
  boardState: Record<string, unknown>
  permissions: RoomPermissions | null
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
})

const emit = defineEmits<{
  event: [eventType: string, data: Record<string, unknown>]
  'state-change': [state: Record<string, unknown>]
}>()

// Refs
const boardContainer = ref<HTMLElement | null>(null)

// State
const currentTool = ref('pen')
const currentColor = ref('#000000')
const currentSize = ref(2)
const zoom = ref(1)
const layerCount = ref(1)

// Watch board state changes
watch(
  () => props.boardState,
  (newState) => {
    // Apply state to board
    console.log('[BoardDock] State updated:', newState)
  },
  { deep: true }
)

// Lifecycle
onMounted(() => {
  // Initialize whiteboard engine here
  console.log('[BoardDock] Mounted')
})

onUnmounted(() => {
  // Cleanup
  console.log('[BoardDock] Unmounted')
})

// Handlers
function handleToolChange(tool: string): void {
  currentTool.value = tool
  emit('event', 'tool_change', { tool })
}

function handleColorChange(color: string): void {
  currentColor.value = color
  emit('event', 'color_change', { color })
}

function handleSizeChange(size: number): void {
  currentSize.value = size
  emit('event', 'size_change', { size })
}

function handleUndo(): void {
  emit('event', 'undo', {})
}

function handleRedo(): void {
  emit('event', 'redo', {})
}

function handleClear(): void {
  if (!props.permissions?.can_clear_board) return
  emit('event', 'clear_all', {})
}

function handleZoomIn(): void {
  zoom.value = Math.min(3, zoom.value + 0.25)
}

function handleZoomOut(): void {
  zoom.value = Math.max(0.5, zoom.value - 0.25)
}

function handleZoomReset(): void {
  zoom.value = 1
}
</script>

<style scoped>
.board-dock {
  position: relative;
  height: 100%;
  background: white;
  border-radius: 12px;
  overflow: hidden;
}

.board-dock--readonly {
  pointer-events: none;
  opacity: 0.9;
}

.board-dock__canvas {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.board-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
}

.board-placeholder .icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.board-dock__zoom {
  position: absolute;
  bottom: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.zoom-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.25rem;
  color: var(--color-text-primary);
}

.zoom-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.zoom-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.zoom-level {
  min-width: 48px;
  text-align: center;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.board-dock__layers {
  position: absolute;
  bottom: 16px;
  left: 16px;
  padding: 4px 8px;
  background: var(--color-bg-secondary);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
</style>
