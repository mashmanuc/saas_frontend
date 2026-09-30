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

/**
 * Quick-expression presets, shown у CalculusRenderer toolbar.
 *
 * `integral` — межі [a, b], на яких приклад читається в режимі інтеграла (власник 2026-09-30,
 * «так, роби»): до цього приклад брав a, b від попередньої функції, і eˣ на [0,1; 10,97]
 * давала вісь Y на сотні тисяч, а криву — пластом уздовж осі.
 */
export const CALCULUS_EXPR_PRESETS: ReadonlyArray<{
  label: string
  expr: string
  integral: readonly [number, number]
}> = Object.freeze([
  { label: 'x²', expr: 'x^2', integral: [0, 2] },
  { label: 'x³−3x', expr: 'x^3 - 3*x', integral: [-2, 2] },
  { label: 'sin x', expr: 'sin(x)', integral: [0, 3.14] },
  { label: 'cos x', expr: 'cos(x)', integral: [-1.57, 1.57] },
  { label: 'eˣ', expr: 'exp(x)', integral: [0, 2] },
  { label: '1/(1+x²)', expr: '1/(1 + x^2)', integral: [-2, 2] },
  { label: '√x', expr: 'sqrt(x)', integral: [0, 4] },
  { label: '|x|', expr: 'abs(x)', integral: [-2, 2] },
] as const)

/** Межі інтеграла для прикладу; не приклад — null (власна функція вчителя межі не змінює). */
export function calculusPresetInterval(expr: string): readonly [number, number] | null {
  return CALCULUS_EXPR_PRESETS.find((p) => p.expr === expr)?.integral ?? null
}

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
