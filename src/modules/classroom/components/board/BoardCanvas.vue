<template>
  <div 
    ref="containerRef" 
    class="board-canvas"
    tabindex="0"
    @keydown="handleKeydown"
    @dragover.prevent
    @dragenter.prevent
    @drop.prevent="handleDrop"
  >
    <!-- F29.8: Performance HUD (Ctrl+Alt+P to toggle) -->
    <PerfHUD ref="perfHudRef" :stage-ref="perfHudStageRef" />

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
      <v-layer ref="backgroundLayerRef">
        <v-rect :config="backgroundConfig" />
      </v-layer>

      <!-- Assets layer (images) - BELOW strokes -->
      <v-layer ref="assetsLayerRef">
        <v-image
          v-for="asset in assets"
          :key="asset.id"
          :config="getAssetConfig(asset)"
          @click="handleAssetClick(asset, $event)"
          @dragend="handleAssetDragEnd(asset, $event)"
          @transformend="handleAssetTransformEnd(asset, $event)"
        />
      </v-layer>

      <!-- Strokes layer - ABOVE images -->
      <v-layer ref="strokesLayerRef">
        <!-- F29-FLICKER-FIX: Vue incremental rendering via :key -->
        <template v-for="stroke in strokes" :key="stroke.id">
          <!-- Pen / Highlighter strokes (use v-path for SVG path data) -->
          <v-path
            v-if="stroke.tool === 'pen' || stroke.tool === 'highlighter'"
            :config="getStrokeConfig(stroke)"
            @click="handleStrokeClick(stroke, $event)"
            @dragend="handleStrokeDragEnd(stroke, $event)"
          />
          <!-- Line tool -->
          <v-line
            v-else-if="stroke.tool === 'line'"
            :config="getLineConfig(stroke)"
            @click="handleStrokeClick(stroke, $event)"
            @dragend="handleStrokeDragEnd(stroke, $event)"
          />
          <!-- Rectangle -->
          <v-rect
            v-else-if="stroke.tool === 'rectangle'"
            :config="getRectConfig(stroke)"
            @click="handleStrokeClick(stroke, $event)"
            @dragend="handleStrokeDragEnd(stroke, $event)"
          />
          <!-- Circle / Ellipse -->
          <v-ellipse
            v-else-if="stroke.tool === 'circle'"
            :config="getCircleConfig(stroke)"
            @click="handleStrokeClick(stroke, $event)"
            @dragend="handleStrokeDragEnd(stroke, $event)"
          />
          <!-- Text -->
          <v-text
            v-else-if="stroke.tool === 'text'"
            :config="getTextConfig(stroke)"
            @dblclick="handleTextEdit(stroke)"
            @click="handleStrokeClick(stroke, $event)"
            @dragend="handleStrokeDragEnd(stroke, $event)"
          />
        </template>
      </v-layer>

      <!-- UI layer (transformer only) -->
      <v-layer ref="uiLayerRef">
        <v-transformer
          v-if="selectedNode"
          ref="transformerRef"
          :config="transformerConfig"
        />
      </v-layer>
    </v-stage>

    <!-- Offscreen preview canvas overlay -->
    <canvas
      ref="previewCanvasRef"
      class="board-preview-canvas"
    />

    <!-- Text editing overlay -->
    <textarea
      v-show="editingText"
      ref="textareaRef"
      v-model="editingTextValue"
      class="text-edit-overlay"
      :style="textEditStyle"
      @blur="finishTextEdit"
      @keydown.enter.exact="finishTextEdit"
    />

    <div class="remote-cursors" aria-hidden="true">
      <div
        v-for="c in remoteCursors"
        :key="c.userId"
        class="remote-cursor"
        :style="{ transform: `translate(${c.x * props.zoom}px, ${c.y * props.zoom}px)` }"
      >
        <div
          class="remote-cursor__dot"
          :class="{ 'remote-cursor__dot--teacher': c.userId === teacherUserId, 'remote-cursor__dot--follow': followTeacherEnabled && c.userId === teacherUserId }"
          :style="{ backgroundColor: c.color }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Konva from 'konva'
import getStroke from 'perfect-freehand'
import PerfHUD from './PerfHUD.vue'
// F29-STEALTH: Import stealth autosave utilities
import {
  setIsPointerInputActive,
  setIsTextEditingActive,
  setStableAutosaveStore,
  setStageRef,
  useBoardStore,
} from '../../board/state/boardStore'
import { initSnapshotOverlay, destroySnapshotOverlay } from '../../board/render/snapshotOverlay'
import { isSaveWindowActive, recordPointerEvent } from '../../board/perf/saveWindowMetrics'
import { isRenderGuardActive } from '../../board/render/guards'

// Types
interface Point {
  x: number
  y: number
  t?: number
}

