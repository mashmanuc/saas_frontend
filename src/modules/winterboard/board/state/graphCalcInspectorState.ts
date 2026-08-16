/**
 * GraphCalculator inspector UI state — module-level reactive bridge між
 * GraphCalculatorRenderer та GraphCalcInspector (sidebar).
 *
 * Exposes:
 *   - param sliders section (paramEntries + range editor)
 *   - expression editing panel (displayExpressions + slash popup + quick-add)
 *
 * NOT persisted, FE UI coordination only.
 * Pattern: mirrors nmt3dUiState.ts.
 */
import { reactive } from 'vue'

export interface GcParamEntry {
  name: string
  value: number
  min: number
  max: number
  step: number
}

export interface GcExprEntry {
  id: string
  src: string
  color: string
  hidden: boolean
  isParam: boolean
}

export interface GcSlashTemplate {
  id: string
  label: string
  src: string
}

export interface GcSlashPopup {
  exprId: string
  query: string
  selectedIdx: number
}

export interface GraphCalcInspectorBridge {
  // ── Param sliders (existing) ──────────────────────────────────────────
  paramEntries: GcParamEntry[]
  /** Параметри, якими можна керувати drag-ом (крива залежить рівно від
   *  одного). Порожньо — підказка «Shift-drag» гасне. 2026-08-16. */
  dragParamNames: string[]
  paramExpanded: Record<string, boolean>
  onSliderInput(name: string, value: number): void
  flushParam(): void
  toggleParamExpand(name: string): void
  onRangeMinChange(name: string, value: string): void
  onRangeMaxChange(name: string, value: string): void
  onRangeStepChange(name: string, value: string): void

  // ── Expression editing ────────────────────────────────────────────────
  displayExpressions: GcExprEntry[]
  slashPopup: GcSlashPopup | null
  slashFilteredTemplates: GcSlashTemplate[]
  onSrcInput(id: string, val: string): void
  onInputBlur(id: string): void
  onEnterPress(id: string): void
  onArrowNav(id: string, delta: 1 | -1): void
  onToggleHidden(id: string): void
  onRemoveExpression(id: string): void
  onAddExpression(): void
  onQuickAdd(src: string): void
  applySlashTemplate(exprId: string, tpl: GcSlashTemplate): void
  closeSlashPopup(): void
  setSlashSelectedIdx(idx: number): void

  // ── Expand to full board ──────────────────────────────────────────────
  isExpanded: boolean
  toggleExpand(): void
}

export const graphCalcInspectorState = reactive<{
  assetId: string | null
  bridge: GraphCalcInspectorBridge | null
}>({
  assetId: null,
  bridge: null,
})

export function registerGraphCalcInspector(assetId: string, bridge: GraphCalcInspectorBridge): void {
  graphCalcInspectorState.assetId = assetId
  graphCalcInspectorState.bridge = bridge
}

export function unregisterGraphCalcInspector(assetId: string): void {
  if (graphCalcInspectorState.assetId === assetId) {
    graphCalcInspectorState.assetId = null
    graphCalcInspectorState.bridge = null
  }
}

export function __resetGraphCalcInspectorForTests(): void {
  graphCalcInspectorState.assetId = null
  graphCalcInspectorState.bridge = null
}
