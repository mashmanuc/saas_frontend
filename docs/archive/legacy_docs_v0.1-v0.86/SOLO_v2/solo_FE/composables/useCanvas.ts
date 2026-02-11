import { ref, computed, onMounted, onUnmounted, type Ref } from 'vue'
import type { Point } from '../types/solo'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 4
const ZOOM_STEP = 0.1

export function useCanvas(canvasRef: Ref<HTMLCanvasElement | null>) {
  const zoom = ref(1)
  const pan = ref<Point>({ x: 0, y: 0 })
  const isPanning = ref(false)
  const lastPanPoint = ref<Point | null>(null)

  const canvasWidth = ref(1920)
  const canvasHeight = ref(1080)

  const transform = computed(() => ({
    zoom: zoom.value,
    pan: pan.value,
  }))

  const canvasStyle = computed(() => ({
    width: `${canvasWidth.value}px`,
    height: `${canvasHeight.value}px`,
    transform: `translate(-50%, -50%) scale(${zoom.value}) translate(${pan.value.x}px, ${pan.value.y}px)`,
  }))

  function zoomIn(): void {
    zoom.value = Math.min(MAX_ZOOM, zoom.value + ZOOM_STEP)
  }

  function zoomOut(): void {
    zoom.value = Math.max(MIN_ZOOM, zoom.value - ZOOM_STEP)
  }

  function resetZoom(): void {
    zoom.value = 1
    pan.value = { x: 0, y: 0 }
  }

  function setZoom(value: number): void {
    zoom.value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
  }

  function startPan(x: number, y: number): void {
    isPanning.value = true
    lastPanPoint.value = { x, y }
  }

  function continuePan(x: number, y: number): void {
    if (!isPanning.value || !lastPanPoint.value) return

    const dx = (x - lastPanPoint.value.x) / zoom.value
    const dy = (y - lastPanPoint.value.y) / zoom.value

    pan.value = {
      x: pan.value.x + dx,
      y: pan.value.y + dy,
    }

    lastPanPoint.value = { x, y }
  }

  function endPan(): void {
    isPanning.value = false
    lastPanPoint.value = null
  }

  function handleWheel(e: WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      setZoom(zoom.value + delta)
    }
  }

  function fitToScreen(containerWidth: number, containerHeight: number): void {
    const scaleX = containerWidth / canvasWidth.value
    const scaleY = containerHeight / canvasHeight.value
    const scale = Math.min(scaleX, scaleY, 1) * 0.9
    zoom.value = scale
    pan.value = { x: 0, y: 0 }
  }

  function resizeCanvas(width: number, height: number): void {
    canvasWidth.value = width
    canvasHeight.value = height
  }

  onMounted(() => {
    const canvas = canvasRef.value
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false })
    }
  })

  onUnmounted(() => {
    const canvas = canvasRef.value
    if (canvas) {
      canvas.removeEventListener('wheel', handleWheel)
    }
  })

  return {
    zoom,
    pan,
    isPanning,
    canvasWidth,
    canvasHeight,
    transform,
    canvasStyle,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoom,
    startPan,
    continuePan,
    endPan,
    fitToScreen,
    resizeCanvas,
    MIN_ZOOM,
    MAX_ZOOM,
  }
}
