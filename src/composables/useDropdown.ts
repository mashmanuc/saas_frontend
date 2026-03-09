import { ref, onMounted, onUnmounted, type Ref } from 'vue'
import { useClickOutside } from './useClickOutside'

/**
 * Composable for dropdown menu logic: toggle, close, click outside, escape key.
 * Platform-grade: reusable for any dropdown in the system.
 *
 * Usage:
 *   const rootRef = ref<HTMLElement | null>(null)
 *   const { isOpen, toggle, close, handleKeydown } = useDropdown(rootRef)
 *
 * Ref: UX_PRODUCT_VISION.md §R3
 */
export function useDropdown(rootRef: Ref<HTMLElement | null>) {
  const isOpen = ref(false)

  function toggle() {
    isOpen.value = !isOpen.value
  }

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
  }

  // Click outside → close
  useClickOutside(rootRef, close)

  // Escape key → close
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen.value) {
      close()
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    isOpen,
    toggle,
    open,
    close,
    handleKeydown,
  }
}
