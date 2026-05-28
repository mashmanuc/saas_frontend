/**
 * Quadratic card vendor loader.
 * Interactive ax²+bx+c visualizer — parabola, discriminant, roots.
 *
 * Standalone IIFE, no external dependencies (unlike calculus which needs GraphCalc).
 * Mirror pattern: vendor/calculus/index.ts.
 */

// CSS першим — quad-root стилі готові до першого mount.
import './quad-card.css'
// QuadraticCard IIFE — sets window.QuadraticCard.
import './quad-card.js'

/* ─── Runtime types ──────────────────────────────────────────────────────── */

export interface QuadOpts {
  a?: number
  b?: number
  c?: number
  showVertex?: boolean
  showAxis?: boolean
  showRoots?: boolean
}

export interface QuadraticCardInstance {
  opts: Required<QuadOpts>
  viewport: { cx: number; cy: number; scale: number }
  setOption<K extends keyof QuadOpts>(key: K, value: QuadOpts[K]): void
  destroy(): void
  /** Fires on drag (vertex or arm handle moved). */
  onChange?: (() => void) | null
}

declare global {
  interface Window {
    QuadraticCard: new (
      container: HTMLElement,
      opts: QuadOpts,
    ) => QuadraticCardInstance
  }
}