interface Stroke {
  id: string
  tool: 'pen' | 'highlighter' | 'line' | 'rectangle' | 'circle' | 'text' | 'eraser' | 'select'
  color: string
  size: number
  opacity: number
  points: Point[]
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
  tool?: string
  color?: string
  size?: number
  opacity?: number
  strokes?: Stroke[]
  assets?: Asset[]
  remoteCursors?: Array<{ userId: string; x: number; y: number; tool: string; color: string; ts: number }>
  teacherUserId?: string | null
  followTeacherEnabled?: boolean
  width?: number
  height?: number
  zoom?: number
}

// F29-STEALTH: NO default factories for arrays - prevents new reference on each access
// Canvas receives strokes/assets directly from parent, no sync props
const props = withDefaults(defineProps<Props>(), {
  tool: 'pen',
  color: '#111111',
  size: 4,
  opacity: 1,
  width: 920,
  height: 1200,
  zoom: 1,
})

// F29-STEALTH: Stable references - use props directly, fallback to empty array only once
const strokes = computed(() => props.strokes ?? [])
const assets = computed(() => props.assets ?? [])

const remoteCursors = computed(() => props.remoteCursors ?? [])
const teacherUserId = computed(() => props.teacherUserId ?? null)
const followTeacherEnabled = computed(() => props.followTeacherEnabled ?? false)

