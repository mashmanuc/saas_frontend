import { onMounted, onUnmounted } from 'vue'

export interface KeyboardNavigationOptions {
  onArrowUp?: () => void
  onArrowDown?: () => void
  onArrowLeft?: () => void
  onArrowRight?: () => void
  onEnter?: () => void
  onEscape?: () => void
  onTab?: (event: KeyboardEvent) => void
  onSpace?: () => void
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions) {
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        options.onArrowUp?.()
        break
      case 'ArrowDown':
        event.preventDefault()
        options.onArrowDown?.()
        break
      case 'ArrowLeft':
        event.preventDefault()
        options.onArrowLeft?.()
        break
      case 'ArrowRight':
        event.preventDefault()
        options.onArrowRight?.()
        break
      case 'Enter':
        event.preventDefault()
        options.onEnter?.()
        break
      case 'Escape':
        event.preventDefault()
        options.onEscape?.()
        break
      case 'Tab':
        options.onTab?.(event)
        break
      case ' ':
        event.preventDefault()
        options.onSpace?.()
        break
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    handleKeydown,
  }
}
