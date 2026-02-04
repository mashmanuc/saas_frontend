<template>
  <div
    ref="containerRef"
    class="solo-canvas-wrapper"
    :class="{
      'solo-canvas-wrapper--panning': isPanning,
      'solo-canvas-wrapper--selecting': tool === 'select',
      'solo-canvas-wrapper--moving': selection.mode.value === 'move',
      'solo-canvas-wrapper--resizing': selection.mode.value === 'resize',
      'solo-canvas-wrapper--dragover': isDragOver,
    }"
    :style="{ cursor: cursorStyle }"
    tabindex="0"
    @paste="handlePaste"
    @keydown="handleKeydown"
    @dragover.prevent
    @dragenter.prevent="handleDragEnter"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
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
      <v-layer ref="backgroundLayerRef">
        <!-- Base background color -->
        <v-rect :config="backgroundConfig" />

        <!-- Grid pattern (vertical + horizontal lines) -->
        <template v-if="pageBackground?.type === 'grid'">
          <v-line
            v-for="line in gridLines"
            :key="line.id"
            :config="line.config"
          />
        </template>

        <!-- Dots pattern -->
        <template v-if="pageBackground?.type === 'dots'">
          <v-circle
            v-for="dot in gridDots"
            :key="dot.id"
            :config="dot.config"
          />
        </template>

        <!-- Ruled pattern (horizontal lines only) -->
        <template v-if="pageBackground?.type === 'ruled'">
          <v-line
            v-for="line in ruledLines"
            :key="line.id"
            :config="line.config"
          />
        </template>

        <!-- Graph pattern (fine grid) -->
        <template v-if="pageBackground?.type === 'graph'">
          <v-line
            v-for="line in graphLines"
            :key="line.id"
            :config="line.config"
          />
        </template>
      </v-layer>

      <!-- Assets layer -->
      <v-layer ref="assetsLayerRef">
        <v-image
          v-for="asset in sortedAssets"
          :key="asset.id"
          :config="getAssetConfig(asset)"
        />
      </v-layer>

      <!-- Strokes layer -->
      <v-layer ref="strokesLayerRef">
        <template v-for="stroke in pageStrokes" :key="stroke.id">
          <!-- Selection highlight for strokes -->
          <v-line
            v-if="selection.isSelected(stroke.id) && (stroke.tool === 'pen' || stroke.tool === 'highlighter')"
            :config="getSelectionHighlightConfig(stroke)"
          />
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
          <!-- Arrow tool -->
          <v-arrow
            v-else-if="stroke.tool === 'arrow'"
            :config="getArrowConfig(stroke)"
          />
          <!-- Rectangle -->
          <v-rect
            v-else-if="stroke.tool === 'rectangle'"
            :config="getRectConfig(stroke)"
          />
          <!-- Circle -->
          <v-circle
            v-else-if="stroke.tool === 'circle'"
            :config="getCircleConfig(stroke)"
          />
          <!-- Text -->
          <v-text
            v-else-if="stroke.tool === 'text'"
            :config="getTextConfig(stroke)"
            @dblclick="handleTextEdit(stroke)"
          />
        </template>

        <!-- Shapes from shapes[] array -->
        <template v-for="shape in pageShapes" :key="shape.id">
          <!-- Selection highlight for shapes -->
          <v-rect
            v-if="selection.isSelected(shape.id) && shape.type === 'rectangle'"
            :config="getShapeSelectionHighlight(shape)"
          />
          <v-line
            v-if="shape.type === 'line' && !shape.arrowStart && !shape.arrowEnd"
            :config="getShapeLineConfig(shape)"
          />
          <v-arrow
            v-else-if="shape.type === 'line' && (shape.arrowStart || shape.arrowEnd)"
            :config="getShapeArrowConfig(shape)"
          />
          <v-arrow
            v-else-if="shape.type === 'arrow'"
            :config="getShapeArrowConfig(shape)"
          />
          <v-rect
            v-else-if="shape.type === 'rectangle'"
            :config="getShapeRectConfig(shape)"
          />
          <v-circle
            v-else-if="shape.type === 'circle'"
            :config="getShapeCircleConfig(shape)"
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
        <!-- Arrow preview -->
        <v-arrow
          v-if="isDrawing && tool === 'arrow' && shapePreview"
          :config="arrowPreviewConfig"
        />
        <!-- Circle preview -->
        <v-circle
          v-if="isDrawing && tool === 'circle' && circlePreview"
          :config="circlePreviewConfig"
        />

        <!-- Selection UI -->
        <!-- Lasso selection path -->
        <v-line
          v-if="selection.mode.value === 'lasso' && selection.lassoPoints.value.length > 1"
          :config="lassoPreviewConfig"
        />
        <!-- Rectangle selection -->
        <v-rect
          v-if="selection.mode.value === 'rect' && selection.selectionRect.value"
          :config="selectionRectConfig"
        />
        <!-- Bounding box -->
        <v-rect
          v-if="selection.boundingBox.value && selection.selectedIds.value.size > 0"
          :config="boundingBoxConfig"
        />
        <!-- Resize handles -->
        <template v-if="selection.boundingBox.value && selection.selectedIds.value.size > 0">
          <v-rect
            v-for="handle in selection.resizeHandles.value"
            :key="handle.id"
            :config="getResizeHandleConfig(handle)"
          />
        </template>
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
import { ref, computed, watch, onMounted, onUnmounted, nextTick, reactive } from 'vue'
import type { PageState, Stroke, Shape, TextElement, Tool, Point as TypePoint, PageBackground, AssetLayer } from '../../types/solo'
import { getStroke } from 'perfect-freehand'
import { useKeyboardShortcuts } from '../../composables/useKeyboardShortcuts'
import { useSelection, type ResizeHandle } from '../../composables/useSelection'

