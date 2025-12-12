<template>
  <div
    ref="wrapperRef"
    class="solo-canvas-wrapper"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
    @touchstart.prevent="handleTouchStart"
    @touchmove.prevent="handleTouchMove"
    @touchend.prevent="handleTouchEnd"
  >
    <canvas
      ref="canvasRef"
      class="solo-canvas"
      :class="{ 'solo-canvas--pan': isPanning }"
      :style="canvasStyle"
      :width="canvasWidth"
      :height="canvasHeight"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import type { Tool, PageState, Stroke, Shape, TextElement } from '../../types/solo'
import { DrawingEngine } from '../../engine/DrawingEngine'

const props = defineProps<{
  page: PageState
  tool: Tool
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

const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const engine = ref<DrawingEngine | null>(null)

const canvasWidth = ref(1920)
const canvasHeight = ref(1080)
const isPanning = ref(false)
const isSpacePressed = ref(false)
const lastPanPoint = ref<{ x: number; y: number } | null>(null)

const canvasStyle = computed(() => ({
  width: `${canvasWidth.value}px`,
  height: `${canvasHeight.value}px`,
  transform: `translate(-50%, -50%) scale(${props.zoom}) translate(${props.panX}px, ${props.panY}px)`,
}))

watch(
  () => props.page,
  () => {
    render()
  },
  { deep: true }
)

watch(
  () => [props.tool, props.color, props.size],
  () => {
    if (engine.value) {
      engine.value.setTool(props.tool)
      engine.value.setColor(props.color)
      engine.value.setSize(props.size)
    }
  }
)

function render(): void {
  if (engine.value) {
    engine.value.renderPage(props.page)
  }
}

function handleMouseDown(e: MouseEvent): void {
  if (isSpacePressed.value || e.button === 1) {
    isPanning.value = true
    lastPanPoint.value = { x: e.clientX, y: e.clientY }
    return
  }

  if (!engine.value) return

  if (['pen', 'highlighter', 'eraser'].includes(props.tool)) {
    engine.value.startStroke(e.clientX, e.clientY)
  } else if (['line', 'rectangle', 'circle'].includes(props.tool)) {
    engine.value.startShape(e.clientX, e.clientY)
  } else if (['text', 'note'].includes(props.tool)) {
    const text = prompt('Enter text:')
    if (text) {
      const textEl = engine.value.createText(e.clientX, e.clientY, text)
      emit('text-create', textEl)
    }
  }
}

function handleMouseMove(e: MouseEvent): void {
  if (isPanning.value && lastPanPoint.value) {
    const dx = (e.clientX - lastPanPoint.value.x) / props.zoom
    const dy = (e.clientY - lastPanPoint.value.y) / props.zoom
    emit('pan-change', props.panX + dx, props.panY + dy)
    lastPanPoint.value = { x: e.clientX, y: e.clientY }
    return
  }

  if (!engine.value) return

  if (['pen', 'highlighter', 'eraser'].includes(props.tool)) {
    engine.value.continueStroke(e.clientX, e.clientY)
    render()
  } else if (['line', 'rectangle', 'circle'].includes(props.tool)) {
    engine.value.continueShape(e.clientX, e.clientY)
    render()
  }
}

function handleMouseUp(): void {
  if (isPanning.value) {
    isPanning.value = false
    lastPanPoint.value = null
    return
  }

  if (!engine.value) return

  if (['pen', 'highlighter', 'eraser'].includes(props.tool)) {
    const stroke = engine.value.endStroke()
    if (stroke && stroke.points.length > 1) {
      emit('stroke-end', stroke)
    }
  } else if (['line', 'rectangle', 'circle'].includes(props.tool)) {
    const shape = engine.value.endShape()
    if (shape) {
      emit('shape-end', shape)
    }
  }

  render()
}

function handleTouchStart(e: TouchEvent): void {
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY, button: 0 } as MouseEvent)
  } else if (e.touches.length === 2) {
    isPanning.value = true
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
    lastPanPoint.value = { x: midX, y: midY }
  }
}

function handleTouchMove(e: TouchEvent): void {
  if (e.touches.length === 1) {
    const touch = e.touches[0]
    handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent)
  } else if (e.touches.length === 2 && lastPanPoint.value) {
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
    const dx = (midX - lastPanPoint.value.x) / props.zoom
    const dy = (midY - lastPanPoint.value.y) / props.zoom
    emit('pan-change', props.panX + dx, props.panY + dy)
    lastPanPoint.value = { x: midX, y: midY }
  }
}

function handleTouchEnd(): void {
  handleMouseUp()
}

function handleKeyDown(e: KeyboardEvent): void {
  if (e.code === 'Space') {
    isSpacePressed.value = true
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  if (e.code === 'Space') {
    isSpacePressed.value = false
  }
}

function handleWheel(e: WheelEvent): void {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    const newZoom = Math.max(0.25, Math.min(4, props.zoom + delta))
    emit('zoom-change', newZoom)
  }
}

onMounted(() => {
  if (canvasRef.value) {
    engine.value = new DrawingEngine(canvasRef.value)
    engine.value.setTool(props.tool)
    engine.value.setColor(props.color)
    engine.value.setSize(props.size)
    render()
  }

  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  wrapperRef.value?.addEventListener('wheel', handleWheel, { passive: false })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  wrapperRef.value?.removeEventListener('wheel', handleWheel)
})

defineExpose({
  getCanvas: () => canvasRef.value,
  render,
})
</script>
