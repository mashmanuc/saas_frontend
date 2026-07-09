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

/** Декларативна команда побудови (§3.1 конструктора). `op` — дискримінатор. */
export interface GeoCmd {
  op: string
  [k: string]: unknown
}

/** Один інструмент із маніфесту `toolSpec()` — дошка рендерить панель без хардкоду. */
export interface GeoToolSpecEntry {
  op: string
  labelKey: string
  category: 'point' | 'line' | 'circle' | 'polygon' | 'measure'
  inputs: Array<{ role: string; accepts: string[]; multi?: boolean }>
}

/** Патч стилю/підпису/стану об'єкта (§3.4 restyle). */
export interface GeoStylePatch {
  color?: string
  opacity?: number
  lineWidth?: number
  labelMode?: 'none' | 'name' | 'nameValue' | 'value' | 'caption'
  visible?: boolean
  locked?: boolean
  caption?: string
}

type Objs = Map<string, GeoObject>

export interface GeoEngineApi {
  deserialize(scene: GeoScene | null): { objects: Objs; cs: { ox: number; oy: number; sc: number } | null }
  serialize(objects: Objs, cs?: unknown): GeoScene
  // ── Конструктор (stage 2, §2.8) — headless execute-сторона Command Pattern ──
  /** Створити об'єкт із декларативної команди. Повертає НОВУ Map + id нових об'єктів. */
  construct(objects: Objs, cs: unknown, cmd: GeoCmd): { objects: Objs; created: string[] } | { error: string }
  /** Посунути вільну точку/повзунок + перерахунок залежних (updateDeps). Похідні → {error:'derived'}. */
  move(objects: Objs, cs: unknown, id: string, wx: number, wy: number): { objects: Objs; moved: string[] } | { error: string }
  /** Видалити об'єкт (+ залежний каскад за .deps). withDependents:false і є залежні → {error, dependents}. */
  remove(objects: Objs, id: string, opts?: { withDependents?: boolean }): { objects: Objs; removed: string[] } | { error: string; dependents?: string[] }
  /** Патч стилю/підпису/стану (ChangeStyleCmd/ChangeLabelModeCmd headless). */
  restyle(objects: Objs, id: string, patch: GeoStylePatch): { objects: Objs } | { error: string }
  /** Декларативний маніфест інструментів — дошка рендерить панель побудови сама. */
  toolSpec(): GeoToolSpecEntry[]
  /** Валідація команди на поточній сцені — для enable/disable кнопок. */
  canConstruct(objects: Objs, cmd: GeoCmd): { ok: true } | { ok: false; reason: string }
  /** Текстове значення об'єкта для алгебра-рядка (опційно). */
  getValue(objects: Objs, id: string): string
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
