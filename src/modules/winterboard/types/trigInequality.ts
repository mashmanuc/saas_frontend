/**
 * trig_inequality asset type — trig inequality solver card.
 * Visualises sin/cos/tan/cot(x) >/</=/≤ a on unit circle with shaded region.
 * SSOT §3.7.8: trig_inequality data contract.
 */
import type { WBAsset } from './winterboard'

export type TrigIneqFunc = 'sin' | 'cos' | 'tan' | 'cot'
export type TrigIneqSign = '>' | '<' | '≥' | '≤'

/** Drag MIME emitted by TrigSolverTray for inequality items. */
export const TRIG_INEQUALITY_DRAG_MIME = 'application/x-trig-inequality'

export interface TrigInequalityDragPayload {
  type: 'trig_inequality'
  func: TrigIneqFunc
}

/**
 * Persisted data envelope (version 1).
 * All fields are flat — add to FLAT_DATA_ASSET_TYPES in assetEquality.ts.
 */
export interface TrigInequalityData {
  version: 1
  /** Which trig function is displayed. */
  func: TrigIneqFunc
  /** Inequality sign. */
  sign: TrigIneqSign
  /** RHS value 'a'. */
  value: number
  /** Show solution interval in the right panel. */
  showInterval: boolean
}

export type TrigInequalityAsset = WBAsset & {
  type: 'trig_inequality'
  data: TrigInequalityData
}