// Types
interface Point {
  x: number
  y: number
  t?: number
}

interface StrokeData {
  id: string
  tool: 'pen' | 'highlighter' | 'line' | 'arrow' | 'rectangle' | 'circle' | 'text' | 'eraser' | 'select'
  color: string
  size: number
  opacity: number
  points: Point[]
  text?: string
  width?: number
  height?: number
  radius?: number
  arrowStart?: boolean
  arrowEnd?: boolean
  arrowSize?: number
}

const props = defineProps<{
  page: PageState
  tool: string
  color: string
  size: number
  zoom: number
  panX: number
  panY: number
  arrowStyle?: 'arrow-end' | 'arrow-start' | 'arrow-both'
  arrowSize?: number
}>()

const emit = defineEmits<{
  'stroke-end': [stroke: Stroke]
  'shape-end': [shape: Shape]
  'text-create': [text: TextElement]
  'zoom-change': [zoom: number]
  'pan-change': [x: number, y: number]
  'asset-add': [asset: AssetLayer, file?: File]
  'tool-change': [tool: Tool]
  'undo': []
  'redo': []
  'delete': []
  'copy': []
  'paste': []
  'select-all': []
  'escape': []
  'items-update': [updates: Array<{ id: string; type: 'stroke' | 'shape' | 'text'; changes: any }>]
  'items-delete': [ids: { strokes: string[]; shapes: string[]; texts: string[] }]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<any>(null)
const backgroundLayerRef = ref<any>(null)
const strokesLayerRef = ref<any>(null)
const assetsLayerRef = ref<any>(null)
const uiLayerRef = ref<any>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// State
const canvasWidth = ref(920)
const canvasHeight = ref(1200)
const isDrawing = ref(false)
const currentPoints = ref<Point[]>([])
const shapePreview = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const circlePreview = ref<{ x: number; y: number; radius: number } | null>(null)
const editingText = ref<StrokeData | null>(null)
const editingTextValue = ref('')

const isDragOver = ref(false)
const dragCounter = ref(0)

// Selection state
const selectionStartPoint = ref<Point | null>(null)

// Pan state
const isPanDragging = ref(false)
const panStartPos = ref<{ x: number; y: number } | null>(null)
const panStartOffset = ref<{ x: number; y: number }>({ x: 0, y: 0 })

// Asset images cache
const assetImages = reactive(new Map<string, HTMLImageElement>())

// Selection composable
const selection = useSelection(
  computed(() => props.page?.strokes || []),
  computed(() => props.page?.shapes || []),
  computed(() => props.page?.texts || []),
  {
    gridSize: 10,
    snapEnabled: true,
    onItemsUpdate: (updates) => {
      emit('items-update', updates)
    },
  }
)

// Keyboard shortcuts
const { isPanning, disable: disableShortcuts, enable: enableShortcuts } = useKeyboardShortcuts({
  onToolChange: (tool) => emit('tool-change', tool),
  onUndo: () => emit('undo'),
  onRedo: () => emit('redo'),
  onDelete: () => {
    // Delete selected items if in select mode
    if (selection.selectedIds.value.size > 0) {
      const toDelete = selection.deleteSelected()
      emit('items-delete', toDelete)
    } else {
      emit('delete')
    }
  },
  onCopy: () => emit('copy'),
  onPaste: () => emit('paste'),
  onSelectAll: () => {
    if (props.tool === 'select') {
      selection.selectAll()
    }
    emit('select-all')
  },
  onEscape: () => {
    // Cancel current drawing or deselect
    if (isDrawing.value) {
      isDrawing.value = false
      currentPoints.value = []
      shapePreview.value = null
      circlePreview.value = null
    }
    // Deselect all
    selection.deselectAll()
    emit('escape')
  },
  onZoomIn: () => {
    const newZoom = Math.min(props.zoom * 1.2, 5)
    emit('zoom-change', newZoom)
  },
  onZoomOut: () => {
    const newZoom = Math.max(props.zoom / 1.2, 0.1)
    emit('zoom-change', newZoom)
  },
  onZoomReset: () => emit('zoom-change', 1),
  onPanStart: () => {
    // Pan mode cursor change handled in template
  },
  onPanEnd: () => {
    // Pan mode cursor change handled in template
  },
})

// Computed
const pageStrokes = computed<StrokeData[]>(() => {
  return (props.page?.strokes || []) as StrokeData[]
})

const pageShapes = computed(() => {
  return props.page?.shapes || []
})

const pageAssets = computed(() => {
  return props.page?.assets || []
})

const sortedAssets = computed(() => {
  return [...pageAssets.value].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
})

const pageBackground = computed<PageBackground | undefined>(() => {
  return props.page?.background
})

const stageConfig = computed(() => ({
  width: canvasWidth.value,
  height: canvasHeight.value,
  scaleX: props.zoom,
  scaleY: props.zoom,
  x: props.panX * props.zoom,
  y: props.panY * props.zoom,
}))

// Get background fill color based on type
const backgroundFill = computed(() => {
  const bg = pageBackground.value
  if (!bg || bg.type === 'white') return '#ffffff'
  if (bg.type === 'color') return bg.color || '#ffffff'
  // For pattern types, use white base
  return '#ffffff'
})

const backgroundConfig = computed(() => ({
  x: 0,
  y: 0,
  width: canvasWidth.value,
  height: canvasHeight.value,
  fill: backgroundFill.value,
}))

watch(pageAssets, (assets) => {
  for (const asset of assets) {
    if (!assetImages.has(asset.id) && asset.src) {
      loadAssetImage(asset)
    }
  }
  for (const id of Array.from(assetImages.keys())) {
    if (!assets.find((asset) => asset.id === id)) {
      assetImages.delete(id)
    }
  }
}, { immediate: true })

// Grid lines (for 'grid' type)
const gridLines = computed(() => {
  const bg = pageBackground.value
  if (!bg || bg.type !== 'grid') return []

  const lines: Array<{ id: string; config: any }> = []
  const gridSize = bg.gridSize || 20
  const lineColor = bg.lineColor || '#e5e7eb'
  const width = canvasWidth.value
  const height = canvasHeight.value

  // Vertical lines
  for (let x = gridSize; x < width; x += gridSize) {
    lines.push({
      id: `grid-v-${x}`,
      config: {
        points: [x, 0, x, height],
        stroke: lineColor,
        strokeWidth: 1,
        listening: false,
      },
    })
  }

  // Horizontal lines
  for (let y = gridSize; y < height; y += gridSize) {
    lines.push({
      id: `grid-h-${y}`,
      config: {
        points: [0, y, width, y],
        stroke: lineColor,
        strokeWidth: 1,
        listening: false,
      },
    })
  }

  return lines
})

// Dots (for 'dots' type)
const gridDots = computed(() => {
  const bg = pageBackground.value
  if (!bg || bg.type !== 'dots') return []

  const dots: Array<{ id: string; config: any }> = []
  const gridSize = bg.gridSize || 20
  const dotColor = bg.lineColor || '#9ca3af'
  const width = canvasWidth.value
  const height = canvasHeight.value

  for (let x = gridSize; x < width; x += gridSize) {
    for (let y = gridSize; y < height; y += gridSize) {
      dots.push({
        id: `dot-${x}-${y}`,
        config: {
          x,
          y,
          radius: 1.5,
          fill: dotColor,
          listening: false,
        },
      })
    }
  }

  return dots
})

// Ruled lines (for 'ruled' type - horizontal only)
const ruledLines = computed(() => {
  const bg = pageBackground.value
  if (!bg || bg.type !== 'ruled') return []

  const lines: Array<{ id: string; config: any }> = []
  const lineSpacing = bg.gridSize || 28 // Slightly larger default for ruled
  const lineColor = bg.lineColor || '#dbeafe' // Light blue default
  const width = canvasWidth.value
  const height = canvasHeight.value

  for (let y = lineSpacing; y < height; y += lineSpacing) {
    lines.push({
      id: `ruled-${y}`,
      config: {
        points: [0, y, width, y],
        stroke: lineColor,
        strokeWidth: 1,
        listening: false,
      },
    })
  }

  return lines
})

// Graph lines (for 'graph' type - fine grid with major/minor lines)
const graphLines = computed(() => {
  const bg = pageBackground.value
  if (!bg || bg.type !== 'graph') return []

  const lines: Array<{ id: string; config: any }> = []
  const minorSize = (bg.gridSize || 20) / 4 // Minor grid is 1/4 of major
  const majorSize = bg.gridSize || 20
  const lineColor = bg.lineColor || '#e5e7eb'
  const width = canvasWidth.value
  const height = canvasHeight.value

  // Minor vertical lines
  for (let x = minorSize; x < width; x += minorSize) {
    const isMajor = x % majorSize === 0
    lines.push({
      id: `graph-v-${x}`,
      config: {
        points: [x, 0, x, height],
        stroke: lineColor,
        strokeWidth: isMajor ? 1 : 0.5,
        opacity: isMajor ? 1 : 0.5,
        listening: false,
      },
    })
  }

  // Minor horizontal lines
  for (let y = minorSize; y < height; y += minorSize) {
    const isMajor = y % majorSize === 0
    lines.push({
      id: `graph-h-${y}`,
      config: {
        points: [0, y, width, y],
        stroke: lineColor,
        strokeWidth: isMajor ? 1 : 0.5,
        opacity: isMajor ? 1 : 0.5,
        listening: false,
      },
    })
  }

  return lines
})

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

const arrowPreviewConfig = computed(() => {
  if (!shapePreview.value || currentPoints.value.length < 1) return {}
  const start = currentPoints.value[0]
  const endX = shapePreview.value.x + shapePreview.value.w
  const endY = shapePreview.value.y + shapePreview.value.h
  const arrowLen = props.arrowSize || 15
  const style = props.arrowStyle || 'arrow-end'

  return {
    points: [start.x, start.y, endX, endY],
    stroke: props.color,
    strokeWidth: props.size,
    fill: props.color,
    pointerLength: arrowLen,
    pointerWidth: arrowLen * 0.8,
    pointerAtBeginning: style === 'arrow-start' || style === 'arrow-both',
    pointerAtEnding: style === 'arrow-end' || style === 'arrow-both',
    lineCap: 'round',
    lineJoin: 'round',
  }
})

const circlePreviewConfig = computed(() => {
  if (!circlePreview.value) return {}
  return {
    x: circlePreview.value.x,
    y: circlePreview.value.y,
    radius: circlePreview.value.radius,
    stroke: props.color,
    strokeWidth: props.size,
    dash: [5, 5],
  }
})

// Selection UI configs
const cursorStyle = computed(() => {
  if (isPanning.value) return 'grab'
  if (selection.mode.value === 'move') return 'move'
  if (selection.mode.value === 'resize') {
    const handle = selection.resizeHandle.value
    const cursors: Record<string, string> = {
      nw: 'nwse-resize', n: 'ns-resize', ne: 'nesw-resize',
      e: 'ew-resize', se: 'nwse-resize', s: 'ns-resize',
      sw: 'nesw-resize', w: 'ew-resize',
    }
    return handle ? cursors[handle] : 'default'
  }
  if (props.tool === 'select') return 'default'
  return 'crosshair'
})

const lassoPreviewConfig = computed(() => {
  const points = selection.lassoPoints.value
  if (points.length < 2) return {}

  const flatPoints = points.flatMap(p => [p.x, p.y])

  return {
    points: flatPoints,
    stroke: '#2563eb',
    strokeWidth: 1,
    dash: [4, 4],
    closed: false,
    lineCap: 'round',
    lineJoin: 'round',
  }
})

const selectionRectConfig = computed(() => {
  const rect = selection.selectionRect.value
  if (!rect) return {}

  return {
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    stroke: '#2563eb',
    strokeWidth: 1,
    dash: [4, 4],
    fill: 'rgba(37, 99, 235, 0.1)',
  }
})

const boundingBoxConfig = computed(() => {
  const box = selection.boundingBox.value
  if (!box) return {}

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    stroke: '#2563eb',
    strokeWidth: 1,
    dash: [4, 4],
    fill: 'transparent',
  }
})

