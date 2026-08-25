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

/** Metadata entry у `window.GEO_PRESETS` — used by tray + drop handler. */
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

/**
 * Public API surface of a mounted GeoCard widget instance.
 *
 * SSOT §3.7.3 adapter pattern (one-way binding):
 *   ✅ store → `setToggle` / `setFreePoints`  (incoming from ops/replay)
 *   ✅ card  → `onPointMove` callback         (outgoing for persistence)
 *   ❌ NEVER read card internal state back to store
 *   ❌ NEVER call `rebuild()` outside the bundle itself
 *
 * Internal methods (`rebuild`, `_apply`, `setOption`, etc.) are intentionally
 * excluded — renderers MUST NOT call them directly.
 */
export interface GeoCardInstance {
  /**
   * Live snapshot of all toggle keys → current boolean state.
   * Read-only from renderer perspective (wireToolbarPersistence reads after click).
   */
  readonly toggleState: Record<string, boolean>

  /**
   * Enable or disable a named toggle (Медіани, Висоти, Бісектриси, …).
   * Safe to call with a key the preset doesn't have — bundle ignores unknowns.
   */
  setToggle(key: string, on: boolean): void

  /**
   * Restore free-point positions from a persisted snapshot.
   * Engine rebuilds the construction, then snaps each free point to stored coords.
   * Map: step-id → { x, y } in canvas units (per Geometry2DV2Data.pointsSnapshot).
   */
  setFreePoints(snapshot: Record<string, { x: number; y: number }>): void

  /**
   * Called by the bundle when the user finishes dragging a free point.
   * Set by `wirePointMovePersistence` in Geometry2DRenderer.
   * Signature: `(allPoints: Record<step-id, {x,y}>) => void`
   * Reset to `null` on destroy to avoid stale closure leaks.
   */
  onPointMove: ((points: Record<string, { x: number; y: number }>) => void) | null

  /** Tear down the JSXGraph board and all event listeners. Idempotent. */
  destroy(): void
}

declare global {
  interface Window {
    Geo2D: {
      Construction: new () => unknown
      Renderer: new (container: HTMLElement, con: unknown, defaults: unknown) => unknown
      PRESETS: Record<string, unknown>
    }
    GeoCard: new (
      container: HTMLElement,
      opts: {
        type: string
        /** i18n (8-19): перекладач для підказок, які малює сам vendor.
         *  Повертає `null`, якщо ключа в локалі немає — тоді лишається
         *  авторський текст пресету. */
        i18n?: (key: string) => string | null
      },
    ) => GeoCardInstance
    /**
     * Creates the preset's toggle toolbar and appends it to `host`.
     * Returns the root `<div class="toolbar">` element for further DOM queries
     * (e.g. localizeToolbar: querySelectorAll('button.tool')).
     */
    makeGeoToolbar: (card: GeoCardInstance, host: HTMLElement) => HTMLDivElement
    GEO_PRESETS: GeoPresetMeta[]
  }
}

/** Returns `GEO_PRESETS` metadata once the bundle is loaded (empty array before). */
export function geoPresets(): GeoPresetMeta[] {
  return window.GEO_PRESETS || []
}

/**
 * Validate a preset name against the bundle's runtime PRESETS registry.
 * Used by drop handler before constructing a new geometry_2d_v2 asset.
 * Returns `false` if bundle not yet loaded (safe — caller falls back to 'blank').
 */
export function isValidGeoPreset(name: string): boolean {
  return !!window.Geo2D?.PRESETS?.[name]
}
