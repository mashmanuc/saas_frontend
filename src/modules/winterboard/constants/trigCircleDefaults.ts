/**
 * TrigCircle — default state, MIME, constants for `trig_circle` assets.
 *
 * Refs:
 *   - types/trigCircle.ts
 *   - vendor/trig/index.ts
 * Mirror pattern: constants/calculusDefaults.ts
 */

import type { TrigCircleData, TrigCircleDragPayload } from '../types/trigCircle'

export { TRIG_CIRCLE_DRAG_MIME } from '../types/trigCircle'
export type { TrigCircleDragPayload }

/** Default card size (px) при drop. 16:9-ish — dual panel (circle + graph). */
export const DEFAULT_TRIG_CIRCLE_W = 640
export const DEFAULT_TRIG_CIRCLE_H = 360

/** Build fresh data envelope для нової картки. */
export function buildDefaultTrigCircleData(): TrigCircleData {
  return {
    version: 1,
    theta: Math.PI / 3,   // 60° — nice default, all values non-trivial
    showSin: true,
    showCos: true,
    showTan: false,
    showCot: false,
    showSpecialPoints: true,
    showRefLabels: true,
    showDeg: true,
    showRad: true,
    showExactGrid: false,
    showInscribed: false,
    showGraphs: true,
    snapPi12: false,
    speed: 0.6,
  }
}
