/**
 * Phase G v2 — Geometry 2D v2 type definitions (bundle-backed).
 *
 * Refs:
 *   - saas_docs/domains/winterboard/phase_G_geometry_v2/PLAN.md
 *   - vendor/geo2d/index.ts — runtime engine + presets registry
 *
 * Engine source:
 *   - vendor/geo2d/geo2d.js (Construction + Renderer + dependency graph)
 *   - vendor/geo2d/geo2d-presets.js (preset.build() functions)
 *   - vendor/geo2d/geo2d-card.js (GeoCard wrapper + GEO_PRESETS metadata)
 *
 * Extensibility:
 *   - preset = open string (NOT closed enum). Validation runtime через
 *     vendor/geo2d/index.ts:isValidGeoPreset() проти Geo2D.PRESETS keys.
 *   - Додавання нової картки = додати у geo2d-presets.js + geo2d-card.js
 *     GEO_PRESETS array. Tray + drop handler автоматично підхоплять.
 */

import type { WBAsset } from './winterboard'

/** Preset name — string (open set), validated runtime проти Geo2D.PRESETS. */
export type Geometry2DV2Preset = string

/**
 * Persisted asset data envelope.
 * Bundle engine має internal Construction state і не serializable trivially —
 * persistence у v1 obmedjena полем `preset` (engine rebuilds на mount).
 * Free-point координати після drag — у v2 layer (PR-G5: snapshot hook).
 */
export interface Geometry2DV2Data {
  version: 1
  preset: Geometry2DV2Preset
  /**
   * Optional snapshot координат free points (PR-G5+).
   * Map step-id → {x, y}. Engine rebuilds, then applies snapshot.
   */
  pointsSnapshot?: Record<string, { x: number; y: number }>
  /**
   * Toolbar toggles state — persisted щоб після reload toggles лишались.
   * Map toggle.key → boolean (e.g. { showMedians: true, showAltitudes: false }).
   */
  toggles?: Record<string, boolean>
  /** Renderer-level options (showGrid, showAxes). */
  options?: Record<string, unknown>
}

/** Type-safe alias. */
export interface Geometry2DV2Asset extends WBAsset {
  type: 'geometry_2d_v2'
  src: ''
  data: Geometry2DV2Data
}

/** MIME для tray → drop handler. Узгоджено з standalone bundle MIME 'application/x-geo2d'. */
export const GEOMETRY_2D_V2_DRAG_MIME = 'application/x-geo2d'

export interface Geometry2DV2DragPayload {
  preset: Geometry2DV2Preset
  /** Optional full-label передається для UI (drop tooltip / asset title). */
  name?: string
}