const emit = defineEmits<{
  'stroke-add': [stroke: Stroke]
  'stroke-update': [stroke: Stroke]
  'stroke-delete': [strokeId: string]
  'asset-add': [asset: Asset, file?: File]
  'asset-update': [asset: Asset]
  'asset-delete': [assetId: string]
  'select': [id: string | null]
  'cursor-move': [payload: { x: number; y: number; tool: string; color: string }]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<InstanceType<typeof Konva.Stage> | null>(null)
const backgroundLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const strokesLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const assetsLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const uiLayerRef = ref(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const perfHudRef = ref<InstanceType<typeof PerfHUD> | null>(null)

const perfHudStageRef = computed(() => ({
  getStage: () => (stageRef.value as unknown as { getDrawCalls?: () => number } | null),
}))

// State
const isDrawing = ref(false)
const currentPoints = ref<Point[]>([])
const shapePreview = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const selectedNode = ref<Konva.Node | null>(null)
const editingText = ref<Stroke | null>(null)
const editingTextValue = ref('')
const loadedImages = reactive<Map<string, HTMLImageElement>>(new Map())

const strokeConfigCache = new Map<string, { sig: string; config: Record<string, unknown> }>()

// F29-AS.26: Input pipeline guard - track if we're in active drawing mode
// During active draw, we skip sync watchers to prevent Vue updates from triggering Konva redraws
const isActiveDrawing = ref(false)

// F29-CRITICAL-FIX: Konva v10+ has automatic batching
// Manual batchDraw() calls cause flickering - removed

function hasRenderableArea(layer: Konva.Layer): boolean {
  const stage = layer.getStage?.()
  if (!stage) return false
  const stageSize = stage.size?.()
  if (!stageSize || stageSize.width <= 0 || stageSize.height <= 0) return false
  const childrenCount = typeof layer.getChildren === 'function' ? layer.getChildren().length : 0
  if (childrenCount === 0) return false
  try {
    const rect = layer.getClientRect?.({ skipTransform: true })
    if (rect && (rect.width <= 0 || rect.height <= 0)) {
      return false
    }
  } catch {
    return false
  }
  return true
}

function cacheLayer(layerRef: typeof backgroundLayerRef | typeof strokesLayerRef) {
  const konvaLayer = layerRef.value?.getNode?.()
  if (!konvaLayer) return
  if (!hasRenderableArea(konvaLayer)) {
    return
  }
  try {
    if (!konvaLayer.isCached?.()) {
      konvaLayer.cache()
    }
  } catch (error) {
    console.warn('[BoardCanvas] layer cache failed', error)
  }
}

function handleDrop(e: DragEvent): void {
  const dt = e.dataTransfer
  if (!dt) return

  const file = Array.from(dt.files || []).find((f) => f.type.startsWith('image/'))
  if (!file) return

  const objectUrl = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    let w = img.width
    let h = img.height
    const maxSize = Math.min(props.width * 0.8, 4096)
    if (w > maxSize || h > maxSize) {
      const scale = maxSize / Math.max(w, h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }

    let x = (props.width - w) / 2
    let y = 100

    const rect = containerRef.value?.getBoundingClientRect()
    if (rect) {
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      x = (px / (props.zoom || 1)) - w / 2
      y = (py / (props.zoom || 1)) - h / 2
    }

    const asset: Asset = {
      id: generateId(),
      type: 'image',
      src: objectUrl,
      x,
      y,
      w,
      h,
      rotation: 0,
    }

    emit('asset-add', asset, file)
  }
  img.onerror = () => {
    try {
      URL.revokeObjectURL(objectUrl)
    } catch {
      // ignore
    }
  }
  img.src = objectUrl
}

// F29-CRITICAL-FIX: Removed scheduleLayerBatchDraw
// Konva v10+ automatically batches all draws
// Manual batchDraw() interferes with automatic batching

// F29-AS.19: Freeze/unfreeze hit graph during drawing for performance
function freezeHitGraph(freeze: boolean): void {
  const layers = [strokesLayerRef, assetsLayerRef]
  for (const layerRef of layers) {
    const konvaLayer = layerRef.value?.getNode?.()
    if (!konvaLayer) continue
    try {
      konvaLayer.listening(!freeze)
    } catch (error) {
      console.warn('[BoardCanvas] freezeHitGraph failed', error)
    }
  }
}

// F29-AS.36: Prewarm glyphs/fonts to avoid first-text freeze
function prewarmFonts(): void {
  // Create offscreen canvas to render alphabet and trigger font loading
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 50
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const fonts = ['system-ui', '-apple-system', 'sans-serif']
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгдеєжзиіїйклмнопрстуфхцчшщьюя'

  for (const font of fonts) {
    ctx.font = `16px ${font}`
    ctx.fillText(alphabet, 0, 20)
  }

  // Clean up
  canvas.width = 0
  canvas.height = 0
}

// Offscreen preview (F29.2)
const supportsOffscreenCanvas =
  typeof window !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && 'OffscreenCanvas' in window
const isSafari = typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

interface CanvasBuffer {
  canvas: OffscreenCanvas | HTMLCanvasElement
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
}

const offscreenBuffers: CanvasBuffer[] = []
let activeBufferIndex = 0
let previewCtx: CanvasRenderingContext2D | null = null
let currentBitmap: ImageBitmap | null = null

function getStagePixelSize() {
  return {
    width: stageConfig.value.width,
    height: stageConfig.value.height,
  }
}

function createOffscreenBuffer(width: number, height: number): CanvasBuffer | null {
  if (supportsOffscreenCanvas) {
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    return { canvas, ctx }
  }

  const fallback = document.createElement('canvas')
  fallback.width = width
  fallback.height = height
  const ctx = fallback.getContext('2d')
  if (!ctx) return null
  return { canvas: fallback, ctx }
}

function initPreviewCanvas() {
  const canvas = previewCanvasRef.value
  if (!canvas) return
  const { width, height } = getStagePixelSize()
  canvas.width = width
  canvas.height = height
  previewCtx = canvas.getContext('2d')

  offscreenBuffers.length = 0
  activeBufferIndex = 0
  for (let i = 0; i < 2; i++) {
    const buffer = createOffscreenBuffer(width, height)
    if (buffer) {
      offscreenBuffers.push(buffer)
    }
  }

  clearPreviewCanvas()
}

function getActiveBuffer(): CanvasBuffer | null {
  if (!offscreenBuffers.length) return null
  return offscreenBuffers[activeBufferIndex]
}

function advanceBuffer(): void {
  if (!offscreenBuffers.length) return
  activeBufferIndex = (activeBufferIndex + 1) % offscreenBuffers.length
}

function clearPreviewCanvas() {
  const { width, height } = getStagePixelSize()
  if (previewCtx) {
    previewCtx.clearRect(0, 0, width, height)
  }
}

function flushPreviewCanvas() {
  if (!previewCtx) return
  const activeBuffer = getActiveBuffer()
  if (!activeBuffer) return

  const { width, height } = getStagePixelSize()

  previewCtx.clearRect(0, 0, width, height)

  // F29-FLICKER-FIX: Disable transferToImageBitmap for Safari (unstable)
  if (!isSafari && supportsOffscreenCanvas && activeBuffer.canvas instanceof OffscreenCanvas && 'transferToImageBitmap' in activeBuffer.canvas) {
    const bitmap = activeBuffer.canvas.transferToImageBitmap()
    if (currentBitmap) {
      currentBitmap.close()
    }
    currentBitmap = bitmap
    previewCtx.drawImage(bitmap, 0, 0, width, height)
  } else {
    previewCtx.drawImage(activeBuffer.canvas, 0, 0, width, height)
  }
}

function drawPreviewCanvas() {
  const buffer = getActiveBuffer()
  if (!isDrawing.value || !buffer || !previewCtx) {
    clearPreviewCanvas()
    return
  }

  const tool = currentTool.value
  const shouldPreview =
    tool === 'pen' || tool === 'highlighter' || tool === 'rectangle' || tool === 'line' || tool === 'circle'
  if (!shouldPreview) {
    clearPreviewCanvas()
    return
  }

  const { width, height } = getStagePixelSize()
  const ctx = buffer.ctx
  ctx.save()
  ctx.clearRect(0, 0, width, height)

  const scale = props.zoom

  if ((tool === 'pen' || tool === 'highlighter') && currentPoints.value.length >= 2) {
    const scaledPoints = currentPoints.value.map((p) => [p.x * scale, p.y * scale] as [number, number])
    const strokePath = getSvgPathFromStroke(
      getStroke(scaledPoints, {
        size: props.size * scale,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
      })
    )
    const path = new Path2D(strokePath)
    ctx.fillStyle = props.color
    ctx.globalAlpha = tool === 'highlighter' ? 0.4 : props.opacity
    ctx.globalCompositeOperation = tool === 'highlighter' ? 'multiply' : 'source-over'
    ctx.fill(path)
  } else if (tool === 'rectangle' && shapePreview.value) {
    ctx.strokeStyle = props.color
    ctx.lineWidth = props.size * scale
    ctx.globalAlpha = props.opacity
    ctx.strokeRect(
      shapePreview.value.x * scale,
      shapePreview.value.y * scale,
      shapePreview.value.width * scale,
      shapePreview.value.height * scale
    )
  } else if (tool === 'line' && currentPoints.value.length >= 2) {
    const start = currentPoints.value[0]
    const end = currentPoints.value[currentPoints.value.length - 1]
    ctx.strokeStyle = props.color
    ctx.lineWidth = props.size * scale
    ctx.globalAlpha = props.opacity
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(start.x * scale, start.y * scale)
    ctx.lineTo(end.x * scale, end.y * scale)
    ctx.stroke()
  } else if (tool === 'circle' && shapePreview.value) {
    ctx.strokeStyle = props.color
    ctx.lineWidth = props.size * scale
    ctx.globalAlpha = props.opacity
    const centerX = shapePreview.value.x * scale + (shapePreview.value.width * scale) / 2
    const centerY = shapePreview.value.y * scale + (shapePreview.value.height * scale) / 2
    ctx.beginPath()
    ctx.ellipse(
      centerX,
      centerY,
      (shapePreview.value.width * scale) / 2,
      (shapePreview.value.height * scale) / 2,
      0,
      0,
      Math.PI * 2
    )
    ctx.stroke()
  } else {
    ctx.restore()
    clearPreviewCanvas()
    return
  }

  ctx.restore()
  flushPreviewCanvas()
  advanceBuffer()
}

// Computed
const currentTool = computed(() => props.tool)

const stageConfig = computed(() => ({
  width: props.width * props.zoom,
  height: props.height * props.zoom,
  scaleX: props.zoom,
  scaleY: props.zoom,
}))

const backgroundConfig = computed(() => ({
  x: 0,
  y: 0,
  width: props.width,
  height: props.height,
  fill: '#ffffff',
  name: 'background',
}))

// F29-STEALTH: strokes/assets computed defined at top of script
// Removed duplicate declaration here

// Current stroke preview config
const currentStrokeConfig = computed(() => {
  if (currentPoints.value.length < 2) return {}
  
  const strokePath = getSvgPathFromStroke(
    getStroke(currentPoints.value.map(p => [p.x, p.y]), {
      size: props.size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    })
  )
  
  return {
    data: strokePath,
    fill: props.color,
    opacity: props.tool === 'highlighter' ? 0.4 : props.opacity,
    globalCompositeOperation: props.tool === 'highlighter' ? 'multiply' : 'source-over',
  }
})

const shapePreviewConfig = computed(() => {
  if (!shapePreview.value) return {}
  return {
    x: shapePreview.value.x,
    y: shapePreview.value.y,
    width: shapePreview.value.width,
    height: shapePreview.value.height,
    stroke: props.color,
    strokeWidth: props.size,
    fill: 'transparent',
    dash: [5, 5],
  }
})

const linePreviewConfig = computed(() => {
  if (!shapePreview.value || currentPoints.value.length < 2) return {}
  const start = currentPoints.value[0]
  const end = currentPoints.value[currentPoints.value.length - 1]
  return {
    points: [start.x, start.y, end.x, end.y],
    stroke: props.color,
    strokeWidth: props.size,
    lineCap: 'round',
    lineJoin: 'round',
  }
})

const circlePreviewConfig = computed(() => {
  if (!shapePreview.value) return {}
  return {
    x: shapePreview.value.x + shapePreview.value.width / 2,
    y: shapePreview.value.y + shapePreview.value.height / 2,
    radiusX: shapePreview.value.width / 2,
    radiusY: shapePreview.value.height / 2,
    stroke: props.color,
    strokeWidth: props.size,
    fill: 'transparent',
    dash: [5, 5],
  }
})

const transformerConfig = computed(() => ({
  anchorSize: 8,
  borderStroke: '#2563eb',
  anchorStroke: '#2563eb',
  anchorFill: '#ffffff',
  rotateEnabled: true,
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
}))

const textEditStyle = computed(() => {
  if (!editingText.value) return {}
  const stroke = editingText.value
  return {
    left: `${stroke.points[0].x * props.zoom}px`,
    top: `${stroke.points[0].y * props.zoom}px`,
    fontSize: `${(stroke.size || 16) * props.zoom}px`,
    color: stroke.color,
  }
})

// Methods
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getPointerPosition(): Point | null {
  const stage = stageRef.value?.getStage()
  if (!stage) return null
  const pos = stage.getPointerPosition()
  if (!pos) return null
  return {
    x: pos.x / props.zoom,
    y: pos.y / props.zoom,
    t: Date.now(),
  }
}

function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  // F29-STEALTH: Record pointer event timestamp for input latency metrics
  recordPointerEvent(performance.now())
  
  const pos = getPointerPosition()
  if (!pos) return

  // Selection mode
  if (currentTool.value === 'select') {
    const target = e.target
    if (target === stageRef.value?.getStage() || target.name() === 'background') {
      selectedNode.value = null
      emit('select', null)
    }
    return
  }

  // Eraser mode - start erasing and set isDrawing for drag
  if (currentTool.value === 'eraser') {
    setIsPointerInputActive(true)
    isDrawing.value = true
    handleErase(pos)
    return
  }

  // Text tool - create text on click
  if (currentTool.value === 'text') {
    createTextAtPosition(pos)
    return
  }

  // Start drawing
  setIsPointerInputActive(true)
  isDrawing.value = true
  isActiveDrawing.value = true // F29-AS.26: Enable input pipeline guard
  currentPoints.value = [pos]
  
  if (currentTool.value === 'rectangle' || currentTool.value === 'line' || currentTool.value === 'circle') {
    shapePreview.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  }

  // F29-AS.19: Freeze hit graph during drawing for performance
  freezeHitGraph(true)

  drawPreviewCanvas()
}

function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  // F29-STEALTH: Record pointer event timestamp for input latency metrics
  recordPointerEvent(performance.now())

  const cursorPos = getPointerPosition()
  if (cursorPos) {
    emit('cursor-move', {
      x: cursorPos.x,
      y: cursorPos.y,
      tool: currentTool.value,
      color: props.color,
    })
  }
  
  if (!isDrawing.value) return
  
  const pos = getPointerPosition()
  if (!pos) return

  // Eraser drag
  if (currentTool.value === 'eraser') {
    handleErase(pos)
    return
  }

  // Drawing tools
  if (currentTool.value === 'pen' || currentTool.value === 'highlighter') {
    currentPoints.value = [...currentPoints.value, pos]
  } else if (currentTool.value === 'rectangle' || currentTool.value === 'line' || currentTool.value === 'circle') {
    const start = currentPoints.value[0]
    shapePreview.value = {
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      width: Math.abs(pos.x - start.x),
      height: Math.abs(pos.y - start.y),
    }
    currentPoints.value = [start, pos]
  }

  drawPreviewCanvas()
}

