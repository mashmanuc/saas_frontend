// WB Responsive: Device mode detection types
// Ref: winterboard_dev/responsive/PHASE1.md A1
// INV-2: deviceMode and inputMode are INDEPENDENT systems — NEVER mix them

/**
 * Device mode based on viewport width ONLY.
 * Used for: layout, CSS, breakpoints, toolbar position.
 * INV-2: NEVER mix with inputMode.
 */
export type DeviceMode = 'mobile' | 'tablet' | 'desktop' | 'display'

/**
 * Input mode based on PointerEvent.pointerType ONLY.
 * Used for: gesture config, palm rejection, draw/pan logic.
 * INV-2: NEVER mix with deviceMode.
 */
export type InputMode = 'touch' | 'pen' | 'mouse'

/**
 * Screen orientation from screen.orientation API.
 */
export type Orientation = 'portrait' | 'landscape'

/**
 * Complete device state — 3 independent systems.
 * deviceMode (width) + inputMode (pointer) + orientation (screen API).
 */
export interface DeviceModeState {
  // Layout system (width-based)
  deviceMode: DeviceMode
  viewportWidth: number
  viewportHeight: number

  // Input system (pointer-based)
  inputMode: InputMode
  hasTouch: boolean
  hasPen: boolean
  hasHover: boolean

  // Orientation system
  orientation: Orientation

  // Additional
  dpr: number
  isStandalone: boolean
}

/**
 * Breakpoints aligned with RESPONSIVE_STRATEGY.md.
 * Used by useDeviceMode() to resolve deviceMode from viewport width.
 */
export const WB_BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  tabletL: 1024,
  desktop: 1280,
  display: 1920,
} as const

/**
 * Resolve deviceMode from viewport width ONLY (INV-2).
 * < 640  → mobile
 * < 1024 → tablet
 * < 1920 → desktop
 * ≥ 1920 → display
 */
export function resolveDeviceMode(width: number): DeviceMode {
  if (width < WB_BREAKPOINTS.mobile) return 'mobile'
  if (width < WB_BREAKPOINTS.tabletL) return 'tablet'
  if (width < WB_BREAKPOINTS.display) return 'desktop'
  return 'display'
}

/**
 * Resolve inputMode from PointerEvent.pointerType ONLY (INV-2).
 */
export function resolveInputMode(pointerType: string): InputMode {
  if (pointerType === 'pen') return 'pen'
  if (pointerType === 'touch') return 'touch'
  return 'mouse'
}
