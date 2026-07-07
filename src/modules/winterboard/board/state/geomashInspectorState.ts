/**
 * GeoMASH inspector UI state — module-level reactive bridge між GeomashRenderer
 * та GeomashInspector (sidebar). Дзеркало graphCalcInspectorState / nmt3dUiState.
 *
 * v1: список геометричних об'єктів сцени (навігація). NOT persisted, FE UI only.
 */
import { reactive } from 'vue'
import type { GeoObject } from '../../vendor/geomash'

export interface GeomashInspectorBridge {
  /** Список об'єктів сцени (points/lines/circles/…) — renderer синкає reactive. */
  objects: GeoObject[]
}

export const geomashInspectorState = reactive<{
  assetId: string | null
  bridge: GeomashInspectorBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerGeomashInspector(assetId: string, bridge: GeomashInspectorBridge): void {
  geomashInspectorState.assetId = assetId
  geomashInspectorState.bridge = bridge
}

export function unregisterGeomashInspector(assetId: string): void {
  if (geomashInspectorState.assetId === assetId) {
    geomashInspectorState.assetId = null
    geomashInspectorState.bridge = null
  }
}

export function __resetGeomashInspectorForTests(): void {
  geomashInspectorState.assetId = null
  geomashInspectorState.bridge = null
}
