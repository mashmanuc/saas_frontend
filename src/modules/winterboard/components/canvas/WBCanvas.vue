<template>
  <div
    ref="containerRef"
    class="wb-canvas"
    :class="[cursorClass, { 'wb-canvas--panning': isPanningRef }]"
    tabindex="0"
    @keydown="handleKeydown"
    @dragover.prevent
    @dragenter.prevent
    @drop.prevent="handleDrop"
    @wheel.prevent="handleWheel"
    @mousedown.middle.prevent="handlePanStart"
  >
    <!-- A6.1: Loading spinner while Konva initializes -->
    <div v-if="!konvaReady" class="wb-canvas-loading">
      <div class="wb-canvas-loading__spinner" />
      <span class="wb-canvas-loading__text">Loading canvas...</span>
    </div>

    <v-stage
      v-show="konvaReady"
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
        <!-- A5.2: White base rect (always present) -->
        <v-rect :config="backgroundConfig" />
        <!-- A5.2: PDF background image -->
        <v-image
          v-if="pdfBackgroundConfig"
          :config="pdfBackgroundConfig"
        />
        <!-- A5.2: Grid pattern overlay -->
        <v-group v-if="bgPatternType === 'grid'" :config="{ listening: false }">
          <v-line
            v-for="i in Math.floor(props.width / 40)"
            :key="'gv-' + i"
            :config="{ points: [i * 40, 0, i * 40, props.height], stroke: '#e2e8f0', strokeWidth: 0.5, listening: false }"
          />
          <v-line
            v-for="j in Math.floor(props.height / 40)"
            :key="'gh-' + j"
            :config="{ points: [0, j * 40, props.width, j * 40], stroke: '#e2e8f0', strokeWidth: 0.5, listening: false }"
          />
        </v-group>
        <!-- A5.2: Dots pattern overlay -->
        <v-group v-if="bgPatternType === 'dots'" :config="{ listening: false }">
          <v-circle
            v-for="dot in dotsPattern"
            :key="dot.key"
            :config="{ x: dot.x, y: dot.y, radius: 1.5, fill: '#cbd5e1', listening: false }"
          />
        </v-group>
        <!-- A5.2: Lined pattern overlay -->
        <v-group v-if="bgPatternType === 'lined'" :config="{ listening: false }">
          <v-line
            v-for="k in Math.floor(props.height / 32)"
            :key="'ln-' + k"
            :config="{ points: [0, k * 32, props.width, k * 32], stroke: '#93c5fd', strokeWidth: 0.5, listening: false }"
          />
        </v-group>
      </v-layer>

      <!-- Assets layer (images) — BELOW strokes -->
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

      <!-- Strokes layer — ABOVE images -->
      <v-layer ref="strokesLayerRef">
        <template v-for="stroke in strokes" :key="stroke.id">
          <!-- Pen / Highlighter -->
          <v-path
            v-if="stroke.tool === 'pen' || stroke.tool === 'highlighter'"
            :config="getStrokeConfig(stroke)"
            @click="handleStrokeClick(stroke, $event)"
            @dragend="handleStrokeDragEnd(stroke, $event)"
          />
          <!-- Line -->
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

      <!-- A4.2: Dedicated preview layer for shape previews during drawing -->
      <v-layer ref="previewLayerRef" :config="{ listening: false, clearBeforeDraw: true }">
        <!-- Rectangle preview -->
        <v-rect
          v-if="konvaShapePreview.type === 'rectangle'"
          :config="konvaShapePreview.config"
        />
        <!-- Circle preview -->
        <v-ellipse
          v-if="konvaShapePreview.type === 'circle'"
          :config="konvaShapePreview.config"
        />
        <!-- Line preview -->
        <v-line
          v-if="konvaShapePreview.type === 'line'"
          :config="konvaShapePreview.config"
        />
      </v-layer>

      <!-- UI layer (transformer) -->
      <v-layer ref="uiLayerRef">
        <v-transformer
          v-if="selectedNode"
          ref="transformerRef"
          :config="transformerConfig"
        />
      </v-layer>
    </v-stage>

    <!-- Offscreen preview canvas overlay -->
    <canvas ref="previewCanvasRef" class="wb-preview-canvas" />

    <!-- Text editing overlay -->
    <textarea
      v-show="editingText"
      ref="textareaRef"
      v-model="editingTextValue"
      class="wb-text-edit-overlay"
      :style="textEditStyle"
      @blur="finishTextEdit"
      @keydown.enter.exact="finishTextEdit"
    />
  </div>
</template>

<script setup lang="ts">
// WB: WBCanvas — main Konva canvas component for Winterboard
// Ref: ARCHITECTURE.md ADR-01, BoardCanvas.vue (classroom reference)
// Stripped of: classroom session linking, stealth autosave, save window guards, presence cursors

import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Konva from 'konva'
import getStroke from 'perfect-freehand'
import type { WBStroke, WBAsset, WBToolType, WBPoint, WBPageBackground, WBPdfBackground } from '../../types/winterboard'
import { useImageCache } from '../../composables/useImageCache'
import { getSmoothedPoints, clearSmoothedCache } from '../../engine/smoothing'
import { handleDrop as imageHandleDrop, handlePaste as imageHandlePaste } from '../../composables/useImageUpload'
import { loadKonva } from '../../engine/konvaLoader'
import { WBSpatialIndex } from '../../engine/spatialIndex'
import {
  snapZoom,
  zoomToCursor,
  fitToPage,
  pinchDistance,
  pinchCenter,
  ZOOM_WHEEL_STEP,
  ZOOM_MIN,
  ZOOM_MAX,
} from '../../engine/zoomPan'

