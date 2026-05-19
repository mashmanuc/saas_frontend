/**
 * Vendor loader for trig widgets.
 *
 * TrigCircle  — interactive unit circle ↔ graph (trig-circle.js).
 *               Sets window.TrigCircle after IIFE evaluation.
 *
 * TrigEquation — elementary trig equations & inequalities (trig-equations.js).
 *                Unified: sin/cos/tan/cot × =/>/</≥/≤ in one class.
 *                Sets window.TrigEquation after IIFE evaluation.
 */

import './trig-circle.js'
import './trig-equations.js'

/* ─── TrigCircle ─────────────────────────────────────────────────────────── */

export interface TrigCircleOpts {
  theta?: number
  showSin?: boolean
  showCos?: boolean
  showTan?: boolean
  showCot?: boolean
  showSpecialPoints?: boolean
  showRefLabels?: boolean
  showDeg?: boolean
  showRad?: boolean
  showExactGrid?: boolean
  showInscribed?: boolean
  showGraphs?: boolean
  snapPi12?: boolean
  animate?: boolean
  speed?: number
  partialCurves?: boolean
}

export interface TrigCircleInstance {
  opts: Required<TrigCircleOpts>
  setOption<K extends keyof TrigCircleOpts>(key: K, value: TrigCircleOpts[K]): void
  setTheta(theta: number): void
  destroy(): void
  onChange?: (() => void) | null
}

/* ─── TrigEquation (new unified API — §3.7.7) ───────────────────────────── */

export type TrigFuncType = 'sin' | 'cos' | 'tan' | 'cot'
export type TrigRelation = '=' | '>' | '<' | '>=' | '<='

export interface TrigEquationOpts {
  type?:             TrigFuncType
  rel?:              TrigRelation
  a?:                number
  showDeg?:          boolean
  showRad?:          boolean
  showSpecialPoints?: boolean
  showRefLabels?:    boolean
  snapSpecial?:      boolean
  showAllSolutions?: boolean
  showGraph?:        boolean
}

export interface TrigEquationInstance {
  opts: Required<TrigEquationOpts>
  setType(t: TrigFuncType): void
  setRel(rel: TrigRelation): void
  setA(a: number): void
  setOption(k: string, v: unknown): void
  destroy(): void
  onChange?: (() => void) | null
}

declare global {
  interface Window {
    TrigCircle: new (
      container: HTMLElement,
      opts: TrigCircleOpts,
    ) => TrigCircleInstance
    TrigEquation: new (
      container: HTMLElement,
      opts: TrigEquationOpts,
    ) => TrigEquationInstance
  }
}
