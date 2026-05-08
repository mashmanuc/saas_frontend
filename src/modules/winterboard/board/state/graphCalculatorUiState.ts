// Phase G4 — per-asset UI state for graph_calculator (toggle param mode).
// P2 (2026-05-08) — додано `presenting` для режиму презентації (приховати панель).
//
// HARD INVARIANTS (g4_inv_6, g4_inv_7, g4_inv_8):
//   - NOT persisted (no BE, no ops, no replay)
//   - Per-asset (each instance has own toggle)
//   - Shared module-level reactive map so renderer + sidebar stay in sync
//
// Lifecycle: entries created lazily on first read. We don't bother cleaning
// up on asset delete — Map stays small (one entry per visible graph_calculator
// per session) and resets on full page reload.

import { reactive } from 'vue'

export interface GraphCalcUiEntry {
  paramMode: boolean
  /** P2: режим презентації — панель прихована, plot заповнює весь body. */
  presenting: boolean
}

const state = reactive<Record<string, GraphCalcUiEntry>>({})

export function getGraphCalcUi(assetId: string): GraphCalcUiEntry {
  if (!state[assetId]) state[assetId] = { paramMode: false, presenting: false }
  return state[assetId]
}

export function toggleGraphCalcParamMode(assetId: string): void {
  const e = getGraphCalcUi(assetId)
  e.paramMode = !e.paramMode
}

export function setGraphCalcParamMode(assetId: string, value: boolean): void {
  getGraphCalcUi(assetId).paramMode = value
}

export function toggleGraphCalcPresenting(assetId: string): void {
  const e = getGraphCalcUi(assetId)
  e.presenting = !e.presenting
}

export function setGraphCalcPresenting(assetId: string, value: boolean): void {
  getGraphCalcUi(assetId).presenting = value
}

/** Test-only: reset all UI state. */
export function __resetGraphCalcUiForTests(): void {
  for (const k of Object.keys(state)) delete state[k]
}
