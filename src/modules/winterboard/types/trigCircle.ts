/**
 * TrigCircle — type definitions for `trig_circle` WBAsset.
 *
 * Refs:
 *   - vendor/trig/index.ts — runtime TrigCircleInstance engine
 *   - Mirror pattern: types/calculus.ts
 */

import type { WBAsset } from './winterboard'

/** Persisted data envelope для trig_circle asset. */
export interface TrigCircleData {
  version: 1
  /** Current angle in radians (0..2π). */
  theta: number
  showSin: boolean
  showCos: boolean
  showTan: boolean
  showCot: boolean
  showSpecialPoints: boolean
  showRefLabels: boolean
  showDeg: boolean
  showRad: boolean
  showExactGrid: boolean
  showInscribed: boolean
  showGraphs: boolean
  snapPi12: boolean
  /** Whether the values overlay (θ, sin, cos, tg, ctg) is visible. Default true. */
  showHud: boolean
  speed: number
}

export interface TrigCircleAsset extends WBAsset {
  type: 'trig_circle'
  src: ''
  data: TrigCircleData
}

/** MIME для tray → drop handler payload. */
export const TRIG_CIRCLE_DRAG_MIME = 'application/x-trig-circle'

/** Payload carries no mode — single variant. */
export interface TrigCircleDragPayload {
  type: 'trig_circle'
}
