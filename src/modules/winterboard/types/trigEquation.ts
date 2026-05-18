/**
 * trig_equation asset type — trig equation solver card.
 * Visualises sin/cos/tan/cot(x) = a on unit circle.
 * SSOT §3.7.7: trig_equation data contract.
 */
import type { WBAsset } from './winterboard'

export type TrigEqFunc = 'sin' | 'cos' | 'tan' | 'cot'

/** Drag MIME emitted by TrigSolverTray for equation items. */
export const TRIG_EQUATION_DRAG_MIME = 'application/x-trig-equation'

export interface TrigEquationDragPayload {
  type: 'trig_equation'
  func: TrigEqFunc
}

/**
 * Persisted data envelope (version 1).
 * All fields are flat — add to FLAT_DATA_ASSET_TYPES in assetEquality.ts.
 */
export interface TrigEquationData {
  version: 1
  /** Which trig function is displayed. */
  func: TrigEqFunc
  /** RHS value 'a' in func(x) = a.  Range: sin/cos → [−1, 1]; tan/cot → (−∞, +∞). */
  value: number
  /** Show general solution formula in the right panel. */
  showFormula: boolean
  /** Draw angle labels next to solution points on the circle. */
  showAngles: boolean
}

export type TrigEquationAsset = WBAsset & {
  type: 'trig_equation'
  data: TrigEquationData
}
