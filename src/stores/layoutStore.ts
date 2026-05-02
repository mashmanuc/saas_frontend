import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed, readonly, watch, getCurrentInstance } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import {
  BREAKPOINTS,
  resolveBreakpoint,
  resolveDevice,
  type BreakpointKey,
  type DeviceCategory,
} from '@/config/breakpoints'

/**
 * Layout SSoT — runtime store for viewport + breakpoint + sidebar.
 *
 * SSoT-compliant single source for Dashboard / shared shell layout state.
 *
 * Refs:
 *   - saas_docs/plans/LAYOUT_SSOT_2026-05-02.md (v4, Stage 1)
 *   - INV-LAYOUT-1..9
 *
 * Boundary:
 *   - Use this store: Dashboard, Marketplace, Lessons, shared UI (Modal, etc.).
 *   - DO NOT use in Winterboard rooms — they use useDeviceMode (INV-RESP-3).
 *   - DO NOT mutate :root CSS vars from here (INV-LAYOUT-8); CSS = SSoT for dimensions.
 *   - DO NOT expose sidebarWidth/containerMaxWidth — JS doesn't know px (Variant A).
 *
 * Critical contracts:
 *   - init() must run synchronously in App.vue setup() (NOT onMounted).
 *   - getViewportSnapshot() = non-reactive accessor for popover positioning (INV-LAYOUT-9).
 *   - sidebarMode is derived; collapse_breakpoint == overlay_breakpoint == lg (D-1, INV-LAYOUT-5).
 */

const STORAGE_KEY = 'layout:sidebar:collapsed'
const LEGACY_STORAGE_KEY = 'sidebar-collapsed'

const SSR_DEFAULT_WIDTH = 1280
const SSR_DEFAULT_HEIGHT = 720

