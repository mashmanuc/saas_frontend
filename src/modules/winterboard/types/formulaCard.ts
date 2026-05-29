/**
 * FormulaCard (2026-05-30) — LaTeX formula card asset (§3.7.11).
 * Draggable HTML overlay на canvas, рендерить KaTeX.
 * Ref: saas_docs/plans/FUTURE_WORK_PLAN_2026-05-30.md Phase 1
 */

import type { WBAsset } from './winterboard'

/** Дані формульної картки. version=1 для replay schema migrations. */
export interface FormulaCardData {
  /** LaTeX рядок БЕЗ $ delimiters. Напр: '\sin^2 x + \cos^2 x = 1' */
  formula: string
  /** Розмір шрифту (px). Default: 22. */
  fontSize: number
  /** CSS колір тексту. Default: '#1e293b' */
  color: string
  /** CSS колір фону. Default: '#ffffff' */
  bg: string
  /** version=1 для schema migration guard */
  version: 1
}

/** Typed alias — assets з type='formula_card' гарантовано мають data: FormulaCardData */
export interface FormulaCardAsset extends WBAsset {
  type: 'formula_card'
  data: FormulaCardData
}

export const FORMULA_CARD_DEFAULTS: Readonly<{
  w: number
  h: number
  data: FormulaCardData
}> = {
  w: 380,
  h: 110,
  data: {
    formula: '',
    fontSize: 22,
    color: '#1e293b',
    bg: '#f8fafc',
    version: 1,
  },
}
