/**
 * trig_solver asset type — unified trig equation & inequality solver card.
 * Visualises sin/cos/tan/cot(x) = a  OR  f(x) >/</≥/≤ a on a unit circle
 * with an optional function graph side panel.
 *
 * Engine: vendor/trig/trig-equations.js → window.TrigEquation (§3.7.7).
 */
import type { WBAsset } from './winterboard'

export type TrigFuncType = 'sin' | 'cos' | 'tan' | 'cot'
export type TrigRelation = '=' | '>' | '<' | '>=' | '<='

/** Drag MIME emitted by TrigSolverTray. */
export const TRIG_SOLVER_DRAG_MIME = 'application/x-trig-solver'

export interface TrigSolverDragPayload {
  type: TrigFuncType
}

/**
 * Persisted data envelope (version 1). All fields are flat.
 * → Registered in FLAT_DATA_ASSET_TYPES in assetEquality.ts.
 */
export interface TrigSolverData {
  version: 1
  /** Which trig function. */
  type: TrigFuncType
  /** Relation: '=' = equation, '>'/'<'/'>=''<=' = inequality. */
  rel: TrigRelation
  /** RHS value 'a'.  sin/cos → [−1, 1];  tan/cot clamped by engine. */
  a: number
  /** Snap 'a' to special table values (½, √2/2, √3/2 …). */
  snapSpecial: boolean
  /** Show function graph side panel. */
  showGraph: boolean
  /** Show periodic solution copies (faint). */
  showAllSolutions: boolean
}

export type TrigSolverAsset = WBAsset & {
  type: 'trig_solver'
  data: TrigSolverData
}
