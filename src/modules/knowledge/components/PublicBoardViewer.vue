<!-- Phase 13 A2.1: PublicBoardViewer — read-only Konva canvas
     Allows: zoom (scroll/pinch), pan (drag)
     Blocks: drawing, selection, toolbar, text editing, asset upload
     Renders boardState JSON — strokes, assets, text objects
     Receives state via props, NOT through boardStore
     Ref: AGENT_A_FE_CORE.md A2.1 -->
<template>
  <div
    ref="containerRef"
    class="public-board-viewer"
    @wheel.prevent="handleWheel"
  >
    <v-stage
      ref="stageRef"
      :config="stageConfig"
      @mousedown="handlePanStart"
      @mousemove="handlePanMove"
      @mouseup="handlePanEnd"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
    >
      <!-- Background layer -->
      <v-layer>
        <v-rect :config="backgroundConfig" />
      </v-layer>

      <!-- Assets layer -->
      <v-layer>
        <v-image
          v-for="asset in parsedAssets"
          :key="asset.id"
          :config="getAssetConfig(asset)"
        />
      </v-layer>

      <!-- Strokes layer -->
      <v-layer>
        <template v-for="stroke in parsedStrokes" :key="stroke.id">
          <!-- Pen / Highlighter (SVG path via perfect-freehand) -->
          <v-path
            v-if="stroke.tool === 'pen' || stroke.tool === 'highlighter'"
            :config="getPenConfig(stroke)"
          />
          <!-- Line -->
          <v-line
            v-else-if="stroke.tool === 'line'"
            :config="getLineConfig(stroke)"
          />
          <!-- Rectangle -->
          <v-rect
            v-else-if="stroke.tool === 'rectangle'"
            :config="getRectConfig(stroke)"
          />
          <!-- Circle / Ellipse -->
          <v-ellipse
            v-else-if="stroke.tool === 'circle'"
            :config="getCircleConfig(stroke)"
          />
          <!-- Text -->
          <v-text
            v-else-if="stroke.tool === 'text'"
            :config="getTextConfig(stroke)"
          />
        </template>
      </v-layer>
    </v-stage>

    <!-- Page navigation overlay -->
    <div v-if="totalPages > 1" class="public-board-viewer__page-nav">
      <button
        type="button"
        class="public-board-viewer__page-btn"
        :disabled="currentPageIdx <= 0"
        aria-label="Previous page"
        @click="prevPage"
      >&lsaquo;</button>
      <span class="public-board-viewer__page-indicator">{{ currentPageIdx + 1 }} / {{ totalPages }}</span>
      <button
        type="button"
        class="public-board-viewer__page-btn"
        :disabled="currentPageIdx >= totalPages - 1"
        aria-label="Next page"
        @click="nextPage"
      >&rsaquo;</button>
    </div>

    <!-- Zoom controls overlay -->
    <div class="public-board-viewer__zoom-controls">
      <button
        type="button"
        class="public-board-viewer__zoom-btn"
        aria-label="Zoom in"
        @click="zoomIn"
      >+</button>
      <span class="public-board-viewer__zoom-level">{{ zoomPercent }}%</span>
      <button
        type="button"
        class="public-board-viewer__zoom-btn"
        aria-label="Zoom out"
        @click="zoomOut"
      >−</button>
      <button
        type="button"
        class="public-board-viewer__zoom-btn public-board-viewer__zoom-btn--fit"
        aria-label="Fit to view"
        @click="fitToView"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { getStroke } from 'perfect-freehand'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BoardStroke {
  id: string
  tool: string
  color: string
  size: number
  opacity: number
  points: { x: number; y: number; pressure?: number }[]
  width?: number
  height?: number
  text?: string
}

interface BoardAsset {
  id: string
  src: string
  x: number
  y: number
  width: number
  height: number
}

// ─── Props ──────────────────────────────────────────────────────────────────

const props = defineProps<{
  boardState: Record<string, unknown>
  pageIndex?: number
}>()

const emit = defineEmits<{
  'update:pageIndex': [index: number]
}>()

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_WIDTH = 1920
const PAGE_HEIGHT = 1080
const ZOOM_MIN = 0.25
const ZOOM_MAX = 5
const ZOOM_STEP = 0.15

// ─── State ──────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<unknown>(null)
const containerWidth = ref(PAGE_WIDTH)
const containerHeight = ref(PAGE_HEIGHT)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)

let isPanning = false
let panStartX = 0
let panStartY = 0
let panStartPanX = 0
let panStartPanY = 0

// Pinch state
let isPinching = false
let pinchStartDist = 0
let pinchStartZoom = 1

