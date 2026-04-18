/**
 * MoveAnimator — abstraction over replay-time move animation.
 *
 * Phase 1 ships SimpleMoveAnimator (batch rAF against store.applyTransientPositions).
 * Phase 2 (future) can drop in a KonvaLayerAnimator implementation without
 * changing the applier — same interface, same contract.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONTRACT (hard invariants — any implementation MUST uphold these):
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  1. ITEMS are ABSOLUTE positions:  { id, kind: 'asset', x, y }
 *     No delta, no points. Future kinds may extend but MUST stay absolute.
 *
 *  2. ASSETS ONLY for Phase 1. `kind: 'stroke'` is reserved for future
 *     (Phase 2 KonvaLayerAnimator). Applier currently filters to 'asset'.
 *
 *  3. ANIMATE and COMMIT are SEPARATE:
 *       await animator.animate(items, ctx)
 *       commitStoreUpdate(items)   // ONE canonical final write, always
 *     Commit is always idempotent (same absolute targets).
 *
 *  4. NO OPS EMITTED during animation (visual-only).
 *     No history / undo push (not user action).
 *
 *  5. cancel() MUST be synchronous and idempotent.
 *     After cancel(): animator is in a clean state, safe to call animate()
 *     again. Caller is responsible for applying final state if needed.
 *
 *  6. GUARDS live in APPLIER (not animator):
 *       - items.length > 20 → skip animation, instant apply
 *       - prefers-reduced-motion → skip animation, instant apply
 *       - no konva context (edge/test) → skip
 *     Animator assumes guards already passed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type MoveItem = {
  id: string
  kind: 'asset'
  x: number
  y: number
}

export type MoveAnimatorCtx = {
  /** Tween duration in ms at speed 1x. Implementation may scale by replaySpeed. */
  duration: number
  /** Replay speed multiplier (1 = normal). Implementation may scale duration. */
  speed?: number
}

/**
 * Minimal store surface the animator needs. Keeping this narrow avoids
 * pulling in the full boardStore type here.
 */
export interface AnimatorStoreApi {
  currentPageIndex: number
  pages: Array<{ id: string; assets?: Array<{ id: string; x?: number; y?: number }> }>
  applyTransientPositions: (items: Array<{ id: string; x: number; y: number }>) => void
}

export interface MoveAnimator {
  /**
   * Animate `items` to their target absolute positions.
   * Resolves when animation completes OR is cancelled.
   * Never rejects.
   */
  animate(items: MoveItem[], ctx: MoveAnimatorCtx): Promise<void>

  /**
   * Cancel any in-flight animation synchronously.
   * Safe to call multiple times; safe to call when nothing is running.
   * Does NOT commit final state — caller is responsible for final commit.
   */
  cancel(): void
}

// ───────────────────────────────────────────────────────────────────────────
// SimpleMoveAnimator — Phase 1 implementation.
// ───────────────────────────────────────────────────────────────────────────
//
// Strategy:
//   - ONE rAF loop drives the animation (not N parallel rAFs).
//   - Each frame: compute interpolated positions for all items,
//     commit via store.applyTransientPositions in ONE mutation.
//   - This gives 13 frames × 1 Vue mutation = 13 mutations total,
//     regardless of item count. Avoids the Option A anti-pattern
//     (N items × 13 frames = N·13 per-object mutations).
//
// Easing: cubic ease-out (1 - (1-t)^3) — matches existing Konva Tween feel
// elsewhere in the codebase.
// ───────────────────────────────────────────────────────────────────────────

type Snapshot = { id: string; fromX: number; fromY: number; toX: number; toY: number }

export function createSimpleMoveAnimator(store: AnimatorStoreApi): MoveAnimator {
  let rafHandle: number | null = null
  let activeResolver: (() => void) | null = null

  // ─── Cancellation semantics ────────────────────────────────────────────
  // cancel() must NOT resolve the pending promise — resolution triggers the
  // applier's .then(commitFinal) which would snap the asset to its target
  // position, defeating both:
  //   a) "new op arrives mid-animation" (brief teleport to old target before
  //      new animation starts from interpolated mid-point), and
  //   b) seek/reset (snapshot reload handles state, not the animator).
  //
  // Abandoned promises are harmless — no listeners remain, GC collects them.
  // Natural completion (t=1) still resolves via the frame branch below.
  function cleanup(): void {
    if (rafHandle !== null) {
      cancelAnimationFrame(rafHandle)
      rafHandle = null
    }
    // Intentionally do NOT resolve activeResolver here.
    activeResolver = null
  }

  function cancel(): void {
    cleanup()
  }

  function animate(items: MoveItem[], ctx: MoveAnimatorCtx): Promise<void> {
    // Cancel any in-flight animation first.
    cleanup()

    if (!Array.isArray(items) || items.length === 0) {
      return Promise.resolve()
    }

    // Snapshot current positions from store for each item.
    const pageData = store.pages[store.currentPageIndex] as unknown as {
      assets?: Array<{ id: string; x?: number; y?: number }>
    }
    const assetsById = new Map<string, { id: string; x?: number; y?: number }>()
    if (Array.isArray(pageData?.assets)) {
      for (const a of pageData.assets) assetsById.set(a.id, a)
    }

    const snapshots: Snapshot[] = []
    for (const it of items) {
      if (it.kind !== 'asset') continue // strokes not animated in Phase 1
      const cur = assetsById.get(it.id)
      if (!cur) continue
      const fromX = typeof cur.x === 'number' ? cur.x : it.x
      const fromY = typeof cur.y === 'number' ? cur.y : it.y
      // Skip items that don't actually move.
      if (fromX === it.x && fromY === it.y) continue
      snapshots.push({ id: it.id, fromX, fromY, toX: it.x, toY: it.y })
    }

    if (snapshots.length === 0) {
      return Promise.resolve()
    }

    const speed = ctx.speed && ctx.speed > 0 ? ctx.speed : 1
    const duration = Math.max(1, ctx.duration / speed)
    const startTime =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()

    return new Promise<void>((resolve) => {
      activeResolver = resolve

      const frame = (now: number) => {
        const elapsed = now - startTime
        const t = Math.min(1, elapsed / duration)
        const eased = 1 - Math.pow(1 - t, 3)

        // Build one batch for this frame — exactly one store mutation.
        const batch: Array<{ id: string; x: number; y: number }> = snapshots.map((s) => ({
          id: s.id,
          x: s.fromX + (s.toX - s.fromX) * eased,
          y: s.fromY + (s.toY - s.fromY) * eased,
        }))
        store.applyTransientPositions(batch)

        if (t < 1) {
          rafHandle = requestAnimationFrame(frame)
        } else {
          // Animation complete — resolve. Caller will commitStoreUpdate(items).
          rafHandle = null
          const r = activeResolver
          activeResolver = null
          if (r) r()
        }
      }

      rafHandle = requestAnimationFrame(frame)
    })
  }

  return { animate, cancel }
}

/**
 * Utility: check if user prefers reduced motion.
 * Guards live in applier but exposed here for test use.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
