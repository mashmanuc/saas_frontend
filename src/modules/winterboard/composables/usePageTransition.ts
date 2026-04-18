/**
 * usePageTransition — smooth fade between pages (Phase 1, editor-only).
 *
 * Architecture (see saas_docs/plans/PAGE_TRANSITION_ANIMATION_TZ.md v2.1):
 *
 *   logicalIndex  ── store.currentPageIndex (changes instantly on goToPage)
 *        │
 *        │ watch (with rapid-change coalescing, same-index guard,
 *        │        reduced-motion bypass)
 *        ▼
 *   isFading = true        (wrapper gets .page-out class → opacity 0)
 *        │
 *        │ FADE_OUT_MS (default 180ms)
 *        ▼
 *   displayIndex = target  (parent rebinds strokes/assets from this index)
 *   isFading = false        (wrapper class removed → opacity 1, fade-in)
 *
 * INVARIANTS:
 *   1. Same-index guard — watch(logical) fires on any mutation; skip when
 *      newIdx === displayIndex.value (covers PDF import addPage×N + goToPage(0)).
 *   2. No-stack rapid changes — if already fading and a new logical change
 *      arrives, update target via pendingIndex and let the ONE active timer
 *      resolve to the latest value. Latest-wins, never overlay.
 *   3. Reduced motion → instant swap, no fade, no timer scheduled.
 *   4. Auto-cleanup on scope dispose (component unmount).
 *
 * PHASE 1 SCOPE:
 *   - Editor only. Replay is Phase 2 (blocked on replayUiStore.isSeeking,
 *     see TZ §3.5 / Факт 2).
 *   - Fade only. Slide/direction is Phase 2.
 *   - setTimeout-based. Phase 2 should migrate to `transitionend` event
 *     for deterministic timing + E2E friendliness.
 */
import { ref, readonly, watch, onScopeDispose, type Ref, type DeepReadonly } from 'vue'

export interface UsePageTransitionOptions {
  /** Duration of the fade-out phase in ms. Fade-in is handled by CSS. Default 180. */
  fadeOutMs?: number
}

export interface UsePageTransitionReturn {
  /** Index of the page to render NOW. Lags `logicalIndex` by up to `fadeOutMs`. */
  displayIndex: DeepReadonly<Ref<number>>
  /** True while wrapper is in the fade-out phase. Bind to `:class="{ 'page-out': isFading }"`. */
  isFading: DeepReadonly<Ref<boolean>>
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function usePageTransition(
  logicalIndex: Ref<number>,
  options: UsePageTransitionOptions = {},
): UsePageTransitionReturn {
  const FADE_OUT_MS = options.fadeOutMs ?? 180

  const displayIndex = ref(logicalIndex.value)
  const isFading = ref(false)

  // Latest target requested while we were already fading. Consumed at timer end.
  let pendingIndex: number | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function onFadeOutComplete(scheduledTarget: number): void {
    timer = null
    // Use latest pending if newer clicks arrived during the fade; else the
    // originally-scheduled target. pendingIndex > scheduledTarget case is
    // the "rapid click" scenario — user ended at page N, we swap to N.
    const finalTarget = pendingIndex !== null ? pendingIndex : scheduledTarget
    pendingIndex = null

    // Actual content swap — parent rebinds strokes/assets from this index.
    if (finalTarget !== displayIndex.value) {
      displayIndex.value = finalTarget
    }
    // Wrapper removes .page-out → CSS transitions opacity back to 1.
    isFading.value = false

    // If the user kept clicking past our latest captured target, run another
    // fade cycle to catch up. Rare; only hits on 200ms+ sustained bursts.
    if (logicalIndex.value !== displayIndex.value) {
      startFade(logicalIndex.value)
    }
  }

  function startFade(target: number): void {
    // INVARIANT 2: no-stack. MUST come before the same-index guard so that
    // "click back to original during active fade" correctly cancels the
    // in-flight swap. Without this order, a mid-fade click-back would be
    // dropped by the same-index check and the fade would still swap to
    // the stale original target.
    if (isFading.value) {
      pendingIndex = target
      return
    }

    // INVARIANT 1: same-index guard (only meaningful when NOT fading).
    // Covers PDF-import addPage×N + goToPage(0) where Vue may briefly
    // observe intermediate indices that equal the already-displayed one.
    if (target === displayIndex.value) return

    // INVARIANT 3: respect reduced motion — instant swap, no transition.
    if (prefersReducedMotion()) {
      displayIndex.value = target
      return
    }

    isFading.value = true
    timer = setTimeout(() => onFadeOutComplete(target), FADE_OUT_MS)
  }

  watch(logicalIndex, (newIdx) => {
    startFade(newIdx)
  })

  // INVARIANT 4: auto-cleanup on component unmount — prevents leaked timers
  // updating refs on a dead scope.
  onScopeDispose(() => {
    clearTimer()
    pendingIndex = null
  })

  return {
    displayIndex: readonly(displayIndex),
    isFading: readonly(isFading),
  }
}
