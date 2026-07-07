/**
 * GeoMASH vendor loader (B3 — жива інтерактивна геометрія на дошці).
 *
 * Патерн-дзеркало vendor/nmt3d: side-effect IIFE-бандли ставлять
 * window.GeoEngine + window.GeoRenderer + window.createGeoRenderer.
 * Обидва headless (0 dc-runtime/React/DOM — дизайнер витяг ядро за Guide §4;
 * verified). Колізій з board-глобалами НЕМА (grep-чисто).
 *
 * Порядок: geo-engine ПЕРШИЙ (renderer приймає engine інжекцією, але тримаємо
 * канонічний порядок). Джерело: public/mash/geomash/{geo-engine,geo-renderer}.js.
 * Read-only vendor — вада → фікс у джерелі воронки.
 */
import './geo-engine.js'
import './geo-renderer.js'

/* ─── types ──────────────────────────────────────────────────────────────── */

/** Один геометричний об'єкт сцени (плоский; поля залежать від type). */
export interface GeoObject {
  id: string
  type: string
  [k: string]: unknown
}

/** Серіалізована GeoMASH-сцена ({format:'geomash-scene', version, objects, cs}). */
export interface GeoScene {
  format?: string
  version?: number
  objects: GeoObject[]
  cs?: { ox: number; oy: number; sc: number }
}

/** Coord-system + розмір в'юпорта, який рендерер очікує у draw/hitTest. */
export interface GeoView {
  ox: number
  oy: number
  sc: number
  w: number
  h: number
  dpr: number
}

export interface GeoRendererInstance {
  draw(scene: { objects: Map<string, GeoObject> }, view: GeoView, ui: Record<string, unknown>): void
  hitTest(scene: { objects: Map<string, GeoObject> }, view: GeoView, sx: number, sy: number, tol?: number): string | null
  objectAABB(scene: { objects: Map<string, GeoObject> }, view: GeoView, id: string): { x: number; y: number; w: number; h: number } | null
  resize(w: number, h: number, dpr: number): void
  setTheme(partial: Record<string, unknown>): void
  destroy(): void
}

export interface GeoEngineApi {
  deserialize(scene: GeoScene | null): { objects: Map<string, GeoObject>; cs: { ox: number; oy: number; sc: number } | null }
  serialize(objects: Map<string, GeoObject>, cs?: unknown): GeoScene
  [k: string]: unknown
}

declare global {
  interface Window {
    GeoEngine?: GeoEngineApi
    GeoRenderer?: { fmt(n: number): string; [k: string]: unknown }
    createGeoRenderer?: (
      canvas: HTMLCanvasElement,
      opts: { engine: GeoEngineApi; theme?: Record<string, unknown>; fonts?: Record<string, unknown> },
    ) => GeoRendererInstance
  }
}
