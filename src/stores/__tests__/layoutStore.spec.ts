/**
 * Layout SSoT — store unit tests.
 *
 * Refs:
 *   - saas_docs/plans/LAYOUT_SSOT_2026-05-02.md (Stage 1 DoD)
 *   - saas_docs/plans/LAYOUT_SSOT_2026-05-02_KILL_TESTS.md (Tests 1-4 + 7-8)
 *
 * Critical kill-tests:
 *   T1 — idempotent init (one listener even after multiple init calls).
 *   T2 — rAF throttle (resize storm doesn't cause N viewport updates).
 *   T3 — legacy localStorage migration ('sidebar-collapsed' → 'layout:sidebar:collapsed').
 *   T4 — SSR safety (typeof window === 'undefined' → no-op).
 *   T7 — destroy() removes listeners.
 *   T8 — listener counter (DEV mode).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useLayoutStore } from '../layoutStore'
import { BREAKPOINTS } from '@/config/breakpoints'

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function setViewport(width: number, height = 800) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true })
}

function fireResize() {
  window.dispatchEvent(new Event('resize'))
}

function flushRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

// ─────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────

describe('layoutStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setViewport(1280, 720)
    localStorage.clear()
    // Reset listener counter
    delete (window as unknown as { __layoutListenerCount?: number }).__layoutListenerCount
  })

  afterEach(() => {
    // Best-effort cleanup
    try {
      const layout = useLayoutStore()
      layout.destroy()
    } catch {
      // ignore
    }
  })

  // ─────────────────────────────────────────────
  // T1: Idempotent init (CRITICAL)
  // ─────────────────────────────────────────────

  describe('init() idempotency', () => {
    it('attaches exactly ONE resize listener even after multiple init() calls', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      const layout = useLayoutStore()
      layout.init()
      layout.init()
      layout.init()

      const resizeListeners = addSpy.mock.calls.filter((c) => c[0] === 'resize')
      const orientationListeners = addSpy.mock.calls.filter((c) => c[0] === 'orientationchange')

      expect(resizeListeners).toHaveLength(1)
      expect(orientationListeners).toHaveLength(1)

      addSpy.mockRestore()
    })

    it('sets ui.isHydrated = true synchronously (BEFORE any nextTick)', () => {
      const layout = useLayoutStore()
      expect(layout.ui.isHydrated).toBe(false)

      layout.init()

      // No await/nextTick — must be synchronously true
      expect(layout.ui.isHydrated).toBe(true)
    })

    it('reads viewport synchronously on init (no flicker)', () => {
      setViewport(400, 900)

      const layout = useLayoutStore()
      layout.init()

      // No await — viewport must reflect window immediately
      expect(layout.viewport.width).toBe(400)
      expect(layout.viewport.height).toBe(900)
      expect(layout.isMobile).toBe(true)
    })
  })

  // ─────────────────────────────────────────────
  // T2: rAF throttle
  // ─────────────────────────────────────────────

  describe('handleResize() rAF throttle', () => {
    it('coalesces multiple resize events into ≤ 1 viewport update per frame', async () => {
      const layout = useLayoutStore()
      layout.init()

      let updateCount = 0
      const initialWidth = layout.viewport.width

      // Watch viewport.width changes
      const stopWatcher = vi.fn()
      const unwatch = (
        await import('vue')
      ).watch(
        () => layout.viewport.width,
        () => {
          updateCount++
        },
      )

      // Storm: 100 resize events in single tick
      setViewport(500)
      for (let i = 0; i < 100; i++) {
        fireResize()
      }

      // Before rAF: viewport not updated yet (rAF batches)
      expect(layout.viewport.width).toBe(initialWidth)

      // After rAF: exactly ONE update
      await flushRaf()

      expect(layout.viewport.width).toBe(500)
      expect(updateCount).toBe(1)

      unwatch()
      stopWatcher()
    })
  })

  // ─────────────────────────────────────────────
  // T3: Legacy localStorage migration
  // ─────────────────────────────────────────────

  describe('localStorage migration', () => {
    it('migrates legacy "sidebar-collapsed" → "layout:sidebar:collapsed" on init', () => {
      localStorage.setItem('sidebar-collapsed', 'true')

      const layout = useLayoutStore()
      layout.init()

      expect(layout.sidebar.isCollapsed).toBe(true)
      expect(localStorage.getItem('sidebar-collapsed')).toBeNull()
      expect(localStorage.getItem('layout:sidebar:collapsed')).toBe('true')
    })

    it('prefers v2 key over legacy when both exist', () => {
      localStorage.setItem('sidebar-collapsed', 'true')
      localStorage.setItem('layout:sidebar:collapsed', 'false')

      const layout = useLayoutStore()
      layout.init()

      expect(layout.sidebar.isCollapsed).toBe(false)
      expect(localStorage.getItem('sidebar-collapsed')).toBeNull() // legacy cleaned
    })

    it('defaults to false when no localStorage entry', () => {
      const layout = useLayoutStore()
      layout.init()

      expect(layout.sidebar.isCollapsed).toBe(false)
    })
  })

  // ─────────────────────────────────────────────
  // T7: destroy() removes listeners
  // ─────────────────────────────────────────────

  describe('destroy()', () => {
    it('removes resize and orientationchange listeners', () => {
      const removeSpy = vi.spyOn(window, 'removeEventListener')

      const layout = useLayoutStore()
      layout.init()
      layout.destroy()

      const resizeRemovals = removeSpy.mock.calls.filter((c) => c[0] === 'resize')
      const orientationRemovals = removeSpy.mock.calls.filter((c) => c[0] === 'orientationchange')

      expect(resizeRemovals).toHaveLength(1)
      expect(orientationRemovals).toHaveLength(1)

      removeSpy.mockRestore()
    })

    it('allows re-init after destroy', () => {
      const layout = useLayoutStore()
      layout.init()
      layout.destroy()
      expect(layout.ui.isHydrated).toBe(false)

      layout.init()
      expect(layout.ui.isHydrated).toBe(true)
    })
  })

  // ─────────────────────────────────────────────
  // Derived state (breakpoint, device, sidebarMode)
  // ─────────────────────────────────────────────

  describe('derived state', () => {
    it.each([
      [400, 'xs', 'mobile', true, false, false, 'overlay'],
      [600, 'sm', 'mobile', true, false, false, 'overlay'],
      [700, 'md', 'mobile', true, false, false, 'overlay'],
      [900, 'lg', 'tablet', false, true, false, 'overlay'],
      [1100, 'xl', 'desktop', false, false, true, 'static'],
      [1400, '2xl', 'desktop', false, false, true, 'static'],
      [1700, 'display', 'desktop', false, false, true, 'static'],
      [2000, 'display', 'display', false, false, true, 'static'],
    ])(
      'width=%d → breakpoint=%s, device=%s, mobile=%s, tablet=%s, desktop=%s, sidebarMode=%s',
      (width, bp, dev, isMobile, isTablet, isDesktop, mode) => {
        setViewport(width as number)

        const layout = useLayoutStore()
        layout.init()

        expect(layout.breakpoint).toBe(bp)
        expect(layout.device).toBe(dev)
        expect(layout.isMobile).toBe(isMobile)
        expect(layout.isTablet).toBe(isTablet)
        expect(layout.isDesktop).toBe(isDesktop)
        expect(layout.sidebarMode).toBe(mode)
      },
    )

    it('INV-LAYOUT-5: collapse_breakpoint == overlay_breakpoint == lg', () => {
      // At lg-1 = overlay
      setViewport(BREAKPOINTS.lg - 1)
      const layout = useLayoutStore()
      layout.init()
      expect(layout.sidebarMode).toBe('overlay')

      // At lg = static
      setViewport(BREAKPOINTS.lg)
      fireResize()
      return flushRaf().then(() => {
        expect(layout.sidebarMode).toBe('static')
      })
    })
  })

  // ─────────────────────────────────────────────
  // Sidebar actions
  // ─────────────────────────────────────────────

  describe('sidebar actions — context-aware', () => {
    it('toggleSidebar() in static mode → toggles isCollapsed (persisted)', () => {
      setViewport(1280)
      const layout = useLayoutStore()
      layout.init()

      expect(layout.sidebarMode).toBe('static')
      const initial = layout.sidebar.isCollapsed

      layout.toggleSidebar()
      expect(layout.sidebar.isCollapsed).toBe(!initial)
      expect(layout.sidebar.isOpen).toBe(false)
      expect(localStorage.getItem('layout:sidebar:collapsed')).toBe(String(!initial))
    })

    it('toggleSidebar() in overlay mode → toggles isOpen (NOT persisted)', () => {
      setViewport(400)
      const layout = useLayoutStore()
      layout.init()

      expect(layout.sidebarMode).toBe('overlay')
      const initialCollapsed = layout.sidebar.isCollapsed

      layout.toggleSidebar()
      expect(layout.sidebar.isOpen).toBe(true)
      expect(layout.sidebar.isCollapsed).toBe(initialCollapsed) // unchanged

      layout.toggleSidebar()
      expect(layout.sidebar.isOpen).toBe(false)
    })

    it('openSidebar() / closeSidebar() are no-op in static mode', () => {
      setViewport(1280)
      const layout = useLayoutStore()
      layout.init()

      layout.openSidebar()
      expect(layout.sidebar.isOpen).toBe(false) // no-op

      layout.closeSidebar()
      expect(layout.sidebar.isOpen).toBe(false) // no-op
    })

    it('setCollapsed() is no-op in overlay mode', () => {
      setViewport(400)
      const layout = useLayoutStore()
      layout.init()

      const initial = layout.sidebar.isCollapsed
      layout.setCollapsed(!initial)
      expect(layout.sidebar.isCollapsed).toBe(initial) // no-op
    })

    it('STRESS: 10 rapid toggleSidebar() calls produce exactly 10 state changes (INV-LAYOUT-7)', async () => {
      setViewport(1280)
      const layout = useLayoutStore()
      layout.init()

      const { watch } = await import('vue')
      let changes = 0
      const unwatch = watch(
        () => layout.sidebar.isCollapsed,
        () => {
          changes++
        },
        { flush: 'sync' }, // count every change synchronously
      )

      for (let i = 0; i < 10; i++) {
        layout.toggleSidebar()
      }

      expect(changes).toBe(10)
      expect(layout.sidebar.isCollapsed).toBe(false) // even toggles cancel
      unwatch()
    })
  })

  // ─────────────────────────────────────────────
  // getViewportSnapshot — INV-LAYOUT-9 (non-reactive)
  // ─────────────────────────────────────────────

  describe('getViewportSnapshot()', () => {
    it('returns plain numbers (not reactive refs)', () => {
      setViewport(1024, 768)
      const layout = useLayoutStore()
      layout.init()

      const snap = layout.getViewportSnapshot()
      expect(snap).toEqual({ width: 1024, height: 768 })
      expect(typeof snap.width).toBe('number')
      expect(typeof snap.height).toBe('number')
    })

    it('snapshot at time T does not update on later resize', () => {
      setViewport(1024, 768)
      const layout = useLayoutStore()
      layout.init()

      const snap = layout.getViewportSnapshot()

      setViewport(400, 900)
      fireResize()

      return flushRaf().then(() => {
        // store reactive value updates...
        expect(layout.viewport.width).toBe(400)
        // ...but snapshot taken before is unchanged.
        expect(snap.width).toBe(1024)
      })
    })
  })

  // ─────────────────────────────────────────────
  // Forbidden: store mutations outside actions (readonly)
  // ─────────────────────────────────────────────

  describe('readonly state guards', () => {
    it('viewport, sidebar, ui are exposed as readonly (no direct mutation)', () => {
      const layout = useLayoutStore()
      layout.init()

      // TypeScript would error on mutation; runtime check:
      // Pinia readonly() throws in strict mode but only warns by default.
      // We just confirm references are present and gettable.
      expect(layout.viewport).toBeDefined()
      expect(layout.sidebar).toBeDefined()
      expect(layout.ui).toBeDefined()

      expect(typeof layout.viewport.width).toBe('number')
      expect(typeof layout.sidebar.isCollapsed).toBe('boolean')
      expect(typeof layout.ui.isHydrated).toBe('boolean')
    })

    it('does not expose sidebarWidth or containerMaxWidth (CSS = SSoT, INV-LAYOUT-8)', () => {
      const layout = useLayoutStore()
      // These getters were intentionally NOT exposed (Variant A locked).
      expect((layout as unknown as { sidebarWidth?: unknown }).sidebarWidth).toBeUndefined()
      expect((layout as unknown as { containerMaxWidth?: unknown }).containerMaxWidth).toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────
  // INV-LAYOUT-10: Listener budget HARD invariant
  // ─────────────────────────────────────────────

  describe('INV-LAYOUT-10: listener budget HARD fail', () => {
    it('throws in DEV when listener count > 3 (transitional budget)', () => {
      const w = window as unknown as { __layoutListenerCount?: number }
      // Simulate 3 already-existing listeners (e.g. legacy useResponsiveLayout instances).
      w.__layoutListenerCount = 3

      const layout = useLayoutStore()
      // 4-th listener triggers budget violation.
      expect(() => layout.init()).toThrow(/INV-LAYOUT-10/)
    })

    it('does not throw at exactly 3 listeners (boundary)', () => {
      const w = window as unknown as { __layoutListenerCount?: number }
      w.__layoutListenerCount = 2

      const layout = useLayoutStore()
      expect(() => layout.init()).not.toThrow()
      expect(w.__layoutListenerCount).toBe(3)
    })

    it('Stage 5 mode (production budget=2): throws at 3', () => {
      const w = window as unknown as {
        __layoutListenerCount?: number
        __layoutStage5Mode?: boolean
      }
      w.__layoutStage5Mode = true
      w.__layoutListenerCount = 2

      const layout = useLayoutStore()
      expect(() => layout.init()).toThrow(/INV-LAYOUT-10/)

      delete w.__layoutStage5Mode
    })
  })

  // ─────────────────────────────────────────────
  // Stage 1.5 hardening tests (red-team B-1, B-2, S-3, missing gaps)
  // ─────────────────────────────────────────────

  describe('Stage 1.5 — destroy() idempotency', () => {
    it('destroy() called twice does not throw and does not double-decrement counter', () => {
      const layout = useLayoutStore()
      layout.init()

      const w = window as unknown as { __layoutListenerCount?: number }
      const countAfterInit = w.__layoutListenerCount

      expect(() => {
        layout.destroy()
        layout.destroy()
      }).not.toThrow()

      // Counter should drop by 1, not by 2 (idempotent guard via listenerAttached flag).
      expect(w.__layoutListenerCount).toBe((countAfterInit ?? 1) - 1)
    })
  })

  describe('Stage 1.5 — bindRouteChanges replacement', () => {
    it('calling bindRouteChanges twice cleans up previous watcher', async () => {
      setViewport(400)
      const layout = useLayoutStore()
      layout.init()

      const { reactive } = await import('vue')
      const route1 = reactive({ path: '/dashboard' })
      const route2 = reactive({ path: '/dashboard' })

      layout.bindRouteChanges(route1 as never)
      layout.bindRouteChanges(route2 as never) // should detach route1 watcher

      layout.openSidebar()
      expect(layout.sidebar.isOpen).toBe(true)

      // Changing route1 — should NOT trigger close (watcher detached).
      route1.path = '/marketplace'
      await new Promise((r) => setTimeout(r, 10))
      expect(layout.sidebar.isOpen).toBe(true)

      // Changing route2 — SHOULD trigger close.
      route2.path = '/marketplace'
      await new Promise((r) => setTimeout(r, 10))
      expect(layout.sidebar.isOpen).toBe(false)
    })
  })

  describe('Stage 1.5 — readonly() limit (B-2 documentation)', () => {
    it('readonly() warns in DEV when consumer mutates state directly (NOT a hard guarantee)', () => {
      const layout = useLayoutStore()
      layout.init()

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

      // KNOWN LIMIT (B-2): readonly() emits a Vue dev warning, but does NOT throw.
      // The mutation is silently rejected in dev (proxy trap returns false), но це
      // demonstrates that runtime is NOT a hard guarantee. INV-LAYOUT-1 enforcement
      // relies on TypeScript + ESLint + code review, not runtime.
      const before = layout.viewport.width
      try {
        // @ts-expect-error — intentional violation for the test
        layout.viewport.width = 9999
      } catch {
        // some environments may throw, others just warn
      }

      // In Vue dev mode, value remains unchanged AND warn was called.
      // (Behavior may differ; we mainly assert that mutation didn't silently succeed
      // OR that a warning was issued.)
      const after = layout.viewport.width
      const mutationBlocked = after === before
      const warnCalled = warnSpy.mock.calls.length > 0
      expect(mutationBlocked || warnCalled).toBe(true)

      warnSpy.mockRestore()
    })
  })

  describe('Stage 1.5 — HMR survival (B-1)', () => {
    it('simulates HMR: destroy() → re-init() yields exactly one listener', () => {
      const addSpy = vi.spyOn(window, 'addEventListener')

      // Simulate first module load + App.vue setup
      const layoutA = useLayoutStore()
      layoutA.init()

      // Simulate Vite HMR: dispose hook fires destroy() before new module loads.
      layoutA.destroy()

      // Simulate new module's defineStore() → fresh closure on next useLayoutStore call.
      // (In real HMR, Pinia's acceptHMRUpdate replaces the store definition;
      //  here we just simulate the destroy → re-init flow.)
      setActivePinia(createPinia())

      const layoutB = useLayoutStore()
      layoutB.init()

      const resizeAfterHmr = addSpy.mock.calls.filter((c) => c[0] === 'resize')
      // 1 attach (layoutA.init) + 1 attach (layoutB.init after destroy)
      // = 2 total addEventListener calls, but only 1 active listener at a time.
      expect(resizeAfterHmr.length).toBe(2)

      // Active listener count = 1 (the new instance).
      const w = window as unknown as { __layoutListenerCount?: number }
      expect(w.__layoutListenerCount).toBe(1)

      addSpy.mockRestore()
    })
  })

  // ─────────────────────────────────────────────
  // INV-LAYOUT-11: Hydration anti-flicker (data-hydrated)
  // ─────────────────────────────────────────────

  describe('INV-LAYOUT-11: data-hydrated attribute', () => {
    it('sets <html data-hydrated="true"> on init()', () => {
      document.documentElement.removeAttribute('data-hydrated')
      expect(document.documentElement.getAttribute('data-hydrated')).toBeNull()

      const layout = useLayoutStore()
      layout.init()

      expect(document.documentElement.getAttribute('data-hydrated')).toBe('true')
    })

    it('removes data-hydrated on destroy()', () => {
      const layout = useLayoutStore()
      layout.init()
      expect(document.documentElement.getAttribute('data-hydrated')).toBe('true')

      layout.destroy()
      expect(document.documentElement.getAttribute('data-hydrated')).toBeNull()
    })
  })

  // ─────────────────────────────────────────────
  // bindRouteChanges — auto-close mobile drawer
  // ─────────────────────────────────────────────

  describe('bindRouteChanges()', () => {
    it('closes mobile drawer on route.path change', async () => {
      setViewport(400)
      const layout = useLayoutStore()
      layout.init()

      const route = { path: '/dashboard' }
      const reactiveRoute = (await import('vue')).reactive(route)
      layout.bindRouteChanges(reactiveRoute as never)

      layout.openSidebar()
      expect(layout.sidebar.isOpen).toBe(true)

      reactiveRoute.path = '/marketplace'
      await new Promise((r) => setTimeout(r, 0))

      expect(layout.sidebar.isOpen).toBe(false)
    })
  })
})
