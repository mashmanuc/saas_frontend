/**
 * Unit tests — usePageTransition (Phase 1).
 *
 * Critical paths from TZ v2.1:
 *  - Same-index guard (PDF import double-event protection)
 *  - No-stack rapid changes (latest-wins)
 *  - Reduced motion bypass
 *  - Auto-cleanup on scope dispose
 *  - Render/Action split — drawing during fade hits logical, not display
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { effectScope, ref, nextTick } from 'vue'
import { usePageTransition } from '../composables/usePageTransition'

// ── Matchmedia mock ────────────────────────────────────────────────────────
function setReducedMotion(matches: boolean): void {
  vi.stubGlobal('window', {
    ...(globalThis as unknown as { window?: Window }).window,
    matchMedia: (q: string) =>
      ({ matches: q.includes('prefers-reduced-motion') && matches }) as MediaQueryList,
  } as unknown as Window & typeof globalThis)
}

describe('usePageTransition — core flow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setReducedMotion(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('initial displayIndex equals logicalIndex', () => {
    const logical = ref(2)
    const { displayIndex, isFading } = usePageTransition(logical)
    expect(displayIndex.value).toBe(2)
    expect(isFading.value).toBe(false)
  })

  it('page change triggers fade: isFading=true, display lags, then settles', async () => {
    const logical = ref(0)
    const { displayIndex, isFading } = usePageTransition(logical, { fadeOutMs: 180 })

    logical.value = 1
    await nextTick()

    // Fade-out phase begins immediately
    expect(isFading.value).toBe(true)
    // Display still on old index during fade
    expect(displayIndex.value).toBe(0)

    // Advance past fade-out duration
    vi.advanceTimersByTime(180)
    await nextTick()

    expect(displayIndex.value).toBe(1)
    expect(isFading.value).toBe(false)
  })

  it('SAME-INDEX GUARD: setting logical to current display is a no-op', async () => {
    // Covers PDF import scenario (addPage × N may briefly observe intermediate
    // indices before settling on goToPage(0)).
    const logical = ref(3)
    const { displayIndex, isFading } = usePageTransition(logical, { fadeOutMs: 180 })

    // Simulate PDF import: logical fluctuates but ends on current index.
    logical.value = 5
    await nextTick()
    expect(isFading.value).toBe(true) // real change kicks off fade

    // Let fade complete
    vi.advanceTimersByTime(180)
    await nextTick()
    expect(displayIndex.value).toBe(5)

    // Re-setting to same index — must NOT retrigger fade
    logical.value = 5
    await nextTick()
    expect(isFading.value).toBe(false)
  })
})

describe('usePageTransition — no-stack (latest-wins on rapid changes)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setReducedMotion(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('5 rapid clicks during fade → one active animation, ends on latest target', async () => {
    const logical = ref(0)
    const { displayIndex, isFading } = usePageTransition(logical, { fadeOutMs: 180 })

    // Click 1 — start fade to 1
    logical.value = 1
    await nextTick()
    expect(isFading.value).toBe(true)

    // Click 2, 3, 4, 5 — all during fade (still at t=0)
    logical.value = 2
    await nextTick()
    logical.value = 3
    await nextTick()
    logical.value = 4
    await nextTick()
    logical.value = 5
    await nextTick()

    // isFading still true throughout (no stacking, one ACTIVE animation)
    expect(isFading.value).toBe(true)
    expect(displayIndex.value).toBe(0) // display untouched until swap

    // Complete the active fade
    vi.advanceTimersByTime(180)
    await nextTick()

    // Ends on latest captured target (5), not 1
    expect(displayIndex.value).toBe(5)
    expect(isFading.value).toBe(false)
  })

  it('clicks back to original during fade → display ends at original (harmless blink)', async () => {
    const logical = ref(0)
    const { displayIndex, isFading } = usePageTransition(logical, { fadeOutMs: 180 })

    logical.value = 2
    await nextTick()
    logical.value = 0 // user clicked back
    await nextTick()

    vi.advanceTimersByTime(180)
    await nextTick()

    // Final target = 0 (last click); display == 0 (already there). No net change.
    expect(displayIndex.value).toBe(0)
    expect(isFading.value).toBe(false)
  })

  it('sustained burst (clicks AFTER swap) triggers a second fade cycle', async () => {
    const logical = ref(0)
    const { displayIndex, isFading } = usePageTransition(logical, { fadeOutMs: 180 })

    logical.value = 1
    await nextTick()
    vi.advanceTimersByTime(180)
    await nextTick()
    expect(displayIndex.value).toBe(1)

    // Second click after first fade complete
    logical.value = 2
    await nextTick()
    expect(isFading.value).toBe(true)

    vi.advanceTimersByTime(180)
    await nextTick()
    expect(displayIndex.value).toBe(2)
    expect(isFading.value).toBe(false)
  })
})

describe('usePageTransition — reduced motion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('prefers-reduced-motion: reduce → instant swap, no fade, no timer', async () => {
    setReducedMotion(true)
    const logical = ref(0)
    const { displayIndex, isFading } = usePageTransition(logical, { fadeOutMs: 180 })

    logical.value = 3
    await nextTick()

    // Instant: no fading, display already on new index
    expect(isFading.value).toBe(false)
    expect(displayIndex.value).toBe(3)

    // No pending timer
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('usePageTransition — cleanup on scope dispose', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setReducedMotion(false)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('component unmount while fading clears pending timer (no late writes)', async () => {
    const logical = ref(0)
    const scope = effectScope()
    let display: ReturnType<typeof usePageTransition>['displayIndex'] | null = null
    let fading: ReturnType<typeof usePageTransition>['isFading'] | null = null

    scope.run(() => {
      const t = usePageTransition(logical, { fadeOutMs: 180 })
      display = t.displayIndex
      fading = t.isFading
    })

    logical.value = 2
    await nextTick()
    expect(fading!.value).toBe(true)

    // Unmount mid-fade
    scope.stop()

    // Timers pending at dispose time should be cleared — no side-effects after stop
    vi.advanceTimersByTime(500)
    await nextTick()

    // displayIndex MUST NOT have advanced to 2 — the timer was cancelled
    expect(display!.value).toBe(0)
  })
})