function handleMouseUp(): void {
  if (!isDrawing.value) return
  isDrawing.value = false
  isActiveDrawing.value = false // F29-AS.26: Disable input pipeline guard

  // F29-STABLE: input ended, allow idle-save scheduling
  setIsPointerInputActive(false)

  // F29-AS.19: Unfreeze hit graph after drawing
  freezeHitGraph(false)

  if (currentPoints.value.length < 2) {
    currentPoints.value = []
    shapePreview.value = null
    return
  }

  // Create stroke
  const stroke: Stroke = {
    id: generateId(),
    tool: currentTool.value as Stroke['tool'],
    color: props.color,
    size: props.size,
    opacity: currentTool.value === 'highlighter' ? 0.4 : props.opacity,
    points: [...currentPoints.value],
  }

  if ((currentTool.value === 'rectangle' || currentTool.value === 'circle') && shapePreview.value) {
    stroke.width = shapePreview.value.width
    stroke.height = shapePreview.value.height
    stroke.points = [{ x: shapePreview.value.x, y: shapePreview.value.y, t: Date.now() }]
  }

  emit('stroke-add', stroke)
  
  // Reset
  currentPoints.value = []
  shapePreview.value = null

  // Ensure the committed stroke is rendered before removing the preview overlay.
  // Otherwise the user can see a brief gap where the preview disappears but
  // the Konva layer hasn't painted the new node yet.
  void nextTick(() => {
    const stage = stageRef.value?.getStage?.()
    stage?.batchDraw()
    requestAnimationFrame(() => {
      clearPreviewCanvas()
    })
  })
}

