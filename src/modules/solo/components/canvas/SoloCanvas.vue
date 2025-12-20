<template>
  <div
    ref="containerRef"
    class="solo-canvas-wrapper"
    tabindex="0"
    @paste="handlePaste"
    @keydown="handleKeydown"
  >
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
      @touchstart="handleMouseDown"
      @touchmove="handleMouseMove"
      @touchend="handleMouseUp"
    >
      <!-- Background layer -->
      <v-layer>
        <v-rect :config="backgroundConfig" />
      </v-layer>

      <!-- Strokes layer -->
      <v-layer ref="strokesLayerRef">
        <template v-for="stroke in pageStrokes" :key="stroke.id">
          <!-- Pen / Highlighter strokes -->
          <v-line
            v-if="stroke.tool === 'pen' || stroke.tool === 'highlighter'"
            :config="getStrokeConfig(stroke)"
          />
          <!-- Line tool -->
          <v-line
            v-else-if="stroke.tool === 'line'"
            :config="getLineConfig(stroke)"
          />
          <!-- Rectangle -->
          <v-rect
            v-else-if="stroke.tool === 'rectangle'"
            :config="getRectConfig(stroke)"
          />
          <!-- Text -->
          <v-text
            v-else-if="stroke.tool === 'text'"
            :config="getTextConfig(stroke)"
            @dblclick="handleTextEdit(stroke)"
          />
        </template>
      </v-layer>

      <!-- UI layer (current drawing) -->
      <v-layer ref="uiLayerRef">
        <!-- Current drawing preview -->
        <v-line
          v-if="isDrawing && currentPoints.length > 0"
          :config="currentStrokeConfig"
        />
        <!-- Shape preview -->
        <v-rect
          v-if="isDrawing && tool === 'rectangle' && shapePreview"
          :config="shapePreviewConfig"
        />
        <v-line
          v-if="isDrawing && tool === 'line' && shapePreview"
          :config="linePreviewConfig"
        />
      </v-layer>
    </v-stage>

    <!-- Text editing overlay -->
    <textarea
      v-if="editingText"
      ref="textareaRef"
      v-model="editingTextValue"
      class="text-edit-overlay"
      :style="textEditStyle"
      @blur="finishTextEdit"
      @keydown.enter.exact="finishTextEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { PageState, Stroke, Shape, TextElement } from '../../types/solo'
import { getStroke } from 'perfect-freehand'

// Types
interface Point {
  x: number
  y: number
  t?: number
}

interface StrokeData {
  id: string
  tool: 'pen' | 'highlighter' | 'line' | 'rectangle' | 'text' | 'eraser' | 'select'
  color: string
  size: number
  opacity: number
  points: Point[]
  text?: string
  width?: number
  height?: number
}

const props = defineProps<{
  page: PageState
  tool: string
  color: string
  size: number
  zoom: number
  panX: number
  panY: number
}>()

const emit = defineEmits<{
  'stroke-end': [stroke: Stroke]
  'shape-end': [shape: Shape]
  'text-create': [text: TextElement]
  'zoom-change': [zoom: number]
  'pan-change': [x: number, y: number]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<any>(null)
const strokesLayerRef = ref<any>(null)
const uiLayerRef = ref<any>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// State
const canvasWidth = ref(920)
const canvasHeight = ref(1200)
const isDrawing = ref(false)
const currentPoints = ref<Point[]>([])
const shapePreview = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const editingText = ref<StrokeData | null>(null)
const editingTextValue = ref('')

// Computed
const pageStrokes = computed<StrokeData[]>(() => {
  return (props.page?.strokes || []) as StrokeData[]
})

const stageConfig = computed(() => ({
  width: canvasWidth.value,
  height: canvasHeight.value,
  scaleX: props.zoom,
  scaleY: props.zoom,
  x: props.panX * props.zoom,
  y: props.panY * props.zoom,
}))

const backgroundConfig = computed(() => ({
  x: 0,
  y: 0,
  width: canvasWidth.value,
  height: canvasHeight.value,
  fill: '#ffffff',
}))

const currentStrokeConfig = computed(() => {
  if (currentPoints.value.length < 2) return {}
  
  const strokePoints = getStroke(currentPoints.value, {
    size: props.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  })
  
  const flatPoints = strokePoints.flatMap(p => [p[0], p[1]])
  
  return {
    points: flatPoints,
    fill: props.color,
    opacity: props.tool === 'highlighter' ? 0.4 : 1,
    closed: true,
    lineCap: 'round',
    lineJoin: 'round',
  }
})

const shapePreviewConfig = computed(() => {
  if (!shapePreview.value) return {}
  return {
    x: shapePreview.value.x,
    y: shapePreview.value.y,
    width: shapePreview.value.w,
    height: shapePreview.value.h,
    stroke: props.color,
    strokeWidth: props.size,
    dash: [5, 5],
  }
})

const linePreviewConfig = computed(() => {
  if (!shapePreview.value || currentPoints.value.length < 1) return {}
  const start = currentPoints.value[0]
  return {
    points: [start.x, start.y, shapePreview.value.x + shapePreview.value.w, shapePreview.value.y + shapePreview.value.h],
    stroke: props.color,
    strokeWidth: props.size,
    lineCap: 'round',
  }
})

const textEditStyle = computed(() => {
  if (!editingText.value) return {}
  const stroke = editingText.value
  return {
    left: `${stroke.points[0]?.x || 0}px`,
    top: `${stroke.points[0]?.y || 0}px`,
    fontSize: `${stroke.size * 4}px`,
    color: stroke.color,
  }
})

// Methods
function getStrokeConfig(stroke: StrokeData) {
  if (stroke.points.length < 2) return {}
  
  const strokePoints = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  })
  
  const flatPoints = strokePoints.flatMap(p => [p[0], p[1]])
  
  return {
    points: flatPoints,
    fill: stroke.color,
    opacity: stroke.tool === 'highlighter' ? 0.4 : stroke.opacity,
    closed: true,
    lineCap: 'round',
    lineJoin: 'round',
  }
}

