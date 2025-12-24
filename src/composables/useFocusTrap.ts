import { onMounted, onUnmounted, Ref } from 'vue'

/**
 * Focus trap composable для модальних вікон
 * Забезпечує утримання фокусу всередині модалки та обробку ESC
 */
export function useFocusTrap(
  containerRef: Ref<HTMLElement | null>,
  options: {
    onEscape?: () => void
    initialFocus?: boolean
  } = {}
) {
  const { onEscape, initialFocus = true } = options

  let previousActiveElement: HTMLElement | null = null

  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ')

  function getFocusableElements(): HTMLElement[] {
    if (!containerRef.value) return []
    return Array.from(containerRef.value.querySelectorAll(focusableSelector))
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault()
      onEscape()
      return
    }

    if (event.key !== 'Tab') return

    const focusableElements = getFocusableElements()
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (event.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }
  }

  function activate() {
    previousActiveElement = document.activeElement as HTMLElement

    if (initialFocus && containerRef.value) {
      const focusableElements = getFocusableElements()
      if (focusableElements.length > 0) {
        // Фокус на першому елементі або на close button
        const closeButton = containerRef.value.querySelector('[aria-label="Закрити"]') as HTMLElement
        const targetElement = closeButton || focusableElements[0]
        setTimeout(() => targetElement?.focus(), 100)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
  }

  function deactivate() {
    document.removeEventListener('keydown', handleKeyDown)

    // Повернути фокус на попередній елемент
    if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
      previousActiveElement.focus()
    }
  }

  onMounted(() => {
    activate()
  })

  onUnmounted(() => {
    deactivate()
  })

  return {
    activate,
    deactivate,
  }
}
