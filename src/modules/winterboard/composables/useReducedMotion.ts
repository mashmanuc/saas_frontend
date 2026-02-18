// WB: Reduced motion detection composable
// Ref: TASK_BOARD.md B5.2 — prefers-reduced-motion support
// Reactive ref that tracks the user's motion preference via matchMedia

import { ref, onMounted, onUnmounted } from 'vue'

const prefersReducedMotion = ref(false)
let mediaQuery: MediaQueryList | null = null
let refCount = 0

function handleChange(e: MediaQueryListEvent): void {
  prefersReducedMotion.value = e.matches
}

/**
 * useReducedMotion — reactive composable for prefers-reduced-motion.
 * Returns a shared reactive ref that is `true` when the user prefers reduced motion.
 * Uses ref counting to manage the matchMedia listener lifecycle.
 */
export function useReducedMotion() {
  onMounted(() => {
    refCount++
    if (refCount === 1 && typeof window !== 'undefined') {
      mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
      prefersReducedMotion.value = mediaQuery.matches
      mediaQuery.addEventListener('change', handleChange)
    }
  })

  onUnmounted(() => {
    refCount--
    if (refCount <= 0) {
      refCount = 0
      if (mediaQuery) {
        mediaQuery.removeEventListener('change', handleChange)
        mediaQuery = null
      }
    }
  })

  return { prefersReducedMotion }
}