// A3.3: Performance benchmark flag — set to true in dev to see console.time markers
const __DEV_PERF__ = import.meta.env.DEV && import.meta.env.VITE_WB_PERF === 'true'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  tool?: WBToolType
  color?: string
  size?: number
  opacity?: number
  strokes?: WBStroke[]
  assets?: WBAsset[]
  width?: number
  height?: number
  zoom?: number
  /** A5.2: Page background — 'white' | 'grid' | 'dots' | 'lined' | WBPdfBackground */
  background?: WBPageBackground
}

const props = withDefaults(defineProps<Props>(), {
  tool: 'pen',
  color: '#1e293b',
  size: 2,
  opacity: 1,
  width: 1920,
  height: 1080,
  zoom: 1,
  background: 'white',
})

// Stable references — use props directly, fallback to empty array only once
const allStrokes = computed(() => props.strokes ?? [])
const assets = computed(() => props.assets ?? [])

// A6.2: Spatial index for viewport culling (replaces A3.3 inline filter)
const spatialIndex = new WBSpatialIndex(500)

// A6.2: Virtual rendering — spatial index query for visible strokes
// 7.A2: viewport origin uses scroll offset so culling works when panned
const strokes = computed(() => {
  const all = allStrokes.value
  if (all.length <= LAZY_RENDER_THRESHOLD) return all

  // Viewport bounds in canvas coordinates (account for scroll offset)
  const vw = props.width / props.zoom
  const vh = props.height / props.zoom
  const vx = (containerRef.value?.scrollLeft ?? 0) / props.zoom
  const vy = (containerRef.value?.scrollTop ?? 0) / props.zoom

  const visibleIds = spatialIndex.query({ x: vx, y: vy, w: vw, h: vh })

  return all.filter((s) => visibleIds.has(s.id))
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'stroke-add': [stroke: WBStroke]
  'stroke-update': [stroke: WBStroke]
  'stroke-delete': [strokeId: string]
  'asset-add': [asset: WBAsset]
  'asset-update': [asset: WBAsset]
  'asset-delete': [assetId: string]
  'select': [id: string | null]
  'cursor-move': [payload: { x: number; y: number; tool: WBToolType; color: string }]
  // A5.3: Zoom/pan events
  'zoom-change': [zoom: number]
  'scroll-change': [scrollX: number, scrollY: number]
  'fit-to-page': []
}>()

// ─── Refs ───────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<InstanceType<typeof Konva.Stage> | null>(null)
const backgroundLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const strokesLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const assetsLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const previewLayerRef = ref<{ getNode: () => Konva.Layer } | null>(null)
const uiLayerRef = ref(null)
const previewCanvasRef = ref<HTMLCanvasElement | null>(null)
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// ─── State ──────────────────────────────────────────────────────────────────

// A6.1: Loading state — true after Konva is ready
const konvaReady = ref(false)

// A6.3: Container dimensions for responsive sizing
const containerWidth = ref(0)
const containerHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

const isDrawing = ref(false)
const currentPoints = ref<WBPoint[]>([])

// A4.1: Pressure sensitivity — track last native PointerEvent for pressure capture
let lastNativePointerEvent: PointerEvent | null = null
let currentPointerType: string = 'mouse'
const shapePreview = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const selectedNode = ref<Konva.Node | null>(null)
const editingText = ref<WBStroke | null>(null)
const editingTextValue = ref('')
const loadedImages = reactive<Map<string, HTMLImageElement>>(new Map())

// Stroke config cache for performance (R10)
const strokeConfigCache = new Map<string, { sig: string; config: Record<string, unknown> }>()

// rAF scheduling for preview canvas (A3.3)
let previewRafId: number | null = null

// A5.2: Image cache for PDF background images
const bgImageCache = useImageCache(() => {
  // Force Konva redraw when background image loads
  backgroundLayerRef.value?.getNode?.()?.batchDraw?.()
})

// A5.3: Pan state (middle mouse drag)
let isPanning = false
let panStartX = 0
let panStartY = 0
let panScrollStartX = 0
let panScrollStartY = 0

// A5.3: Pinch-to-zoom state
let isPinching = false
let pinchStartDist = 0
let pinchStartZoom = 1
let pinchCenterX = 0
let pinchCenterY = 0

// A5.3: Double-tap detection
let lastTapTime = 0
const DOUBLE_TAP_THRESHOLD_MS = 300

// A5.3: Smooth zoom animation
let zoomAnimFrameId: number | null = null
let zoomAnimTarget = 1
let zoomAnimCurrent = 1
let zoomAnimStartTime = 0

// Lazy rendering threshold (A3.3: >500 strokes → viewport culling)
const LAZY_RENDER_THRESHOLD = 500

// ─── Computed ───────────────────────────────────────────────────────────────

const currentTool = computed(() => props.tool)

const cursorClass = computed(() => {
  switch (props.tool) {
    case 'eraser': return 'wb-canvas--eraser'
    case 'text': return 'wb-canvas--text'
    case 'select': return 'wb-canvas--select'
    default: return 'wb-canvas--drawing'
  }
})

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

// A5.2: PDF background image config
const pdfBackgroundConfig = computed<Record<string, unknown> | null>(() => {
  const bg = props.background
  if (!bg || typeof bg === 'string') return null
  if (bg.type !== 'pdf') return null

  const img = bgImageCache.get(bg.url)
  if (!img) return null

  return {
    x: 0,
    y: 0,
    width: props.width,
    height: props.height,
    image: img,
    listening: false,
    name: 'pdf-background',
  }
})

// A5.2: Background pattern type helper
const bgPatternType = computed<string>(() => {
  const bg = props.background
  if (!bg) return 'white'
  if (typeof bg === 'string') return bg
  return bg.type
})

// A5.2: PDF background loading state
const pdfBgLoading = computed<boolean>(() => {
  const bg = props.background
  if (!bg || typeof bg === 'string') return false
  if (bg.type !== 'pdf') return false
  return bgImageCache.getState(bg.url) === 'loading'
})

const pdfBgError = computed<boolean>(() => {
  const bg = props.background
  if (!bg || typeof bg === 'string') return false
  if (bg.type !== 'pdf') return false
  return bgImageCache.isBroken(bg.url)
})

// A5.2: Dots pattern — precomputed array for template v-for
const dotsPattern = computed(() => {
  const spacing = 40
  const dots: Array<{ key: string; x: number; y: number }> = []
  const cols = Math.floor(props.width / spacing)
  const rows = Math.floor(props.height / spacing)
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      dots.push({ key: `d-${r}-${c}`, x: c * spacing, y: r * spacing })
    }
  }
  return dots
})

