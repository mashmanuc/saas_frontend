/**
 * Quadratic card — type definitions for `quadratic_card` WBAsset.
 * Mirror pattern: types/calculus.ts.
 */

import type { WBAsset } from './winterboard'

/** Знак нерівності / рівності для квадратного виразу. */
export type QuadSign = '=' | '<' | '<=' | '>' | '>='

/** Persisted data envelope для quadratic_card asset. */
export interface QuadraticData {
  version: 1
  a: number
  b: number
  c: number
  /** Знак між виразом і 0 (метод інтервалів). Default '='. */
  sign?: QuadSign
  showVertex?: boolean
  showAxis?:   boolean
  showRoots?:  boolean
  /** View transform — persisted so the user's zoom/pan survives reload. */
  viewport?: { cx: number; cy: number; scale: number }
}

export interface QuadraticAsset extends WBAsset {
  type: 'quadratic_card'
  src: ''
  data: QuadraticData
}

/** MIME для tray → drop handler payload. */
export const QUAD_DRAG_MIME = 'application/x-quadratic'
