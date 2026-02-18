// WB: useTouchGestures — advanced touch gesture system for Winterboard canvas
// Ref: TASK_BOARD_PHASES.md B4.1, LAW-15 (drawing fidelity), LAW-20 (zoom/pan)
//
// Gestures:
//   1 finger  = draw (drawing mode) / select (selection mode)
//   2 fingers = pan + pinch-to-zoom
//   3 fingers = swipe left (undo) / swipe right (redo)
//   Double-tap = zoom reset / select object
//   Long press = context menu
//   Edge swipe = open panels

import { ref, readonly, onBeforeUnmount, type Ref } from 'vue'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:TouchGestures]'

/** Minimum distance (px) to recognize a pan gesture */
const PAN_THRESHOLD = 5

/** Minimum scale change to recognize a pinch gesture */
const PINCH_THRESHOLD = 0.02

/** Minimum swipe distance (px) for 3-finger undo/redo */
const SWIPE_THRESHOLD = 60

/** Double-tap max interval (ms) */
const DOUBLE_TAP_MS = 300

/** Double-tap max distance (px) between taps */
const DOUBLE_TAP_DISTANCE = 30

/** Long press duration (ms) */
const LONG_PRESS_MS = 500

/** Edge zone width (px) from screen edge */
const EDGE_ZONE_PX = 24

/** Edge swipe minimum distance (px) */
const EDGE_SWIPE_MIN = 60

/** Inertia deceleration factor (0..1, lower = faster stop) */
const INERTIA_FRICTION = 0.92

/** Inertia minimum velocity to keep animating */
const INERTIA_MIN_VELOCITY = 0.5

/** Inertia velocity sampling window (ms) */
const VELOCITY_SAMPLE_MS = 100

/** Zoom limits */
const ZOOM_MIN = 0.25
const ZOOM_MAX = 4.0

/** Haptic vibration duration (ms) */
const HAPTIC_MS = 10

// ─── Types ──────────────────────────────────────────────────────────────────

export type GestureMode = 'drawing' | 'selection'

export interface GestureCallbacks {
  onPan: (dx: number, dy: number) => void
  onPanEnd: () => void
  onZoom: (zoom: number, centerX: number, centerY: number) => void
  onUndo: () => void
  onRedo: () => void
  onDoubleTap: (x: number, y: number) => void
  onLongPress: (x: number, y: number) => void
  onEdgeSwipeLeft: () => void
  onEdgeSwipeRight: () => void
}

export interface TouchGestureState {
  /** Current recognized gesture */
  activeGesture: Ref<ActiveGesture>
  /** Number of active touches */
  touchCount: Ref<number>
  /** Whether inertia animation is running */
  isInertiaActive: Ref<boolean>
  /** Whether long press ripple is showing */
  longPressActive: Ref<boolean>
  /** Long press position for ripple */
  longPressPosition: Ref<{ x: number; y: number } | null>
}

export type ActiveGesture =
  | 'none'
  | 'draw'
  | 'pan'
  | 'pinch'
  | 'three-finger-swipe'
  | 'long-press'
  | 'edge-swipe'

interface VelocitySample {
  x: number
  y: number
  t: number
}

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Advanced touch gesture system for Winterboard canvas.
 *
 * Handles: two-finger pan with inertia, pinch-to-zoom, three-finger undo/redo,
 * double-tap zoom reset, long press context menu, edge swipe panels.
 *
 * Integrates with usePalmRejection via filterTouch callback.
 *
 * @param containerRef - Ref to the canvas container element
 * @param callbacks - Gesture action callbacks
 * @param options - Configuration options
 */