// A4.2: Konva shape preview config for dedicated preview layer
const konvaShapePreview = computed<{ type: string; config: Record<string, unknown> }>(() => {
  if (!isDrawing.value || !shapePreview.value) return { type: '', config: {} }

  const tool = currentTool.value
  const sp = shapePreview.value

  if (tool === 'rectangle') {
    return {
      type: 'rectangle',
      config: {
        x: sp.x,
        y: sp.y,
        width: sp.width,
        height: sp.height,
        stroke: props.color,
        strokeWidth: props.size,
        fill: 'transparent',
        opacity: props.opacity,
        perfectDrawEnabled: false,
        listening: false,
      },
    }
  }

  if (tool === 'circle') {
    return {
      type: 'circle',
      config: {
        x: sp.x + sp.width / 2,
        y: sp.y + sp.height / 2,
        radiusX: sp.width / 2,
        radiusY: sp.height / 2,
        stroke: props.color,
        strokeWidth: props.size,
        fill: 'transparent',
        opacity: props.opacity,
        perfectDrawEnabled: false,
        listening: false,
      },
    }
  }

  if (tool === 'line' && currentPoints.value.length >= 2) {
    const start = currentPoints.value[0]
    const end = currentPoints.value[currentPoints.value.length - 1]
    return {
      type: 'line',
      config: {
        points: [start.x, start.y, end.x, end.y],
        stroke: props.color,
        strokeWidth: props.size,
        lineCap: 'round',
        lineJoin: 'round',
        opacity: props.opacity,
        perfectDrawEnabled: false,
        listening: false,
      },
    }
  }

  return { type: '', config: {} }
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * A4.1: Check if stroke points contain real pressure data (not all default 0.5).
 * Used to decide whether perfect-freehand should simulatePressure.
 */
function hasPressureData(points: WBPoint[]): boolean {
  if (points.length === 0) return false
  return points.some((p) => p.pressure !== undefined && p.pressure !== 0.5)
}

function getPointerPosition(): WBPoint | null {
  const stage = stageRef.value?.getStage()
  if (!stage) return null
  const pos = stage.getPointerPosition()
  if (!pos) return null

  // A4.1: Capture pressure from native PointerEvent
  let pressure = 0.5 // default for mouse
  if (lastNativePointerEvent) {
    const pe = lastNativePointerEvent
    currentPointerType = pe.pointerType || 'mouse'
    if (pe.pointerType === 'pen') {
      // Stylus: real pressure (0.0-1.0)
      pressure = pe.pressure > 0 ? pe.pressure : 0.5
    } else if (pe.pointerType === 'touch') {
      // Touch: use force if available, otherwise default
      pressure = pe.pressure > 0 ? pe.pressure : 0.5
    }
    // Mouse: always 0.5
  }

  return {
    x: pos.x / props.zoom,
    y: pos.y / props.zoom,
    t: Date.now(),
    pressure,
  }
}

/** Convert perfect-freehand output to SVG path */
function getSvgPathFromStroke(strokePoints: number[][]): string {
  if (!strokePoints.length) return ''
  const d = strokePoints.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...strokePoints[0], 'Q'] as (string | number)[],
  )
  d.push('Z')
  return d.join(' ')
}

// ─── Hit Graph Freeze (R10: performance during drawing) ─────────────────────

function freezeHitGraph(freeze: boolean): void {
  const layers = [strokesLayerRef, assetsLayerRef]
  for (const layerRef of layers) {
    const konvaLayer = layerRef.value?.getNode?.()
    if (!konvaLayer) continue
    try {
      konvaLayer.listening(!freeze)
    } catch (error) {
      console.warn('[WB:Canvas] freezeHitGraph failed', error)
    }
  }
}

// A4.2: Prevent main strokes layer from re-rendering during active drawing.
// We cache the layer and toggle its `visible` or skip batchDraw calls.
// Instead of hiding the layer (which would flash), we simply avoid triggering
// unnecessary redraws by using batchDraw only on mouseUp.
let mainLayerFrozen = false

function freezeMainLayerRendering(freeze: boolean): void {
  mainLayerFrozen = freeze
  // When unfreezing, schedule a single batchDraw to sync the layer
  if (!freeze) {
    const strokesLayer = strokesLayerRef.value?.getNode?.()
    if (strokesLayer) strokesLayer.batchDraw()
    const assetsLayer = assetsLayerRef.value?.getNode?.()
    if (assetsLayer) assetsLayer.batchDraw()
  }
}

// ─── Preview Canvas (offscreen double-buffer) ───────────────────────────────

interface CanvasBuffer {
  canvas: OffscreenCanvas | HTMLCanvasElement
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
}

const supportsOffscreenCanvas =
  typeof window !== 'undefined' && typeof OffscreenCanvas !== 'undefined'
const isSafari =
  typeof navigator !== 'undefined' && /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

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

function initPreviewCanvas(): void {
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
    if (buffer) offscreenBuffers.push(buffer)
  }
  clearPreviewCanvas()
}

function getActiveBuffer(): CanvasBuffer | null {
  return offscreenBuffers[activeBufferIndex] ?? null
}

function advanceBuffer(): void {
  if (!offscreenBuffers.length) return
  activeBufferIndex = (activeBufferIndex + 1) % offscreenBuffers.length
}

