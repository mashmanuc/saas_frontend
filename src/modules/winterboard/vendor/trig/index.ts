/**
 * TrigCircle — vendor loader for interactive unit circle ↔ sin/cos graph widget.
 *
 * Bundle source: scripts/OD/trig-bundle/trig-circle.js
 * Architecture: standalone canvas engine, no external dependencies.
 * Sets window.TrigCircle after IIFE evaluation.
 *
 * Features:
 *   - Dual-panel: unit circle (left) + sin/cos/tg/ctg graph (right)
 *   - 16 special angles with exact labels (½, √2/2, √3/2, 1)
 *   - Interactive drag point P on circle or scrub along graph
 *   - Animation mode (continuous rotation)
 *   - Special angle reference dots + inscribed shapes overlay
 */

// TrigCircle IIFE — sets window.TrigCircle.
import './trig-circle.js'
// TrigSolver IIFE — sets window.TrigEquation + window.TrigInequality.
import './trig-solver.js'

/* ─── runtime types ──────────────────────────────────────────────────────── */

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
  /** Fires on drag, setOption, setTheta, and animation tick. */
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
      opts: TrigSolverOpts,
    ) => TrigEquationInstance
    TrigInequality: new (
      container: HTMLElement,
      opts: TrigInequalityOpts,
    ) => TrigInequalityInstance
  }
}

// ── TrigEquation ─────────────────────────────────────────────────────────────

export type TrigFunc = 'sin' | 'cos' | 'tan' | 'cot'

export interface TrigSolverOpts {
  func?:        TrigFunc
  value?:       number   // right-hand side 'a'
  showFormula?: boolean  // show general solution formula (equation)
  showAngles?:  boolean  // draw angle labels on circle
}

export interface TrigEquationInstance {
  opts: Required<TrigSolverOpts>
  setOption<K extends keyof TrigSolverOpts>(key: K, value: TrigSolverOpts[K]): void
  destroy(): void
  onChange?: (() => void) | null
}

// ── TrigInequality ────────────────────────────────────────────────────────────

export type IneqSign = '>' | '<' | '≥' | '≤'

export interface TrigInequalityOpts {
  func?:          TrigFunc
  sign?:          IneqSign
  value?:         number
  showInterval?:  boolean
}

export interface TrigInequalityInstance {
  opts: Required<TrigInequalityOpts>
  setOption<K extends keyof TrigInequalityOpts>(key: K, value: TrigInequalityOpts[K]): void
  destroy(): void
  onChange?: (() => void) | null
}
