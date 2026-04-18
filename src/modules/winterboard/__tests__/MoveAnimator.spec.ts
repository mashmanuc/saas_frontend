/**
 * Unit tests — MoveAnimator (Phase 1 SimpleMoveAnimator).
 *
 * Contract coverage:
 *  - One mutation per frame (not per-object × frames)
 *  - Animate is cancellable, cancel is idempotent
 *  - Re-entry: calling animate() while running cancels previous run
 *  - Resolves on completion; resolves on cancel
 *  - Stroke items are ignored (assets-only in Phase 1)
 *  - No-op short-circuits (empty items, no movement) — no mutation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createSimpleMoveAnimator,
  prefersReducedMotion,
  type AnimatorStoreApi,
  type MoveItem,
} from '../engine/animation/MoveAnimator'

// ─── rAF mock — deterministic frame stepping ────────────────────────────────
let _now = 0
let _rafQueue: Array<{ id: number; cb: FrameRequestCallback }> = []
let _rafId = 0

function installRafMock(): void {
  _now = 0
  _rafQueue = []
  _rafId = 0
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    _rafId += 1
    _rafQueue.push({ id: _rafId, cb })
    return _rafId
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    _rafQueue = _rafQueue.filter((r) => r.id !== id)
  })
  vi.stubGlobal('performance', { now: () => _now } as unknown as Performance)
}

/** Advance time + drain all currently-queued rAF callbacks. */
function tick(ms: number): void {
  _now += ms
  const queued = _rafQueue
  _rafQueue = []
  for (const { cb } of queued) cb(_now)
}

// ─── Mock store ────────────────────────────────────────────────────────────

function makeStore(initial: Array<{ id: string; x: number; y: number }>): AnimatorStoreApi & {
  _mutationCount: number
  _lastBatch: Array<{ id: string; x: number; y: number }> | null
} {
  const state = {
    currentPageIndex: 0,
    pages: [{ id: 'page-1', assets: initial.map((a) => ({ ...a })) }],
  }
  const api: AnimatorStoreApi & {
    _mutationCount: number
    _lastBatch: Array<{ id: string; x: number; y: number }> | null
  } = {
    get currentPageIndex() {
      return state.currentPageIndex
    },
    get pages() {
      return state.pages
    },
    applyTransientPositions(items) {
      api._mutationCount += 1
      api._lastBatch = items.map((it) => ({ ...it }))
      const page = state.pages[state.currentPageIndex]
      if (!page?.assets) return
      const byId = new Map(items.map((it) => [it.id, it]))
      page.assets = page.assets.map((a) => {
        const pos = byId.get(a.id)
        if (!pos) return a
        return { ...a, x: pos.x, y: pos.y }
      })
    },
    _mutationCount: 0,
    _lastBatch: null,
  }
  return api
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SimpleMoveAnimator — per-frame batching invariant', () => {
  beforeEach(() => installRafMock())
  afterEach(() => vi.unstubAllGlobals())

  it('produces EXACTLY ONE mutation per frame regardless of item count', async () => {
    const initial = Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, x: 0, y: 0 }))
    const store = makeStore(initial)
    const animator = createSimpleMoveAnimator(store)

    const items: MoveItem[] = initial.map((a) => ({ id: a.id, kind: 'asset', x: 100, y: 50 }))
    const p = animator.animate(items, { duration: 200 })

    // 5 frames over 200ms — 1 mutation each
    tick(40) // frame 1
    tick(40) // frame 2
    tick(40) // frame 3
    tick(40) // frame 4
    tick(40) // frame 5 — t=1, completes

    await p
    // 5 frames = 5 mutations (NOT 15×5 = 75)
    expect(store._mutationCount).toBeLessThanOrEqual(6)
    expect(store._mutationCount).toBeGreaterThanOrEqual(4)
  })

  it('writes final target on completion frame (t=1 → eased=1)', async () => {
    const store = makeStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = createSimpleMoveAnimator(store)

    const p = animator.animate([{ id: 'a1', kind: 'asset', x: 100, y: 200 }], { duration: 100 })
    tick(50) // halfway
    tick(50) // complete
    await p

    expect(store.pages[0].assets?.[0]).toEqual({ id: 'a1', x: 100, y: 200 })
  })

  it('interpolates positions with cubic ease-out', async () => {
    const store = makeStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = createSimpleMoveAnimator(store)
    const p = animator.animate([{ id: 'a1', kind: 'asset', x: 100, y: 0 }], { duration: 100 })

    tick(50) // halfway: eased = 1 - (1 - 0.5)^3 = 1 - 0.125 = 0.875
    const midX = (store._lastBatch as Array<{ id: string; x: number }>)[0].x
    expect(midX).toBeGreaterThan(50) // ease-out is front-loaded
    expect(midX).toBeLessThan(100)

    tick(50)
    await p
  })
})

