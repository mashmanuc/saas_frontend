/**
 * Phase G v2 — Single canonical source for geometry_2d_v2 defaults.
 *
 * Refs:
 *   - vendor/geo2d/index.ts — runtime engine entry
 *   - Mirror pattern: constants/solidDefaults.ts (Phase O)
 */

import type {
  Geometry2DV2Data,
  Geometry2DV2Preset,
} from '../types/geometry2dV2'

export { GEOMETRY_2D_V2_DRAG_MIME } from '../types/geometry2dV2'
export type { Geometry2DV2DragPayload } from '../types/geometry2dV2'

/** Default size (px) при drop. Bundle preferred 320×440 у standalone demo. */
export const DEFAULT_GEOMETRY_2D_V2_W = 360
export const DEFAULT_GEOMETRY_2D_V2_H = 440

/**
 * Builds fresh data envelope. Bundle engine sам build-ить construction
 * via preset.build() при mount → у store зберігається лише `preset` + toggles.
 */
export function buildDefaultGeometry2DV2Data(
  preset: Geometry2DV2Preset = 'blank',
): Geometry2DV2Data {
  return {
    version: 1,
    preset,
  }
}