function handleErase(pos: Point): void {
  const eraserRadius = Math.max(props.size * 2, 10) // Minimum 10px radius
  
  // Find strokes to erase
  for (const stroke of strokes.value) {
    // For shapes (rectangle, circle), check bounding box
    if (stroke.tool === 'rectangle' || stroke.tool === 'circle') {
      const sx = stroke.points[0]?.x || 0
      const sy = stroke.points[0]?.y || 0
      const sw = stroke.width || 0
      const sh = stroke.height || 0
      
      if (pos.x >= sx - eraserRadius && pos.x <= sx + sw + eraserRadius &&
          pos.y >= sy - eraserRadius && pos.y <= sy + sh + eraserRadius) {
        emit('stroke-delete', stroke.id)
        continue
      }
    }
    
    // For pen/highlighter/line, check points
    for (const point of stroke.points) {
      const dist = Math.sqrt(Math.pow(point.x - pos.x, 2) + Math.pow(point.y - pos.y, 2))
      if (dist < eraserRadius + stroke.size) {
        emit('stroke-delete', stroke.id)
        break
      }
    }
  }
}

function createTextAtPosition(pos: Point): void {
  console.log('[BoardCanvas] createTextAtPosition called', { pos, tool: currentTool.value })
  
  const stroke: Stroke = {
    id: generateId(),
    tool: 'text',
    color: props.color,
    size: 16,
    opacity: 1,
    points: [pos],
    text: '',
  }
  
  console.log('[BoardCanvas] Setting editingText', stroke)
  editingText.value = stroke
  editingTextValue.value = ''
  setIsTextEditingActive(true)
  
  console.log('[BoardCanvas] editingText.value after set:', editingText.value)
  
  // Use double nextTick to ensure DOM is fully updated
  nextTick(() => {
    console.log('[BoardCanvas] First nextTick - editingText:', editingText.value)
    nextTick(() => {
      console.log('[BoardCanvas] Second nextTick - textareaRef:', textareaRef.value)
      console.log('[BoardCanvas] Focusing textarea', textareaRef.value)
      if (textareaRef.value) {
        textareaRef.value.focus()
        // Ensure textarea is visible by scrolling into view if needed
        textareaRef.value.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      } else {
        console.error('[BoardCanvas] textareaRef.value is null!')
      }
    })
  })
}

