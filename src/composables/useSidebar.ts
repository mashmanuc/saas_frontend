// src/composables/useSidebar.ts
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'

const STORAGE_KEY = 'sidebar-collapsed'

const sidebarCollapsed = ref(false)
const sidebarMobileOpen = ref(false)

export function useSidebar() {
  function toggleCollapse() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem(STORAGE_KEY, String(sidebarCollapsed.value))
  }

  function openMobile() {
    sidebarMobileOpen.value = true
  }

  function closeMobile() {
    sidebarMobileOpen.value = false
  }

  function initFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'true') {
      sidebarCollapsed.value = true
    }
  }

  // Route change → auto close mobile sidebar
  function watchRouteChanges() {
    const route = useRoute()
    watch(
      () => route.path,
      () => {
        if (sidebarMobileOpen.value) {
          sidebarMobileOpen.value = false
        }
      },
    )
  }

  // Screen resize → auto-handle collapsed via media query
  function watchScreenSize(): () => void {
    if (typeof window === 'undefined') return () => {}

    const mediaQuery = window.matchMedia('(max-width: 1024px)')

    function handleChange(e: MediaQueryListEvent | MediaQueryList) {
      if (e.matches) {
        // Mobile: завжди show expanded (overlay mode)
        // Не змінюємо collapsed — він тільки для desktop
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    handleChange(mediaQuery)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }

  // Keyboard shortcut: Ctrl+B / Cmd+B для toggle sidebar (desktop), Escape для close mobile
  function initKeyboardShortcuts(): () => void {
    if (typeof window === 'undefined') return () => {}

    function handleKeydown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        sidebarCollapsed.value = !sidebarCollapsed.value
        localStorage.setItem(STORAGE_KEY, String(sidebarCollapsed.value))
      }
      if (e.key === 'Escape' && sidebarMobileOpen.value) {
        sidebarMobileOpen.value = false
      }
    }

    window.addEventListener('keydown', handleKeydown)

    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }

  /**
   * Focus trap for mobile sidebar overlay.
   * When mobile sidebar is open, Tab is constrained inside the sidebar element.
   * When closed, focus returns to the element that triggered the open.
   */
  function initMobileFocusTrap(sidebarEl: () => HTMLElement | null): () => void {
    if (typeof document === 'undefined') return () => {}

    let triggerElement: HTMLElement | null = null

    const stopWatch = watch(
      () => sidebarMobileOpen.value,
      (isOpen) => {
        if (isOpen) {
          triggerElement = document.activeElement as HTMLElement
          // Focus first focusable element inside sidebar after transition
          requestAnimationFrame(() => {
            const el = sidebarEl()
            if (!el) return
            const focusable = el.querySelector<HTMLElement>(
              'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
            )
            focusable?.focus()
          })
        } else if (triggerElement) {
          triggerElement.focus()
          triggerElement = null
        }
      },
    )

    function handleTabTrap(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !sidebarMobileOpen.value) return
      const el = sidebarEl()
      if (!el) return

      const focusables = el.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables.length) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleTabTrap)

    return () => {
      stopWatch()
      document.removeEventListener('keydown', handleTabTrap)
    }
  }

  return {
    collapsed: computed(() => sidebarCollapsed.value),
    mobileOpen: computed(() => sidebarMobileOpen.value),
    toggleCollapse,
    openMobile,
    closeMobile,
    initFromStorage,
    watchRouteChanges,
    watchScreenSize,
    initKeyboardShortcuts,
    initMobileFocusTrap,
  }
}
