// WB: usePalmRejection — palm rejection for tablet/stylus input
// Ref: TASK_BOARD_PHASES.md A4.2, LAW-15 (drawing fidelity)
// Modes: 'auto' (pen detected → reject touch), 'always', 'never'
// Strategy: when pen is active, ignore touch events; re-enable after timeout

import { ref, readonly, computed } from 'vue'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:PalmRejection]'
const STORAGE_KEY = 'wb:palmRejection:mode'
const PEN_TIMEOUT_MS = 500
const LARGE_CONTACT_RADIUS = 20
const MAX_SIMULTANEOUS_TOUCHES = 2

// ─── Types ──────────────────────────────────────────────────────────────────

export type PalmRejectionMode = 'auto' | 'always' | 'never'

export interface PalmRejectionResult {
  rejected: boolean
  reason?: 'pen_active' | 'large_contact' | 'too_many_touches' | 'edge_touch' | 'mode_always'
}

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Palm rejection for tablet/stylus drawing.
 *
 * When a pen (stylus) is detected, touch events are rejected to prevent
 * accidental palm strokes. Touch is re-enabled after a configurable timeout
 * when the pen is no longer active.
 *
 * Usage:
 * ```ts
 * const palm = usePalmRejection()
 * // In pointer event handler:
 * if (palm.shouldReject(event).rejected) return
 * // On pen down:
 * palm.onPenDown()
 * // On pen up:
 * palm.onPenUp()
 * ```
 */