function getLineConfig(stroke: StrokeData) {
  if (stroke.points.length < 2) return {}
  const start = stroke.points[0]
  const end = stroke.points[stroke.points.length - 1]
  return {
    points: [start.x, start.y, end.x, end.y],
    stroke: stroke.color,
    strokeWidth: stroke.size,
    lineCap: 'round',
  }
}

function getRectConfig(stroke: StrokeData) {
  if (stroke.points.length < 2) return {}
  const start = stroke.points[0]
  const end = stroke.points[stroke.points.length - 1]
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    stroke: stroke.color,
    strokeWidth: stroke.size,
  }
}

function getTextConfig(stroke: StrokeData) {
  return {
    x: stroke.points[0]?.x || 0,
    y: stroke.points[0]?.y || 0,
    text: stroke.text || '',
    fontSize: stroke.size * 4,
    fill: stroke.color,
  }
}

function getPointerPosition(e: any): Point {
  const stage = stageRef.value?.getStage()
  if (!stage) return { x: 0, y: 0 }
  
  const pos = stage.getPointerPosition()
  return {
    x: (pos.x - props.panX * props.zoom) / props.zoom,
    y: (pos.y - props.panY * props.zoom) / props.zoom,
    t: Date.now(),
  }
}

function handleMouseDown(e: any): void {
  const pos = getPointerPosition(e)
  
  if (props.tool === 'text') {
    // Create text at click position
    const textStroke: Stroke = {
      id: `text-${Date.now()}`,
      tool: 'text',
      color: props.color,
      size: props.size,
      opacity: 1,
      points: [pos],
      text: 'Text',
    }
    emit('stroke-end', textStroke)
    return
  }
  
  if (['pen', 'highlighter', 'eraser'].includes(props.tool)) {
    isDrawing.value = true
    currentPoints.value = [pos]
  } else if (['line', 'rectangle'].includes(props.tool)) {
    isDrawing.value = true
    currentPoints.value = [pos]
    shapePreview.value = { x: pos.x, y: pos.y, w: 0, h: 0 }
  }
}

function handleMouseMove(e: any): void {
  if (!isDrawing.value) return
  
  const pos = getPointerPosition(e)
  
  if (['pen', 'highlighter', 'eraser'].includes(props.tool)) {
    currentPoints.value.push(pos)
  } else if (['line', 'rectangle'].includes(props.tool) && currentPoints.value.length > 0) {
    const start = currentPoints.value[0]
    shapePreview.value = {
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      w: pos.x - start.x,
      h: pos.y - start.y,
    }
  }
}

function handleMouseUp(e: any): void {
  if (!isDrawing.value) return
  
  const pos = getPointerPosition(e)
  
  if (['pen', 'highlighter', 'eraser'].includes(props.tool) && currentPoints.value.length > 1) {
    const stroke: Stroke = {
      id: `stroke-${Date.now()}`,
      tool: props.tool as any,
      color: props.color,
      size: props.size,
      opacity: props.tool === 'highlighter' ? 0.4 : 1,
      points: [...currentPoints.value],
    }
    emit('stroke-end', stroke)
  } else if (['line', 'rectangle'].includes(props.tool) && currentPoints.value.length > 0) {
    const start = currentPoints.value[0]
    const shape: Shape = {
      id: `shape-${Date.now()}`,
      type: props.tool as 'line' | 'rectangle',
      color: props.color,
      size: props.size,
      startX: start.x,
      startY: start.y,
      endX: pos.x,
      endY: pos.y,
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      width: Math.abs(pos.x - start.x),
      height: Math.abs(pos.y - start.y),
      points: props.tool === 'line' ? [start, pos] : undefined,
    }
    emit('shape-end', shape)
  }
  
  isDrawing.value = false
  currentPoints.value = []
  shapePreview.value = null
}

function handleTextEdit(stroke: StrokeData): void {
  editingText.value = stroke
  editingTextValue.value = stroke.text || ''
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function finishTextEdit(): void {
  if (editingText.value && editingTextValue.value) {
    const updatedStroke: Stroke = {
      ...editingText.value,
      text: editingTextValue.value,
    }
    emit('stroke-end', updatedStroke)
  }
  editingText.value = null
  editingTextValue.value = ''
}

function handlePaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items
  if (!items) return
  
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string
          // Emit image paste event
          console.log('[SoloCanvas] Image pasted', dataUrl.slice(0, 50))
        }
        reader.readAsDataURL(file)
      }
    }
  }
}

function handleKeydown(e: KeyboardEvent): void {
  // Undo: Ctrl+Z
  if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    // Undo handled by parent
  }
  // Redo: Ctrl+Shift+Z or Ctrl+Y
  if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
    e.preventDefault()
    // Redo handled by parent
  }
}

// Resize handler
function handleResize(): void {
  if (containerRef.value) {
    // Keep fixed canvas size for consistency
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  handleResize()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<style scoped>
.solo-canvas-wrapper {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary, #f1f5f9);
}

.text-edit-overlay {
  position: absolute;
  background: transparent;
  border: 2px solid var(--color-brand, #2563eb);
  border-radius: 4px;
  padding: 4px 8px;
  font-family: inherit;
  resize: none;
  outline: none;
  z-index: 100;
  min-width: 100px;
  min-height: 32px;
}
</style>