describe('SimpleMoveAnimator — cancel semantics', () => {
  beforeEach(() => installRafMock())
  afterEach(() => vi.unstubAllGlobals())

  it('cancel() stops the rAF loop and freezes mutations (promise intentionally abandoned)', () => {
    // CONTRACT: cancel() does NOT resolve — prevents .then(commitFinal)
    // from firing and snapping the asset to its target on seek/reset or
    // mid-animation re-entry. Callers must not await a cancelled animation.
    const store = makeStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = createSimpleMoveAnimator(store)

    // Intentionally ignored — would hang forever if awaited, by design.
    void animator.animate([{ id: 'a1', kind: 'asset', x: 100, y: 0 }], { duration: 200 })
    tick(50) // one frame mid-animation
    const beforeCancel = store._mutationCount
    animator.cancel()

    tick(200) // further ticks do nothing — loop was cancelled
    expect(store._mutationCount).toBe(beforeCancel)
  })

  it('cancel() is idempotent — safe to call multiple times or when idle', () => {
    const store = makeStore([])
    const animator = createSimpleMoveAnimator(store)
    expect(() => {
      animator.cancel()
      animator.cancel()
      animator.cancel()
    }).not.toThrow()
  })

  it('animate() re-entry cancels previous run — second snapshots from mid-state', async () => {
    // When a new op arrives mid-animation, the previous run must be
    // abandoned WITHOUT resolving (to avoid the .then(commitFinal) snap),
    // and the new animation must snapshot `fromX/fromY` from the current
    // interpolated position, NOT from the previous op's target.
    const store = makeStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = createSimpleMoveAnimator(store)

    // First animation to x=100 over 200ms
    void animator.animate([{ id: 'a1', kind: 'asset', x: 100, y: 0 }], { duration: 200 })
    tick(40) // ~20% elapsed, ease-out ≈ 0.488 → x ≈ 48.8
    const midX = store.pages[0].assets?.[0]?.x ?? 0
    expect(midX).toBeGreaterThan(0)
    expect(midX).toBeLessThan(100)

    // Re-entry: cancel first (silently), start fresh from midX → 300
    const second = animator.animate([{ id: 'a1', kind: 'asset', x: 300, y: 0 }], { duration: 200 })

    tick(50)
    tick(50)
    tick(50)
    tick(50) // drain second animation
    await second

    // Final state = second animation's target.
    expect(store.pages[0].assets?.[0]?.x).toBe(300)
  })
})

describe('SimpleMoveAnimator — edge cases', () => {
  beforeEach(() => installRafMock())
  afterEach(() => vi.unstubAllGlobals())

  it('empty items array → resolves immediately, no mutations', async () => {
    const store = makeStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = createSimpleMoveAnimator(store)
    await animator.animate([], { duration: 200 })
    expect(store._mutationCount).toBe(0)
  })

  it('stroke kind items are filtered out (assets-only in Phase 1)', async () => {
    const store = makeStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = createSimpleMoveAnimator(store)
    // Runtime guard: at the public type level `kind` is only 'asset', but the
    // animator defensively filters non-asset items so a future kind addition
    // won't silently animate through Phase 1.
    const items = [{ id: 's1', kind: 'stroke', x: 100, y: 100 }] as unknown as MoveItem[]
    await animator.animate(items, { duration: 100 })
    // Nothing to animate → 0 mutations
    expect(store._mutationCount).toBe(0)
  })

  it('no-movement items (from == to) → 0 mutations', async () => {
    const store = makeStore([{ id: 'a1', x: 50, y: 50 }])
    const animator = createSimpleMoveAnimator(store)
    await animator.animate([{ id: 'a1', kind: 'asset', x: 50, y: 50 }], { duration: 100 })
    expect(store._mutationCount).toBe(0)
  })

  it('missing asset in store → skipped, no throw', async () => {
    const store = makeStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = createSimpleMoveAnimator(store)
    const p = animator.animate(
      [
        { id: 'a1', kind: 'asset', x: 100, y: 0 },
        { id: 'missing', kind: 'asset', x: 50, y: 50 },
      ],
      { duration: 100 },
    )
    tick(50)
    tick(50)
    await p
    // Existing asset reached target; missing one silently skipped.
    expect(store.pages[0].assets?.[0]?.x).toBe(100)
  })

  it('speed > 1 shortens effective duration', async () => {
    const store = makeStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = createSimpleMoveAnimator(store)
    // duration=200 at speed=4 → effective 50ms. One 50ms tick completes.
    const p = animator.animate([{ id: 'a1', kind: 'asset', x: 100, y: 0 }], {
      duration: 200,
      speed: 4,
    })
    tick(50)
    await p
    expect(store.pages[0].assets?.[0]?.x).toBe(100)
  })
})

describe('prefersReducedMotion utility', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns false when matchMedia is unavailable', () => {
    // jsdom provides matchMedia but we override to simulate absence
    vi.stubGlobal('window', {} as Window & typeof globalThis)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('returns true when media query matches', () => {
    vi.stubGlobal('window', {
      matchMedia: (q: string) =>
        ({ matches: q === '(prefers-reduced-motion: reduce)' }) as MediaQueryList,
    } as unknown as Window & typeof globalThis)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('returns false when matchMedia throws', () => {
    vi.stubGlobal('window', {
      matchMedia: () => {
        throw new Error('boom')
      },
    } as unknown as Window & typeof globalThis)
    expect(prefersReducedMotion()).toBe(false)
  })
})