export const useLayoutStore = defineStore('layout', () => {
  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────

  const viewport = ref({
    width: SSR_DEFAULT_WIDTH,
    height: SSR_DEFAULT_HEIGHT,
  })

  const sidebar = ref({
    isCollapsed: false,
    isOpen: false,
  })

  const ui = ref({
    isHydrated: false,
  })

  // ─────────────────────────────────────────────
  // Internal lifecycle flags (idempotency guards)
  // ─────────────────────────────────────────────

  let initialized = false
  let listenerAttached = false
  let rafId: number | null = null
  let routeUnwatcher: (() => void) | null = null

  // ─────────────────────────────────────────────
  // Derived getters (computed, read-only)
  // ─────────────────────────────────────────────

  const breakpoint = computed<BreakpointKey>(() => resolveBreakpoint(viewport.value.width))
  const device = computed<DeviceCategory>(() => resolveDevice(viewport.value.width))

  const isMobile = computed(() => device.value === 'mobile')
  const isTablet = computed(() => device.value === 'tablet')
  const isDesktop = computed(() => device.value === 'desktop' || device.value === 'display')
  const isDisplay = computed(() => device.value === 'display')

  // INV-LAYOUT-5: collapse_bp == overlay_bp == lg (1024).
  const sidebarMode = computed<'overlay' | 'static'>(() =>
    viewport.value.width < BREAKPOINTS.lg ? 'overlay' : 'static',
  )

  // ─────────────────────────────────────────────
  // Internal: localStorage (with legacy migration)
  // ─────────────────────────────────────────────

  function readPersistedCollapsed(): boolean {
    if (typeof window === 'undefined') return false

    try {
      const v2 = localStorage.getItem(STORAGE_KEY)
      if (v2 !== null) {
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
        if (legacy !== null) localStorage.removeItem(LEGACY_STORAGE_KEY)
        return v2 === 'true'
      }

      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
      if (legacy !== null) {
        localStorage.setItem(STORAGE_KEY, legacy)
        localStorage.removeItem(LEGACY_STORAGE_KEY)
        return legacy === 'true'
      }
    } catch {
      // localStorage unavailable
    }
    return false
  }

  function writePersistedCollapsed(value: boolean): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, String(value))
    } catch {
      // ignore
    }
  }

  // ─────────────────────────────────────────────
  // Internal: viewport sync
  // ─────────────────────────────────────────────

  function readViewport(): void {
    if (typeof window === 'undefined') return
    viewport.value = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
  }

  function handleResize(): void {
    if (typeof window === 'undefined') return
    if (rafId !== null) return
    rafId = requestAnimationFrame(() => {
      readViewport()
      rafId = null
    })
  }

  function handleOrientationChange(): void {
    setTimeout(readViewport, 100)
  }

  // ─────────────────────────────────────────────
  // Listener budget (INV-LAYOUT-10 — HARD invariant, not recommendation)
  // Stages 2-4 transitional: ≤3 (layoutStore + legacy resp composable + useDeviceMode).
  // Stage 5+ production: ≤2 (layoutStore + useDeviceMode).
  // Overflow → throw in DEV mode (caught by tests / breaks app early).
  // In prod build — silent counter (still useful for synthetic load tests).
  // ─────────────────────────────────────────────

  const LISTENER_BUDGET_TRANSITIONAL = 3
  const LISTENER_BUDGET_PRODUCTION = 2

  function incrementListenerCounter(): void {
    if (typeof window === 'undefined') return
    const w = window as unknown as { __layoutListenerCount?: number }
    w.__layoutListenerCount = (w.__layoutListenerCount ?? 0) + 1

    const isStage5 = (w as unknown as { __layoutStage5Mode?: boolean }).__layoutStage5Mode === true
    const budget = isStage5 ? LISTENER_BUDGET_PRODUCTION : LISTENER_BUDGET_TRANSITIONAL

    if ((w.__layoutListenerCount ?? 0) > budget) {
      const msg =
        `[layoutStore] INV-LAYOUT-10 violation: resize listener budget exceeded. ` +
        `Count=${w.__layoutListenerCount}, budget=${budget} (mode=${isStage5 ? 'STAGE5' : 'TRANSITIONAL'}). ` +
        `Likely cause: legacy responsive composable instance still alive, ` +
        `OR multiple layoutStore.init() without destroy(). ` +
        `Check Vue DevTools / mount-unmount cycles / HMR.`

      if (import.meta.env && import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error(msg)
        throw new Error(msg)
      } else {
        // eslint-disable-next-line no-console
        console.error(msg)
      }
    }
  }

  function decrementListenerCounter(): void {
    if (typeof window === 'undefined') return
    const w = window as unknown as { __layoutListenerCount?: number }
    w.__layoutListenerCount = Math.max(0, (w.__layoutListenerCount ?? 0) - 1)
  }

  // ─────────────────────────────────────────────
  // Public API: lifecycle
  // ─────────────────────────────────────────────

  /**
   * CRITICAL: Must run synchronously in App.vue setup() — NOT onMounted.
   * Sets viewport from window BEFORE first render; ui.isHydrated = true.
   */
  function init(): void {
    if (initialized) return

    if (typeof window === 'undefined') {
      // SSR — viewport keeps SSR defaults; do not attach listeners.
      ui.value.isHydrated = false
      initialized = true
      return
    }

    // 1. Synchronous viewport read (BEFORE any render).
    readViewport()

    // 2. Hydrate sidebar from localStorage (with legacy migration).
    sidebar.value.isCollapsed = readPersistedCollapsed()

    // 3. Attach listeners (single instance via guard).
    if (!listenerAttached) {
      window.addEventListener('resize', handleResize, { passive: true })
      window.addEventListener('orientationchange', handleOrientationChange, { passive: true })
      listenerAttached = true
      incrementListenerCounter()
    }

    // 4. Set <html data-hydrated="true"> for CSS anti-flicker rule (INV-LAYOUT-11).
    //    Pairs with `html:not([data-hydrated]) { visibility: hidden }` у tokens.css.
    //    NOTE: this is the ONE legitimate exception to INV-LAYOUT-8 (no DOM mutation
    //    from store) — а пишемо attribute, не CSS var. Documented as INV-LAYOUT-11.
    if (document?.documentElement) {
      document.documentElement.setAttribute('data-hydrated', 'true')
    }

    // 5. Mark hydrated — last, so getters fire only when state is consistent.
    ui.value.isHydrated = true
    initialized = true
  }

  /**
   * Detach listeners + reset flags. For HMR / tests.
   */
  function destroy(): void {
    if (typeof window !== 'undefined') {
      if (listenerAttached) {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('orientationchange', handleOrientationChange)
        listenerAttached = false
        decrementListenerCounter()
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    }

    if (routeUnwatcher) {
      routeUnwatcher()
      routeUnwatcher = null
    }

    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.removeAttribute('data-hydrated')
    }

    ui.value.isHydrated = false
    initialized = false
  }

  /**
   * Non-reactive viewport accessor for popover/dropdown/menu positioning.
   * INV-LAYOUT-9: popovers MUST use this; reading viewport.value.* directly
   * subscribes to reactivity → recompute on resize → jitter.
   */
  function getViewportSnapshot(): { width: number; height: number } {
    return {
      width: viewport.value.width,
      height: viewport.value.height,
    }
  }

  // ─────────────────────────────────────────────
  // Public API: sidebar actions
  // ─────────────────────────────────────────────

  /**
   * Context-aware toggle:
   *   overlay mode (mobile) → toggle isOpen
   *   static mode (desktop) → toggle isCollapsed (persisted)
   *
   * DEV mode: logs caller component name — helps detect Stage 3 bridge
   * double-flow (INV-LAYOUT-7). If two different component names appear
   * у швидкій послідовності → race detected.
   *
   * NOTE: uses getCurrentInstance() (component name only), NOT Error.stack
   * (S-2 from red-team: stack leaks absolute file paths).
   */
  function toggleSidebar(): void {
    if (import.meta.env && import.meta.env.DEV) {
      const instance = getCurrentInstance()
      const source =
        (instance?.type as { name?: string; __name?: string } | undefined)?.name ??
        (instance?.type as { name?: string; __name?: string } | undefined)?.__name ??
        '<unknown>'
      const willBeOpen =
        sidebarMode.value === 'overlay' ? !sidebar.value.isOpen : sidebar.value.isOpen
      const willBeCollapsed =
        sidebarMode.value === 'static' ? !sidebar.value.isCollapsed : sidebar.value.isCollapsed
      // eslint-disable-next-line no-console
      console.debug('[layoutStore.toggleSidebar]', {
        source,
        mode: sidebarMode.value,
        nextOpen: willBeOpen,
        nextCollapsed: willBeCollapsed,
      })
    }

    if (sidebarMode.value === 'overlay') {
      sidebar.value.isOpen = !sidebar.value.isOpen
    } else {
      sidebar.value.isCollapsed = !sidebar.value.isCollapsed
      writePersistedCollapsed(sidebar.value.isCollapsed)
    }
  }

  /** Mobile-only: open drawer. No-op in static mode. */
  function openSidebar(): void {
    if (sidebarMode.value !== 'overlay') return
    sidebar.value.isOpen = true
  }

  /** Mobile-only: close drawer. No-op in static mode. */
  function closeSidebar(): void {
    if (sidebarMode.value !== 'overlay') return
    sidebar.value.isOpen = false
  }

  /** Desktop-only: set collapsed state. No-op in overlay mode. Persists. */
  function setCollapsed(value: boolean): void {
    if (sidebarMode.value !== 'static') return
    sidebar.value.isCollapsed = value
    writePersistedCollapsed(value)
  }

  /**
   * Auto-close mobile drawer on route change.
   * Pass `useRoute()` result from App.vue setup() (Vue Router reactive route).
   * Idempotent: re-calling replaces the previous watcher cleanly.
   */
  function bindRouteChanges(route: RouteLocationNormalizedLoaded): void {
    if (routeUnwatcher) {
      routeUnwatcher()
      routeUnwatcher = null
    }
    routeUnwatcher = watch(
      () => route.path,
      () => {
        if (sidebar.value.isOpen) sidebar.value.isOpen = false
      },
    )
  }

  // ─────────────────────────────────────────────
  // Return (readonly state + getters + actions)
  // ─────────────────────────────────────────────

  return {
    // State (readonly to consumers; mutations only via actions)
    viewport: readonly(viewport),
    sidebar: readonly(sidebar),
    ui: readonly(ui),

    // Derived
    breakpoint,
    device,
    isMobile,
    isTablet,
    isDesktop,
    isDisplay,
    sidebarMode,
    // NOTE: sidebarWidth / containerMaxWidth INTENTIONALLY NOT exposed.
    // CSS = SSoT for layout dimensions (INV-LAYOUT-8, Variant A).

    // Actions
    init,
    destroy,
    getViewportSnapshot,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    setCollapsed,
    bindRouteChanges,
  }
})

// ─────────────────────────────────────────────
// HMR support (B-1 fix from red-team audit)
// ─────────────────────────────────────────────
//
// Without this, Vite HMR replaces the module → new closure → init() reattaches
// listener → previous listener orphaned on window → INV-LAYOUT-10 throws on
// 3rd HMR edit. acceptHMRUpdate keeps Pinia state across reloads; dispose hook
// destroys the previous instance to release the listener.
//
// Refs:
//   - saas_docs/plans/LAYOUT_SSOT_2026-05-02_RED_TEAM.md (B-1)
//   - https://pinia.vuejs.org/cookbook/hot-module-replacement.html

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useLayoutStore, import.meta.hot))
  import.meta.hot.dispose(() => {
    try {
      useLayoutStore().destroy()
    } catch {
      // store may already be torn down or pinia not active
    }
  })
}