function getResizeHandleConfig(handle: { id: string; x: number; y: number; cursor: string }) {
  return {
    x: handle.x,
    y: handle.y,
    width: 8,
    height: 8,
    fill: '#ffffff',
    stroke: '#2563eb',
    strokeWidth: 1,
    cornerRadius: 1,
  }
}

function getSelectionHighlightConfig(stroke: StrokeData) {
  if (stroke.points.length < 2) return {}

  const strokePoints = getStroke(stroke.points, {
    size: stroke.size + 6,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  })

  const flatPoints = strokePoints.flatMap(p => [p[0], p[1]])

  return {
    points: flatPoints,
    fill: 'rgba(37, 99, 235, 0.2)',
    closed: true,
    lineCap: 'round',
    lineJoin: 'round',
    listening: false,
  }
}

function getShapeSelectionHighlight(shape: Shape) {
  return {
    x: (shape.x || 0) - 3,
    y: (shape.y || 0) - 3,
    width: (shape.width || 0) + 6,
    height: (shape.height || 0) + 6,
    stroke: '#2563eb',
    strokeWidth: 2,
    dash: [4, 4],
    fill: 'rgba(37, 99, 235, 0.1)',
    listening: false,
  }
}

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

function getArrowConfig(stroke: StrokeData) {
  if (stroke.points.length < 2) return {}
  const start = stroke.points[0]
  const end = stroke.points[stroke.points.length - 1]
  const arrowLen = stroke.arrowSize || 15

  return {
    points: [start.x, start.y, end.x, end.y],
    stroke: stroke.color,
    strokeWidth: stroke.size,
    fill: stroke.color,
    pointerLength: arrowLen,
    pointerWidth: arrowLen * 0.8,
    pointerAtBeginning: stroke.arrowStart || false,
    pointerAtEnding: stroke.arrowEnd !== false, // default true for arrow tool
    lineCap: 'round',
    lineJoin: 'round',
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

function getCircleConfig(stroke: StrokeData) {
  if (stroke.points.length < 2) return {}
  const center = stroke.points[0]
  const edge = stroke.points[stroke.points.length - 1]
  const radius = Math.sqrt(
    Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
  )
  return {
    x: center.x,
    y: center.y,
    radius: radius,
    stroke: stroke.color,
    strokeWidth: stroke.size,
  }
}

// Shape-specific configs (for shapes[] array)
function getShapeLineConfig(shape: Shape) {
  return {
    points: [shape.startX || 0, shape.startY || 0, shape.endX || 0, shape.endY || 0],
    stroke: shape.color,
    strokeWidth: shape.size,
    lineCap: 'round',
  }
}

function getShapeArrowConfig(shape: Shape) {
  const arrowLen = shape.arrowSize || 15
  return {
    points: [shape.startX || 0, shape.startY || 0, shape.endX || 0, shape.endY || 0],
    stroke: shape.color,
    strokeWidth: shape.size,
    fill: shape.color,
    pointerLength: arrowLen,
    pointerWidth: arrowLen * 0.8,
    pointerAtBeginning: shape.arrowStart || false,
    pointerAtEnding: shape.arrowEnd !== false,
    lineCap: 'round',
    lineJoin: 'round',
  }
}

function getShapeRectConfig(shape: Shape) {
  return {
    x: shape.x || 0,
    y: shape.y || 0,
    width: shape.width || 0,
    height: shape.height || 0,
    stroke: shape.color,
    strokeWidth: shape.size,
  }
}

function getShapeCircleConfig(shape: Shape) {
  return {
    x: shape.x || 0,
    y: shape.y || 0,
    radius: shape.radius || 0,
    stroke: shape.color,
    strokeWidth: shape.size,
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
  const ctrlKey = e.evt?.ctrlKey || e.evt?.metaKey || false
  const shiftKey = e.evt?.shiftKey || false
  const button = e.evt?.button // 0=left, 1=middle, 2=right

  // Pan mode handling (Space key held OR middle-click)
  if (isPanning.value || button === 1) {
    e.evt?.preventDefault() // Prevent browser default middle-click behavior
    isPanDragging.value = true
    const stage = stageRef.value?.getStage()
    if (stage) {
      const pointer = stage.getPointerPosition()
      panStartPos.value = { x: pointer.x, y: pointer.y }
      panStartOffset.value = { x: props.panX, y: props.panY }
    }
    return
  }

  // Selection tool handling
  if (props.tool === 'select') {
    // Check if clicking on a resize handle
    const handle = selection.getHandleAtPoint(pos) as ResizeHandle
    if (handle && selection.selectedIds.value.size > 0) {
      selection.startResize(handle, pos)
      return
    }

    // Check if clicking inside bounding box (to move)
    if (selection.isPointInBoundingBox(pos) && selection.selectedIds.value.size > 0) {
      selection.startMove(pos)
      return
    }

    // Check if clicking on an item
    const item = selection.getItemAtPoint(pos)
    if (item) {
      selection.selectItem(item.id, ctrlKey)
      // Start move immediately
      selection.startMove(pos)
      return
    }

    // Start selection (lasso with shift, rectangle otherwise)
    selectionStartPoint.value = pos
    if (shiftKey) {
      selection.startLassoSelection(pos)
    } else {
      selection.startRectSelection(pos)
    }
    return
  }

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
  } else if (['line', 'rectangle', 'arrow'].includes(props.tool)) {
    isDrawing.value = true
    currentPoints.value = [pos]
    shapePreview.value = { x: pos.x, y: pos.y, w: 0, h: 0 }
  } else if (props.tool === 'circle') {
    isDrawing.value = true
    currentPoints.value = [pos]
    circlePreview.value = { x: pos.x, y: pos.y, radius: 0 }
  }
}

function handleMouseMove(e: any): void {
  const pos = getPointerPosition(e)
  const shiftKey = e.evt?.shiftKey || false
  const altKey = e.evt?.altKey || false

  // Pan mode dragging
  if (isPanDragging.value && panStartPos.value) {
    const stage = stageRef.value?.getStage()
    if (stage) {
      const pointer = stage.getPointerPosition()
      const dx = (pointer.x - panStartPos.value.x) / props.zoom
      const dy = (pointer.y - panStartPos.value.y) / props.zoom
      const newPanX = panStartOffset.value.x + dx
      const newPanY = panStartOffset.value.y + dy
      emit('pan-change', newPanX, newPanY)
    }
    return
  }

  // Selection tool handling
  if (props.tool === 'select') {
    if (selection.mode.value === 'lasso') {
      selection.updateLassoSelection(pos)
      return
    }
    if (selection.mode.value === 'rect' && selectionStartPoint.value) {
      selection.updateRectSelection(pos, selectionStartPoint.value)
      return
    }
    if (selection.mode.value === 'move') {
      // Preview move - visual feedback without saving
      selection.calculateMoveUpdates(pos, shiftKey)
      return
    }
    if (selection.mode.value === 'resize') {
      // Preview resize - visual feedback without saving
      selection.calculateResizeUpdates(pos, shiftKey, altKey)
      return
    }
    return
  }

  if (!isDrawing.value) return

  if (['pen', 'highlighter', 'eraser'].includes(props.tool)) {
    currentPoints.value.push(pos)
  } else if (['line', 'rectangle', 'arrow'].includes(props.tool) && currentPoints.value.length > 0) {
    const start = currentPoints.value[0]
    shapePreview.value = {
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      w: pos.x - start.x,
      h: pos.y - start.y,
    }
  } else if (props.tool === 'circle' && currentPoints.value.length > 0) {
    const center = currentPoints.value[0]
    const radius = Math.sqrt(
      Math.pow(pos.x - center.x, 2) + Math.pow(pos.y - center.y, 2)
    )
    circlePreview.value = { x: center.x, y: center.y, radius }
  }
}

function handleMouseUp(e: any): void {
  const pos = getPointerPosition(e)
  const ctrlKey = e.evt?.ctrlKey || e.evt?.metaKey || false
  const shiftKey = e.evt?.shiftKey || false
  const altKey = e.evt?.altKey || false

  // Pan mode end
  if (isPanDragging.value) {
    isPanDragging.value = false
    panStartPos.value = null
    return
  }

  // Selection tool handling
  if (props.tool === 'select') {
    if (selection.mode.value === 'lasso') {
      selection.endLassoSelection(ctrlKey)
      selectionStartPoint.value = null
      return
    }
    if (selection.mode.value === 'rect') {
      selection.endRectSelection(ctrlKey)
      selectionStartPoint.value = null
      return
    }
    if (selection.mode.value === 'move') {
      const updates = selection.endMove(pos, shiftKey)
      if (updates.length > 0) {
        emit('items-update', updates)
      }
      return
    }
    if (selection.mode.value === 'resize') {
      const updates = selection.endResize(pos, shiftKey, altKey)
      if (updates.length > 0) {
        emit('items-update', updates)
      }
      return
    }
    return
  }

  if (!isDrawing.value) return

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
  } else if (props.tool === 'arrow' && currentPoints.value.length > 0) {
    const start = currentPoints.value[0]
    const style = props.arrowStyle || 'arrow-end'
    const shape: Shape = {
      id: `shape-${Date.now()}`,
      type: 'arrow',
      color: props.color,
      size: props.size,
      startX: start.x,
      startY: start.y,
      endX: pos.x,
      endY: pos.y,
      arrowStart: style === 'arrow-start' || style === 'arrow-both',
      arrowEnd: style === 'arrow-end' || style === 'arrow-both',
      arrowSize: props.arrowSize || 15,
      points: [start, pos],
    }
    emit('shape-end', shape)
  } else if (props.tool === 'circle' && currentPoints.value.length > 0) {
    const center = currentPoints.value[0]
    const radius = Math.sqrt(
      Math.pow(pos.x - center.x, 2) + Math.pow(pos.y - center.y, 2)
    )
    const shape: Shape = {
      id: `shape-${Date.now()}`,
      type: 'circle',
      color: props.color,
      size: props.size,
      x: center.x,
      y: center.y,
      radius: radius,
      points: [center, pos],
    }
    emit('shape-end', shape)
  }

  isDrawing.value = false
  currentPoints.value = []
  shapePreview.value = null
  circlePreview.value = null
}

function handleTextEdit(stroke: StrokeData): void {
  editingText.value = stroke
  editingTextValue.value = stroke.text || ''
  disableShortcuts() // Disable shortcuts during text editing
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
  enableShortcuts() // Re-enable shortcuts after text editing
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
  // Keyboard shortcuts are now handled by useKeyboardShortcuts composable
  // This handler is kept for component-specific key handling if needed
}

function handleDragEnter(): void {
  dragCounter.value += 1
  isDragOver.value = true
}

function handleDragLeave(): void {
  dragCounter.value = Math.max(0, dragCounter.value - 1)
  if (dragCounter.value === 0) {
    isDragOver.value = false
  }
}

async function handleDrop(event: DragEvent): Promise<void> {
  dragCounter.value = 0
  isDragOver.value = false

  const file = await extractImageFile(event)
  if (!file) {
    console.warn('[SoloCanvas] Dropped content is not an image')
    return
  }

  const dropPosition = getDropCanvasPosition(event)
  if (!dropPosition) return

  await addAssetFromFile(file, dropPosition)
}

async function extractImageFile(event: DragEvent): Promise<File | null> {
  const dt = event.dataTransfer
  if (!dt) return null

  const file = Array.from(dt.files || []).find((f) => f.type.startsWith('image/'))
  if (file) return file

  const url = await getDroppedUrl(dt)
  if (!url) return null

  try {
    const response = await fetch(url)
    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) return null
    const extension = blob.type.split('/')[1] || 'png'
    return new File([blob], `dropped-image.${extension}`, { type: blob.type })
  } catch (error) {
    console.error('[SoloCanvas] Failed to fetch dropped URL', error)
    return null
  }
}

