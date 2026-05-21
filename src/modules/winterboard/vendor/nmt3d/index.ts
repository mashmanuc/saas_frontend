/**
 * NMT3D vendor loader.
 *
 * Pattern mirror: vendor/helix/index.ts — side-effect static imports
 * load the IIFE bundles which set window.NMT_TEMPLATES + window.NMT3D.
 *
 * Usage in renderer/tray (lazy, module evaluated once):
 *   await import('../../vendor/nmt3d')
 *
 * After import:
 *   window.NMT_TEMPLATES   — 2D SVG thumbnail generators per shape key
 *   window.NMT3D.TEMPLATES — 3D parametric template definitions
 *   window.NMT3D.Workspace — constructor: new Workspace(el, key) -> ws
 */

// Order matters: nmt-templates.js first (nmt-3d.js may reference NMT_TEMPLATES at IIFE time)
import './nmt-templates.js'
import './nmt-3d.js'

/* ─── global types ───────────────────────────────────────────────────────── */

export interface Nmt3dWorkspace {
  /** Current display mode. */
  mode: 'adapt' | 'draw'
  /** Template key this workspace was created with. */
  templateKey: string
  /** Current parameter values. */
  params: Record<string, number>
  /** Aux toggle states. */
  opts: Record<string, boolean>
  /** Whether auto-orbit is active. */
  autoOrbit: boolean
  /** Unfold animation progress (0=folded, 1=unfolded). */
  unfoldT: number

  setMode(mode: 'adapt' | 'draw'): void
  setParam(key: string, value: number): void
  setParams(values: Record<string, number>): void
  setOpt(key: string, value: boolean): void
  setView(preset: '3d' | 'iso' | 'front' | 'side' | 'top' | 'bottom'): void
  setAutoOrbit(on: boolean): void
  resetView(): void
  clearStrokes(): void
  toggleUnfold(): void
  destroy(): void

  onParamsChanged?: ((params: Record<string, number>) => void) | null
  readonly pen: { tool: 'pen' | 'erase'; color: string; width: number }
  readonly template: {
    name: string
    full?: string
    params: Record<string, { value: number; min: number; max: number; label: string }>
    aux?: Array<{ key: string; label: string }>
    buildUnfolded?: unknown
  }
}

declare global {
  interface Window {
    NMT_TEMPLATES: Record<string, { render(opts: Record<string, unknown>): string } | undefined>
    NMT3D: {
      TEMPLATES: Record<string, {
        key: string
        name: string
        full?: string
        params: Record<string, { value: number; min: number; max: number; label: string }>
        aux?: Array<{ key: string; label: string }>
      } | undefined>
      Workspace: new (container: HTMLElement, templateKey: string) => Nmt3dWorkspace
    }
  }
}