function clearPreviewCanvas(): void {
  const { width, height } = getStagePixelSize()
  previewCtx?.clearRect(0, 0, width, height)
}

function flushPreviewCanvas(): void {
  if (!previewCtx) return
  const activeBuffer = getActiveBuffer()
  if (!activeBuffer) return

  const { width, height } = getStagePixelSize()
  previewCtx.clearRect(0, 0, width, height)

  if (
    !isSafari &&
    supportsOffscreenCanvas &&
    activeBuffer.canvas instanceof OffscreenCanvas &&
    'transferToImageBitmap' in activeBuffer.canvas
  ) {
    const bitmap = activeBuffer.canvas.transferToImageBitmap()
    currentBitmap?.close()
    currentBitmap = bitmap
    previewCtx.drawImage(bitmap, 0, 0, width, height)
  } else {
    previewCtx.drawImage(activeBuffer.canvas, 0, 0, width, height)
  }
}

/** Schedule preview draw via requestAnimationFrame (A3.3: avoid redundant draws) */
function schedulePreviewDraw(): void {
  if (previewRafId !== null) return
  previewRafId = requestAnimationFrame(() => {
    previewRafId = null
    drawPreviewCanvas()
  })
}

function drawPreviewCanvas(): void {
  if (__DEV_PERF__) console.time('[WB:Perf] drawPreview')
  const buffer = getActiveBuffer()
  if (!isDrawing.value || !buffer || !previewCtx) {
    clearPreviewCanvas()
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
    return
  }

  const tool = currentTool.value

  // A4.2: Shape previews (rect/circle/line) now use dedicated Konva preview layer
  // via konvaShapePreview computed — only pen/highlighter need Canvas2D preview
  if (tool === 'rectangle' || tool === 'line' || tool === 'circle') {
    // Konva preview layer handles these via reactive computed — just batchDraw it
    const previewLayer = previewLayerRef.value?.getNode?.()
    if (previewLayer) previewLayer.batchDraw()
    clearPreviewCanvas()
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
    return
  }

  if (tool !== 'pen' && tool !== 'highlighter') {
    clearPreviewCanvas()
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
    return
  }

  if (currentPoints.value.length < 2) {
    clearPreviewCanvas()
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
    return
  }

  const { width, height } = getStagePixelSize()
  const ctx = buffer.ctx
  ctx.save()
  ctx.clearRect(0, 0, width, height)

  const scale = props.zoom

  // A4.1: Apply Catmull-Rom smoothing to live preview (pen/highlighter only)
  const smoothed = currentPoints.value.length >= 4
    ? getSmoothedPoints('__preview__', tool, currentPoints.value)
    : currentPoints.value
  // A4.1: Pass pressure as triplets [x, y, pressure] to perfect-freehand
  const scaledPoints = smoothed.map((p) => [
    p.x * scale,
    p.y * scale,
    p.pressure ?? 0.5,
  ] as [number, number, number])
  const strokePath = getSvgPathFromStroke(
    getStroke(scaledPoints, {
      size: props.size * scale,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
      simulatePressure: !hasPressureData(currentPoints.value),
    }),
  )
  const path = new Path2D(strokePath)
  ctx.fillStyle = props.color
  ctx.globalAlpha = tool === 'highlighter' ? 0.4 : props.opacity
  ctx.globalCompositeOperation = tool === 'highlighter' ? 'multiply' : 'source-over'
  ctx.fill(path)

  ctx.restore()
  flushPreviewCanvas()
  advanceBuffer()
  if (__DEV_PERF__) console.timeEnd('[WB:Perf] drawPreview')
}

// ─── Event Handlers ─────────────────────────────────────────────────────────

function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  const pos = getPointerPosition()
  if (!pos) return

  // Selection mode
  if (currentTool.value === 'select') {
    const target = e.target
    if (target === stageRef.value?.getStage() || target.name() === 'background') {
      clearSelection()
    }
    return
  }

  // Eraser mode
  if (currentTool.value === 'eraser') {
    isDrawing.value = true
    handleErase(pos)
    return
  }

  // Text tool
  if (currentTool.value === 'text') {
    createTextAtPosition(pos)
    return
  }

  // Start drawing
  isDrawing.value = true
  currentPoints.value = [pos]

  if (currentTool.value === 'rectangle' || currentTool.value === 'line' || currentTool.value === 'circle') {
    shapePreview.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  }

  // R10: Freeze hit graph during drawing for performance
  freezeHitGraph(true)
  // A4.2: Freeze main layer rendering during drawing
  freezeMainLayerRendering(true)
  schedulePreviewDraw()
}

function handleMouseMove(_e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
  const pos = getPointerPosition()
  if (!pos) return

  // 7.A1: Emit cursor position for presence (always, even when not drawing)
  emit('cursor-move', {
    x: pos.x,
    y: pos.y,
    tool: currentTool.value,
    color: props.color,
  })

  if (!isDrawing.value) return

  // Eraser drag
  if (currentTool.value === 'eraser') {
    handleErase(pos)
    return
  }

  // Drawing tools
  if (currentTool.value === 'pen' || currentTool.value === 'highlighter') {
    // Min distance filter to reduce noise (LAW-15: drawing fidelity)
    const lastPt = currentPoints.value[currentPoints.value.length - 1]
    if (lastPt) {
      const dx = pos.x - lastPt.x
      const dy = pos.y - lastPt.y
      if (dx * dx + dy * dy < 1) return // skip sub-pixel moves
    }
    currentPoints.value = [...currentPoints.value, pos]
  } else if (
    currentTool.value === 'rectangle' ||
    currentTool.value === 'line' ||
    currentTool.value === 'circle'
  ) {
    const start = currentPoints.value[0]
    shapePreview.value = {
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      width: Math.abs(pos.x - start.x),
      height: Math.abs(pos.y - start.y),
    }
    currentPoints.value = [start, pos]
  }

  schedulePreviewDraw()
}

