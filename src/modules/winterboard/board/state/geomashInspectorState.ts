/**
 * GeoMASH inspector UI state — module-level reactive bridge між GeomashRenderer
 * та GeomashInspector (sidebar). Дзеркало graphCalcInspectorState / graphmash3dInspectorState.
 *
 * Stage A (2026-07-09): nav-only → редактор. Bridge віддає toolSpec + виконавчі
 * handlers (construct/move/remove/restyle) поверх headless GeoEngine (§2.8 конструктор).
 * Кожен handler = один asset_update op через renderer.patchSceneAndEmit. NOT persisted, FE UI only.
 */
import { reactive } from 'vue'
import type { GeoObject, GeoCmd, GeoToolSpecEntry, GeoStylePatch } from '../../vendor/geomash'

export interface GeomashInspectorBridge {
  /** Список об'єктів сцени (points/lines/circles/…) — renderer синкає reactive. */
  objects: GeoObject[]
  /** Декларативний маніфест інструментів (GeoEngine.toolSpec()) — панель побудови. */
  toolSpec: GeoToolSpecEntry[]
  /** Чи дозволене редагування (asset не locked). */
  canEdit: boolean
  /** Валідація команди на поточній сцені (enable/disable «Створити»). */
  canConstruct(cmd: GeoCmd): boolean
  /** Виконати побудову → asset_update. Повертає { ok, error? }. */
  construct(cmd: GeoCmd): { ok: boolean; error?: string }
  /** Патч стилю/підпису/стану об'єкта → asset_update. */
  restyle(id: string, patch: GeoStylePatch): void
  /** Видалити об'єкт (+ залежний каскад) → asset_update. */
  remove(id: string): void
  /** Текстове значення об'єкта (GeoEngine.getValue) для алгебра-рядка. */
  valueOf(id: string): string
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
