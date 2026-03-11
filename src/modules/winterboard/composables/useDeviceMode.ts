// WB Responsive: Device mode detection composable
// Ref: winterboard_dev/responsive/PHASE1.md A1
// INV-2: deviceMode (width) and inputMode (pointer) are INDEPENDENT — NEVER mix

import { ref, computed, onMounted, onUnmounted, readonly, type Ref, type ComputedRef } from 'vue'
import type { DeviceMode, InputMode, Orientation, DeviceModeState } from '../types/responsive'
import { WB_BREAKPOINTS, resolveDeviceMode, resolveInputMode } from '../types/responsive'

// ─── Return type ────────────────────────────────────────────────────────────

export interface UseDeviceModeReturn {
  // Layout system (width-based)
  deviceMode: ComputedRef<DeviceMode>
  isMobile: ComputedRef<boolean>
  isTablet: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
  isDisplay: ComputedRef<boolean>

  // Input system (pointer-based)
  inputMode: ComputedRef<InputMode>
  isTouchInput: ComputedRef<boolean>
  isPenInput: ComputedRef<boolean>
  hasMultipleInputModes: ComputedRef<boolean>

  // Orientation system
  orientation: ComputedRef<Orientation>
  isLandscape: ComputedRef<boolean>

  // Raw state
  state: Readonly<Ref<DeviceModeState>>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getInitialInputMode(): InputMode {
  if (typeof window === 'undefined') return 'mouse'
  // Static detection via matchMedia — fallback for initial state
  const hasFine = window.matchMedia('(pointer: fine)').matches
  const hasCoarse = window.matchMedia('(pointer: coarse)').matches
  const anyFine = window.matchMedia('(any-pointer: fine)').matches
  const anyCoarse = window.matchMedia('(any-pointer: coarse)').matches

  // If both fine and coarse pointers exist → likely pen-capable device
  if (anyFine && anyCoarse) return 'pen'
  if (hasCoarse && !hasFine) return 'touch'
  return 'mouse'
}

function getOrientation(): Orientation {
  if (typeof screen !== 'undefined' && screen.orientation) {
    return screen.orientation.type.startsWith('portrait') ? 'portrait' : 'landscape'
  }
  if (typeof window !== 'undefined') {
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  }
  return 'landscape'
}

function getViewportWidth(): number {
  if (typeof window === 'undefined') return 1280
  return window.innerWidth
}

function getViewportHeight(): number {
  if (typeof window === 'undefined') return 720
  return window.innerHeight
}

function getDpr(): number {
  if (typeof window === 'undefined') return 1
  return window.devicePixelRatio || 1
}

function getHasTouch(): boolean {
  if (typeof window === 'undefined') return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

function getHasPen(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(any-pointer: fine)').matches &&
         window.matchMedia('(any-pointer: coarse)').matches
}

function getHasHover(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(hover: hover)').matches
}

function getIsStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches ||
         (navigator as any).standalone === true
}

// ─── Composable ─────────────────────────────────────────────────────────────

const RESIZE_DEBOUNCE_MS = 100

export function useDeviceMode(): UseDeviceModeReturn {
  const state = ref<DeviceModeState>({
    deviceMode: resolveDeviceMode(getViewportWidth()),
    viewportWidth: getViewportWidth(),
    viewportHeight: getViewportHeight(),
    inputMode: getInitialInputMode(),
    hasTouch: getHasTouch(),
    hasPen: getHasPen(),
    hasHover: getHasHover(),
    orientation: getOrientation(),
    dpr: getDpr(),
    isStandalone: getIsStandalone(),
  })

  let resizeTimeoutId: ReturnType<typeof setTimeout> | null = null
  let resizeObserver: ResizeObserver | null = null

  // ── Viewport resize handler (deviceMode ONLY from width) ───────────

  function updateViewport() {
    const w = getViewportWidth()
    const h = getViewportHeight()
    const newMode = resolveDeviceMode(w)

    state.value = {
      ...state.value,
      deviceMode: newMode,
      viewportWidth: w,
      viewportHeight: h,
      dpr: getDpr(),
    }
  }

  function debouncedViewportUpdate() {
    if (resizeTimeoutId) clearTimeout(resizeTimeoutId)
    resizeTimeoutId = setTimeout(updateViewport, RESIZE_DEBOUNCE_MS)
  }

  // ── Input mode handler (from PointerEvent ONLY) ────────────────────

  function handlePointerEvent(e: PointerEvent) {
    const newInputMode = resolveInputMode(e.pointerType)
    if (newInputMode !== state.value.inputMode) {
      state.value = {
        ...state.value,
        inputMode: newInputMode,
      }
    }
  }

  // ── Orientation handler (from screen.orientation API) ──────────────

  function handleOrientationChange() {
    // Viewport needs time to stabilize after orientation change
    setTimeout(() => {
      const newOrientation = getOrientation()
      const w = getViewportWidth()
      const h = getViewportHeight()
      state.value = {
        ...state.value,
        orientation: newOrientation,
        viewportWidth: w,
        viewportHeight: h,
        deviceMode: resolveDeviceMode(w),
      }
    }, 150)
  }

  // ── matchMedia listeners for capabilities ──────────────────────────

  let hoverMql: MediaQueryList | null = null
  let touchMql: MediaQueryList | null = null

  function handleHoverChange(e: MediaQueryListEvent) {
    state.value = { ...state.value, hasHover: e.matches }
  }

  function handleTouchChange() {
    state.value = {
      ...state.value,
      hasTouch: getHasTouch(),
      hasPen: getHasPen(),
    }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  onMounted(() => {
    if (typeof window === 'undefined') return

    // Initial state refresh
    updateViewport()

    // ResizeObserver on documentElement for viewport changes
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(debouncedViewportUpdate)
      resizeObserver.observe(document.documentElement)
    } else {
      window.addEventListener('resize', debouncedViewportUpdate, { passive: true })
    }

    // PointerEvent listener for dynamic inputMode updates
    document.addEventListener('pointerdown', handlePointerEvent, { passive: true })
    document.addEventListener('pointermove', handlePointerEvent, { passive: true })

    // Orientation change
    if (screen.orientation) {
      screen.orientation.addEventListener('change', handleOrientationChange)
    }
    window.addEventListener('orientationchange', handleOrientationChange, { passive: true })

    // matchMedia listeners for capability changes
    hoverMql = window.matchMedia('(hover: hover)')
    hoverMql.addEventListener('change', handleHoverChange)

    touchMql = window.matchMedia('(any-pointer: coarse)')
    touchMql.addEventListener('change', handleTouchChange)
  })

  onUnmounted(() => {
    if (typeof window === 'undefined') return

    if (resizeTimeoutId) clearTimeout(resizeTimeoutId)

    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    } else {
      window.removeEventListener('resize', debouncedViewportUpdate)
    }

    document.removeEventListener('pointerdown', handlePointerEvent)
    document.removeEventListener('pointermove', handlePointerEvent)

    if (screen.orientation) {
      screen.orientation.removeEventListener('change', handleOrientationChange)
    }
    window.removeEventListener('orientationchange', handleOrientationChange)

    hoverMql?.removeEventListener('change', handleHoverChange)
    touchMql?.removeEventListener('change', handleTouchChange)
    hoverMql = null
    touchMql = null
  })

  // ── Computed refs ──────────────────────────────────────────────────

  return {
    // Layout system (width-based ONLY — INV-2)
    deviceMode: computed(() => state.value.deviceMode),
    isMobile: computed(() => state.value.deviceMode === 'mobile'),
    isTablet: computed(() => state.value.deviceMode === 'tablet'),
    isDesktop: computed(() => state.value.deviceMode === 'desktop'),
    isDisplay: computed(() => state.value.deviceMode === 'display'),

    // Input system (pointer-based ONLY — INV-2)
    inputMode: computed(() => state.value.inputMode),
    isTouchInput: computed(() => state.value.inputMode === 'touch'),
    isPenInput: computed(() => state.value.inputMode === 'pen'),
    hasMultipleInputModes: computed(() => {
      const s = state.value
      // Device supports multiple input modes (e.g. Surface Pro = pen+mouse+touch)
      const modes = [s.hasTouch, s.hasPen, s.hasHover].filter(Boolean).length
      return modes >= 2
    }),

    // Orientation system
    orientation: computed(() => state.value.orientation),
    isLandscape: computed(() => state.value.orientation === 'landscape'),

    // Raw state (readonly)
    state: readonly(state) as Readonly<Ref<DeviceModeState>>,
  }
}
