/**
 * Phase 30 B1: Audit Overlay Composable
 *
 * Singleton state with 2s refresh interval and Shift+D toggle.
 * INV-2: interval ≥ 2000ms
 * INV-6: reads only from auditCollector (single source of state)
 */
import { ref, onMounted, onUnmounted, readonly } from 'vue'
import type { AuditSnapshot } from './types'
import { getAuditSnapshot, initAuditCollector, disposeAuditCollector } from './auditCollector'
import { resetNetworkStats } from './networkTracker'

// Singleton state (shared between all consumers)
const isVisible = ref(true)
const snapshot = ref<AuditSnapshot | null>(null)
let _intervalId: ReturnType<typeof setInterval> | null = null
let _refCount = 0
let _unsubRouter: (() => void) | null = null

export function useAuditOverlay() {
  function updateSnapshot(): void {
    try {
      snapshot.value = getAuditSnapshot()
    } catch {
      // Graceful degradation — keep last snapshot (INV-5)
    }
  }

  function toggle(): void {
    isVisible.value = !isVisible.value
  }

  // Keyboard handler: Shift+D (no Ctrl/Alt/Meta)
  function handleKeydown(e: KeyboardEvent): void {
    if (e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && e.key === 'D') {
      // Ignore if focus is in input/textarea/select
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.target as HTMLElement)?.isContentEditable) return
      e.preventDefault()
      toggle()
    }
  }

  onMounted(() => {
    _refCount++
    if (_refCount === 1) {
      initAuditCollector()
      updateSnapshot()
      _intervalId = setInterval(updateSnapshot, 2_000)
      window.addEventListener('keydown', handleKeydown)

      // Reset network stats on every route navigation (immediate, not 2s delayed)
      import('@/router').then(({ default: router }) => {
        _unsubRouter = router.afterEach(() => {
          resetNetworkStats()
          updateSnapshot()
        })
      }).catch(() => { /* router not available */ })
    }
  })

  onUnmounted(() => {
    _refCount--
    if (_refCount <= 0) {
      if (_intervalId) clearInterval(_intervalId)
      _intervalId = null
      if (_unsubRouter) { _unsubRouter(); _unsubRouter = null }
      window.removeEventListener('keydown', handleKeydown)
      disposeAuditCollector()
      _refCount = 0
    }
  })

  return {
    snapshot: readonly(snapshot),
    isVisible: readonly(isVisible),
    toggle,
  }
}
