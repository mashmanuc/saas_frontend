/**
 * Phase G v2 — Geo2D vendor loader.
 *
 * Підключає standalone IIFE-bundle у порядку залежностей через side-effect imports
 * + CSS. Кожен файл реєструється на window globals — typing exposed нижче.
 *
 * Bundle source: scripts/geo2d-bundle/ (live demo + production-ready engine).
 * Architecture:
 *   - geo2d.js       → window.Geo2D = { Construction, Renderer, PRESETS }
 *   - geo2d-presets.js → mutates Geo2D.PRESETS з 7+ конструкціями
 *   - geo2d-card.js  → window.GeoCard, window.makeGeoToolbar, window.GEO_PRESETS
 *
 * Extensibility:
 *   - Нові presets → додати у `geo2d-presets.js` (Geo2D.PRESETS[name] = { build, toggles, defaults })
 *     + у GEO_PRESETS array у `geo2d-card.js` для tray metadata
 *   - Drop handler і tray автоматично підхоплять (немає hardcoded enum)
 */

// CSS перший — щоб toolbar мав правильні стилі при первому render.
import './geo2d.css'
// Order matters: engine → presets → card. Кожен наступний залежить від попереднього через window.Geo2D.
import './geo2d.js'
import './geo2d-presets.js'
import './geo2d-card.js'

/* ────── runtime types ─────────────────────────────────────────────────── */

export interface GeoPresetMeta {
  /** Preset key — used як WBAsset.data.preset + Geo2D.PRESETS lookup. */
  type: string
  /** Short label (e.g. 'A·B·C'). */
  short: string
  /** Full label (e.g. 'Трикутник'). */
  full: string
  /** Description (e.g. 'медіани · висоти · бісектриси'). */
  desc: string
}

export interface GeoCardInstance {
  type: string
  preset: unknown
  toggleState: Record<string, boolean>
  setToggle(key: string, on: boolean): void
  setOption(key: string, value: unknown): void
  setFreePoints(snapshot: Record<string, { x: number; y: number }>): void
  rebuild(): void
  destroy(): void
  /** Set by renderer to receive point-move notifications (drag + drag-end). */
  onPointMove?: ((points: Record<string, { x: number; y: number }>) => void) | null
}

declare global {
  interface Window {
    Geo2D: {
      Construction: new () => unknown
      Renderer: new (container: HTMLElement, con: unknown, defaults: unknown) => unknown
      PRESETS: Record<string, unknown>
    }
    GeoCard: new (container: HTMLElement, opts: { type: string }) => GeoCardInstance
    makeGeoToolbar: (card: GeoCardInstance, host: HTMLElement) => HTMLDivElement
    GEO_PRESETS: GeoPresetMeta[]
  }
}

/** Awaitable hook — повертає `GEO_PRESETS` коли bundle loaded. */
export function geoPresets(): GeoPresetMeta[] {
  return window.GEO_PRESETS || []
}

/** Validate preset name — used by drop handler. */
export function isValidGeoPreset(name: string): boolean {
  return !!window.Geo2D?.PRESETS?.[name]
}
