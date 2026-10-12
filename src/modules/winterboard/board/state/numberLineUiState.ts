/**
 * NumberLine inspector UI state — module-level reactive bridge між
 * NumberLineRenderer (картка-рисунок) та NumberLineInspector (sidebar).
 *
 * NOT persisted, FE UI coordination only. Чернетка живе в рендерері,
 * інспектор лише показує її й викликає дії.
 * Pattern: mirrors trigSolverUiState.ts.
 */
import { reactive } from 'vue'

export interface NumberLineBridge {
  /** Рядки-умови чернетки (ще не застосовані). */
  draft: string[]
  combine: 'and' | 'or'
  dirty: boolean
  showAnswer: boolean
  /** Пояснення помилки біля рядка, '' — помилки немає. */
  errorFor(i: number): string
  setLine(i: number, value: string): void
  /** Новий рядок після `after`; повертає його індекс. */
  addRow(after: number): number
  /** Прибрати рядок; повертає індекс рядка, куди перевести фокус, або -1. */
  removeRow(i: number): number
  setCombine(c: 'and' | 'or'): void
  apply(): void
  revert(): void
  toggleAnswer(): void
}

export const numberLineUiState = reactive<{
  assetId: string | null
  bridge: NumberLineBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerNumberLine(assetId: string, bridge: NumberLineBridge): void {
  numberLineUiState.assetId = assetId
  numberLineUiState.bridge = bridge
}

export function unregisterNumberLine(assetId: string): void {
  if (numberLineUiState.assetId === assetId) {
    numberLineUiState.assetId = null
    numberLineUiState.bridge = null
  }
}

export function __resetNumberLineUiForTests(): void {
  numberLineUiState.assetId = null
  numberLineUiState.bridge = null
}
