/**
 * Phase G — graph_calculator asset types
 *
 * Per OPS_SYNC_SSOT.md INV-21 GRAPH-CALCULATOR-CONTRACT.
 *
 * Storage: WBBoardOperation.payload (JSONField); asset.data.state — user
 * content; asset.data.meta — BE-managed (last_snapshot_seq).
 *
 * Snapshot stays as `version: 1` LOCKED (Phase G v1).
 */

export const GRAPH_CALCULATOR_TYPE = 'graph_calculator' as const

/** Slider range for parameter expressions (e.g. `a = 1`). */
export interface GraphParamRange {
  min: number
  max: number
  step: number
}

/** Single expression entry. `id` is store-assigned UUID (FE-RULE-3). */
export interface GraphExpression {
  id: string
  src: string
  color: string
  hidden: boolean
  paramRange?: GraphParamRange
}

/** Coordinate viewport state (per inv-21.8). */
export interface GraphViewport {
  cx: number
  cy: number
  scale: number
}

/**
 * Per-parameter entry. Slider value + range configuration co-located so that
 * snapshot fully describes the param (per HARD SPEC 2026-05-06).
 * Constraints: all finite, min < max, step > 0.
 */
export interface GraphParam {
  value: number
  min: number
  max: number
  step: number
}

/**
 * Interactive draggable point (Phase G2 2026-05-06).
 * - mode='free': x/y are independent
 * - mode='onCurve': bound to expression curveExprId; user drags X, Y computed
 */
export interface GraphPoint {
  x: number
  y: number
  mode: 'free' | 'onCurve'
  /** REQUIRED when mode='onCurve' — references an expression's id. */
  curveExprId?: string
}

/** User-content state — full snapshot. */
export interface GraphCalculatorState {
  expressions: GraphExpression[]
  /** name → param config (regex `^[a-zA-Z][a-zA-Z0-9_]{0,31}$`). */
  params: Record<string, GraphParam>
  viewport: GraphViewport
  /**
   * Interactive points (Phase G2). OPTIONAL field; absent treated as `{}`.
   * id regex: `^[a-zA-Z0-9_-]{1,64}$`. Max 32 entries.
   */
  points?: Record<string, GraphPoint>
}

/** BE-managed metadata. NOT mutated by FE. */
export interface GraphCalculatorMeta {
  /** seq of last successful asset_add/asset_update apply for this asset. */
  last_snapshot_seq?: number
}

/** Full `data` object — version + state + meta. */
export interface GraphCalculatorData {
  version: 1
  state: GraphCalculatorState
  meta?: GraphCalculatorMeta
}

/** Full asset shape для WBAsset.type='graph_calculator' (lives in op payload). */
export interface GraphCalculatorAsset {
  id: string
  type: typeof GRAPH_CALCULATOR_TYPE
  x: number
  y: number
  w: number
  h: number
  rotation?: number
  locked?: boolean
  lockedBy?: string
  data: GraphCalculatorData
}

/** Payload schema for the `graph_param_set` op (high-freq slider/animation). */
export interface GraphParamSetPayload {
  asset_id: string
  /** parameter name. Regex enforced by BE. */
  name: string
  /** finite float (NaN/Infinity rejected by BE). */
  value: number
  /**
   * seq of the last snapshot (`asset_add`/`asset_update`) for this asset,
   * known to FE at emit time. BE drops op silently if `base_seq <
   * asset.data.meta.last_snapshot_seq` (per inv-21.12 race protection).
   */
  base_seq: number
}