function handleTextEdit(stroke: Stroke): void {
  editingText.value = stroke
  editingTextValue.value = stroke.text || ''
  setIsTextEditingActive(true)
  
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function finishTextEdit(): void {
  if (!editingText.value) return
  
  const stroke = {
    ...editingText.value,
    text: editingTextValue.value,
  }
  
  if (editingTextValue.value.trim()) {
    if (editingText.value.text === undefined) {
      emit('stroke-add', stroke)
    } else {
      emit('stroke-update', stroke)
    }
  }
  
  editingText.value = null
  editingTextValue.value = ''
  setIsTextEditingActive(false)
}

function handlePaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (blob) {
        const objectUrl = URL.createObjectURL(blob)
        const img = new Image()
        img.onload = () => {
          // Scale preview if too large
          let w = img.width
          let h = img.height
          const maxSize = Math.min(props.width * 0.8, 4096)

          if (w > maxSize || h > maxSize) {
            const scale = maxSize / Math.max(w, h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }

          const asset: Asset = {
            id: generateId(),
            type: 'image',
            src: objectUrl,
            x: (props.width - w) / 2,
            y: 100,
            w,
            h,
            rotation: 0,
          }

          emit('asset-add', asset, blob)
        }
        img.onerror = () => {
          try {
            URL.revokeObjectURL(objectUrl)
          } catch {
            // ignore
          }
        }
        img.src = objectUrl
      }
      break
    }
  }
}

function handleKeydown(e: KeyboardEvent): void {
  // Delete selected
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode.value) {
    e.preventDefault()
    const nodeId = selectedNode.value.id()
    const nodeName = selectedNode.value.name() || ''
    
    if (nodeName.startsWith('stroke-')) {
      emit('stroke-delete', nodeId)
    } else if (nodeName.startsWith('asset-')) {
      emit('asset-delete', nodeId)
    }
    
    selectedNode.value = null
    // Clear transformer
    const transformer = transformerRef.value?.getNode()
    if (transformer) {
      transformer.nodes([])
    }
  }
}

function handleAssetDragEnd(asset: Asset, e: Konva.KonvaEventObject<DragEvent>): void {
  const node = e.target
  emit('asset-update', {
    ...asset,
    x: node.x(),
    y: node.y(),
  })
}

// Stroke selection and drag handlers
function handleStrokeClick(stroke: Stroke, e: Konva.KonvaEventObject<MouseEvent>): void {
  if (currentTool.value !== 'select') return
  if (isSaveWindowActive() || isRenderGuardActive()) return
  
  e.cancelBubble = true
  selectedNode.value = e.target
  emit('select', stroke.id)
  
  // Attach transformer
  nextTick(() => {
    if (isSaveWindowActive() || isRenderGuardActive()) return
    const transformer = transformerRef.value?.getNode()
    if (transformer && e.target) {
      transformer.nodes([e.target])
    }
  })
}

