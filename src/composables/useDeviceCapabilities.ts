import { computed } from 'vue'
import { useLayoutStore } from '@/stores/layoutStore'

/**
 * Device capability composable (touch / orientation / DPR / pointer).
 *
 * Stage 5 of LAYOUT_SSOT migration:
 *   - isLandscape now reads from layoutStore (no own resize listener — saves listener budget).
 *   - hasTouch / pixelRatio / isCoarsePointer — one-time reads, no listeners.
 *
 * Refs: saas_docs/plans/LAYOUT_SSOT_2026-05-02.md §6 Stage 5.
 */
export function useDeviceCapabilities() {
  const layout = useLayoutStore()

  const hasTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0)

  const pixelRatio =
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1

  const isLandscape = computed(
    () => layout.viewport.width > layout.viewport.height,
  )

  const isCoarsePointer = computed(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia?.('(pointer: coarse)')?.matches ?? false
  })

  return {
    hasTouch,
    isLandscape,
    pixelRatio,
    isCoarsePointer,
  }
}
