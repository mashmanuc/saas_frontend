// WB: useCanvasResize — reactive container sizing via ResizeObserver
// Ref: RESPONSIVE_STRATEGY.md §4, AGENT_RULES.md §5.4
//
// Replaces static window.innerWidth/innerHeight for canvas dimensions.
// Uses ResizeObserver on a container element so Konva stage always fits
// the available space — critical for tablet/mobile where viewport changes
// (fullscreen toggle, address bar, orientation).

import { ref, onMounted, onUnmounted, type Ref } from 'vue'

interface UseCanvasResizeOptions {
  /** Reference to the container element */
  containerRef: Ref<HTMLElement | null>
  /** Callback when size changes */
  onResize?: (width: number, height: number) => void
  /** Debounce delay in ms */
  debounceMs?: number
}

export function useCanvasResize(options: UseCanvasResizeOptions) {
  const { containerRef, onResize, debounceMs = 100 } = options

  const width = ref(0)
  const height = ref(0)

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

  onMounted(() => {
    if (!containerRef.value) return

    // Initial size
    updateSize()

    // ResizeObserver for container size changes
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(debouncedUpdate)
      observer.observe(containerRef.value)
    }

    // Handle orientation change (mobile/tablet)
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true })
  })

  onUnmounted(() => {
    observer?.disconnect()
    observer = null
    if (timeoutId) clearTimeout(timeoutId)
    if (orientationTimeoutId) clearTimeout(orientationTimeoutId)
    window.removeEventListener('orientationchange', handleOrientationChange)
  })

  return {
    /** Current container width (px) */
    width,
    /** Current container height (px) */
    height,
    /** Force immediate recalculation */
    recalculate: updateSize,
  }
}
