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
  }
}
