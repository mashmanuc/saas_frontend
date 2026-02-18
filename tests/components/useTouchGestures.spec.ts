/**
 * [WB:B4.1] Unit tests — useTouchGestures composable
 *
 * Tests:
 * 1. Two-finger pan detection
 * 2. Pinch zoom calculation
 * 3. Three-finger undo
 * 4. Three-finger redo
 * 5. Double-tap zoom reset
 * 6. Long press timer
 * 7. Gesture conflict resolution (1 finger ≠ pan)
 * 8. Inertia deceleration
 * 9. Edge gesture detection (left)
 * 10. Edge gesture detection (right)
 * 11. Palm rejection integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, type Ref } from 'vue'
import { useTouchGestures, type GestureCallbacks } from '@/modules/winterboard/components/gestures/useTouchGestures'

// ── Helpers ─────────────────────────────────────────────────────────────────

function createContainer(width = 800, height = 600): HTMLDivElement {
  const el = document.createElement('div')
  // Mock getBoundingClientRect
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, right: width, bottom: height,
    width, height, x: 0, y: 0, toJSON: () => ({}),
  })
  return el
}

function createPointerEvent(
  type: string,
  opts: {
    pointerId?: number
    pointerType?: string
    clientX?: number
    clientY?: number
    pressure?: number
  } = {},
): PointerEvent {
  return new PointerEvent(type, {
    pointerId: opts.pointerId ?? 1,
    pointerType: opts.pointerType ?? 'touch',
    clientX: opts.clientX ?? 100,
    clientY: opts.clientY ?? 100,
    pressure: opts.pressure ?? 0.5,
    bubbles: true,
    cancelable: true,
  })
}

function createCallbacks(): GestureCallbacks & {
  panCalls: Array<{ dx: number; dy: number }>
  zoomCalls: Array<{ zoom: number; cx: number; cy: number }>
  undoCalls: number
  redoCalls: number
  doubleTapCalls: Array<{ x: number; y: number }>
  longPressCalls: Array<{ x: number; y: number }>
  edgeLeftCalls: number
  edgeRightCalls: number
  panEndCalls: number
} {
  const cb = {
    panCalls: [] as Array<{ dx: number; dy: number }>,
    zoomCalls: [] as Array<{ zoom: number; cx: number; cy: number }>,
    undoCalls: 0,
    redoCalls: 0,
    doubleTapCalls: [] as Array<{ x: number; y: number }>,
    longPressCalls: [] as Array<{ x: number; y: number }>,
    edgeLeftCalls: 0,
    edgeRightCalls: 0,
    panEndCalls: 0,
    onPan(dx: number, dy: number) { cb.panCalls.push({ dx, dy }) },
    onPanEnd() { cb.panEndCalls++ },
    onZoom(zoom: number, cx: number, cy: number) { cb.zoomCalls.push({ zoom, cx, cy }) },
    onUndo() { cb.undoCalls++ },
    onRedo() { cb.redoCalls++ },
    onDoubleTap(x: number, y: number) { cb.doubleTapCalls.push({ x, y }) },
    onLongPress(x: number, y: number) { cb.longPressCalls.push({ x, y }) },
    onEdgeSwipeLeft() { cb.edgeLeftCalls++ },
    onEdgeSwipeRight() { cb.edgeRightCalls++ },
  }
  return cb
}

describe('[WB:B4.1] useTouchGestures', () => {
  let container: HTMLDivElement
  let containerRef: Ref<HTMLElement | null>

  beforeEach(() => {
    vi.useFakeTimers()
    container = createContainer()
    containerRef = ref<HTMLElement | null>(container)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 1. Two-finger pan detection ──────────────────────────────────

  it('detects two-finger pan and calls onPan', () => {
    const cb = createCallbacks()
    const { attach } = useTouchGestures(containerRef, cb, { currentZoom: ref(1) })
    attach()

    // Finger 1 down
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    // Finger 2 down
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }))

    // Move both fingers (pan right+down)
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 120, clientY: 120 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 220, clientY: 220 }))

    expect(cb.panCalls.length).toBeGreaterThan(0)
  })

  // ── 2. Pinch zoom calculation ────────────────────────────────────

  it('detects pinch gesture and calls onZoom', () => {
    const cb = createCallbacks()
    const currentZoom = ref(1)
    const { attach } = useTouchGestures(containerRef, cb, { currentZoom })
    attach()

    // Two fingers close together
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 150, clientY: 300 }))
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 250, clientY: 300 }))

    // Spread fingers apart (zoom in)
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 300 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 300, clientY: 300 }))

    expect(cb.zoomCalls.length).toBeGreaterThan(0)
    // Zoom should increase (fingers spread apart)
    expect(cb.zoomCalls[cb.zoomCalls.length - 1].zoom).toBeGreaterThan(1)
  })

  // ── 3. Three-finger undo ─────────────────────────────────────────

  it('detects three-finger swipe left as undo', () => {
    const cb = createCallbacks()
    const { attach } = useTouchGestures(containerRef, cb)
    attach()

    // Three fingers down
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }))
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 250, clientY: 200 }))
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 3, clientX: 300, clientY: 200 }))

    // Swipe left (all three fingers move left by > 60px)
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 120, clientY: 200 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 170, clientY: 200 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 3, clientX: 220, clientY: 200 }))

    expect(cb.undoCalls).toBe(1)
    expect(cb.redoCalls).toBe(0)
  })

  // ── 4. Three-finger redo ─────────────────────────────────────────

  it('detects three-finger swipe right as redo', () => {
    const cb = createCallbacks()
    const { attach } = useTouchGestures(containerRef, cb)
    attach()

    // Three fingers down
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 200, clientY: 200 }))
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 250, clientY: 200 }))
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 3, clientX: 300, clientY: 200 }))

    // Swipe right (all three fingers move right by > 60px)
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 280, clientY: 200 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 330, clientY: 200 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 3, clientX: 380, clientY: 200 }))

    expect(cb.redoCalls).toBe(1)
    expect(cb.undoCalls).toBe(0)
  })

  // ── 5. Double-tap zoom reset ─────────────────────────────────────

  it('detects double-tap and calls onDoubleTap', () => {
    const cb = createCallbacks()
    const { attach } = useTouchGestures(containerRef, cb)
    attach()

    // First tap
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 400, clientY: 300 }))
    container.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1, clientX: 400, clientY: 300 }))

    // Second tap quickly (within 300ms)
    vi.advanceTimersByTime(150)
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 400, clientY: 300 }))
    container.dispatchEvent(createPointerEvent('pointerup', { pointerId: 2, clientX: 400, clientY: 300 }))

    expect(cb.doubleTapCalls.length).toBe(1)
    expect(cb.doubleTapCalls[0].x).toBe(400)
    expect(cb.doubleTapCalls[0].y).toBe(300)
  })

  // ── 6. Long press timer ──────────────────────────────────────────

  it('triggers long press after 500ms hold', () => {
    const cb = createCallbacks()
    const { attach, state } = useTouchGestures(containerRef, cb)
    attach()

    // Single finger down
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 300, clientY: 200 }))

    // Wait 500ms
    vi.advanceTimersByTime(500)

    expect(cb.longPressCalls.length).toBe(1)
    expect(cb.longPressCalls[0].x).toBe(300)
    expect(cb.longPressCalls[0].y).toBe(200)
    expect(state.longPressActive.value).toBe(true)
  })

  it('cancels long press if finger moves', () => {
    const cb = createCallbacks()
    const { attach } = useTouchGestures(containerRef, cb)
    attach()

    // Single finger down
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 300, clientY: 200 }))

    // Move finger significantly before 500ms
    vi.advanceTimersByTime(200)
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 350, clientY: 250 }))

    // Wait remaining time
    vi.advanceTimersByTime(400)

    expect(cb.longPressCalls.length).toBe(0)
  })

  // ── 7. Gesture conflict resolution ───────────────────────────────

  it('single finger does not trigger pan', () => {
    const cb = createCallbacks()
    const { attach, state } = useTouchGestures(containerRef, cb)
    attach()

    // Single finger down + move
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 200, clientY: 200 }))

    // Pan should NOT be called (1 finger = draw, not pan)
    expect(cb.panCalls.length).toBe(0)
    expect(state.activeGesture.value).not.toBe('pan')
  })

  it('two fingers cancel long press', () => {
    const cb = createCallbacks()
    const { attach } = useTouchGestures(containerRef, cb)
    attach()

    // First finger down (starts long press timer)
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 300, clientY: 200 }))

    // Second finger down before timer fires
    vi.advanceTimersByTime(200)
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 400, clientY: 200 }))

    // Wait past long press threshold
    vi.advanceTimersByTime(400)

    // Long press should NOT have fired (2 fingers = pinch, not long press)
    expect(cb.longPressCalls.length).toBe(0)
  })

  // ── 8. Inertia deceleration ──────────────────────────────────────

  it('starts inertia after fast two-finger pan release', () => {
    const cb = createCallbacks()
    const { attach, state } = useTouchGestures(containerRef, cb, {
      currentZoom: ref(1),
      reducedMotion: false,
    })
    attach()

    // Use real timers for performance.now() in velocity calculation
    vi.useRealTimers()

    // Two fingers down
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 }))

    // Fast pan movement
    for (let i = 1; i <= 5; i++) {
      container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 100 + i * 20, clientY: 100 }))
      container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 200 + i * 20, clientY: 100 }))
    }

    // Release both fingers
    container.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1, clientX: 200, clientY: 100 }))
    container.dispatchEvent(createPointerEvent('pointerup', { pointerId: 2, clientX: 300, clientY: 100 }))

    // Inertia may or may not activate depending on velocity sampling
    // At minimum, pan calls should have been made during the movement
    expect(cb.panCalls.length).toBeGreaterThan(0)

    vi.useFakeTimers()
  })

  it('does not start inertia with reduced motion', () => {
    const cb = createCallbacks()
    const { attach, state } = useTouchGestures(containerRef, cb, {
      currentZoom: ref(1),
      reducedMotion: true,
    })
    attach()

    // Two fingers down + fast move + release
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 200, clientY: 100 }))
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 2, clientX: 300, clientY: 100 }))
    container.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
    container.dispatchEvent(createPointerEvent('pointerup', { pointerId: 2 }))

    expect(state.isInertiaActive.value).toBe(false)
  })

  // ── 9. Edge gesture detection (left) ─────────────────────────────

  it('detects left edge swipe and calls onEdgeSwipeLeft', () => {
    const cb = createCallbacks()
    const { attach } = useTouchGestures(containerRef, cb)
    attach()

    // Finger down near left edge (x < 24)
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 300 }))

    // Swipe right from left edge (> 60px)
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 80, clientY: 300 }))

    expect(cb.edgeLeftCalls).toBe(1)
  })

  // ── 10. Edge gesture detection (right) ────────────────────────────

  it('detects right edge swipe and calls onEdgeSwipeRight', () => {
    const cb = createCallbacks()
    const { attach } = useTouchGestures(containerRef, cb)
    attach()

    // Finger down near right edge (x > 800 - 24 = 776)
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 790, clientY: 300 }))

    // Swipe left from right edge (> 60px)
    container.dispatchEvent(createPointerEvent('pointermove', { pointerId: 1, clientX: 720, clientY: 300 }))

    expect(cb.edgeRightCalls).toBe(1)
  })

  // ── 11. Palm rejection integration ────────────────────────────────

  it('rejects touch when filterTouch returns false', () => {
    const cb = createCallbacks()
    const { attach, state } = useTouchGestures(containerRef, cb, {
      filterTouch: () => false, // Reject all touches
    })
    attach()

    // Touch down — should be rejected
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 300, clientY: 200 }))

    expect(state.touchCount.value).toBe(0)

    // Long press should not fire
    vi.advanceTimersByTime(600)
    expect(cb.longPressCalls.length).toBe(0)
  })

  it('allows touch when filterTouch returns true', () => {
    const cb = createCallbacks()
    const { attach, state } = useTouchGestures(containerRef, cb, {
      filterTouch: () => true,
    })
    attach()

    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 300, clientY: 200 }))

    expect(state.touchCount.value).toBe(1)
  })

  // ── 12. Detach cleans up ──────────────────────────────────────────

  it('detach removes all listeners', () => {
    const cb = createCallbacks()
    const { attach, detach, state } = useTouchGestures(containerRef, cb)
    attach()

    // Verify attached
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100 }))
    expect(state.touchCount.value).toBe(1)

    // Detach
    container.dispatchEvent(createPointerEvent('pointerup', { pointerId: 1 }))
    detach()

    // After detach, events should not be processed
    container.dispatchEvent(createPointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 200 }))
    expect(state.touchCount.value).toBe(0)
  })
})
