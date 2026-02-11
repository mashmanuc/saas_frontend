import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue'
import type { Stroke, Shape, PageState } from '../types/solo'

// Performance metrics (dev mode only)
export interface PerformanceMetrics {
  renderTime: number
  strokeCount: number
  shapeCount: number
  activeCanvases: number
  memoryUsage?: number
  timestamp: number
}

export interface BatchedStrokes {
  key: string // color-size combo
  color: string
  size: number
  strokes: Stroke[]
}

export interface UseCanvasOptimizationOptions {
  enableMetrics?: boolean
  batchingEnabled?: boolean
  cachingEnabled?: boolean
  lazyRenderingEnabled?: boolean
  visibleBuffer?: number // pages to preload above/below
}

// Check if running in development mode
const isDev = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development'

// Performance metrics storage
const metricsHistory: PerformanceMetrics[] = []
const MAX_METRICS_HISTORY = 100

export function useCanvasOptimization(options: UseCanvasOptimizationOptions = {}) {
  const {
    enableMetrics = isDev,
    batchingEnabled = true,
    cachingEnabled = true,
    lazyRenderingEnabled = true,
    visibleBuffer = 1,
  } = options

  // State
  const renderStartTime = ref(0)
  const lastRenderTime = ref(0)
  const activeCanvasCount = ref(0)
  const currentMetrics = ref<PerformanceMetrics | null>(null)

  // Batch strokes by color and size for efficient rendering
  function batchStrokes(strokes: Stroke[]): BatchedStrokes[] {
    if (!batchingEnabled || strokes.length === 0) {
      return [{
        key: 'all',
        color: '',
        size: 0,
        strokes,
      }]
    }

    const batches = new Map<string, BatchedStrokes>()

    for (const stroke of strokes) {
      const key = `${stroke.color}-${stroke.size}`

      if (!batches.has(key)) {
        batches.set(key, {
          key,
          color: stroke.color,
          size: stroke.size,
          strokes: [],
        })
      }

      batches.get(key)!.strokes.push(stroke)
    }

    return Array.from(batches.values())
  }

  // Check if a page should be rendered (lazy rendering)
  function shouldRenderPage(
    pageIndex: number,
    activePageIndex: number,
    totalPages: number
  ): boolean {
    if (!lazyRenderingEnabled) return true

    const minVisible = Math.max(0, activePageIndex - visibleBuffer)
    const maxVisible = Math.min(totalPages - 1, activePageIndex + visibleBuffer)

    return pageIndex >= minVisible && pageIndex <= maxVisible
  }

  // Get visible page indices
  function getVisiblePageIndices(
    activePageIndex: number,
    totalPages: number
  ): number[] {
    const minVisible = Math.max(0, activePageIndex - visibleBuffer)
    const maxVisible = Math.min(totalPages - 1, activePageIndex + visibleBuffer)

    const indices: number[] = []
    for (let i = minVisible; i <= maxVisible; i++) {
      indices.push(i)
    }
    return indices
  }

  // Start measuring render time
  function startRenderMeasure(): void {
    if (!enableMetrics) return
    renderStartTime.value = performance.now()
  }

  // End measuring and record metrics
  function endRenderMeasure(page: PageState): void {
    if (!enableMetrics) return

    const endTime = performance.now()
    lastRenderTime.value = endTime - renderStartTime.value

    const metrics: PerformanceMetrics = {
      renderTime: lastRenderTime.value,
      strokeCount: page.strokes?.length || 0,
      shapeCount: page.shapes?.length || 0,
      activeCanvases: activeCanvasCount.value,
      timestamp: Date.now(),
    }

    // Try to get memory usage (Chrome only)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory
      metrics.memoryUsage = memInfo?.usedJSHeapSize
    }

    currentMetrics.value = metrics
    metricsHistory.push(metrics)

    // Keep only recent metrics
    if (metricsHistory.length > MAX_METRICS_HISTORY) {
      metricsHistory.shift()
    }

    // Log in dev mode
    if (isDev && lastRenderTime.value > 16) { // > 16ms = below 60fps
      console.warn(
        `[Canvas Performance] Slow render: ${lastRenderTime.value.toFixed(2)}ms`,
        `(${metrics.strokeCount} strokes, ${metrics.shapeCount} shapes)`
      )
    }
  }

  // Register canvas mount
  function registerCanvas(): void {
    activeCanvasCount.value++
    if (enableMetrics && isDev) {
      console.log(`[Canvas] Mounted. Active: ${activeCanvasCount.value}`)
    }
  }

  // Register canvas unmount
  function unregisterCanvas(): void {
    activeCanvasCount.value = Math.max(0, activeCanvasCount.value - 1)
    if (enableMetrics && isDev) {
      console.log(`[Canvas] Unmounted. Active: ${activeCanvasCount.value}`)
    }
  }

  // Get Konva cache config for complex shapes
  function getCacheConfig(strokeCount: number): { enabled: boolean; pixelRatio?: number } {
    if (!cachingEnabled) return { enabled: false }

    // Cache if many strokes (performance benefit outweighs memory cost)
    if (strokeCount > 100) {
      return {
        enabled: true,
        pixelRatio: window.devicePixelRatio || 1,
      }
    }

    return { enabled: false }
  }

  // Simplify stroke points for faster rendering (Douglas-Peucker-like)
  function simplifyPoints(
    points: Array<{ x: number; y: number }>,
    tolerance: number = 1
  ): Array<{ x: number; y: number }> {
    if (points.length <= 2) return points

    const simplified: Array<{ x: number; y: number }> = [points[0]]
    let lastPoint = points[0]

    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i]
      const distance = Math.sqrt(
        Math.pow(point.x - lastPoint.x, 2) +
        Math.pow(point.y - lastPoint.y, 2)
      )

      if (distance >= tolerance) {
        simplified.push(point)
        lastPoint = point
      }
    }

    simplified.push(points[points.length - 1])
    return simplified
  }

  // Get average metrics
  function getAverageMetrics(): { avgRenderTime: number; avgStrokeCount: number } {
    if (metricsHistory.length === 0) {
      return { avgRenderTime: 0, avgStrokeCount: 0 }
    }

    const totalRenderTime = metricsHistory.reduce((sum, m) => sum + m.renderTime, 0)
    const totalStrokes = metricsHistory.reduce((sum, m) => sum + m.strokeCount, 0)

    return {
      avgRenderTime: totalRenderTime / metricsHistory.length,
      avgStrokeCount: totalStrokes / metricsHistory.length,
    }
  }

  // Print performance report (dev mode)
  function printPerformanceReport(): void {
    if (!isDev) return

    const avg = getAverageMetrics()
    console.group('[Canvas Performance Report]')
    console.log(`Active canvases: ${activeCanvasCount.value}`)
    console.log(`Last render time: ${lastRenderTime.value.toFixed(2)}ms`)
    console.log(`Average render time: ${avg.avgRenderTime.toFixed(2)}ms`)
    console.log(`Average stroke count: ${avg.avgStrokeCount.toFixed(0)}`)
    console.log(`Metrics samples: ${metricsHistory.length}`)

    if (currentMetrics.value?.memoryUsage) {
      const mb = currentMetrics.value.memoryUsage / (1024 * 1024)
      console.log(`Memory usage: ${mb.toFixed(2)}MB`)
    }

    console.groupEnd()
  }

  // Clear metrics history
  function clearMetrics(): void {
    metricsHistory.length = 0
    currentMetrics.value = null
  }

  // Expose dev console commands
  if (isDev && typeof window !== 'undefined') {
    (window as any).__soloCanvasPerf = {
      getMetrics: () => currentMetrics.value,
      getHistory: () => metricsHistory,
      getAverage: getAverageMetrics,
      printReport: printPerformanceReport,
      clear: clearMetrics,
    }
  }

  return {
    // State
    lastRenderTime,
    activeCanvasCount,
    currentMetrics,

    // Batching
    batchStrokes,

    // Lazy rendering
    shouldRenderPage,
    getVisiblePageIndices,

    // Metrics
    startRenderMeasure,
    endRenderMeasure,
    getAverageMetrics,
    printPerformanceReport,

    // Canvas lifecycle
    registerCanvas,
    unregisterCanvas,

    // Caching
    getCacheConfig,

    // Point simplification
    simplifyPoints,

    // Cleanup
    clearMetrics,
  }
}

export default useCanvasOptimization
