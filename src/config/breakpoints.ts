/**
 * Breakpoints SSoT (Single Source of Truth)
 *
 * Канонічна шкала viewport breakpoints для всього проекту.
 * Це джерело істини для:
 *   - layoutStore (Dashboard / shared runtime state)
 *   - useDeviceMode (Winterboard) — імпортує сюди ж (узгоджено з WB_BREAKPOINTS)
 *   - tailwind.config.js (Tailwind screens)
 *
 * Refs:
 *   - saas_docs/plans/ADAPTIVE_AUDIT_2026-05-01.md (INV-RESP-1, audit Phase -1 G-1)
 *   - saas_docs/plans/LAYOUT_SSOT_2026-05-02.md (INV-LAYOUT-1, INV-LAYOUT-5)
 *
 * INV-RESP-1: будь-який hardcoded `@media (max-width: NNNpx)` поза whitelist —
 *             порушення SSoT. Use these tokens.
 *
 * Цей файл НЕ має Vue-deps, щоб імпортуватись також у tailwind.config.js (CommonJS bridge).
 */

export const BREAKPOINTS = {
  xs: 480,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  display: 1920,
} as const

export type BreakpointKey = keyof typeof BREAKPOINTS

/**
 * Resolve breakpoint name from viewport width.
 * < xs (480)       → 'xs'
 * < sm (640)       → 'sm'
 * < md (768)       → 'md'
 * < lg (1024)      → 'lg'
 * < xl (1280)      → 'xl'
 * < 2xl (1536)     → '2xl'
 * ≥ display (1920) → 'display'
 */
export function resolveBreakpoint(width: number): BreakpointKey {
  if (width < BREAKPOINTS.xs) return 'xs'
  if (width < BREAKPOINTS.sm) return 'sm'
  if (width < BREAKPOINTS.md) return 'md'
  if (width < BREAKPOINTS.lg) return 'lg'
  if (width < BREAKPOINTS.xl) return 'xl'
  if (width < BREAKPOINTS['2xl']) return '2xl'
  return 'display'
}

/**
 * Device categories (project-wide convention).
 * Mobile: < md (< 768)
 * Tablet: md..lg-1 (768..1023)
 * Desktop: lg..display-1 (1024..1919)
 * Display: ≥ display (1920+)
 *
 * NOTE: Winterboard internal `useDeviceMode` використовує власну градацію
 * через `WB_BREAKPOINTS` (frontend/src/modules/winterboard/types/responsive.ts).
 * Числа збігаються (640/768/1024/1280/1920); це навмисно для consistency.
 */
export type DeviceCategory = 'mobile' | 'tablet' | 'desktop' | 'display'

export function resolveDevice(width: number): DeviceCategory {
  if (width < BREAKPOINTS.md) return 'mobile'
  if (width < BREAKPOINTS.lg) return 'tablet'
  if (width < BREAKPOINTS.display) return 'desktop'
  return 'display'
}