function handleStrokeDragEnd(stroke: Stroke, e: Konva.KonvaEventObject<DragEvent>): void {
  if (currentTool.value !== 'select') return
  
  const node = e.target
  const dx = node.x()
  const dy = node.y()
  
  // Reset node position (we store offset in stroke data)
  node.x(0)
  node.y(0)
  
  // Update stroke points with offset
  const updatedStroke = {
    ...stroke,
    points: stroke.points.map(p => ({
      ...p,
      x: p.x + dx,
      y: p.y + dy,
    })),
  }
  
  emit('stroke-update', updatedStroke)
}

function handleAssetTransformEnd(asset: Asset, e: Konva.KonvaEventObject<Event>): void {
  const node = e.target
  const scaleX = node.scaleX()
  const scaleY = node.scaleY()
  
  node.scaleX(1)
  node.scaleY(1)
  
  emit('asset-update', {
    ...asset,
    x: node.x(),
    y: node.y(),
    w: Math.round(node.width() * scaleX),
    h: Math.round(node.height() * scaleY),
    rotation: node.rotation(),
  })
}

// Asset click handler for selection
function handleAssetClick(asset: Asset, e: Konva.KonvaEventObject<MouseEvent>): void {
  if (currentTool.value !== 'select') return
  if (isSaveWindowActive() || isRenderGuardActive()) return
  
  e.cancelBubble = true
  selectedNode.value = e.target
  emit('select', asset.id)
  
  // Attach transformer
  nextTick(() => {
    if (isSaveWindowActive() || isRenderGuardActive()) return
    const transformer = transformerRef.value?.getNode()
    if (transformer && e.target) {
      transformer.nodes([e.target])
    }
  })
}

// Stroke configs
function getStrokeConfig(stroke: Stroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }

  const selectable = currentTool.value === 'select'
  const last = stroke.points[stroke.points.length - 1]
  const first = stroke.points[0]
  const sig = `${stroke.tool}|${stroke.color}|${stroke.size}|${stroke.opacity}|${selectable ? 1 : 0}|${stroke.points.length}|${first?.x ?? 0},${first?.y ?? 0}|${last?.x ?? 0},${last?.y ?? 0}`
  const cached = strokeConfigCache.get(stroke.id)
  if (cached && cached.sig === sig) {
    return cached.config
  }
  
  const strokePath = getSvgPathFromStroke(
    getStroke(stroke.points.map(p => [p.x, p.y]), {
      size: stroke.size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    })
  )
  
  const config: Record<string, unknown> = {
    id: stroke.id,
    name: `stroke-${stroke.id}`,
    data: strokePath,
    fill: stroke.color,
    opacity: stroke.opacity,
    globalCompositeOperation: stroke.tool === 'highlighter' ? 'multiply' : 'source-over',
    draggable: selectable,
    perfectDrawEnabled: false,
    listening: selectable,
  }

  strokeConfigCache.set(stroke.id, { sig, config })
  return config
}

function getLineConfig(stroke: Stroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }
  const start = stroke.points[0]
  const end = stroke.points[stroke.points.length - 1]
  return {
    id: stroke.id,
    name: `stroke-${stroke.id}`,
    points: [start.x, start.y, end.x, end.y],
    stroke: stroke.color,
    strokeWidth: stroke.size,
    lineCap: 'round',
    lineJoin: 'round',
    opacity: stroke.opacity,
    draggable: currentTool.value === 'select',
    perfectDrawEnabled: false,
    listening: currentTool.value === 'select',
  }
}

function getRectConfig(stroke: Stroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }
  return {
    id: stroke.id,
    name: `stroke-${stroke.id}`,
    x: stroke.points[0].x,
    y: stroke.points[0].y,
    width: stroke.width || 0,
    height: stroke.height || 0,
    stroke: stroke.color,
    strokeWidth: stroke.size,
    fill: 'transparent',
    opacity: stroke.opacity,
    draggable: currentTool.value === 'select',
    perfectDrawEnabled: false,
    listening: currentTool.value === 'select',
  }
}

function getCircleConfig(stroke: Stroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }
  // Center point is stored, width/height are diameters
  return {
    id: stroke.id,
    name: `stroke-${stroke.id}`,
    x: stroke.points[0].x + (stroke.width || 0) / 2,
    y: stroke.points[0].y + (stroke.height || 0) / 2,
    radiusX: (stroke.width || 0) / 2,
    radiusY: (stroke.height || 0) / 2,
    stroke: stroke.color,
    strokeWidth: stroke.size,
    fill: 'transparent',
    opacity: stroke.opacity,
    draggable: currentTool.value === 'select',
    perfectDrawEnabled: false,
    listening: currentTool.value === 'select',
  }
}

function getTextConfig(stroke: Stroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }
  return {
    id: stroke.id,
    name: `stroke-${stroke.id}`,
    x: stroke.points[0].x,
    y: stroke.points[0].y,
    text: stroke.text || '',
    fontSize: stroke.size || 16,
    fill: stroke.color,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    draggable: currentTool.value === 'select',
    perfectDrawEnabled: false,
    listening: currentTool.value === 'select',
  }
}

