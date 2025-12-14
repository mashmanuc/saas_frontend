<template>
  <div 
    ref="containerRef" 
    class="board-canvas"
    tabindex="0"
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

      <!-- UI layer (transformer, current drawing) -->
      <v-layer ref="uiLayerRef">
        <!-- Current drawing preview (use v-path for SVG path data) -->
        <v-path
          v-if="isDrawing && currentPoints.length > 0 && (currentTool === 'pen' || currentTool === 'highlighter')"
          :config="currentStrokeConfig"
        />
        <!-- Shape preview -->
        <v-rect
          v-if="isDrawing && currentTool === 'rectangle' && shapePreview"
          :config="shapePreviewConfig"
        />
        <v-line
          v-if="isDrawing && currentTool === 'line' && shapePreview"
          :config="linePreviewConfig"
        />
        <v-ellipse
          v-if="isDrawing && currentTool === 'circle' && shapePreview"
          :config="circlePreviewConfig"
        />
        <!-- Transformer for selection -->
        <v-transformer
          v-if="selectedNode"
          ref="transformerRef"
          :config="transformerConfig"
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
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import Konva from 'konva'
import getStroke from 'perfect-freehand'

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
  width?: number
  height?: number
  zoom?: number
}

const props = withDefaults(defineProps<Props>(), {
  tool: 'pen',
  color: '#111111',
  size: 4,
  opacity: 1,
  strokes: () => [],
  assets: () => [],
  width: 920,
  height: 1200,
  zoom: 1,
})

const emit = defineEmits<{
  'stroke-add': [stroke: Stroke]
  'stroke-update': [stroke: Stroke]
  'stroke-delete': [strokeId: string]
  'asset-add': [asset: Asset]
  'asset-update': [asset: Asset]
  'asset-delete': [assetId: string]
  'select': [id: string | null]
}>()

// Refs
const containerRef = ref<HTMLElement | null>(null)
const stageRef = ref<InstanceType<typeof Konva.Stage> | null>(null)
const strokesLayerRef = ref(null)
const assetsLayerRef = ref(null)
const uiLayerRef = ref(null)
const transformerRef = ref<{ getNode: () => Konva.Transformer } | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// State
const isDrawing = ref(false)
const currentPoints = ref<Point[]>([])
const shapePreview = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const selectedNode = ref<Konva.Node | null>(null)
const editingText = ref<Stroke | null>(null)
const editingTextValue = ref('')
const loadedImages = reactive<Map<string, HTMLImageElement>>(new Map())

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
}))

const strokes = computed(() => props.strokes)
const assets = computed(() => props.assets)

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
  isDrawing.value = true
  currentPoints.value = [pos]
  
  if (currentTool.value === 'rectangle' || currentTool.value === 'line' || currentTool.value === 'circle') {
    shapePreview.value = { x: pos.x, y: pos.y, width: 0, height: 0 }
  }
}

function handleMouseMove(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): void {
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
}

function handleMouseUp(): void {
  if (!isDrawing.value) return
  isDrawing.value = false

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
  
  editingText.value = stroke
  editingTextValue.value = ''
  
  // Use double nextTick to ensure DOM is fully updated
  nextTick(() => {
    nextTick(() => {
      console.log('[BoardCanvas] Focusing textarea', textareaRef.value)
      if (textareaRef.value) {
        textareaRef.value.focus()
        // Ensure textarea is visible by scrolling into view if needed
        textareaRef.value.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
    })
  })
}

function handleTextEdit(stroke: Stroke): void {
  editingText.value = stroke
  editingTextValue.value = stroke.text || ''
  
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
}

function handlePaste(e: ClipboardEvent): void {
  const items = e.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const blob = item.getAsFile()
      if (blob) {
        const reader = new FileReader()
        reader.onload = (event) => {
          const src = event.target?.result as string
          const img = new Image()
          img.onload = () => {
            // Scale if too large
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
              src,
              x: (props.width - w) / 2,
              y: 100,
              w,
              h,
              rotation: 0,
            }
            
            emit('asset-add', asset)
          }
          img.src = src
        }
        reader.readAsDataURL(blob)
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
  
  e.cancelBubble = true
  selectedNode.value = e.target
  emit('select', stroke.id)
  
  // Attach transformer
  nextTick(() => {
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
  
  e.cancelBubble = true
  selectedNode.value = e.target
  emit('select', asset.id)
  
  // Attach transformer
  nextTick(() => {
    const transformer = transformerRef.value?.getNode()
    if (transformer && e.target) {
      transformer.nodes([e.target])
    }
  })
}

// Stroke configs
function getStrokeConfig(stroke: Stroke): Record<string, unknown> {
  if (stroke.points.length < 2) return { visible: false }
  
  const strokePath = getSvgPathFromStroke(
    getStroke(stroke.points.map(p => [p.x, p.y]), {
      size: stroke.size,
      thinning: 0.5,
      smoothing: 0.5,
      streamline: 0.5,
    })
  )
  
  return {
    id: stroke.id,
    name: `stroke-${stroke.id}`,
    data: strokePath,
    fill: stroke.color,
    opacity: stroke.opacity,
    globalCompositeOperation: stroke.tool === 'highlighter' ? 'multiply' : 'source-over',
    draggable: currentTool.value === 'select',
  }
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
  }
}

function getAssetConfig(asset: Asset): Record<string, unknown> {
  let image = loadedImages.get(asset.src)
  
  if (!image) {
    image = new Image()
    image.src = asset.src
    image.onload = () => {
      loadedImages.set(asset.src, image!)
      // Force re-render
      stageRef.value?.getStage()?.batchDraw()
    }
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
onMounted(() => {
  containerRef.value?.focus()
  // Register paste listener globally
  document.addEventListener('paste', handlePaste as EventListener)
})

onUnmounted(() => {
  document.removeEventListener('paste', handlePaste as EventListener)
})

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
  overflow: auto;
  background: var(--board-canvas-bg, #f8fafc);
  outline: none;
}

.board-canvas:focus {
  outline: 2px solid var(--color-brand, #2563eb);
  outline-offset: -2px;
}

.text-edit-overlay {
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
