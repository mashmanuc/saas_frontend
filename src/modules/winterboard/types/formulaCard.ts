/**
 * FormulaCard (2026-05-30) — LaTeX formula card asset (§3.7.11).
 * Draggable HTML overlay на canvas, рендерить KaTeX.
 * Ref: saas_docs/plans/FUTURE_WORK_PLAN_2026-05-30.md Phase 1
 */

import type { WBAsset } from './winterboard'

/** Дані формульної картки. version=1 для replay schema migrations. */
export interface FormulaCardData {
  /** Незмінний LaTeX + структурований документ нового матеріалу. */
  math_content?: { version: 1; fields: Record<string, unknown> }
  /** LaTeX рядок БЕЗ $ delimiters. Напр: '\sin^2 x + \cos^2 x = 1' */
  formula: string
  /** Формула з бібліотеки Інтегралика (пакет 2, 19.10): назва, позначення з `$…$`, id. */
  title?: string
  notation?: string
  formula_id?: string
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

/** Поля формули з бібліотеки Інтегралика — описують саме цю формулу (пакет 2, 19.10). */
export const FORMULA_LIBRARY_FIELDS = ['title', 'notation', 'formula_id'] as const

/**
 * Нова формула на тій самій картці. Назва й позначення з бібліотеки описували попередню —
 * знімаємо їх; та сама формула — лишаємо як є.
 */
export function withFormula<T extends { formula?: string }>(data: T, formula: string): T {
  const next: Record<string, unknown> = { ...data, formula }
  if ((data?.formula ?? '') !== formula) for (const key of FORMULA_LIBRARY_FIELDS) delete next[key]
  return next as T
}

/**
 * Висота картки: смуга формули (вміст `formulaH` + відступи 24; звичайна картка — 86 + 24 = 110)
 * + рядок назви + рядки позначень. Рядок позначень — ≈46 видимих знаків на ширині 380 (команда
 * `\alpha` важить як одна буква), ширша картка — пропорційно більше; понад чотири рядки — прокрутка.
 */
export function formulaCardHeight(
  data: { title?: string; notation?: string },
  w = FORMULA_CARD_DEFAULTS.w,
  formulaH = FORMULA_CARD_DEFAULTS.h - 24,
): number {
  let h = Math.max(FORMULA_CARD_DEFAULTS.h - 24, Math.ceil(formulaH)) + 24
  if (data?.title) h += 26
  if (data?.notation) {
    const visible = String(data.notation).replace(/\\[a-zA-Z]+/g, 'x').replace(/[${}_^]/g, '').length
    const perLine = Math.max(20, Math.floor(46 * w / FORMULA_CARD_DEFAULTS.w))
    h += 12 + 17 * Math.min(4, Math.ceil(visible / perLine))
  }
  return h
}