function handleMouseUp(): void {
  if (!isDrawing.value) return
  isDrawing.value = false

  // R10: Unfreeze hit graph
  freezeHitGraph(false)
  // A4.2: Unfreeze main layer rendering — triggers single batchDraw
  freezeMainLayerRendering(false)

  if (currentPoints.value.length < 2) {
    currentPoints.value = []
    shapePreview.value = null
    return
  }

  // Create stroke
  const stroke: WBStroke = {
    id: generateId(),
    tool: currentTool.value as WBStroke['tool'],
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

  // Line: keep only start + end points
  if (currentTool.value === 'line' && stroke.points.length >= 2) {
    stroke.points = [stroke.points[0], stroke.points[stroke.points.length - 1]]
  }

  emit('stroke-add', stroke)

  // Reset
  currentPoints.value = []
  shapePreview.value = null

  // A4.2: Use batchDraw (not draw) for efficient composite after stroke finalization
  void nextTick(() => {
    const stage = stageRef.value?.getStage?.()
    stage?.batchDraw()
    requestAnimationFrame(() => {
      clearPreviewCanvas()
      // Clear Konva preview layer shapes
      const previewLayer = previewLayerRef.value?.getNode?.()
      if (previewLayer) previewLayer.batchDraw()
    })
  })
}

function handleErase(pos: WBPoint): void {
  const eraserRadius = Math.max(props.size * 2, 10)
  const toDelete: string[] = []

  // Use allStrokes (not viewport-filtered) so eraser works on all elements
  for (const stroke of allStrokes.value) {
    // Shapes (rectangle, circle): check bounding box
    if (stroke.tool === 'rectangle' || stroke.tool === 'circle') {
      const sx = stroke.points[0]?.x || 0
      const sy = stroke.points[0]?.y || 0
      const sw = stroke.width || 0
      const sh = stroke.height || 0

      if (
        pos.x >= sx - eraserRadius &&
        pos.x <= sx + sw + eraserRadius &&
        pos.y >= sy - eraserRadius &&
        pos.y <= sy + sh + eraserRadius
      ) {
        toDelete.push(stroke.id)
        continue
      }
    }

    // Text: check approximate bounding box (position + estimated size)
    if (stroke.tool === 'text') {
      const tx = stroke.points[0]?.x || 0
      const ty = stroke.points[0]?.y || 0
      const textLen = (stroke.text || '').length
      const estWidth = textLen * (stroke.size || 16) * 0.6
      const estHeight = (stroke.size || 16) * 1.4

      if (
        pos.x >= tx - eraserRadius &&
        pos.x <= tx + estWidth + eraserRadius &&
        pos.y >= ty - eraserRadius &&
        pos.y <= ty + estHeight + eraserRadius
      ) {
        toDelete.push(stroke.id)
        continue
      }
    }

    // Pen/highlighter/line: check points proximity
    let hit = false
    for (const point of stroke.points) {
      const dx = point.x - pos.x
      const dy = point.y - pos.y
      if (dx * dx + dy * dy < (eraserRadius + stroke.size) * (eraserRadius + stroke.size)) {
        hit = true
        break
      }
    }
    if (hit) {
      toDelete.push(stroke.id)
    }
  }

  // Emit deletions (batch to avoid multiple re-renders)
  for (const id of toDelete) {
    emit('stroke-delete', id)
  }
}

function createTextAtPosition(pos: WBPoint): void {
  const stroke: WBStroke = {
    id: generateId(),
    tool: 'text',
    color: props.color,
    size: Math.max(props.size * 4, 16),
    opacity: 1,
    points: [pos],
    text: '',
  }

  editingText.value = stroke
  editingTextValue.value = ''

  nextTick(() => {
    nextTick(() => {
      textareaRef.value?.focus()
    })
  })
}

function handleTextEdit(stroke: WBStroke): void {
  editingText.value = stroke
  editingTextValue.value = stroke.text || ''
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function finishTextEdit(): void {
  if (!editingText.value) return

  const stroke: WBStroke = {
    ...editingText.value,
    text: editingTextValue.value,
  }

  if (editingTextValue.value.trim()) {
    if (editingText.value.text === undefined || editingText.value.text === '') {
      emit('stroke-add', stroke)
    } else {
      emit('stroke-update', stroke)
    }
  }

  editingText.value = null
  editingTextValue.value = ''
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
    const transformer = transformerRef.value?.getNode()
    if (transformer) {
      transformer.nodes([])
    }
  }
}

// A4.3: Image drop handler — uses useImageUpload for validation (5MB, PNG/JPEG/WebP/GIF) + data URL
async function handleDrop(e: DragEvent): Promise<void> {
  // Calculate drop position in canvas coordinates
  let dropX = props.width / 2
  let dropY = 100
  const rect = containerRef.value?.getBoundingClientRect()
  if (rect) {
    dropX = (e.clientX - rect.left) / (props.zoom || 1)
    dropY = (e.clientY - rect.top) / (props.zoom || 1)
  }

  const asset = await imageHandleDrop(e, dropX, dropY)
  if (asset) {
    // Center the asset on the drop point
    asset.x = dropX - asset.w / 2
    asset.y = dropY - asset.h / 2
    // Preload image into loadedImages cache
    preloadAssetImage(asset)
    emit('asset-add', asset)
  }
}

// A4.3: Image paste handler — uses useImageUpload for validation + data URL
function handlePaste(e: Event): void {
  const clipboardEvent = e as ClipboardEvent
  if (!clipboardEvent.clipboardData?.items) return

  // Check if any item is an image
  const hasImage = Array.from(clipboardEvent.clipboardData.items).some(
    (item) => item.kind === 'file' && item.type.startsWith('image/'),
  )
  if (!hasImage) return

  e.preventDefault()
  const centerX = props.width / 2
  const centerY = props.height / 2

  imageHandlePaste(clipboardEvent, centerX, centerY).then((asset) => {
    if (asset) {
      // Center the asset
      asset.x = centerX - asset.w / 2
      asset.y = centerY - asset.h / 2
      preloadAssetImage(asset)
      emit('asset-add', asset)
    }
  }).catch((err) => {
    console.error('[WB:Canvas] Paste image failed:', err)
  })
}

// ─── Selection Handlers ─────────────────────────────────────────────────────

function handleStrokeClick(stroke: WBStroke, e: Konva.KonvaEventObject<MouseEvent>): void {
  if (currentTool.value !== 'select') return
  e.cancelBubble = true
  selectedNode.value = e.target
  emit('select', stroke.id)

  nextTick(() => {
    const transformer = transformerRef.value?.getNode()
    if (transformer && e.target) {
      transformer.nodes([e.target])
    }
  })
}

function handleStrokeDragEnd(stroke: WBStroke, e: Konva.KonvaEventObject<DragEvent>): void {
  if (currentTool.value !== 'select') return

  const node = e.target
  const dx = node.x()
  const dy = node.y()

  // Reset node position — offset stored in stroke data
  node.x(0)
  node.y(0)

  // Shapes store origin in points[0]; pen/highlighter/line offset all points
  const updatedStroke: WBStroke = {
    ...stroke,
    points: stroke.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
  }
  emit('stroke-update', updatedStroke)
}

/** Clear selection and transformer nodes */
function clearSelection(): void {
  selectedNode.value = null
  emit('select', null)
  const transformer = transformerRef.value?.getNode()
  if (transformer) {
    transformer.nodes([])
  }
}

function handleAssetClick(asset: WBAsset, e: Konva.KonvaEventObject<MouseEvent>): void {
  if (currentTool.value !== 'select') return
  e.cancelBubble = true
  selectedNode.value = e.target
  emit('select', asset.id)

  nextTick(() => {
    const transformer = transformerRef.value?.getNode()
    if (transformer && e.target) {
      transformer.nodes([e.target])
    }
  })
}

function handleAssetDragEnd(asset: WBAsset, e: Konva.KonvaEventObject<DragEvent>): void {
  const node = e.target
  emit('asset-update', {
    ...asset,
    x: node.x(),
    y: node.y(),
  })
}

function handleAssetTransformEnd(asset: WBAsset, e: Konva.KonvaEventObject<Event>): void {
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

// ─── Stroke Config Generators ───────────────────────────────────────────────

/** Build cache signature for any stroke */
function buildStrokeSig(stroke: WBStroke, selectable: boolean): string {
  const last = stroke.points[stroke.points.length - 1]
  const first = stroke.points[0]
  return `${stroke.tool}|${stroke.color}|${stroke.size}|${stroke.opacity}|${selectable ? 1 : 0}|${stroke.points.length}|${first?.x ?? 0},${first?.y ?? 0}|${last?.x ?? 0},${last?.y ?? 0}|${stroke.width ?? 0}|${stroke.height ?? 0}|${stroke.text ?? ''}`
}

/** Get cached config or build new one */
function getCachedConfig(stroke: WBStroke, builder: () => Record<string, unknown>): Record<string, unknown> {
  const selectable = currentTool.value === 'select'
  const sig = buildStrokeSig(stroke, selectable)
  const cached = strokeConfigCache.get(stroke.id)
  if (cached && cached.sig === sig) return cached.config
  const config = builder()
  strokeConfigCache.set(stroke.id, { sig, config })
  return config
}

function getStrokeConfig(stroke: WBStroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
    // A4.1: Apply Catmull-Rom smoothing for pen/highlighter (display only, original points stay in store)
    const displayPoints = getSmoothedPoints(stroke.id, stroke.tool, stroke.points)
    // A4.1: Pass pressure triplets for variable-width rendering
    const hasPressure = hasPressureData(stroke.points)
    const strokePath = getSvgPathFromStroke(
      getStroke(
        displayPoints.map((p) => [p.x, p.y, p.pressure ?? 0.5]),
        {
          size: stroke.size,
          thinning: hasPressure ? 0.5 : 0.5,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: !hasPressure,
        },
      ),
    )

    return {
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
  })
}

function getLineConfig(stroke: WBStroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
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
      draggable: selectable,
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

function getRectConfig(stroke: WBStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
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
      draggable: selectable,
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

function getCircleConfig(stroke: WBStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
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
      draggable: selectable,
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

function getTextConfig(stroke: WBStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }

  return getCachedConfig(stroke, () => {
    const selectable = currentTool.value === 'select'
    return {
      id: stroke.id,
      name: `stroke-${stroke.id}`,
      x: stroke.points[0].x,
      y: stroke.points[0].y,
      text: stroke.text || '',
      fontSize: stroke.size || 16,
      fill: stroke.color,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      draggable: selectable,
      perfectDrawEnabled: false,
      listening: selectable,
    }
  })
}

// A4.3: Preload an asset image into the loadedImages cache (for immediate rendering after drop/paste)
function preloadAssetImage(asset: WBAsset): void {
  if (loadedImages.has(asset.src)) return
  const image = new Image()
  // data: URLs don't need crossOrigin; external URLs do
  if (!asset.src.startsWith('data:')) {
    image.crossOrigin = 'anonymous'
  }
  image.onload = () => {
    loadedImages.set(asset.src, image)
    // Trigger Konva re-render so the image appears immediately
    const assetsLayer = assetsLayerRef.value?.getNode?.()
    if (assetsLayer) assetsLayer.batchDraw()
  }
  image.onerror = () => {
    console.warn('[WB:Canvas] Failed to preload asset image:', asset.id)
  }
  image.src = asset.src
}

function getAssetConfig(asset: WBAsset): Record<string, unknown> {
  if (!loadedImages.has(asset.src)) {
    // Lazy-load image on first render
    preloadAssetImage(asset)
  }

  const selectable = currentTool.value === 'select'
  return {
    id: asset.id,
    name: `asset-${asset.id}`,
    x: asset.x,
    y: asset.y,
    width: asset.w,
    height: asset.h,
    rotation: asset.rotation,
    image: loadedImages.get(asset.src),
    draggable: selectable,
    perfectDrawEnabled: false,
    listening: selectable,
  }
}

// ─── Background layer cache ─────────────────────────────────────────────────

function hasRenderableArea(layer: Konva.Layer): boolean {
  const stage = layer.getStage?.()
  if (!stage) return false
  const stageSize = stage.size?.()
  if (!stageSize || stageSize.width <= 0 || stageSize.height <= 0) return false
  const childrenCount = typeof layer.getChildren === 'function' ? layer.getChildren().length : 0
  if (childrenCount === 0) return false
  return true
}

function cacheBackgroundLayer(): void {
  const konvaLayer = backgroundLayerRef.value?.getNode?.()
  if (!konvaLayer) return
  if (!hasRenderableArea(konvaLayer)) return
  try {
    if (!konvaLayer.isCached?.()) {
      konvaLayer.cache()
    }
  } catch (error) {
    console.warn('[WB:Canvas] background layer cache failed', error)
  }
}

// ─── Font prewarm ───────────────────────────────────────────────────────────

function prewarmFonts(): void {
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 50
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const fonts = ['system-ui', '-apple-system', 'sans-serif']
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789АБВГДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгдеєжзиіїйклмнопрстуфхцчшщьюя'

  for (const font of fonts) {
    ctx.font = `16px ${font}`
    ctx.fillText(alphabet, 0, 20)
  }

  canvas.width = 0
  canvas.height = 0
}

// ─── A5.3: Zoom / Pan / Pinch handlers ──────────────────────────────────────

const isPanningRef = ref(false)

/** Ctrl+scroll = zoom to cursor position; plain scroll = vertical pan */
function handleWheel(e: WheelEvent): void {
  if (e.ctrlKey || e.metaKey) {
    // Zoom to cursor
    const rect = containerRef.value?.getBoundingClientRect()
    if (!rect) return

    const cursorX = e.clientX - rect.left
    const cursorY = e.clientY - rect.top
    const delta = -e.deltaY * ZOOM_WHEEL_STEP * 0.1
    const oldZoom = props.zoom
    const rawZoom = oldZoom + delta
    const newZoom = snapZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rawZoom)))

    if (Math.abs(newZoom - oldZoom) < 0.001) return

    const scroll = zoomToCursor(cursorX, cursorY, 0, 0, oldZoom, newZoom)
    emit('zoom-change', newZoom)
    emit('scroll-change', scroll.scrollX, scroll.scrollY)
  }
  // Plain scroll without Ctrl is default browser behavior (prevented by .prevent on template)
  // We could add pan here if needed
}

