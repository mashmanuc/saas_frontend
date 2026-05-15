/**
 * Phase Calculus — type definitions for `calculus_card` WBAsset.
 *
 * Refs:
 *   - vendor/calculus/index.ts — runtime CalculusCard engine
 *   - Mirror pattern: types/geometry2dV2.ts, types/graphCalculator.ts
 */

import type { WBAsset } from './winterboard'
import type { CalculusMode, RiemannMode } from '../vendor/calculus'

/** Persisted data envelope для calculus_card asset. */
export interface CalculusData {
  version: 1
  mode: CalculusMode
  expr: string
  // Derivative state
  x0?: number
  showSecant?: boolean
  h?: number
  showDerivTrace?: boolean
  // Integral state
  a?: number
  b?: number
  riemann?: RiemannMode
  N?: number
  showF?: boolean
  // View transform
  viewport?: { cx: number; cy: number; scale: number }
}

export interface CalculusAsset extends WBAsset {
  type: 'calculus_card'
  src: ''
  data: CalculusData
}

/** MIME для tray → drop handler payload. */
export const CALCULUS_DRAG_MIME = 'application/x-calculus'

export interface CalculusDragPayload {
  mode: CalculusMode
}