export function useTouchGestures(
  containerRef: Ref<HTMLElement | null>,
  callbacks: GestureCallbacks,
  options: {
    mode?: Ref<GestureMode>
    currentZoom?: Ref<number>
    /** Palm rejection filter: return true if touch should be allowed */
    filterTouch?: (e: PointerEvent) => boolean
    /** Respect prefers-reduced-motion */
    reducedMotion?: boolean
  } = {},
) {
  // ── State ─────────────────────────────────────────────────────────

  const activeGesture = ref<ActiveGesture>('none')
  const touchCount = ref(0)
  const isInertiaActive = ref(false)
  const longPressActive = ref(false)
  const longPressPosition = ref<{ x: number; y: number } | null>(null)

  // Internal tracking
  const touches = new Map<number, { x: number; y: number; startX: number; startY: number; startTime: number }>()
  let pinchStartDist = 0
  let pinchStartZoom = 1
  let pinchCenterX = 0
  let pinchCenterY = 0

  // Pan velocity for inertia
  const velocitySamples: VelocitySample[] = []
  let lastPanX = 0
  let lastPanY = 0

  // Double-tap tracking
  let lastTapTime = 0
  let lastTapX = 0
  let lastTapY = 0

  // Long press
  let longPressTimer: ReturnType<typeof setTimeout> | null = null

  // Edge swipe
  let edgeSwipeStartX = 0
  let edgeSwipeStartY = 0
  let isEdgeSwipe = false
  let edgeSide: 'left' | 'right' | null = null

  // Three-finger swipe
  let threeFingerStartX = 0
  let threeFingerTriggered = false

  // Inertia animation
  let inertiaRaf = 0

  // ── Helpers ───────────────────────────────────────────────────────

  function getReducedMotion(): boolean {
    if (options.reducedMotion !== undefined) return options.reducedMotion
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  }

  function haptic(): void {
    try {
      navigator?.vibrate?.(HAPTIC_MS)
    } catch {
      // Not supported
    }
  }

  function getContainerRect(): DOMRect | null {
    return containerRef.value?.getBoundingClientRect() ?? null
  }

  function touchCenter(ids: number[]): { x: number; y: number } {
    let sx = 0, sy = 0, n = 0
    for (const id of ids) {
      const t = touches.get(id)
      if (t) { sx += t.x; sy += t.y; n++ }
    }
    return n > 0 ? { x: sx / n, y: sy / n } : { x: 0, y: 0 }
  }

  function touchDistance(id1: number, id2: number): number {
    const t1 = touches.get(id1)
    const t2 = touches.get(id2)
    if (!t1 || !t2) return 0
    const dx = t1.x - t2.x
    const dy = t1.y - t2.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  function addVelocitySample(x: number, y: number): void {
    const now = performance.now()
    velocitySamples.push({ x, y, t: now })
    // Keep only recent samples
    while (velocitySamples.length > 0 && now - velocitySamples[0].t > VELOCITY_SAMPLE_MS) {
      velocitySamples.shift()
    }
  }

  function computeVelocity(): { vx: number; vy: number } {
    if (velocitySamples.length < 2) return { vx: 0, vy: 0 }
    const first = velocitySamples[0]
    const last = velocitySamples[velocitySamples.length - 1]
    const dt = last.t - first.t
    if (dt < 1) return { vx: 0, vy: 0 }
    return {
      vx: (last.x - first.x) / dt * 16, // px per frame (~16ms)
      vy: (last.y - first.y) / dt * 16,
    }
  }

  // ── Inertia ───────────────────────────────────────────────────────

  function startInertia(vx: number, vy: number): void {
    if (getReducedMotion()) return
    if (Math.abs(vx) < INERTIA_MIN_VELOCITY && Math.abs(vy) < INERTIA_MIN_VELOCITY) return

    isInertiaActive.value = true
    let cvx = vx
    let cvy = vy

    const tick = () => {
      cvx *= INERTIA_FRICTION
      cvy *= INERTIA_FRICTION

      if (Math.abs(cvx) < INERTIA_MIN_VELOCITY && Math.abs(cvy) < INERTIA_MIN_VELOCITY) {
        isInertiaActive.value = false
        callbacks.onPanEnd()
        return
      }

      callbacks.onPan(-cvx, -cvy)
      inertiaRaf = requestAnimationFrame(tick)
    }

    inertiaRaf = requestAnimationFrame(tick)
  }

  function stopInertia(): void {
    if (inertiaRaf) {
      cancelAnimationFrame(inertiaRaf)
      inertiaRaf = 0
    }
    isInertiaActive.value = false
  }

  // ── Long press ────────────────────────────────────────────────────

  function startLongPressTimer(x: number, y: number): void {
    cancelLongPress()
    longPressTimer = setTimeout(() => {
      if (touchCount.value === 1 && activeGesture.value === 'none') {
        activeGesture.value = 'long-press'
        longPressActive.value = true
        longPressPosition.value = { x, y }
        haptic()
        console.info(`${LOG} Long press at (${x.toFixed(0)}, ${y.toFixed(0)})`)
        callbacks.onLongPress(x, y)
      }
    }, LONG_PRESS_MS)
  }

  function cancelLongPress(): void {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      longPressTimer = null
    }
    longPressActive.value = false
    longPressPosition.value = null
  }

  // ── Edge detection ────────────────────────────────────────────────

  function detectEdge(clientX: number): 'left' | 'right' | null {
    const rect = getContainerRect()
    if (!rect) return null
    const relX = clientX - rect.left
    if (relX < EDGE_ZONE_PX) return 'left'
    if (relX > rect.width - EDGE_ZONE_PX) return 'right'
    return null
  }

  // ── Gesture resolution ────────────────────────────────────────────

  function resolveGesture(): void {
    const count = touchCount.value

    if (count === 0) {
      activeGesture.value = 'none'
      return
    }

    if (count === 1) {
      // Edge swipe or draw/select — determined on move
      if (isEdgeSwipe) {
        activeGesture.value = 'edge-swipe'
      }
      // Otherwise stays 'none' until movement threshold
      return
    }

    if (count === 2) {
      // Pan + pinch
      const ids = [...touches.keys()]
      if (ids.length >= 2) {
        pinchStartDist = touchDistance(ids[0], ids[1])
        pinchStartZoom = options.currentZoom?.value ?? 1
        const center = touchCenter(ids)
        const rect = getContainerRect()
        if (rect) {
          pinchCenterX = center.x - rect.left
          pinchCenterY = center.y - rect.top
        }
        lastPanX = center.x
        lastPanY = center.y
        velocitySamples.length = 0
      }
      activeGesture.value = 'pinch'
      cancelLongPress()
      return
    }

    if (count >= 3) {
      // Three-finger swipe
      const center = touchCenter([...touches.keys()])
      threeFingerStartX = center.x
      threeFingerTriggered = false
      activeGesture.value = 'three-finger-swipe'
      cancelLongPress()
      return
    }
  }

  // ── Pointer event handlers ────────────────────────────────────────

  function onPointerDown(e: PointerEvent): void {
    // Only handle touch
    if (e.pointerType !== 'touch') return

    // Palm rejection integration
    if (options.filterTouch && !options.filterTouch(e)) return

    stopInertia()

    const rect = getContainerRect()
    if (!rect) return

    touches.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
    })
    touchCount.value = touches.size

    // Edge detection (only for single touch)
    if (touches.size === 1) {
      const edge = detectEdge(e.clientX)
      if (edge) {
        isEdgeSwipe = true
        edgeSide = edge
        edgeSwipeStartX = e.clientX
        edgeSwipeStartY = e.clientY
      } else {
        isEdgeSwipe = false
        edgeSide = null
      }

      // Start long press timer
      startLongPressTimer(e.clientX - rect.left, e.clientY - rect.top)
    }

    resolveGesture()
  }

  function onPointerMove(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return

    const touch = touches.get(e.pointerId)
    if (!touch) return

    touch.x = e.clientX
    touch.y = e.clientY

    const count = touches.size

    // Cancel long press if moved too far
    if (longPressTimer) {
      const dx = e.clientX - touch.startX
      const dy = e.clientY - touch.startY
      if (dx * dx + dy * dy > PAN_THRESHOLD * PAN_THRESHOLD) {
        cancelLongPress()
      }
    }

    // ── Edge swipe ──
    if (isEdgeSwipe && count === 1 && edgeSide) {
      const dx = e.clientX - edgeSwipeStartX
      if (edgeSide === 'left' && dx > EDGE_SWIPE_MIN) {
        activeGesture.value = 'edge-swipe'
        callbacks.onEdgeSwipeLeft()
        isEdgeSwipe = false
        haptic()
        console.info(`${LOG} Edge swipe left → open tool panel`)
        return
      }
      if (edgeSide === 'right' && dx < -EDGE_SWIPE_MIN) {
        activeGesture.value = 'edge-swipe'
        callbacks.onEdgeSwipeRight()
        isEdgeSwipe = false
        haptic()
        console.info(`${LOG} Edge swipe right → open page panel`)
        return
      }
    }

    // ── Two-finger pan + pinch ──
    if (count === 2 && (activeGesture.value === 'pinch' || activeGesture.value === 'pan')) {
      const ids = [...touches.keys()]
      if (ids.length < 2) return

      // Pan
      const center = touchCenter(ids)
      const panDx = center.x - lastPanX
      const panDy = center.y - lastPanY

      if (Math.abs(panDx) > 0.5 || Math.abs(panDy) > 0.5) {
        callbacks.onPan(-panDx, -panDy)
        addVelocitySample(panDx, panDy)
      }

      lastPanX = center.x
      lastPanY = center.y

      // Pinch zoom
      const dist = touchDistance(ids[0], ids[1])
      if (pinchStartDist > 0) {
        const scale = dist / pinchStartDist
        const rawZoom = pinchStartZoom * scale
        const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, rawZoom))

        if (Math.abs(newZoom - (options.currentZoom?.value ?? 1)) > PINCH_THRESHOLD) {
          callbacks.onZoom(newZoom, pinchCenterX, pinchCenterY)
        }
      }

      e.preventDefault()
      return
    }

    // ── Three-finger swipe ──
    if (count >= 3 && activeGesture.value === 'three-finger-swipe' && !threeFingerTriggered) {
      const center = touchCenter([...touches.keys()])
      const dx = center.x - threeFingerStartX

      if (dx < -SWIPE_THRESHOLD) {
        threeFingerTriggered = true
        haptic()
        console.info(`${LOG} Three-finger swipe left → undo`)
        callbacks.onUndo()
      } else if (dx > SWIPE_THRESHOLD) {
        threeFingerTriggered = true
        haptic()
        console.info(`${LOG} Three-finger swipe right → redo`)
        callbacks.onRedo()
      }
    }
  }

  function onPointerUp(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return

    const touch = touches.get(e.pointerId)
    touches.delete(e.pointerId)
    touchCount.value = touches.size

    cancelLongPress()

    // ── Double-tap detection (on last finger up) ──
    if (touches.size === 0 && touch) {
      const now = performance.now()
      const dx = touch.startX - lastTapX
      const dy = touch.startY - lastTapY
      const dt = now - lastTapTime
      const movedDist = Math.sqrt(
        (touch.x - touch.startX) ** 2 + (touch.y - touch.startY) ** 2,
      )

      // Only count as tap if finger didn't move much
      if (movedDist < PAN_THRESHOLD) {
        if (dt < DOUBLE_TAP_MS && dx * dx + dy * dy < DOUBLE_TAP_DISTANCE * DOUBLE_TAP_DISTANCE) {
          // Double-tap detected
          const rect = getContainerRect()
          if (rect) {
            const x = touch.x - rect.left
            const y = touch.y - rect.top
            console.info(`${LOG} Double-tap at (${x.toFixed(0)}, ${y.toFixed(0)})`)
            callbacks.onDoubleTap(x, y)
          }
          lastTapTime = 0
        } else {
          lastTapTime = now
          lastTapX = touch.startX
          lastTapY = touch.startY
        }
      }

      // ── Inertia after 2-finger pan ──
      if (activeGesture.value === 'pinch' || activeGesture.value === 'pan') {
        const { vx, vy } = computeVelocity()
        startInertia(vx, vy)
      }
    }

    // Re-resolve gesture for remaining touches
    if (touches.size > 0) {
      resolveGesture()
    } else {
      activeGesture.value = 'none'
      isEdgeSwipe = false
      edgeSide = null
    }
  }

  function onPointerCancel(e: PointerEvent): void {
    if (e.pointerType !== 'touch') return
    touches.delete(e.pointerId)
    touchCount.value = touches.size
    cancelLongPress()
    if (touches.size === 0) {
      activeGesture.value = 'none'
      stopInertia()
    }
  }

  // ── Attach / detach ───────────────────────────────────────────────

  let attached = false

  function attach(): void {
    const el = containerRef.value
    if (!el || attached) return

    el.addEventListener('pointerdown', onPointerDown, { passive: false })
    el.addEventListener('pointermove', onPointerMove, { passive: false })
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    attached = true
    console.info(`${LOG} Gesture listeners attached`)
  }

  function detach(): void {
    const el = containerRef.value
    if (!el || !attached) return

    el.removeEventListener('pointerdown', onPointerDown)
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
    attached = false
    stopInertia()
    cancelLongPress()
    console.info(`${LOG} Gesture listeners detached`)
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  onBeforeUnmount(() => {
    detach()
  })

  // ── Public API ────────────────────────────────────────────────────

  return {
    /** Reactive gesture state */
    state: {
      activeGesture: readonly(activeGesture),
      touchCount: readonly(touchCount),
      isInertiaActive: readonly(isInertiaActive),
      longPressActive: readonly(longPressActive),
      longPressPosition: readonly(longPressPosition),
    } as TouchGestureState,

    /** Attach gesture listeners to container */
    attach,

    /** Detach gesture listeners */
    detach,

    /** Stop inertia animation */
    stopInertia,

    /** Check if a gesture is consuming touch input (2+ fingers) */
    isGestureActive(): boolean {
      return activeGesture.value !== 'none' && activeGesture.value !== 'draw'
    },
  }
}
