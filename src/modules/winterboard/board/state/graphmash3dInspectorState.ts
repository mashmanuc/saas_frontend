/**
 * GraphMASH 3D inspector UI state — bridge між Graphmash3dRenderer та
 * Graphmash3dInspector (sidebar). Дзеркало geomashInspectorState.
 *
 * v1: список 3D-виразів (поверхонь) сцени. NOT persisted, FE UI only.
 */
import { reactive } from 'vue'

export interface Gm3dExprEntry {
  id: number
  src: string
  color: string
  colorMap: string
  visible: boolean
}

export interface Graphmash3dInspectorBridge {
  /** Список виразів-поверхонь — renderer синкає reactive. */
  expressions: Gm3dExprEntry[]
}

export const graphmash3dInspectorState = reactive<{
  assetId: string | null
  bridge: Graphmash3dInspectorBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerGraphmash3dInspector(assetId: string, bridge: Graphmash3dInspectorBridge): void {
  graphmash3dInspectorState.assetId = assetId
  graphmash3dInspectorState.bridge = bridge
}

export function unregisterGraphmash3dInspector(assetId: string): void {
  if (graphmash3dInspectorState.assetId === assetId) {
    graphmash3dInspectorState.assetId = null
    graphmash3dInspectorState.bridge = null
  }
}

export function __resetGraphmash3dInspectorForTests(): void {
  graphmash3dInspectorState.assetId = null
  graphmash3dInspectorState.bridge = null
}
