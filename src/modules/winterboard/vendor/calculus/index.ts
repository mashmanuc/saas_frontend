/**
 * Phase Calculus — vendor loader for interactive derivative + antiderivative cards.
 *
 * Bundle source: scripts/Pochida_pervisna/calculus-bundle/
 * Architecture: depends на window.GraphCalc (parse / evalAst / freeVars / CONSTS)
 * від existing vendor/graph_calculator/graph-calculator.js. Side-effect import
 * у потрібному порядку: graph-calculator engine → calculus.js → CSS.
 *
 * Two card modes:
 *   - 'derivative' — tangent line, secant, slope label, f'(x) trace
 *   - 'integral'   — area under curve, Riemann rectangles (L/M/R), F(x) antideriv
 */

// CSS перший — calc-root styling готовий до перших mount.
import './calculus.css'
// Engine залежність — window.GraphCalc must exist before calculus.js IIFE evaluates.
// Vite загрузить graph_calculator vendor через його власний index.ts якщо ще не.
import '../graph_calculator/graph-calculator.js'
// CalculusCard class IIFE — sets window.CalculusCard.
import './calculus.js'

/* ─── runtime types ──────────────────────────────────────────────────────── */

export type CalculusMode = 'derivative' | 'integral'
export type RiemannMode = 'off' | 'left' | 'mid' | 'right'

export interface CalculusOpts {
  mode?: CalculusMode
  expr?: string
  // Derivative
  x0?: number
  showSecant?: boolean
  h?: number
  showDerivTrace?: boolean
  // Integral
  a?: number
  b?: number
  riemann?: RiemannMode
  N?: number
  showF?: boolean
}

export interface CalculusCardInstance {
  opts: Required<CalculusOpts>
  viewport: { cx: number; cy: number; scale: number }
  setOption<K extends keyof CalculusOpts>(key: K, value: CalculusOpts[K]): void
  setExpression(src: string): void
  destroy(): void
  /** Set by mounting renderer — fires on drag (a/b for integral, x0 for derivative). */
  onChange?: (() => void) | null
}

declare global {
  interface Window {
    CalculusCard: new (
      container: HTMLElement,
      opts: CalculusOpts,
    ) => CalculusCardInstance
  }
}
