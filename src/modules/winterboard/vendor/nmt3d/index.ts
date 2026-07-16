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
  /**
   * External-renderer seam (контракт §2 MASH_STEREOMASH_VISUAL_TZ.md): якщо задано,
   * кожен рендер-тік двигун віддає display-list цьому колбеку. Не задано → двигун
   * поводиться байт-ідентично (нуль додаткової роботи, SVG як завжди).
   */
  frameSink?: ((frame: Nmt3dFrame) => void) | null
  /** true + frameSink → внутрішній SVG містить ЛИШЕ handles; фігуру малює зовнішній рендерер. */
  frameOnly?: boolean
  /**
   * Виміри активної геометрії від шаблону (оновлюються кожен rebuild; читати після
   * onParamsChanged). Section3-шаблони віддають { sectionArea, sectionVertices }; решта — null.
   */
  readonly measures: { sectionArea: number; sectionVertices: number } | null
  readonly pen: { tool: 'pen' | 'erase'; color: string; width: number }
  readonly template: {
    /** Ключ шаблона (TEMPLATES.<key>) — стабільний ідентифікатор для i18n. */
    key?: string
    name: string
    full?: string
    params: Record<string, { value: number; min: number; max: number; label: string; step?: number }>
    aux?: Array<{ key: string; label: string }>
    buildUnfolded?: unknown
  }
}

/** Display-list, який двигун віддає у frameSink (screen-space; §2 VISUAL_TZ). */
export interface Nmt3dFrame {
  kind: 'solid' | 'unfolded' | 'curved'
  view: { w: number; h: number; dpr: number }
  camera: { yaw: number; pitch: number; scale: number }
  /** Лише для kind='solid': depth 0=найближча..1=найдальша; shade 0..1 Lambert-підказка. */
  faces: Array<{ id: string; pts: Array<{ x: number; y: number }>; front: boolean; depth: number; shade: number }>
  edges: Array<{ pts: [{ x: number; y: number }, { x: number; y: number }]; visible: boolean }>
  /** Лише для kind='curved': готові path-рядки з семантичною роллю ('ring' = кільця основ/екватор-силует, 'silhouette' = обрисові твірні/коло кулі). */
  curves: Array<{ d: string; visible: boolean; role: 'ring' | 'silhouette' }>
  aux: Array<{ d: string; role: string; colorHint: string; w: number; dash: string }>
  fills: Array<{ d: string; role: string; colorHint: string; fillOpacity: number }>
  labels: Array<{ x: number; y: number; text: string; italic: boolean }>
  dots: Array<{ x: number; y: number }>
  strokes: Array<{ d: string; color: string; width: number }>
  handles: Array<{ x: number; y: number; id: string; shape: string }>
}

declare global {
  interface Window {
    NMT_TEMPLATES: Record<string, { render(opts: Record<string, unknown>): string } | undefined>
    NMT3D: {
      TEMPLATES: Record<string, {
        key: string
        name: string
        full?: string
        params: Record<string, { value: number; min: number; max: number; label: string; step?: number }>
        aux?: Array<{ key: string; label: string }>
      } | undefined>
      Workspace: new (container: HTMLElement, templateKey: string) => Nmt3dWorkspace
    }
  }
}