export function usePalmRejection() {
  // ── State ─────────────────────────────────────────────────────────

  const mode = ref<PalmRejectionMode>(loadMode())
  const isPenActive = ref(false)
  const penDetected = ref(false)
  const lastPenTime = ref(0)
  const activeTouchCount = ref(0)

  let penTimeoutId: ReturnType<typeof setTimeout> | null = null

  // ── Computed ──────────────────────────────────────────────────────

  const isEnabled = computed(() => {
    if (mode.value === 'never') return false
    if (mode.value === 'always') return true
    // 'auto': enabled only when pen has been detected
    return penDetected.value
  })

  // ── Mode persistence ──────────────────────────────────────────────

  function loadMode(): PalmRejectionMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'auto' || stored === 'always' || stored === 'never') {
        return stored
      }
    } catch {
      // localStorage unavailable
    }
    return 'auto'
  }

  function setMode(newMode: PalmRejectionMode): void {
    mode.value = newMode
    try {
      localStorage.setItem(STORAGE_KEY, newMode)
    } catch {
      // Ignore
    }
  }

  // ── Pen lifecycle ─────────────────────────────────────────────────

  function onPenDown(): void {
    isPenActive.value = true
    penDetected.value = true
    lastPenTime.value = Date.now()

    // Cancel any pending re-enable timeout
    if (penTimeoutId !== null) {
      clearTimeout(penTimeoutId)
      penTimeoutId = null
    }
  }

  function onPenUp(): void {
    isPenActive.value = false
    lastPenTime.value = Date.now()

    // Schedule touch re-enable after timeout
    if (penTimeoutId !== null) {
      clearTimeout(penTimeoutId)
    }
    penTimeoutId = setTimeout(() => {
      penTimeoutId = null
    }, PEN_TIMEOUT_MS)
  }

  // ── Touch tracking ────────────────────────────────────────────────

  function onTouchStart(touchCount: number): void {
    activeTouchCount.value = touchCount
  }

  function onTouchEnd(touchCount: number): void {
    activeTouchCount.value = touchCount
  }

  // ── Core rejection logic ──────────────────────────────────────────

  /**
   * Determine if a pointer event should be rejected.
   *
   * @param event - Native PointerEvent
   * @param canvasWidth - Canvas width for edge detection
   * @param canvasHeight - Canvas height for edge detection
   * @returns { rejected, reason }
   */
  function shouldReject(
    event: PointerEvent,
    canvasWidth?: number,
    canvasHeight?: number,
  ): PalmRejectionResult {
    // Never reject pen events
    if (event.pointerType === 'pen') {
      return { rejected: false }
    }

    // Never reject mouse events
    if (event.pointerType === 'mouse') {
      return { rejected: false }
    }

    // Mode: never → allow everything
    if (mode.value === 'never') {
      return { rejected: false }
    }

    // Mode: always → reject all touch
    if (mode.value === 'always' && event.pointerType === 'touch') {
      return { rejected: true, reason: 'mode_always' }
    }

    // Mode: auto → reject touch only when pen is active/recent
    if (event.pointerType === 'touch') {
      // 1. Pen is currently active
      if (isPenActive.value) {
        return { rejected: true, reason: 'pen_active' }
      }

      // 2. Pen was recently active (within timeout)
      const timeSincePen = Date.now() - lastPenTime.value
      if (penDetected.value && timeSincePen < PEN_TIMEOUT_MS) {
        return { rejected: true, reason: 'pen_active' }
      }

      // 3. Large contact area (palm)
      if (isLargeContact(event)) {
        return { rejected: true, reason: 'large_contact' }
      }

      // 4. Too many simultaneous touches
      if (activeTouchCount.value > MAX_SIMULTANEOUS_TOUCHES) {
        return { rejected: true, reason: 'too_many_touches' }
      }

      // 5. Edge touch (palm resting on edge)
      if (canvasWidth && canvasHeight && isEdgeTouch(event, canvasWidth, canvasHeight)) {
        return { rejected: true, reason: 'edge_touch' }
      }
    }

    return { rejected: false }
  }

  /**
   * Convenience: process a PointerEvent and auto-track pen state.
   * Returns true if the event should be allowed (not rejected).
   */
  function filterEvent(
    event: PointerEvent,
    canvasWidth?: number,
    canvasHeight?: number,
  ): boolean {
    // Auto-track pen state
    if (event.pointerType === 'pen') {
      if (event.type === 'pointerdown') onPenDown()
      else if (event.type === 'pointerup' || event.type === 'pointercancel') onPenUp()
    }

    // Auto-track touch count
    if (event.pointerType === 'touch') {
      if (event.type === 'pointerdown') {
        activeTouchCount.value++
      } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
        activeTouchCount.value = Math.max(0, activeTouchCount.value - 1)
      }
    }

    const result = shouldReject(event, canvasWidth, canvasHeight)
    return !result.rejected
  }

  // ── Helpers ───────────────────────────────────────────────────────

  function isLargeContact(event: PointerEvent): boolean {
    const rx = event.width ?? 0
    const ry = event.height ?? 0
    return rx > LARGE_CONTACT_RADIUS || ry > LARGE_CONTACT_RADIUS
  }

  function isEdgeTouch(
    event: PointerEvent,
    canvasWidth: number,
    canvasHeight: number,
  ): boolean {
    const edgeThreshold = 30
    const x = event.offsetX
    const y = event.offsetY
    return (
      x < edgeThreshold ||
      y < edgeThreshold ||
      x > canvasWidth - edgeThreshold ||
      y > canvasHeight - edgeThreshold
    )
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  function reset(): void {
    isPenActive.value = false
    activeTouchCount.value = 0
    if (penTimeoutId !== null) {
      clearTimeout(penTimeoutId)
      penTimeoutId = null
    }
  }

  return {
    mode: readonly(mode),
    isPenActive: readonly(isPenActive),
    penDetected: readonly(penDetected),
    isEnabled,
    activeTouchCount: readonly(activeTouchCount),

    setMode,
    onPenDown,
    onPenUp,
    onTouchStart,
    onTouchEnd,
    shouldReject,
    filterEvent,
    reset,
  }
}

export { PEN_TIMEOUT_MS, LARGE_CONTACT_RADIUS, MAX_SIMULTANEOUS_TOUCHES }
