/**
 * NMT3D inspector UI state — module-level reactive bridge між
 * Nmt3dRenderer (canvas overlay) та Nmt3dInspector (sidebar).
 *
 * NOT persisted, NOT ops-relevant — pure FE UI coordination.
 * Pattern: mirrors graphCalculatorUiState.ts.
 *
 * Lifecycle:
 *   - Renderer calls registerNmt3dWorkspace() when isSelected=true
 *   - Renderer calls unregisterNmt3dWorkspace() when isSelected=false / onUnmounted
 *   - Inspector reads nmt3dUiState.ws (null = no active NMT3D)
 *   - latestParams / latestOpts updated by renderer's ws.onParamsChanged + on register
 */
import { reactive, markRaw } from 'vue'
import type { Nmt3dWorkspace } from '../../vendor/nmt3d'

export interface Nmt3dUiActiveState {
  assetId: string | null
  ws: Nmt3dWorkspace | null
  /** Mirror of ws.params — kept reactive for inspector sliders. */
  latestParams: Record<string, number>
  /** Mirror of ws.opts — kept reactive for inspector checkboxes. */
  latestOpts: Record<string, boolean>
  /**
   * Called by inspector when opts change → renderer emits update:asset.
   * Renderer provides this closure on register.
   */
  persistOpts: ((opts: Record<string, boolean>) => void) | null
}

export const nmt3dUiState = reactive<Nmt3dUiActiveState>({
  assetId: null,
  ws: null,
  latestParams: {},
  latestOpts: {},
  persistOpts: null,
})

export function registerNmt3dWorkspace(
  assetId: string,
  ws: Nmt3dWorkspace,
  persistOpts: (opts: Record<string, boolean>) => void,
): void {
  nmt3dUiState.assetId = assetId
  // markRaw: Workspace is a class with RAF loop + canvas state.
  // Vue must not deep-proxy it — property changes are bridged via latestParams/latestOpts.
  nmt3dUiState.ws = markRaw(ws) as Nmt3dWorkspace
  nmt3dUiState.latestParams = { ...ws.params }
  nmt3dUiState.latestOpts = { ...ws.opts }
  nmt3dUiState.persistOpts = persistOpts
}

export function unregisterNmt3dWorkspace(assetId: string): void {
  if (nmt3dUiState.assetId === assetId) {
    nmt3dUiState.assetId = null
    nmt3dUiState.ws = null
    nmt3dUiState.latestParams = {}
    nmt3dUiState.latestOpts = {}
    nmt3dUiState.persistOpts = null
  }
}

/** Test-only reset. */
export function __resetNmt3dUiStateForTests(): void {
  nmt3dUiState.assetId = null
  nmt3dUiState.ws = null
  nmt3dUiState.latestParams = {}
  nmt3dUiState.latestOpts = {}
  nmt3dUiState.persistOpts = null
}
