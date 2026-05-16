/**
 * Helix — default state, MIME, constants for `helix` assets.
 *
 * Refs:
 *   - types/helix.ts
 *   - vendor/helix/index.ts
 * Mirror pattern: constants/trigCircleDefaults.ts
 */

import type { HelixData, HelixDragPayload } from '../types/helix'

export { HELIX_DRAG_MIME } from '../types/helix'
export type { HelixDragPayload }

/** Default card size (px) при drop. 16:9 — 3D view needs width. */
export const DEFAULT_HELIX_W = 640
export const DEFAULT_HELIX_H = 400

/** Build fresh data envelope для нової картки. */
export function buildDefaultHelixData(): HelixData {
  return {
    version:        1,
    theta:          Math.PI / 3,   // 60° — nice default
    phi:            50,            // 3D default view
    pitch:          18,
    showHelix:      true,
    showSin:        true,
    showCos:        true,
    showCircle:     true,
    showWalls:      true,
    showDropLines:  true,
    showAxisLabels: true,
    emitMode:       false,
    speed:          0.6,
  }
}
