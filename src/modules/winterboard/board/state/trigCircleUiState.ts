/**
 * TrigCircle inspector UI state — module-level reactive bridge між
 * TrigCircleRenderer (canvas overlay) та TrigCircleInspector (sidebar).
 *
 * NOT persisted, FE UI coordination only.
 * Pattern: mirrors nmt3dUiState.ts.
 *
 * Renderer calls register() on isSelected=true, unregister() on false/unmount.
 * Inspector reads local (reactive), animating, drawMode and calls action callbacks.
 */
import { reactive } from 'vue'

export interface TrigCircleLocalState {
  showSin: boolean; showCos: boolean; showTan: boolean; showCot: boolean
  showSpecialPoints: boolean; showRefLabels: boolean
  showDeg: boolean; showRad: boolean
  showExactGrid: boolean; showInscribed: boolean
  showGraphs: boolean; snapPi12: boolean; speed: number
}

export interface TrigCircleBridge {
  local: TrigCircleLocalState         // reactive object from renderer
  animating: boolean                  // synced via watchEffect in renderer
  drawMode: boolean
  toggle(key: string): void
  jumpTo(theta: number): void
  setSpeed(v: number): void
  toggleAnimate(): void
  toggleDraw(): void
}

export const trigCircleUiState = reactive<{
  assetId: string | null
  bridge: TrigCircleBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerTrigCircle(assetId: string, bridge: TrigCircleBridge): void {
  trigCircleUiState.assetId = assetId
  trigCircleUiState.bridge = bridge
}

export function unregisterTrigCircle(assetId: string): void {
  if (trigCircleUiState.assetId === assetId) {
    trigCircleUiState.assetId = null
    trigCircleUiState.bridge = null
  }
}

export function __resetTrigCircleUiForTests(): void {
  trigCircleUiState.assetId = null
  trigCircleUiState.bridge = null
}
