import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSidebar } from '@/composables/useSidebar'

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => ({ path: '/' })),
}))

describe('useSidebar integration', () => {
  let cleanup: (() => void) | undefined

  beforeEach(() => {
    localStorage.clear()
    // Reset singleton state: ensure collapsed=false, mobileOpen=false
    const sidebar = useSidebar()
    while (sidebar.collapsed.value) sidebar.toggleCollapse()
    if (sidebar.mobileOpen.value) sidebar.closeMobile()
  })

  afterEach(() => {
    if (cleanup) {
      cleanup()
      cleanup = undefined
    }
  })

  it('Ctrl+B toggles collapsed', () => {
    const { collapsed, initKeyboardShortcuts } = useSidebar()
    cleanup = initKeyboardShortcuts()

    const event = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true })
    window.dispatchEvent(event)

    expect(collapsed.value).toBe(true)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('true')
  })

  it('Ctrl+B toggles back to expanded', () => {
    const { collapsed, initKeyboardShortcuts } = useSidebar()
    cleanup = initKeyboardShortcuts()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))
    expect(collapsed.value).toBe(true)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))
    expect(collapsed.value).toBe(false)
    expect(localStorage.getItem('sidebar-collapsed')).toBe('false')
  })

  it('Cmd+B toggles collapsed (macOS)', () => {
    const { collapsed, initKeyboardShortcuts } = useSidebar()
    cleanup = initKeyboardShortcuts()

    const event = new KeyboardEvent('keydown', { key: 'b', metaKey: true })
    window.dispatchEvent(event)

    expect(collapsed.value).toBe(true)
  })

  it('Escape closes mobile sidebar', () => {
    const { mobileOpen, openMobile, initKeyboardShortcuts } = useSidebar()
    cleanup = initKeyboardShortcuts()
    openMobile()
    expect(mobileOpen.value).toBe(true)

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(event)

    expect(mobileOpen.value).toBe(false)
  })

  it('Escape does nothing when mobile sidebar is already closed', () => {
    const { mobileOpen, initKeyboardShortcuts } = useSidebar()
    cleanup = initKeyboardShortcuts()
    expect(mobileOpen.value).toBe(false)

    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    window.dispatchEvent(event)

    expect(mobileOpen.value).toBe(false)
  })

  it('cleanup removes keyboard listeners', () => {
    const { collapsed, initKeyboardShortcuts } = useSidebar()

    const cleanupFn = initKeyboardShortcuts()
    cleanupFn()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }))
    expect(collapsed.value).toBe(false)
  })

  it('initFromStorage restores collapsed state', () => {
    localStorage.setItem('sidebar-collapsed', 'true')
    const { collapsed, initFromStorage } = useSidebar()
    initFromStorage()
    expect(collapsed.value).toBe(true)
  })

  it('watchScreenSize returns cleanup function', () => {
    const { watchScreenSize } = useSidebar()
    const cleanupFn = watchScreenSize()
    expect(typeof cleanupFn).toBe('function')
    cleanupFn()
  })
})
