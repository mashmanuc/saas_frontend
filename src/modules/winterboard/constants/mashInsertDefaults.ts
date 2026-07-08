/**
 * MASH scene-tools — MIME + starter-контракт для sidebar-вставки (BoardMASH Ф3.1).
 *
 * graphmash_3d і geomash_scene раніше створювались ЛИШЕ через `/mash/import` (воронка).
 * Тут — drag-MIME, щоб їх можна було вставити з сайдбару, як 8 інших. Дефолт-об'єкт
 * будується через ТОЙ САМИЙ `build<Type>Asset(scene)`, що й funnel (INV-BM-7).
 * ТЗ: m4sh_graph/MASH_BOARDMASH_UNIFIED_TZ.md §5.
 */
import type { WBAsset } from '../types/winterboard'
import { buildGraphmash3dAsset, buildGeomashSceneAsset } from '../utils/mashImport'

export const GRAPHMASH_3D_DRAG_MIME = 'application/x-graphmash3d'
export const GEOMASH_DRAG_MIME = 'application/x-geomash'

/** Стартові шаблони 3D (один asset.type, різний дефолтний src). Валідність звірена
 *  з grapher-3d-engine.js: surfaceZ / curve3D(param) / vectorField3D. */
export type Graphmash3dStarter = 'blank' | 'surface' | 'curve' | 'vectorField'

export interface Graphmash3dDragPayload {
  starterKind?: Graphmash3dStarter
}

export interface GeomashDragPayload {
  starterKind?: 'blank'
}

/**
 * Дефолтна graphmash_3d-сцена за стартером. src звірено з grapher-3d-engine.js:
 * surfaceZ / param(curve3D) / vectorField3D.
 */
export function defaultGraphmash3dScene(starter?: string): Record<string, unknown> {
  const obj = (src: string, color: string) => ({
    id: `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    src, color,
    style: { colorMap: 'viridis', wireframe: false, opacity: 1 },
    domain: { range: 3, resolution: 60 },
    visible: true,
  })
  let objects: Array<Record<string, unknown>> = []
  switch (starter) {
    case 'surface': objects = [obj('z = sin(x)*cos(y)', '#2d70b3')]; break
    case 'curve': objects = [obj('(cos(t), sin(t), t/3)', '#c74440')]; break
    case 'vectorField': objects = [obj('(y, -x, 0.3*z)', '#388c46')]; break
    case 'blank': default: objects = []; break
  }
  return { format: 'graphmash-scene', version: 2, objects, params: {} }
}

/** SSOT sidebar-вставка graphmash_3d — через buildGraphmash3dAsset (INV-BM-7). */
export function buildDefaultGraphmash3dAsset(starter?: string): WBAsset {
  // objects[] завжди масив → buildGraphmash3dAsset не поверне null
  return buildGraphmash3dAsset(defaultGraphmash3dScene(starter)) as WBAsset
}

/** Дефолтна (порожня) geomash-сцена. Редагування поки через deep-link у воронку. */
export function defaultGeomashScene(): Record<string, unknown> {
  return { format: 'geomash-scene', version: 1, objects: [], cs: { ox: 230, oy: 180, sc: 40 } }
}

/** SSOT sidebar-вставка geomash_scene — через buildGeomashSceneAsset (INV-BM-7). */
export function buildDefaultGeomashSceneAsset(): WBAsset {
  return buildGeomashSceneAsset(defaultGeomashScene()) as WBAsset
}
