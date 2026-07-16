/**
 * Geometry2D (geo2dv2) inspector UI state — module-level reactive bridge між
 * Geometry2DRenderer та Geo2dInspector (правий сайдбар).
 * Дзеркало geomashInspectorState / trigSolverUiState.
 *
 * Особливість: перемикачі побудов (Сторони/Діагоналі/Кути/Варіньйон/…) — це
 * vendor-DOM (makeGeoToolbar з geo2d-бандла), НЕ Vue-компонент. Тому bridge
 * віддає сам toolbarEl, а Geo2dInspector ТЕЛЕПОРТУЄ його у свій host
 * (appendChild переміщує вузол разом із live listeners). При знятті виділення
 * renderer повертає елемент назад у картку (див. watch(isSelected) у renderer-і).
 */
import { reactive } from 'vue'

export interface Geo2dInspectorBridge {
  /** Людський заголовок пресета («Чотирикутник», «Трикутник», …). */
  label: string
  /** vendor toolbar DOM — інспектор монтує його у свій host як є. */
  toolbarEl: HTMLElement
}

export const geo2dInspectorState = reactive<{
  assetId: string | null
  bridge: Geo2dInspectorBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerGeo2dInspector(assetId: string, bridge: Geo2dInspectorBridge): void {
  geo2dInspectorState.assetId = assetId
  geo2dInspectorState.bridge = bridge
}

export function unregisterGeo2dInspector(assetId: string): void {
  if (geo2dInspectorState.assetId === assetId) {
    geo2dInspectorState.assetId = null
    geo2dInspectorState.bridge = null
  }
}

export function __resetGeo2dInspectorForTests(): void {
  geo2dInspectorState.assetId = null
  geo2dInspectorState.bridge = null
}