/** Middle mouse button → start panning */
function handlePanStart(e: MouseEvent): void {
  isPanning = true
  isPanningRef.value = true
  panStartX = e.clientX
  panStartY = e.clientY
  panScrollStartX = 0
  panScrollStartY = 0

  const onPanMove = (ev: MouseEvent) => {
    if (!isPanning) return
    const dx = ev.clientX - panStartX
    const dy = ev.clientY - panStartY
    emit('scroll-change', panScrollStartX - dx, panScrollStartY - dy)
  }

  const onPanEnd = () => {
    isPanning = false
    isPanningRef.value = false
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', onPanEnd)
  }

  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', onPanEnd)
}

/** Touch start — detect pinch (2 fingers) or double-tap */
function handleTouchStartZoom(e: TouchEvent): void {
  if (e.touches.length === 2) {
    // Pinch start
    isPinching = true
    pinchStartDist = pinchDistance(e.touches[0], e.touches[1])
    pinchStartZoom = props.zoom
    const center = pinchCenter(e.touches[0], e.touches[1])
    const rect = containerRef.value?.getBoundingClientRect()
    if (rect) {
      pinchCenterX = center.x - rect.left
      pinchCenterY = center.y - rect.top
    }
    e.preventDefault()
    return
  }

  if (e.touches.length === 1) {
    // Double-tap detection
    const now = Date.now()
    if (now - lastTapTime < DOUBLE_TAP_THRESHOLD_MS) {
      // Double-tap: toggle between 1x and 2x
      e.preventDefault()
      const newZoom = props.zoom < 1.5 ? 2.0 : 1.0
      emit('zoom-change', newZoom)
      lastTapTime = 0
    } else {
      lastTapTime = now
    }
  }
}

