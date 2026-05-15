/**
 * Phase Calculus — default state, MIME, presets for `calculus_card` assets.
 *
 * Refs:
 *   - types/calculus.ts
 *   - vendor/calculus/index.ts
 * Mirror pattern: constants/geometry2dV2Defaults.ts
 */

import type { CalculusData, CalculusDragPayload } from '../types/calculus'
import type { CalculusMode } from '../vendor/calculus'

export { CALCULUS_DRAG_MIME } from '../types/calculus'
export type { CalculusDragPayload }

/** Default card size (px) при drop. */
export const DEFAULT_CALCULUS_W = 480
export const DEFAULT_CALCULUS_H = 360

/** Tray entries — 2 fixed cards. */
export const CALCULUS_PRESETS: ReadonlyArray<{ mode: CalculusMode; short: string }> = Object.freeze([
  { mode: 'derivative', short: "f'(x)" },
  { mode: 'integral', short: '∫ f dx' },
])

/** Quick-expression presets, shown у CalculusRenderer toolbar. */
export const CALCULUS_EXPR_PRESETS: ReadonlyArray<{ label: string; expr: string }> = Object.freeze([
  { label: 'x²', expr: 'x^2' },
  { label: 'x³−3x', expr: 'x^3 - 3*x' },
  { label: 'sin x', expr: 'sin(x)' },
  { label: 'cos x', expr: 'cos(x)' },
  { label: 'eˣ', expr: 'exp(x)' },
  { label: '1/(1+x²)', expr: '1/(1 + x^2)' },
  { label: '√x', expr: 'sqrt(x)' },
  { label: '|x|', expr: 'abs(x)' },
])

/**
 * Build fresh data envelope для нової картки. Mode-specific defaults
 * відповідають bundle's CalculusCard constructor opts.
 */
export function buildDefaultCalculusData(mode: CalculusMode): CalculusData {
  if (mode === 'derivative') {
    return {
      version: 1,
      mode: 'derivative',
      expr: 'x^2',
      x0: 1.0,
      showSecant: false,
      h: 0.5,
      showDerivTrace: false,
      viewport: { cx: 0, cy: 0, scale: 50 },
    }
  }
  return {
    version: 1,
    mode: 'integral',
    expr: 'x^2',
    a: -1.5,
    b: 1.5,
    riemann: 'off',
    N: 12,
    showF: false,
    viewport: { cx: 0, cy: 0, scale: 50 },
  }
}

/** Locked allowed-mode set — drop handler validates payload.mode. */
export const CALCULUS_MODE_SET: ReadonlySet<CalculusMode> = new Set(['derivative', 'integral'])