// Image cache (non-reactive to avoid re-render churn)
const loadedImages = new Map<string, HTMLImageElement>()
const failedImages = new Set<string>()

let resizeObserver: ResizeObserver | null = null

// ─── Page-aware board state ─────────────────────────────────────────────────

interface ParsedPage {
  id: string
  name: string
  strokes: BoardStroke[]
  assets: BoardAsset[]
  backgroundColor?: string
}

const currentPageIdx = ref(0)

// Normalize pages from snapshot (array) or replay (object map) format
const allPages = computed<ParsedPage[]>(() => {
  const state = props.boardState
  if (!state) return []

  // Format 1: snapshot array — { pages: [{id, name, strokes, assets, backgroundColor}, ...] }
  if (Array.isArray(state.pages)) {
    return (state.pages as Array<Record<string, unknown>>).map((p, i) => ({
      id: (p.id as string) || `page-${i}`,
      name: (p.name as string) || `Page ${i + 1}`,
      strokes: Array.isArray(p.strokes) ? p.strokes as BoardStroke[] : [],
      assets: (Array.isArray(p.assets) ? p.assets as BoardAsset[] : []).map(a => {
        const raw = a as unknown as Record<string, unknown>
        return {
          ...a,
          width: raw.width ?? raw.w,
          height: raw.height ?? raw.h,
        } as BoardAsset
      }),
      backgroundColor: (p.backgroundColor as string) || undefined,
    }))
  }

  // Format 2: replay object map — { pages: { [pageId]: { strokes, assets, backgroundColor } } }
  if (state.pages && typeof state.pages === 'object') {
    const pagesMap = state.pages as Record<string, { strokes?: BoardStroke[]; assets?: BoardAsset[]; backgroundColor?: string }>
    return Object.entries(pagesMap).map(([id, p], i) => ({
      id,
      name: `Page ${i + 1}`,
      strokes: Array.isArray(p.strokes) ? p.strokes : [],
      assets: Array.isArray(p.assets) ? p.assets : [],
      backgroundColor: p.backgroundColor || undefined,
    }))
  }

  // Format 3: flat (single page) — { strokes: [...], assets: [...] }
  if (Array.isArray(state.strokes) || Array.isArray(state.assets)) {
    return [{
      id: 'default',
      name: 'Page 1',
      strokes: Array.isArray(state.strokes) ? state.strokes as BoardStroke[] : [],
      assets: Array.isArray(state.assets) ? state.assets as BoardAsset[] : [],
    }]
  }

  return []
})

const totalPages = computed(() => allPages.value.length)

// Sync external pageIndex prop
watch(() => props.pageIndex, (idx) => {
  if (idx != null && idx !== currentPageIdx.value) {
    currentPageIdx.value = Math.max(0, Math.min(idx, totalPages.value - 1))
  }
})

function prevPage(): void {
  if (currentPageIdx.value > 0) {
    currentPageIdx.value--
    emit('update:pageIndex', currentPageIdx.value)
    fitToView()
  }
}

function nextPage(): void {
  if (currentPageIdx.value < totalPages.value - 1) {
    currentPageIdx.value++
    emit('update:pageIndex', currentPageIdx.value)
    fitToView()
  }
}

// Expose for parent components
defineExpose({ goToPage: (idx: number) => {
  currentPageIdx.value = Math.max(0, Math.min(idx, totalPages.value - 1))
  fitToView()
}})

const parsedStrokes = computed<BoardStroke[]>(() => {
  const page = allPages.value[currentPageIdx.value]
  return page?.strokes ?? []
})

const parsedAssets = computed<BoardAsset[]>(() => {
  const page = allPages.value[currentPageIdx.value]
  return page?.assets ?? []
})

// ─── Stage config ───────────────────────────────────────────────────────────

const stageConfig = computed(() => ({
  width: containerWidth.value,
  height: containerHeight.value,
  scaleX: zoom.value,
  scaleY: zoom.value,
  x: panX.value,
  y: panY.value,
  draggable: false,
}))

const backgroundConfig = computed(() => ({
  x: 0,
  y: 0,
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
  fill: allPages.value[currentPageIdx.value]?.backgroundColor || '#ffffff',
  listening: false,
}))

const zoomPercent = computed(() => Math.round(zoom.value * 100))

// ─── Stroke rendering ───────────────────────────────────────────────────────