/** Touch move — pinch zoom */
function handleTouchMoveZoom(e: TouchEvent): void {
  if (!isPinching || e.touches.length < 2) return
  e.preventDefault()

  const dist = pinchDistance(e.touches[0], e.touches[1])
  const scale = dist / pinchStartDist
  const rawZoom = pinchStartZoom * scale
  const newZoom = snapZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rawZoom)))

  const scroll = zoomToCursor(pinchCenterX, pinchCenterY, 0, 0, props.zoom, newZoom)
  emit('zoom-change', newZoom)
  emit('scroll-change', scroll.scrollX, scroll.scrollY)
}

/** Touch end — stop pinch */
function handleTouchEndZoom(): void {
  isPinching = false
}

/** Fit entire page in viewport */
function handleFitToPage(): void {
  const container = containerRef.value
  if (!container) return
  const zoom = fitToPage(
    props.width,
    props.height,
    container.clientWidth,
    container.clientHeight,
  )
  emit('zoom-change', zoom)
  emit('scroll-change', 0, 0)
}

// ─── Lifecycle ──────────────────────────────────────────────────────────────

onMounted(async () => {
  containerRef.value?.focus()

  // Register paste listener globally
  document.addEventListener('paste', handlePaste as EventListener)

  // A4.1: Capture native PointerEvent for pressure data
  const container = containerRef.value
  if (container) {
    const capturePointer = (e: PointerEvent) => { lastNativePointerEvent = e }
    container.addEventListener('pointerdown', capturePointer)
    container.addEventListener('pointermove', capturePointer)
    container.addEventListener('pointerup', capturePointer)
    // Store refs for cleanup
    ;(container as unknown as Record<string, unknown>).__wbPointerCapture = capturePointer
  }

  // A5.3: Register touch zoom listeners (passive: false for preventDefault)
  if (container) {
    container.addEventListener('touchstart', handleTouchStartZoom, { passive: false })
    container.addEventListener('touchmove', handleTouchMoveZoom, { passive: false })
    container.addEventListener('touchend', handleTouchEndZoom)
  }

  // A6.1: Ensure Konva is loaded (populates singleton cache for konvaLoader)
  await loadKonva()

  // A6.3: ResizeObserver for responsive canvas sizing
  if (containerRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          containerWidth.value = Math.round(width)
          containerHeight.value = Math.round(height)
        }
      }
    })
    resizeObserver.observe(containerRef.value)
  }

  // Konva pixelRatio
  if (typeof Konva !== 'undefined') {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    Konva.pixelRatio = Math.min(Math.max(dpr, 1), 2)
  }

  prewarmFonts()

  // A6.1: Mark canvas as ready after Konva init
  konvaReady.value = true

  nextTick(() => {
    cacheBackgroundLayer()
    initPreviewCanvas()
  })
})

