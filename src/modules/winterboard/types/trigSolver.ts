/**
 * trig_solver asset type — unified trig equation & inequality solver card.
 * Visualises sin/cos/tan/cot(x) = a  OR  f(x) >/</≥/≤ a on a unit circle.
 *
 * Replaces the two-type design (§3.7.7 trig_equation + §3.7.8 trig_inequality)
 * with a single card that has a mode toggle inside.
 *
 * SSOT §3.7.7: trig_solver data contract.
 */
import type { WBAsset } from './winterboard'

export type TrigSolverFunc = 'sin' | 'cos' | 'tan' | 'cot'
export type TrigSolverSign = '>' | '<' | '≥' | '≤'
export type TrigSolverMode = 'equation' | 'inequality'

/** Drag MIME emitted by TrigSolverTray. */
export const TRIG_SOLVER_DRAG_MIME = 'application/x-trig-solver'

export interface TrigSolverDragPayload {
  func: TrigSolverFunc
}

/**
 * Persisted data envelope (version 1). All fields are flat.
 * → Add 'trig_solver' to FLAT_DATA_ASSET_TYPES in assetEquality.ts.
 */
export interface TrigSolverData {
  version: 1
  /** 'equation' → f(x) = a;  'inequality' → f(x) >/</≥/≤ a */
  mode: TrigSolverMode
  /** Which trig function is displayed. */
  func: TrigSolverFunc
  /** Inequality sign (ignored in equation mode). */
  sign: TrigSolverSign
  /** RHS value 'a'.  sin/cos → [−1, 1];  tan/cot → (−∞, +∞). */
  value: number
  /** Show solution panel on the right (formula for eq, interval for ineq). */
  showInfo: boolean
}

export type TrigSolverAsset = WBAsset & {
  type: 'trig_solver'
  data: TrigSolverData
}
