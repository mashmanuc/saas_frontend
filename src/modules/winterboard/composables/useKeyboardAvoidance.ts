// WB Responsive Phase 4 A7: Keyboard avoidance for iOS Safari / Android
// Ref: winterboard_dev/responsive/PHASE4.md A7.3
// INV-5: NEVER use 100vh on iOS — only visualViewport API
//
// Uses window.visualViewport to detect keyboard open/close,
// calculates stable viewport height, and provides CSS var --wb-vh.

import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  type Ref,
  type ComputedRef,
} from 'vue'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:KeyboardAvoidance]'
const KEYBOARD_MIN_DIFF_PX = 150

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseKeyboardAvoidanceReturn {
  keyboardHeight: Ref<number>
  isKeyboardVisible: Ref<boolean>
  availableHeight: ComputedRef<number>
  viewportOffset: Ref<number>
  getStableViewportHeight: () => number
  adjustForKeyboard: () => void
  resetAfterKeyboard: () => void
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useKeyboardAvoidance(
  containerRef: Ref<HTMLElement | null>,
): UseKeyboardAvoidanceReturn {
  const keyboardHeight = ref(0)
  const isKeyboardVisible = ref(false)
  const viewportOffset = ref(0)

  // Initial full height (captured before keyboard opens)
  let initialHeight = 0

  const availableHeight = computed(() => {
    return getStableViewportHeight()
  })

  // ── Core: get real viewport height (INV-5) ──────────────────────────

  function getStableViewportHeight(): number {
    if (typeof window === 'undefined') return 0
    return window.visualViewport?.height ?? window.innerHeight
  }

  // ── Event handlers ──────────────────────────────────────────────────

  function onVisualViewportResize(): void {
    const vv = window.visualViewport
    if (!vv) return

    const currentHeight = vv.height
    const diff = initialHeight - currentHeight

    if (diff > KEYBOARD_MIN_DIFF_PX) {
      // Keyboard is visible
      keyboardHeight.value = diff
      isKeyboardVisible.value = true
    } else {
      // Keyboard hidden
      keyboardHeight.value = 0
      isKeyboardVisible.value = false
    }

    // Update CSS custom property (INV-5)
    updateCssVar(currentHeight)
  }

  function onVisualViewportScroll(): void {
    const vv = window.visualViewport
    if (!vv) return
    viewportOffset.value = vv.offsetTop
  }

  // ── CSS var update ──────────────────────────────────────────────────

  function updateCssVar(height: number): void {
    document.documentElement.style.setProperty(
      '--wb-vh',
      `${height}px`,
    )
  }

  // ── Keyboard adjustment for text tool ───────────────────────────────

  function adjustForKeyboard(): void {
    if (!isKeyboardVisible.value) return
    if (!containerRef.value) return

    // Scroll container so active element is visible above keyboard
    const activeEl = document.activeElement as HTMLElement | null
    if (activeEl && containerRef.value.contains(activeEl)) {
      const rect = activeEl.getBoundingClientRect()
      const visibleBottom = getStableViewportHeight()

      if (rect.bottom > visibleBottom) {
        const scrollBy = rect.bottom - visibleBottom + 20
        containerRef.value.scrollTop += scrollBy
      }
    }
  }

  function resetAfterKeyboard(): void {
    if (!containerRef.value) return
    // Smooth scroll back to original position
    containerRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Split View / multi-window detection ─────────────────────────────

  function captureInitialHeight(): void {
    if (typeof window === 'undefined') return
    initialHeight = window.visualViewport?.height ?? window.innerHeight
    updateCssVar(initialHeight)
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  onMounted(() => {
    captureInitialHeight()

    const vv = window.visualViewport
    if (vv) {
      vv.addEventListener('resize', onVisualViewportResize)
      vv.addEventListener('scroll', onVisualViewportScroll)
    }

    // Fallback for browsers without visualViewport
    if (!vv) {
      window.addEventListener('resize', () => {
        updateCssVar(window.innerHeight)
      })
    }
  })

  onUnmounted(() => {
    const vv = window.visualViewport
    if (vv) {
      vv.removeEventListener('resize', onVisualViewportResize)
      vv.removeEventListener('scroll', onVisualViewportScroll)
    }
  })

  return {
    keyboardHeight,
    isKeyboardVisible,
    availableHeight,
    viewportOffset,
    getStableViewportHeight,
    adjustForKeyboard,
    resetAfterKeyboard,
  }
}

export { KEYBOARD_MIN_DIFF_PX }
