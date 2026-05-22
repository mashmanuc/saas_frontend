/**
 * TrigSolver inspector UI state — module-level reactive bridge між
 * TrigSolverRenderer (canvas overlay) та TrigSolverInspector (sidebar).
 *
 * NOT persisted, FE UI coordination only.
 * Pattern: mirrors trigCircleUiState.ts.
 */
import { reactive } from 'vue'
import type { TrigFuncType, TrigRelation } from '../../types/trigSolver'

export interface TrigSolverLocalState {
  type: TrigFuncType
  rel: TrigRelation
  a: number
  snapSpecial: boolean
  showGraph: boolean
  showAllSolutions: boolean
}

export interface TrigSolverBridge {
  local: TrigSolverLocalState          // reactive object from renderer
  setType(t: TrigFuncType): void
  setRel(r: TrigRelation): void
  setA(v: number): void
  toggleOpt(key: 'snapSpecial' | 'showGraph' | 'showAllSolutions'): void
}

export const trigSolverUiState = reactive<{
  assetId: string | null
  bridge: TrigSolverBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerTrigSolver(assetId: string, bridge: TrigSolverBridge): void {
  trigSolverUiState.assetId = assetId
  trigSolverUiState.bridge = bridge
}

export function unregisterTrigSolver(assetId: string): void {
  if (trigSolverUiState.assetId === assetId) {
    trigSolverUiState.assetId = null
    trigSolverUiState.bridge = null
  }
}

export function __resetTrigSolverUiForTests(): void {
  trigSolverUiState.assetId = null
  trigSolverUiState.bridge = null
}
