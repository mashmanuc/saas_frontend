<template>
  <div class="board-dock" :class="{ 'board-dock--readonly': readonly }">
    <!-- Board container with Konva Canvas -->
    <div ref="boardContainer" class="board-dock__canvas">
      <BoardCanvas
        ref="canvasRef"
        :tool="currentTool"
        :color="currentColor"
        :size="currentSize"
        :opacity="currentOpacity"
        :strokes="currentStrokes"
        :assets="currentAssets"
        :remote-cursors="remoteCursors"
        :teacher-user-id="teacherUserId"
        :follow-teacher-enabled="followTeacherEnabled"
        :width="canvasWidth"
        :height="canvasHeight"
        :zoom="zoom"
        @stroke-add="handleStrokeAdd"
        @stroke-update="handleStrokeUpdate"
        @stroke-delete="handleStrokeDelete"
        @asset-add="handleAssetAdd"
        @asset-update="handleAssetUpdate"
        @asset-delete="handleAssetDelete"
        @cursor-move="handleCursorMove"
        @select="handleSelect"
      />
    </div>

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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { RoomPermissions } from '../../api/classroom'
import BoardCanvas from './BoardCanvas.vue'

// Types
type ToolType = 'pen' | 'highlighter' | 'line' | 'rectangle' | 'circle' | 'text' | 'eraser' | 'select'

interface Stroke {
  id: string
  tool: ToolType
  color: string
  size: number
  opacity: number
  points: Array<{ x: number; y: number; t?: number }>
  text?: string
  width?: number
  height?: number
}

interface Asset {
  id: string
  type: 'image'
  src: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

interface Props {
  strokes?: unknown[]
  assets?: unknown[]
  remoteCursors?: Array<{ userId: string; x: number; y: number; tool: string; color: string; ts: number }>
  teacherUserId?: string | null
  followTeacherEnabled?: boolean
  permissions: RoomPermissions | null
  readonly?: boolean
  tool?: string
  color?: string
  size?: number
}

// F29-CRITICAL-FIX: NO default factories for arrays
// () => [] creates NEW array on each access → flicker
const props = defineProps<Props>()

const emit = defineEmits<{
  event: [eventType: string, data: Record<string, unknown>]
  'state-change': [state: Record<string, unknown>]
}>()

// Refs
const boardContainer = ref<HTMLElement | null>(null)
const canvasRef = ref<InstanceType<typeof BoardCanvas> | null>(null)

// State - use props for tool/color/size, local refs for others
const currentTool = computed(() => props.tool)
const currentColor = computed(() => props.color)
const currentSize = computed(() => props.size)
const currentOpacity = ref(1)
const zoom = ref(1)
const layerCount = ref(1)
const selectedId = ref<string | null>(null)

// Canvas dimensions (Kami-style: 920px max width)
const canvasWidth = ref(920)
const canvasHeight = ref(1200)

// F29-CRITICAL-FIX: Pass props directly, NO computed wrappers
// Computed creates new array references → Konva sees new refs → redraws all → flicker
const currentStrokes = computed(() => (props.strokes || []) as Stroke[])
const currentAssets = computed(() => (props.assets || []) as Asset[])
const remoteCursors = computed(() => props.remoteCursors || [])
const teacherUserId = computed(() => props.teacherUserId ?? null)
const followTeacherEnabled = computed(() => props.followTeacherEnabled ?? false)

// Lifecycle
onMounted(() => {
  console.log('[BoardDock] Mounted')
})

onUnmounted(() => {
  console.log('[BoardDock] Unmounted')
})

// Canvas event handlers
function handleStrokeAdd(stroke: Stroke): void {
  emit('event', 'stroke_add', { stroke })
  emitStateChange()
}

function handleStrokeUpdate(stroke: Stroke): void {
  if (stroke.points.length === 0) {
    // Delete stroke
    emit('event', 'stroke_delete', { strokeId: stroke.id })
  } else {
    emit('event', 'stroke_update', { stroke })
  }
  emitStateChange()
}

function handleAssetAdd(asset: Asset, file?: File): void {
  emit('event', 'asset_add', { asset, file })
  emitStateChange()
}

function handleAssetUpdate(asset: Asset): void {
  emit('event', 'asset_update', { asset })
  emitStateChange()
}

function handleStrokeDelete(strokeId: string): void {
  emit('event', 'stroke_delete', { strokeId })
  emitStateChange()
}

function handleAssetDelete(assetId: string): void {
  emit('event', 'asset_delete', { assetId })
  emitStateChange()
}

function handleSelect(id: string | null): void {
  selectedId.value = id
  emit('event', 'select', { id })
}

function handleCursorMove(payload: { x: number; y: number; tool: string; color: string }): void {
  // v0.92.2: Normalize cursor position - prevent undefined.x crash
  if (typeof payload?.x !== 'number' || typeof payload?.y !== 'number') {
    console.warn('[BoardDock] Invalid cursor position, skipping:', payload)
    return
  }
  emit('event', 'cursor_move', payload)
}

function emitStateChange(): void {
  // Build state from current data
  const state = {
    version: '1',
    pages: [{
      id: 'p1',
      strokes: currentStrokes.value,
      assets: currentAssets.value,
    }],
    activePageId: 'p1',
    meta: { title: 'Untitled' },
  }
  emit('state-change', state)
}

// Tool handlers (called from parent) - just emit, props will update from parent
function handleToolChange(tool: string): void {
  emit('event', 'tool_change', { tool })
}

function handleColorChange(color: string): void {
  emit('event', 'color_change', { color })
}

function handleSizeChange(size: number): void {
  emit('event', 'size_change', { size })
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

// v0.31: Follow-teacher viewport sync - scroll canvas to center on position
function scrollToPosition(x: number, y: number): void {
  const container = boardContainer.value
  if (!container) return

  // Calculate the center offset based on zoom and container size
  const containerRect = container.getBoundingClientRect()
  const centerX = x * zoom.value - containerRect.width / 2
  const centerY = y * zoom.value - containerRect.height / 2

  // Smooth scroll to the position
  container.scrollTo({
    left: Math.max(0, centerX),
    top: Math.max(0, centerY),
    behavior: 'smooth',
  })
}

// Expose methods for parent
defineExpose({
  handleToolChange,
  handleColorChange,
  handleSizeChange,
  scrollToPosition,
  currentTool,
  currentColor,
  currentSize,
  zoom,
  getStage: () => canvasRef.value?.getStage?.() || null,
})
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