function getDroppedUrl(dt: DataTransfer): Promise<string | null> {
  const item = Array.from(dt.items || []).find((i) => i.type === 'text/uri-list' || i.type === 'text/plain')
  if (!item) return Promise.resolve(null)

  return new Promise((resolve) => {
    item.getAsString((value) => {
      const url = value?.trim()
      resolve(url && url.startsWith('http') ? url : null)
    })
  })
}

function getDropCanvasPosition(event: DragEvent): { x: number; y: number } | null {
  const container = containerRef.value
  if (!container) return null

  const rect = container.getBoundingClientRect()
  const relativeX = event.clientX - rect.left
  const relativeY = event.clientY - rect.top

  const x = (relativeX / props.zoom) - props.panX
  const y = (relativeY / props.zoom) - props.panY

  return { x, y }
}

async function addAssetFromFile(file: File, dropPosition: { x: number; y: number }): Promise<void> {
  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImageFromDataUrl(dataUrl)

  const maxSize = Math.min(canvasWidth.value * 0.8, 4096)
  let width = img.width
  let height = img.height
  if (width > maxSize || height > maxSize) {
    const scale = maxSize / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const id = crypto.randomUUID ? crypto.randomUUID() : `asset-${Date.now()}`
  const asset: AssetLayer = {
    id,
    type: 'image',
    src: dataUrl,
    x: dropPosition.x - width / 2,
    y: dropPosition.y - height / 2,
    width,
    height,
    rotation: 0,
    locked: false,
    zIndex: (props.page?.assets?.length || 0) + 1,
  }

  emit('asset-add', asset, file)
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
    reader.readAsDataURL(file)
  })
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

function loadAssetImage(asset: AssetLayer): void {
  if (!asset.src) return
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    assetImages.set(asset.id, img)
  }
  img.onerror = () => {
    console.warn('[SoloCanvas] Failed to load asset image', asset.id)
  }
  img.src = asset.src
}

function getAssetConfig(asset: AssetLayer) {
  const image = assetImages.get(asset.id)
  return {
    x: asset.x,
    y: asset.y,
    width: asset.width,
    height: asset.height,
    rotation: asset.rotation,
    image,
    listening: false,
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

.solo-canvas-wrapper--panning {
  cursor: grab !important;
}

.solo-canvas-wrapper--panning:active {
  cursor: grabbing !important;
}

.solo-canvas-wrapper--dragover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(37, 99, 235, 0.08);
  border: 2px dashed rgba(37, 99, 235, 0.6);
  pointer-events: none;
  transition: opacity 0.2s ease;
}

/* Pan dragging state */
.solo-canvas-wrapper:active {
  cursor: grabbing;
}

.solo-canvas-wrapper--selecting {
  cursor: default;
}

.solo-canvas-wrapper--moving {
  cursor: move !important;
}

.solo-canvas-wrapper--resizing {
  /* Cursor is set dynamically based on handle */
  cursor: default;
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
