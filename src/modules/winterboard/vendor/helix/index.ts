/**
 * HelixView — vendor loader for 3D helix trig widget.
 *
 * Bundle source: scripts/Heliks/helix-standalone/trig-helix.js
 * Architecture: standalone canvas engine, no external dependencies.
 * Sets window.HelixView after IIFE evaluation.
 *
 * Concept: P = (θ, sin θ, cos θ) — три тіні одного 3D-гелікса:
 *   sin θ → проєкція на стіну
 *   cos θ → проєкція на підлогу
 *   коло  → проєкція на торець
 */

import './trig-helix.js'

/* ─── runtime types ──────────────────────────────────────────────────────── */

export type HelixViewName = '3d' | 'iso' | 'circle' | 'sin' | 'cos'

export interface HelixOpts {
  theta?: number
  phi?: number
  pitch?: number
  showHelix?: boolean
  showSin?: boolean
  showCos?: boolean
  showCircle?: boolean
  showWalls?: boolean
  showDropLines?: boolean
  showAxisLabels?: boolean
  animate?: boolean
  animateCamera?: boolean
  speed?: number
  camSpeed?: number
  emitMode?: boolean
}

export interface HelixInstance {
  opts: Required<HelixOpts>
  setOption<K extends keyof HelixOpts>(key: K, value: HelixOpts[K]): void
  setTheta(theta: number): void
  setView(name: HelixViewName): void
  destroy(): void
  /** Fires on drag, setOption, setTheta, and animation tick. */
  onChange?: (() => void) | null
}

declare global {
  interface Window {
    HelixView: new (
      container: HTMLElement,
      opts: HelixOpts,
    ) => HelixInstance
  }
}
