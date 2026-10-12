/**
 * NumberLine inspector UI state — module-level reactive bridge між
 * NumberLineRenderer (картка-рисунок) та NumberLineInspector (sidebar).
 *
 * NOT persisted, FE UI coordination only. Чернетка живе в рендерері,
 * інспектор лише показує її й викликає дії.
 * Pattern: mirrors trigSolverUiState.ts.
 */
import { reactive } from 'vue'

export interface NumberLineManualPoint {
  /** Як записав учитель (`-3`, `√2`). */
  label: string
  /** Для показу (`−3`). */
  display: string
  included: boolean
}

export interface NumberLineBridge {
  /** 'set' — нерівності / системи / сукупності; 'intervals' — метод інтервалів. */
  mode: 'set' | 'intervals'
  setMode(m: 'set' | 'intervals'): void
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
  // ── Метод інтервалів ──
  ivInput: 'expression' | 'manual'
  setIvInput(m: 'expression' | 'manual'): void
  /** Вираз одним рядком: `(x-1)(x+3)/(x-2) ≥ 0`. */
  expressionLine: string
  setExpressionLine(v: string): void
  /** Вручну: точки через «;». */
  pointsText: string
  setPointsText(v: string): void
  /** Вручну: точки за значенням. */
  manualPoints: NumberLineManualPoint[]
  togglePoint(i: number): void
  /** Вручну: знаки на проміжках зліва направо (точок + 1). */
  manualSigns: Array<'+' | '-'>
  toggleSign(i: number): void
  manualOp: '<' | '<=' | '>' | '>='
  setManualOp(op: '<' | '<=' | '>' | '>='): void
  /** Пояснення помилки методу інтервалів, '' — помилки немає. */
  intervalsError: string
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