function getSvgPathFromStroke(strokePoints: number[][]): string {
  if (!strokePoints.length) return ''

  const d: string[] = []
  const [first, ...rest] = strokePoints

  d.push(`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`)

  for (let i = 0; i < rest.length; i++) {
    const [x, y] = rest[i]
    if (i < rest.length - 1) {
      const [nx, ny] = rest[i + 1]
      const mx = ((x + nx) / 2).toFixed(2)
      const my = ((y + ny) / 2).toFixed(2)
      d.push(`Q ${x.toFixed(2)} ${y.toFixed(2)} ${mx} ${my}`)
    } else {
      d.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`)
    }
  }

  d.push('Z')
  return d.join(' ')
}

function getPenConfig(stroke: BoardStroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }

  const hasPressure = stroke.points.some(p => p.pressure != null && p.pressure !== 0.5)
  const strokePath = getSvgPathFromStroke(
    getStroke(
      stroke.points.map(p => [p.x, p.y, p.pressure ?? 0.5]),
      {
        size: stroke.size,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: !hasPressure,
      },
    ),
  )

  return {
    data: strokePath,
    fill: stroke.color,
    opacity: stroke.opacity,
    globalCompositeOperation: stroke.tool === 'highlighter' ? 'multiply' : 'source-over',
    draggable: false,
    perfectDrawEnabled: false,
    listening: false,
  }
}

function getLineConfig(stroke: BoardStroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }
  const start = stroke.points[0]
  const end = stroke.points[stroke.points.length - 1]
  return {
    points: [start.x, start.y, end.x, end.y],
    stroke: stroke.color,
    strokeWidth: stroke.size,
    lineCap: 'round',
    lineJoin: 'round',
    opacity: stroke.opacity,
    draggable: false,
    perfectDrawEnabled: false,
    listening: false,
  }
}

function getRectConfig(stroke: BoardStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }
  return {
    x: stroke.points[0].x,
    y: stroke.points[0].y,
    width: stroke.width || 0,
    height: stroke.height || 0,
    stroke: stroke.color,
    strokeWidth: stroke.size,
    fill: 'transparent',
    opacity: stroke.opacity,
    draggable: false,
    perfectDrawEnabled: false,
    listening: false,
  }
}

function getCircleConfig(stroke: BoardStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }
  return {
    x: stroke.points[0].x + (stroke.width || 0) / 2,
    y: stroke.points[0].y + (stroke.height || 0) / 2,
    radiusX: (stroke.width || 0) / 2,
    radiusY: (stroke.height || 0) / 2,
    stroke: stroke.color,
    strokeWidth: stroke.size,
    fill: 'transparent',
    opacity: stroke.opacity,
    draggable: false,
    perfectDrawEnabled: false,
    listening: false,
  }
}

function getTextConfig(stroke: BoardStroke): Record<string, unknown> {
  if (!stroke.points[0]) return { visible: false }
  return {
    x: stroke.points[0].x,
    y: stroke.points[0].y,
    text: stroke.text || '',
    fontSize: stroke.size || 16,
    fill: stroke.color,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    opacity: 1,
    draggable: false,
    perfectDrawEnabled: false,
    listening: false,
  }
}

// ─── Asset rendering ────────────────────────────────────────────────────────

function normalizeAssetUrl(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('http')) return url
  return url.replace(/^\/media\/\/media\//, '/media/')
}

function getAssetConfig(asset: BoardAsset): Record<string, unknown> {
  const src = normalizeAssetUrl(asset.src)
  const image = loadedImages.get(src)

  if (!image && !failedImages.has(src)) {
    // Preload
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      loadedImages.set(src, img)
      // Force Konva redraw
      const stage = (stageRef.value as { getNode?: () => { batchDraw: () => void } })?.getNode?.()
      stage?.batchDraw()
    }
    img.onerror = () => { failedImages.add(src) }
    img.src = src
  }

  return {
    id: asset.id,
    x: asset.x,
    y: asset.y,
    width: asset.width,
    height: asset.height,
    image: image || undefined,
    draggable: false,
    listening: false,
  }
}

// ─── Zoom ───────────────────────────────────────────────────────────────────

function handleWheel(e: WheelEvent): void {
  const direction = e.deltaY > 0 ? -1 : 1
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom.value + direction * ZOOM_STEP))

  // Zoom towards cursor position
  const container = containerRef.value
  if (container) {
    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const oldZoom = zoom.value
    const scale = newZoom / oldZoom

    panX.value = mouseX - (mouseX - panX.value) * scale
    panY.value = mouseY - (mouseY - panY.value) * scale
  }

  zoom.value = newZoom
}

function zoomIn(): void {
  zoom.value = Math.min(ZOOM_MAX, zoom.value + ZOOM_STEP)
}

function zoomOut(): void {
  zoom.value = Math.max(ZOOM_MIN, zoom.value - ZOOM_STEP)
}

function fitToView(): void {
  if (!containerRef.value) return
  const cw = containerWidth.value
  const ch = containerHeight.value
  const scaleX = cw / PAGE_WIDTH
  const scaleY = ch / PAGE_HEIGHT
  zoom.value = Math.min(scaleX, scaleY, 1)
  panX.value = (cw - PAGE_WIDTH * zoom.value) / 2
  panY.value = (ch - PAGE_HEIGHT * zoom.value) / 2
}

// ─── Pan (mouse) ────────────────────────────────────────────────────────────

function handlePanStart(e: unknown): void {
  const evt = (e as { evt: MouseEvent }).evt
  if (evt.button !== 0) return
  isPanning = true
  panStartX = evt.clientX
  panStartY = evt.clientY
  panStartPanX = panX.value
  panStartPanY = panY.value
}

function handlePanMove(e: unknown): void {
  if (!isPanning) return
  const evt = (e as { evt: MouseEvent }).evt
  panX.value = panStartPanX + (evt.clientX - panStartX)
  panY.value = panStartPanY + (evt.clientY - panStartY)
}

function handlePanEnd(): void {
  isPanning = false
}

// ─── Touch (pinch + pan) ────────────────────────────────────────────────────

function getTouchDistance(t1: Touch, t2: Touch): number {
  return Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2)
}

function handleTouchStart(e: unknown): void {
  const evt = (e as { evt: TouchEvent }).evt
  if (evt.touches.length === 2) {
    isPinching = true
    isPanning = false
    pinchStartDist = getTouchDistance(evt.touches[0], evt.touches[1])
    pinchStartZoom = zoom.value
  } else if (evt.touches.length === 1) {
    isPanning = true
    isPinching = false
    panStartX = evt.touches[0].clientX
    panStartY = evt.touches[0].clientY
    panStartPanX = panX.value
    panStartPanY = panY.value
  }
}

function handleTouchMove(e: unknown): void {
  const evt = (e as { evt: TouchEvent }).evt
  evt.preventDefault()

  if (isPinching && evt.touches.length === 2) {
    const dist = getTouchDistance(evt.touches[0], evt.touches[1])
    const scale = dist / pinchStartDist
    zoom.value = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, pinchStartZoom * scale))
  } else if (isPanning && evt.touches.length === 1) {
    panX.value = panStartPanX + (evt.touches[0].clientX - panStartX)
    panY.value = panStartPanY + (evt.touches[0].clientY - panStartY)
  }
}

function handleTouchEnd(): void {
  isPanning = false
  isPinching = false
}

// ─── Resize observer ────────────────────────────────────────────────────────

onMounted(() => {
  if (!containerRef.value) return

  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      containerWidth.value = entry.contentRect.width
      containerHeight.value = entry.contentRect.height
    }
  })
  resizeObserver.observe(containerRef.value)

  // Initial fit
  const rect = containerRef.value.getBoundingClientRect()
  containerWidth.value = rect.width
  containerHeight.value = rect.height

  // Defer fitToView to ensure dimensions are settled
  requestAnimationFrame(() => fitToView())
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  loadedImages.clear()
  failedImages.clear()
})

// Re-fit when board state changes
watch(() => props.boardState, () => {
  // Clear image cache for new state
  loadedImages.clear()
  failedImages.clear()
}, { deep: false })
</script>

<style scoped>
.public-board-viewer {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  cursor: grab;
  background: #f1f5f9;
  touch-action: none;
}

.public-board-viewer:active {
  cursor: grabbing;
}

/* Zoom controls */
.public-board-viewer__zoom-controls {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 4px 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.public-board-viewer__zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: background 0.12s;
}

.public-board-viewer__zoom-btn:hover {
  background: #f1f5f9;
}

.public-board-viewer__zoom-btn--fit {
  font-size: 12px;
}

.public-board-viewer__zoom-level {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  min-width: 36px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* Page navigation */
.public-board-viewer__page-nav {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 4px 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  z-index: 10;
}

.public-board-viewer__page-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  border-radius: 4px;
  font-size: 18px;
  font-weight: 700;
  color: #475569;
  cursor: pointer;
  transition: background 0.12s;
}

.public-board-viewer__page-btn:hover:not(:disabled) {
  background: #f1f5f9;
}

.public-board-viewer__page-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.public-board-viewer__page-indicator {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .public-board-viewer__zoom-controls {
    bottom: 8px;
    right: 8px;
  }

  .public-board-viewer__zoom-btn {
    width: 36px;
    height: 36px;
  }

  .public-board-viewer__page-nav {
    bottom: 8px;
  }
}
</style>
