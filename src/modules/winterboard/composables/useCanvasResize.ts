// WB: useCanvasResize — reactive container sizing via ResizeObserver
// Ref: RESPONSIVE_STRATEGY.md §4, AGENT_RULES.md §5.4
//
// Replaces static window.innerWidth/innerHeight for canvas dimensions.
// Uses ResizeObserver on a container element so Konva stage always fits
// the available space — critical for tablet/mobile where viewport changes
// (fullscreen toggle, address bar, orientation).
//
// INV-1: Canvas NEVER resizes — only stage.scale() + stage.position()
// INV-5: Never use 100vh — use visualViewport API

import { ref, computed, watch, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'

interface UseCanvasResizeOptions {
  /** Reference to the container element */
  containerRef: Ref<HTMLElement | null>
  /** Callback when size changes */
  onResize?: (width: number, height: number) => void
  /** Debounce delay in ms */
  debounceMs?: number
}

// ── Viewport Transform (Phase 1: A2) ───────────────────────────────

/** Logical page dimensions — constant, never changes (INV-1) */
export const PAGE_WIDTH = 1920
export const PAGE_HEIGHT = 1080

/** Minimum / maximum zoom bounds */
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 5.0

/**
 * Initial fit-zoom margin — makes grey workspace visible on first load.
 * Page occupies 92% of the viewport at fit-zoom; 4% grey on each side.
 * Applied only to the composable's `fitZoom` ref, not to `calculateFitZoom`
 * (so pure-function tests remain unchanged).
 */
export const FIT_MARGIN = 0.92

/**
 * Calculate optimal zoom to fit page in container (fit-to-container).
 * Returns scale factor such that the entire page is visible within the container.
 * INV-1: This is used for stage.scale(), NOT stage.width/height.
 */
export function calculateFitZoom(
  containerWidth: number,
  containerHeight: number,
  pageWidth: number = PAGE_WIDTH,
  pageHeight: number = PAGE_HEIGHT,
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 1
  if (pageWidth <= 0 || pageHeight <= 0) return 1

  const scaleX = containerWidth / pageWidth
  const scaleY = containerHeight / pageHeight
  return Math.min(scaleX, scaleY)
}

/**
 * Clamp zoom within allowed bounds.
 */
export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

/**
 * Calculate the offset to center the page within the container at a given zoom level.
 * INV-1: This is used for stage.position(), NOT changing page coordinates.
 */
export function calculateCenterOffset(
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number,
  zoom: number,
): { x: number; y: number } {
  const scaledPageWidth = pageWidth * zoom
  const scaledPageHeight = pageHeight * zoom
  return {
    x: Math.max(0, (containerWidth - scaledPageWidth) / 2),
    y: Math.max(0, (containerHeight - scaledPageHeight) / 2),
  }
}

// ── Main composable ─────────────────────────────────────────────────

export function useCanvasResize(options: UseCanvasResizeOptions) {
  const { containerRef, onResize, debounceMs = 100 } = options

  const width = ref(0)
  const height = ref(0)

  // INV-5: Real viewport height from visualViewport API (iOS Safari safe area)
  const visualViewportHeight = ref(typeof window !== 'undefined' ? window.innerHeight : 0)

  let observer: ResizeObserver | null = null
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let orientationTimeoutId: ReturnType<typeof setTimeout> | null = null

  function updateSize() {
    const el = containerRef.value
    if (!el) return

    const rect = el.getBoundingClientRect()
    const newWidth = Math.floor(rect.width)
    const newHeight = Math.floor(rect.height)

    if (newWidth === width.value && newHeight === height.value) return
    if (newWidth <= 0 || newHeight <= 0) return

    width.value = newWidth
    height.value = newHeight
    onResize?.(newWidth, newHeight)
  }

  function debouncedUpdate() {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(updateSize, debounceMs)
  }

  function handleOrientationChange() {
    // Viewport needs time to stabilize after orientation change
    if (orientationTimeoutId) clearTimeout(orientationTimeoutId)
    orientationTimeoutId = setTimeout(updateSize, 150)
  }

  // INV-5: Update --wb-vh CSS variable from visualViewport
  function updateVisualViewport() {
    if (typeof window === 'undefined') return
    const vv = (window as any).visualViewport
    if (vv) {
      visualViewportHeight.value = vv.height
      document.documentElement.style.setProperty(
        '--wb-vh',
        `${vv.height * 0.01}px`,
      )
    } else {
      visualViewportHeight.value = window.innerHeight
      document.documentElement.style.setProperty(
        '--wb-vh',
        '1vh',
      )
    }
  }

  // ── Computed viewport transform (INV-1) ────────────────────────

  /** Optimal zoom to fit the page in the current container (includes FIT_MARGIN) */
  const fitZoom: ComputedRef<number> = computed(() =>
    calculateFitZoom(width.value, height.value) * FIT_MARGIN,
  )

  /** Center offset at fitZoom level */
  const fitOffset: ComputedRef<{ x: number; y: number }> = computed(() =>
    calculateCenterOffset(
      width.value,
      height.value,
      PAGE_WIDTH,
      PAGE_HEIGHT,
      fitZoom.value,
    ),
  )

  /**
   * Attach ResizeObserver to the container. Idempotent — disconnects any
   * previous observer first. Safe to call whenever containerRef changes.
   */
  function attachObserver() {
    if (observer) {
      observer.disconnect()
      observer = null
    }
    const el = containerRef.value
    if (!el) return
    updateSize()
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(debouncedUpdate)
      observer.observe(el)
    }
  }

  onMounted(() => {
    if (typeof window === 'undefined') return

    // INV-5: Initial visualViewport sync
    updateVisualViewport()

    // Attach observer if container already present at mount (edit-mode views).
    // For views where the container renders later (e.g. WBPublicView behind a
    // v-if="isLoading" guard), the watch() below attaches it once it appears.
    attachObserver()

    // Handle orientation change (mobile/tablet)
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true })

    // INV-5: visualViewport resize (iOS Safari keyboard, address bar)
    const vv = (window as any).visualViewport
    if (vv) {
      vv.addEventListener('resize', updateVisualViewport)
    }
  })

  // Re-attach observer whenever the container element appears/changes.
  // CRITICAL for views that render the canvas after async load (container ref
  // is null at mount → onMounted's attach is a no-op → without this watch the
  // observer would never attach and auto-fit would never run).
  watch(containerRef, (el) => {
    if (el) attachObserver()
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
    if (timeoutId) clearTimeout(timeoutId)
    if (orientationTimeoutId) clearTimeout(orientationTimeoutId)

    if (typeof window !== 'undefined') {
      window.removeEventListener('orientationchange', handleOrientationChange)
      const vv = (window as any).visualViewport
      if (vv) {
        vv.removeEventListener('resize', updateVisualViewport)
      }
    }
  })

  return {
    /** Current container width (px) */
    width,
    /** Current container height (px) */
    height,
    /** Force immediate recalculation */
    recalculate: updateSize,
    /** INV-5: Real viewport height from visualViewport API */
    visualViewportHeight,
    /** INV-1: Optimal zoom to fit page in container */
    fitZoom,
    /** INV-1: Center offset at fitZoom level */
    fitOffset,
  }
}