function getAssetConfig(asset: Asset): Record<string, unknown> {
  if (!loadedImages.has(asset.src)) {
    const image = new Image()
    image.onload = () => {
      loadedImages.set(asset.src, image)
      // F29-CRITICAL-FIX: Konva v10+ auto-redraws on image load
      // No manual batchDraw needed
    }
    image.src = asset.src
  }
  
  return {
    id: asset.id,
    name: `asset-${asset.id}`,
    x: asset.x,
    y: asset.y,
    width: asset.w,
    height: asset.h,
    rotation: asset.rotation,
    image: loadedImages.get(asset.src),
    draggable: currentTool.value === 'select',
    perfectDrawEnabled: false,
    listening: currentTool.value === 'select',
  }
}

// Helper: Convert perfect-freehand output to SVG path
function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''

  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )

  d.push('Z')
  return d.join(' ')
}

// Lifecycle
let persistOnExitHandler: (() => void) | null = null
let visibilityChangeHandler: (() => void) | null = null

onMounted(() => {
  containerRef.value?.focus()

  // F29-STABLE: Provide board store reference for module-level idle-save scheduler
  const boardStore = useBoardStore()
  setStableAutosaveStore(boardStore)

  persistOnExitHandler = () => {
    boardStore.persistOnExit()
  }

  visibilityChangeHandler = () => {
    if (document.visibilityState === 'hidden') {
      persistOnExitHandler?.()
    }
  }

  window.addEventListener('pagehide', persistOnExitHandler)
  document.addEventListener('visibilitychange', visibilityChangeHandler)

  // Register paste listener globally
  document.addEventListener('paste', handlePaste as EventListener)

  // F29-AS.34: Fixed pixelRatio manager
  // Keep Konva.pixelRatio = 1 to prevent line thickness "breathing" between frames/zoom
  // Scale is handled via Stage/viewport transform instead
  if (typeof Konva !== 'undefined') {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    Konva.pixelRatio = Math.min(Math.max(dpr, 1), 2)
  }

  // F29-AS.36: Prewarm glyphs/fonts to avoid first-text freeze
  prewarmFonts()

  nextTick(() => {
    // F29-FLICKER-FIX: Only cache static background layer
    // Do NOT cache dynamic layers (strokes/assets) - causes flicker on updates
    cacheLayer(backgroundLayerRef)
    initPreviewCanvas()
    
    // F29-STEALTH: Initialize snapshot overlay and set stage ref for autosave
    const stage = stageRef.value?.getStage?.()
    if (stage && containerRef.value) {
      setStageRef(stage)
      initSnapshotOverlay(containerRef.value)
    }
  })
})

onUnmounted(() => {
  if (persistOnExitHandler) {
    window.removeEventListener('pagehide', persistOnExitHandler)
    persistOnExitHandler = null
  }
  if (visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', visibilityChangeHandler)
    visibilityChangeHandler = null
  }

  document.removeEventListener('paste', handlePaste as EventListener)
  clearPreviewCanvas()
  currentBitmap?.close?.()
  currentBitmap = null
  offscreenBuffers.length = 0
  previewCtx = null
  
  // F29-STEALTH: Cleanup
  setIsPointerInputActive(false)
  setStageRef(null)
  setStableAutosaveStore(null)
  destroySnapshotOverlay()
})

// F29-FLICKER-FIX: Removed watchers on props.strokes and props.assets
// Watchers with deep:true can trigger during autosave, causing flicker
// Vue will automatically detect changes via Pinia reactivity and update v-for incrementally

watch(
  () => [props.width, props.height, props.zoom],
  () => {
    // F29-FLICKER-FIX: Skip reinit during active drawing
    if (isActiveDrawing.value) return
    initPreviewCanvas()
    drawPreviewCanvas()
  },
  { immediate: false }
)

// Expose stageRef for export
defineExpose({
  getStage: () => stageRef.value?.getStage?.() || null,
})
</script>

<style scoped>
.board-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.remote-cursors {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 50;
}

.remote-cursor {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.remote-cursor__dot {
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.9);
}

.board-canvas {
  background: var(--board-canvas-bg, #f8fafc);
  outline: none;
}

.board-canvas:focus {
  outline: 2px solid var(--color-brand, #2563eb);
  outline-offset: -2px;
}

/* F29-AS.32: Offscreen preview canvas overlay */
.board-preview-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 10;
  /* F29-AS.33: No CSS filters/shadows on canvas */
  filter: none;
  backdrop-filter: none;
  box-shadow: none;
}

.text-edit-overlay {
  position: absolute;
  background: var(--card-bg);
  border: 2px solid var(--color-brand, #2563eb);
  padding: 8px;
  min-width: 150px;
  min-height: 32px;
  resize: none;
  outline: none;
  font-family: system-ui, -apple-system, sans-serif;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border-radius: 4px;
}
</style>
