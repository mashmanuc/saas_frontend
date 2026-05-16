/**
 * Helix — type definitions for `helix` WBAsset.
 *
 * Refs:
 *   - vendor/helix/index.ts — runtime HelixInstance engine
 *   - Mirror pattern: types/trigCircle.ts
 */

import type { WBAsset } from './winterboard'

/** Persisted data envelope для helix asset. */
export interface HelixData {
  version: 1
  /** Current angle in radians (0..2π). */
  theta: number
  /** Camera yaw in degrees. 0 = end-on (unit circle), 90 = side (sin). */
  phi: number
  /** Camera pitch in degrees. */
  pitch: number
  showHelix: boolean
  showSin: boolean
  showCos: boolean
  showCircle: boolean
  showWalls: boolean
  showDropLines: boolean
  showAxisLabels: boolean
  emitMode: boolean
  speed: number
}

export interface HelixAsset extends WBAsset {
  type: 'helix'
  src: ''
  data: HelixData
}

/** MIME для tray → drop handler payload. */
export const HELIX_DRAG_MIME = 'application/x-helix'

export interface HelixDragPayload {
  type: 'helix'
}