onUnmounted(() => {
  document.removeEventListener('paste', handlePaste as EventListener)
  clearPreviewCanvas()
  currentBitmap?.close?.()
  currentBitmap = null
  offscreenBuffers.length = 0
  previewCtx = null
  // A3.3: Cancel pending rAF
  if (previewRafId !== null) {
    cancelAnimationFrame(previewRafId)
    previewRafId = null
  }
  // A5.3: Cancel zoom animation
  if (zoomAnimFrameId !== null) {
    cancelAnimationFrame(zoomAnimFrameId)
    zoomAnimFrameId = null
  }
  // A4.1: Remove pointer listeners
  const container = containerRef.value
  if (container) {
    const capturePointer = (container as unknown as Record<string, unknown>).__wbPointerCapture as EventListener | undefined
    if (capturePointer) {
      container.removeEventListener('pointerdown', capturePointer)
      container.removeEventListener('pointermove', capturePointer)
      container.removeEventListener('pointerup', capturePointer)
    }
    lastNativePointerEvent = null
  }
  // A5.3: Remove touch listeners
  if (container) {
    container.removeEventListener('touchstart', handleTouchStartZoom)
    container.removeEventListener('touchmove', handleTouchMoveZoom)
    container.removeEventListener('touchend', handleTouchEndZoom)
  }
  // A6.3: Disconnect ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  // A6.2: Clear spatial index
  spatialIndex.clear()
})

watch(
  () => [props.width, props.height, props.zoom],
  () => {
    initPreviewCanvas()
    drawPreviewCanvas()
  },
  { immediate: false },
)

// Auto-deselect when switching away from select tool
watch(
  () => props.tool,
  (newTool) => {
    if (newTool !== 'select' && selectedNode.value) {
      clearSelection()
    }
  },
)

// A6.2: Rebuild spatial index when strokes change
watch(
  allStrokes,
  (newStrokes) => {
    if (__DEV_PERF__) console.time('[WB:Perf] spatialIndex.rebuild')
    spatialIndex.rebuild(newStrokes)
    if (__DEV_PERF__) console.timeEnd('[WB:Perf] spatialIndex.rebuild')
  },
  { immediate: true },
)

// A6.2: Memory cleanup on page switch — clear caches
watch(
  () => props.strokes,
  () => {
    // Clear stroke config cache (stale entries from previous page)
    strokeConfigCache.clear()
    // Clear smoothing cache
    clearSmoothedCache()
    // Clear loaded images for previous page assets
    loadedImages.clear()
  },
)

// ─── Expose ─────────────────────────────────────────────────────────────────

defineExpose({
  getStage: () => stageRef.value?.getStage?.() || null,
  fitToPage: handleFitToPage,
})
</script>

<style scoped>
.wb-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--wb-canvas-bg, #f8fafc);
  outline: none;
  /* A6.3: Prevent browser zoom on canvas — pinch handled by JS */
  touch-action: none;
}

.wb-canvas--eraser {
  cursor: crosshair;
}

.wb-canvas--text {
  cursor: text;
}

.wb-canvas--select {
  cursor: default;
}

.wb-canvas--drawing {
  cursor: crosshair;
}

/* A5.3: Panning cursor */
.wb-canvas--panning {
  cursor: grabbing !important;
}

.wb-canvas:focus {
  outline: 2px solid var(--color-brand, #2563eb);
  outline-offset: -2px;
}

.wb-preview-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 10;
  filter: none;
  backdrop-filter: none;
  box-shadow: none;
}

/* A6.1: Loading spinner */
.wb-canvas-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  z-index: 5;
}

.wb-canvas-loading__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--wb-border, #e2e8f0);
  border-top-color: var(--wb-brand, #2563eb);
  border-radius: 50%;
  animation: wb-spin 0.8s linear infinite;
}

.wb-canvas-loading__text {
  font-size: 0.8125rem;
  color: var(--wb-fg-secondary, #64748b);
}

@keyframes wb-spin {
  to { transform: rotate(360deg); }
}

.wb-text-edit-overlay {
  position: absolute;
  background: white;
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
