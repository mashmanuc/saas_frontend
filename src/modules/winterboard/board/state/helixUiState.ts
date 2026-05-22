/**
 * Helix inspector UI state — module-level reactive bridge між
 * HelixRenderer (canvas overlay) та HelixInspector (sidebar).
 *
 * NOT persisted, FE UI coordination only.
 * Pattern: mirrors nmt3dUiState.ts.
 */
import { reactive } from 'vue'
import type { HelixViewName } from '../../vendor/helix'

export interface HelixLocalState {
  showHelix: boolean; showSin: boolean; showCos: boolean; showCircle: boolean
  showWalls: boolean; showDropLines: boolean; showAxisLabels: boolean
  emitMode: boolean; speed: number
}

export interface HelixBridge {
  local: HelixLocalState              // reactive object from renderer
  animating: boolean                  // synced via watchEffect in renderer
  animatingCam: boolean
  toggle(key: string): void
  setView(name: HelixViewName): void
  jumpTo(theta: number): void
  setSpeed(v: number): void
  toggleAnimate(): void
  toggleAnimateCam(): void
}

export const helixUiState = reactive<{
  assetId: string | null
  bridge: HelixBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerHelix(assetId: string, bridge: HelixBridge): void {
  helixUiState.assetId = assetId
  helixUiState.bridge = bridge
}

export function unregisterHelix(assetId: string): void {
  if (helixUiState.assetId === assetId) {
    helixUiState.assetId = null
    helixUiState.bridge = null
  }
}

export function __resetHelixUiForTests(): void {
  helixUiState.assetId = null
  helixUiState.bridge = null
}
