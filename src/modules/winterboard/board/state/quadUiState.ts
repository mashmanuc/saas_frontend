/**
 * Quadratic inspector UI state — module-level reactive bridge між
 * QuadraticRenderer (canvas overlay) та QuadraticInspector (sidebar).
 *
 * NOT persisted, FE UI coordination only.
 * Pattern: mirrors calculusUiState.ts.
 */
import { reactive } from 'vue'
import type { QuadSign } from '../../types/quad'

export interface QuadBridge {
  a: number
  b: number
  c: number
  sign: QuadSign
  showVertex: boolean
  showAxis:   boolean
  showRoots:  boolean
  setA(v: number): void
  setB(v: number): void
  setC(v: number): void
  setSign(v: QuadSign): void
  toggle(key: 'showVertex' | 'showAxis' | 'showRoots'): void
  setPreset(a: number, b: number, c: number): void
}

export const quadUiState = reactive<{
  assetId: string | null
  bridge: QuadBridge | null
}>({
  assetId: null,
  bridge:  null,
})

export function registerQuadInspector(assetId: string, bridge: QuadBridge): void {
  quadUiState.assetId = assetId
  quadUiState.bridge  = bridge
}

export function unregisterQuadInspector(assetId: string): void {
  if (quadUiState.assetId === assetId) {
    quadUiState.assetId = null
    quadUiState.bridge  = null
  }
}

export function __resetQuadUiForTests(): void {
  quadUiState.assetId = null
  quadUiState.bridge  = null
}
