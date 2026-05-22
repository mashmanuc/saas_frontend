/**
 * Calculus inspector UI state — module-level reactive bridge між
 * CalculusRenderer (canvas overlay) та CalculusInspector (sidebar).
 *
 * NOT persisted, FE UI coordination only.
 * Pattern: mirrors trigSolverUiState.ts.
 */
import { reactive } from 'vue'
import type { CalculusMode, RiemannMode } from '../../vendor/calculus'

export type { CalculusMode, RiemannMode }

export interface CalculusBridge {
  mode: CalculusMode
  expr: string
  showSecant: boolean
  showDerivTrace: boolean
  h: number
  riemann: RiemannMode
  N: number
  showF: boolean
  /** Live-update engine without committing to store (for inspector typing). */
  setExpr(v: string): void
  /** Commit current expr draft to store (on blur / Enter). */
  commitExpr(): void
  toggle(key: 'showSecant' | 'showDerivTrace' | 'showF'): void
  setRiemann(mode: RiemannMode): void
  setH(v: number): void
  setN(v: number): void
  onExprPreset(expr: string): void
}

export const calculusUiState = reactive<{
  assetId: string | null
  bridge: CalculusBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerCalculusInspector(assetId: string, bridge: CalculusBridge): void {
  calculusUiState.assetId = assetId
  calculusUiState.bridge = bridge
}

export function unregisterCalculusInspector(assetId: string): void {
  if (calculusUiState.assetId === assetId) {
    calculusUiState.assetId = null
    calculusUiState.bridge = null
  }
}

export function __resetCalculusUiForTests(): void {
  calculusUiState.assetId = null
  calculusUiState.bridge = null
}
