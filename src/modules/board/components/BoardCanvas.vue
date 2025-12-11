<template>
  <div ref="containerRef" class="relative h-[400px] w-full rounded-3xl bg-white shadow-inner overflow-hidden touch-none">
    <canvas
      ref="canvasRef"
      class="absolute inset-0 h-full w-full touch-none"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointercancel="handlePointerUp"
      @pointerleave="handlePointerLeave"
    ></canvas>
    <div class="absolute inset-0 pointer-events-none">
      <div
        v-for="cursor in remoteCursors"
        :key="cursor.userId"
        class="absolute flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-body shadow-theme"
        :style="cursorStyle(cursor)"
      >
        <span class="h-2 w-2 rounded-full bg-accent"></span>
        <span>{{ cursor.displayName }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useBoardStore } from '../../../stores/boardStore'
import { useAuthStore } from '../../auth/store/authStore'

const props = defineProps({
  tool: {
    type: String,
    default: 'pencil',
  },
  color: {
    type: String,
    default: '#111827',
  },
  thickness: {
    type: Number,
    default: 3,
  },
})

const boardStore = useBoardStore()
const authStore = useAuthStore()

const canvasRef = ref(null)
const containerRef = ref(null)
const ctx = ref(null)
const drawing = ref(false)
const currentStroke = reactive({
  id: null,
  tool: 'pencil',
  color: '#111827',
  thickness: 3,
  points: [],
})

let resizeObserver = null

const remoteCursors = computed(() =>
  boardStore.activeCursors.filter((cursor) => String(cursor.userId) !== String(authStore.user?.id)),
)

onMounted(() => {
  initCanvas()
  resizeObserver = new ResizeObserver(() => {
    resizeCanvas()
    redraw()
  })
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value)
  }
})

onBeforeUnmount(() => {
  stopDrawing()
  if (resizeObserver && containerRef.value) {
    resizeObserver.unobserve(containerRef.value)
  }
  resizeObserver = null
})

watch(
  () => boardStore.strokes,
  () => {
    redraw()
  },
  { deep: true },
)

function initCanvas() {
  if (!canvasRef.value) return
  ctx.value = canvasRef.value.getContext('2d')
  resizeCanvas()
  redraw()
}

function resizeCanvas() {
  if (!canvasRef.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvasRef.value.width = rect.width * dpr
  canvasRef.value.height = rect.height * dpr
  canvasRef.value.style.width = `${rect.width}px`
  canvasRef.value.style.height = `${rect.height}px`
  ctx.value.scale(dpr, dpr)
}

function handlePointerDown(event) {
  if (event.button !== 0) return
  event.preventDefault()
  drawing.value = true
  currentStroke.id = `local-${Date.now()}`
  currentStroke.tool = props.tool
  currentStroke.color = props.color
  currentStroke.thickness = props.thickness
  currentStroke.points = []
  addPoint(event, true)
  canvasRef.value?.setPointerCapture?.(event.pointerId)
}

function handlePointerMove(event) {
  const point = getNormalizedPoint(event)
  if (!point) return
  boardStore.sendCursor(point)
  if (!drawing.value) return
  addPoint(event, true)
}

function handlePointerUp(event) {
  if (!drawing.value) return
  addPoint(event, false)
  boardStore.addStroke({
    id: currentStroke.id,
    tool: currentStroke.tool,
    color: currentStroke.color,
    thickness: currentStroke.thickness,
    points: [...currentStroke.points],
  })
  stopDrawing()
  canvasRef.value?.releasePointerCapture?.(event.pointerId)
}

function handlePointerLeave() {
  if (drawing.value) {
    stopDrawing()
  }
}

function stopDrawing() {
  drawing.value = false
  currentStroke.points = []
}

function addPoint(event, drawPreview) {
  const point = getNormalizedPoint(event)
  if (!point) return
  currentStroke.points.push(point)
  if (drawPreview && currentStroke.points.length > 1) {
    const prev = currentStroke.points[currentStroke.points.length - 2]
    drawSegment(prev, point, currentStroke)
  }
}

function getNormalizedPoint(event) {
  if (!canvasRef.value || !containerRef.value) return null
  const rect = containerRef.value.getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  if (Number.isNaN(x) || Number.isNaN(y)) return null
  return {
    x: Math.min(Math.max(x, 0), 1),
    y: Math.min(Math.max(y, 0), 1),
  }
}

function drawSegment(prevPoint, nextPoint, stroke) {
  if (!ctx.value || !canvasRef.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const prev = denormalizePoint(prevPoint, rect)
  const next = denormalizePoint(nextPoint, rect)
  ctx.value.save()
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
  ctx.value.lineWidth = stroke.thickness
  if (stroke.tool === 'eraser') {
    ctx.value.globalCompositeOperation = 'destination-out'
    ctx.value.strokeStyle = 'rgba(0,0,0,1)'
  } else {
    ctx.value.globalCompositeOperation = 'source-over'
    ctx.value.strokeStyle = stroke.color
  }
  ctx.value.beginPath()
  ctx.value.moveTo(prev.x, prev.y)
  ctx.value.lineTo(next.x, next.y)
  ctx.value.stroke()
  ctx.value.restore()
}

function redraw() {
  if (!ctx.value || !canvasRef.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  ctx.value.save()
  ctx.value.setTransform(1, 0, 0, 1, 0, 0)
  ctx.value.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  ctx.value.restore()
  boardStore.strokes.forEach((stroke) => {
    drawStroke(stroke, rect)
  })
}

function drawStroke(stroke, rect) {
  if (!ctx.value || !stroke?.points?.length) return
  ctx.value.save()
  ctx.value.lineCap = 'round'
  ctx.value.lineJoin = 'round'
  ctx.value.lineWidth = stroke.thickness
  if (stroke.tool === 'eraser' || stroke.composite === 'destination-out') {
    ctx.value.globalCompositeOperation = 'destination-out'
    ctx.value.strokeStyle = 'rgba(0,0,0,1)'
  } else {
    ctx.value.globalCompositeOperation = 'source-over'
    ctx.value.strokeStyle = stroke.color || '#111827'
  }
  ctx.value.beginPath()
  const [firstPoint, ...otherPoints] = stroke.points
  const first = denormalizePoint(firstPoint, rect)
  ctx.value.moveTo(first.x, first.y)
  otherPoints.forEach((point) => {
    const abs = denormalizePoint(point, rect)
    ctx.value.lineTo(abs.x, abs.y)
  })
  ctx.value.stroke()
  ctx.value.restore()
}

function denormalizePoint(point, rect) {
  return {
    x: point.x * rect.width,
    y: point.y * rect.height,
  }
}

function cursorStyle(cursor) {
  if (!containerRef.value) return {}
  return {
    left: `${cursor.x * 100}%`,
    top: `${cursor.y * 100}%`,
    transform: 'translate(-50%, -50%)',
  }
}
</script>

<style scoped>
.text-body {
  color: rgba(7, 15, 30, 0.9);
}
.bg-accent {
  background: linear-gradient(135deg, #2563eb, #7c3aed);
}
</style>
