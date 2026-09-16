/**
 * Phase G v2 — Single canonical source for geometry_2d_v2 defaults.
 *
 * Refs:
 *   - vendor/geo2d/index.ts — runtime engine entry
 *   - Mirror pattern: constants/solidDefaults.ts (Phase O)
 */

import type {
  Geometry2DV2Asset,
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

/** Штатні необовʼязкові поля даних, з якими картку можна створити (копіюються). */
export interface Geometry2DV2Init {
  pointsSnapshot?: Readonly<Record<string, { x: number; y: number }>>
  toggles?: Readonly<Record<string, boolean>>
}

/**
 * TLV2-06R.1 · ЄДИНИЙ конструктор картки `geometry_2d_v2` — для drag/`+` preset-а
 * (`useContentDrop`) і готових рецептів (`board/preparedBoardRecipes.ts`).
 * Без `init` дані рівно `buildDefaultGeometry2DV2Data(preset)`, як і раніше.
 * `center` — центр картки в координатах сторінки.
 */
export function buildGeometry2DV2Asset(
  center: { x: number; y: number },
  preset: Geometry2DV2Preset,
  init: Geometry2DV2Init = {},
): Geometry2DV2Asset {
  const data: Geometry2DV2Data = buildDefaultGeometry2DV2Data(preset)
  if (init.pointsSnapshot) data.pointsSnapshot = JSON.parse(JSON.stringify(init.pointsSnapshot))
  if (init.toggles) data.toggles = { ...init.toggles }
  return {
    id: `geo2dv2-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: 'geometry_2d_v2',
    src: '',
    x: center.x - DEFAULT_GEOMETRY_2D_V2_W / 2,
    y: center.y - DEFAULT_GEOMETRY_2D_V2_H / 2,
    w: DEFAULT_GEOMETRY_2D_V2_W,
    h: DEFAULT_GEOMETRY_2D_V2_H,
    rotation: 0,
    locked: false,
    data,
  }
}
