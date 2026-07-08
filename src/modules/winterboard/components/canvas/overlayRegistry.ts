// Winterboard — Overlay Renderer Registry (asset.type → renderer + adapter)
//
// Ref: Z_ORDER_UNIFIED_PLAN_2026-06-04.md (v4.0 render-grouping fix), PR1.
//
// ПРИЗНАЧЕННЯ (advisor decision 2026-06-04):
//   Registry централізує мапінг `asset.type → renderer component` + per-type
//   adapter (props/events). Це НЕ "common props contract" — кожен renderer має
//   власні props/events; adapter (buildProps/buildEvents) їх інкапсулює.
//
//   Мета: WBCanvas БІЛЬШЕ НЕ знає про 13 overlay-типів. Знання живе тут.
//   WBOverlayLayer ітерує overlay-assets у порядку `assets[]` (один v-for) →
//   render order = array order → лікує render-grouping bug (INV-RENDER-1).
//
// SSOT overlay-типів = `KONVA_PROXY_TYPES` у WBCanvas.vue (коментар :903).
//   Coverage-тест `overlayRegistry.spec.ts` гарантує: KONVA_PROXY_TYPES ⊆ keys.
//   Новий overlay-тип без entry тут → тест падає (fail-on-missing, не silently).
//
// OUT OF SCOPE PR1: media (audio/video/youtube). Вони мають власну positioning-
//   модель (asset.x*zoom inline, власні drag/resize handlers, z:5) — НЕ Konva-
//   proxy contract. Лишаються окремим блоком у WBCanvas незмінно.

import type { Component } from 'vue'
import type { WBAsset } from '../../types/winterboard'

import SolidCardRenderer from '../board/SolidCardRenderer.vue'
import GraphCalculatorRenderer from '../board/objects/GraphCalculatorRenderer.vue'
import Geometry2DRenderer from '../board/objects/Geometry2DRenderer.vue'
import CalculusRenderer from '../board/objects/CalculusRenderer.vue'
import QuadraticRenderer from '../board/objects/QuadraticRenderer.vue'
import FormulaCardRenderer from '../board/objects/FormulaCardRenderer.vue'
import TrigCircleRenderer from '../board/objects/TrigCircleRenderer.vue'
import HelixRenderer from '../board/objects/HelixRenderer.vue'
import TrigSolverRenderer from '../board/objects/TrigSolverRenderer.vue'
import Nmt3dRenderer from '../board/objects/Nmt3dRenderer.vue'
import NmtTaskRenderer from '../board/objects/NmtTaskRenderer.vue'
import TheoryCardRenderer from '../board/objects/TheoryCardRenderer.vue'
import MashSceneRenderer from '../board/objects/MashSceneRenderer.vue'
import GeomashRenderer from '../board/objects/GeomashRenderer.vue'
import Graphmash3dRenderer from '../board/objects/Graphmash3dRenderer.vue'

// ─── Adapter context ──────────────────────────────────────────────────────────
// WBOverlayLayer будує цей ctx (reactive snapshot) і передає у build* функції.
// Тут немає прямих посилань на store/emit — adapter лишається чистим (testable).

export interface OverlayGraphHandlers {
  paramSet: (assetId: string, name: string, value: number) => void
  syncParams: (assetId: string, names: string[]) => void
  setParamRange: (
    assetId: string,
    name: string,
    range: { min: number; max: number; step: number },
  ) => void
  pointAdd: (
    assetId: string,
    id: string,
    x: number,
    y: number,
    mode: 'free' | 'onCurve',
    curveExprId?: string,
  ) => void
  pointSet: (assetId: string, id: string, x: number, y?: number) => void
  pointDelete: (assetId: string, id: string) => void
  pointPromote: (assetId: string, id: string, curveExprId: string) => void
}

export interface OverlayCtx {
  /** wbStore.selectedIds.includes(id) */
  isSelected: (id: string) => boolean
  /** currentTool === 'select' && wbStore.mode === 'edit' */
  interactive: boolean
  /** wbStore.mode — passed to nmt3d :board-mode */
  boardMode: string
  /** wbStore.mode === 'replay' — passed to graph_calculator :disable-animation */
  disableAnimation: boolean
  /** Поточний expanded asset.id (null = жоден) */
  expandedId: string | null
  /** Toggle expand для assetId */
  toggleExpand: (id: string) => void
  /** emit('asset-update', asset) */
  onUpdate: (asset: WBAsset) => void
  /** emit('asset-delete', assetId) */
  onDelete: (id: string) => void
  /** emit('formula-card-edit', assetId) */
  onFormulaEdit: (id: string) => void
  /** emit('spawn-companions', payload) */
  onSpawnCompanions: (payload: unknown) => void
  /** graph_calculator store-методи */
  graph: OverlayGraphHandlers
}

export interface OverlayRenderEntry {
  component: Component
  /** Базовий клас wrapper-div (без модифікаторів). `${wrapperClass}--selected` додається динамічно. */
  wrapperClass: string
  /** Ім'я data-атрибута (Konva-proxy + тести шукають за ним), напр. 'data-nmt3d-id'. */
  dataAttr: string
  /** Префікс data-testid: `${testidPrefix}-${asset.id}`. */
  testidPrefix: string
  /** Чи підтримує board-expand (is-expanded prop + expand event + fill-style). */
  expandable: boolean
  /** Повний об'єкт props для `v-bind` на renderer. */
  buildProps: (asset: WBAsset, ctx: OverlayCtx) => Record<string, unknown>
  /** Повний об'єкт listeners для `v-on` на renderer (keys = event names як їх emit-ить дитина). */
  buildEvents: (asset: WBAsset, ctx: OverlayCtx) => Record<string, (...args: any[]) => void>
}

// ─── Shared prop/event builders ───────────────────────────────────────────────

const sel = (asset: WBAsset, ctx: OverlayCtx): boolean => ctx.isSelected(asset.id)

/** asset + is-selected + interactive (найпоширеніший набір). */
const stdProps = (asset: WBAsset, ctx: OverlayCtx): Record<string, unknown> => ({
  asset,
  isSelected: sel(asset, ctx),
  interactive: ctx.interactive,
})

/** update:asset + delete (найпоширеніший набір). */
const stdEvents = (
  asset: WBAsset,
  ctx: OverlayCtx,
): Record<string, (...args: any[]) => void> => ({
  'update:asset': (updated: WBAsset) => ctx.onUpdate(updated),
  delete: () => ctx.onDelete(asset.id),
})

/** stdProps + is-expanded (для expandable типів). */
const expProps = (asset: WBAsset, ctx: OverlayCtx): Record<string, unknown> => ({
  ...stdProps(asset, ctx),
  isExpanded: ctx.expandedId === asset.id,
})

/** stdEvents + expand (для expandable типів). */
const expEvents = (
  asset: WBAsset,
  ctx: OverlayCtx,
): Record<string, (...args: any[]) => void> => ({
  ...stdEvents(asset, ctx),
  expand: () => ctx.toggleExpand(asset.id),
})

// ─── Registry ─────────────────────────────────────────────────────────────────
// Кожен entry відтворює 1:1 розмітку відповідного блоку зі старого WBCanvas
// (props + events + wrapper class/data-attr/testid). Verbatim — щоб flag OFF/ON
// рендерили ідентично.

export const OVERLAY_RENDERERS: Record<string, OverlayRenderEntry> = {
  geometry_solid: {
    component: SolidCardRenderer,
    wrapperClass: 'wb-solid-overlay',
    dataAttr: 'data-solid-id',
    testidPrefix: 'solid-overlay',
    expandable: false,
    // ⚠️ SolidCardRenderer НЕ приймає :interactive (старий блок його не передає).
    buildProps: (a, ctx) => ({ asset: a, isSelected: sel(a, ctx) }),
    buildEvents: stdEvents,
  },

  graph_calculator: {
    component: GraphCalculatorRenderer,
    wrapperClass: 'wb-graph-calculator-overlay',
    dataAttr: 'data-graph-calculator-id',
    testidPrefix: 'graph-calculator-overlay',
    expandable: true,
    buildProps: (a, ctx) => ({ ...expProps(a, ctx), disableAnimation: ctx.disableAnimation }),
    buildEvents: (a, ctx) => ({
      ...expEvents(a, ctx),
      'param-set': (name: string, value: number) => ctx.graph.paramSet(a.id, name, value),
      'param-sync': (names: string[]) => ctx.graph.syncParams(a.id, names),
      'range-set': (name: string, range: { min: number; max: number; step: number }) =>
        ctx.graph.setParamRange(a.id, name, range),
      'point-add': (
        id: string,
        x: number,
        y: number,
        mode: 'free' | 'onCurve',
        curveExprId?: string,
      ) => ctx.graph.pointAdd(a.id, id, x, y, mode, curveExprId),
      'point-set': (id: string, x: number, y: number) =>
        ctx.graph.pointSet(a.id, id, x, Number.isFinite(y) ? y : undefined),
      'point-delete': (id: string) => ctx.graph.pointDelete(a.id, id),
      'point-promote': (id: string, curveExprId: string) =>
        ctx.graph.pointPromote(a.id, id, curveExprId),
    }),
  },

  geometry_2d_v2: {
    component: Geometry2DRenderer,
    wrapperClass: 'wb-geo2dv2-overlay',
    dataAttr: 'data-geo2dv2-id',
    testidPrefix: 'geometry-2d-v2-overlay',
    expandable: false,
    buildProps: stdProps,
    buildEvents: stdEvents,
  },

  calculus_card: {
    component: CalculusRenderer,
    wrapperClass: 'wb-calculus-overlay',
    dataAttr: 'data-calculus-id',
    testidPrefix: 'calculus-overlay',
    expandable: false,
    buildProps: stdProps,
    buildEvents: stdEvents,
  },

  quadratic_card: {
    component: QuadraticRenderer,
    wrapperClass: 'wb-quad-overlay',
    dataAttr: 'data-quad-id',
    testidPrefix: 'quad-overlay',
    expandable: false,
    buildProps: stdProps,
    buildEvents: stdEvents,
  },

  formula_card: {
    component: FormulaCardRenderer,
    wrapperClass: 'wb-formula-card-overlay',
    dataAttr: 'data-formula-id',
    testidPrefix: 'formula-card-overlay',
    expandable: false,
    buildProps: stdProps,
    // ⚠️ formula_card НЕ має update:asset — лише request-edit (→ модалка) + delete.
    buildEvents: (a, ctx) => ({
      'request-edit': () => ctx.onFormulaEdit(a.id),
      delete: () => ctx.onDelete(a.id),
    }),
  },

  trig_circle: {
    component: TrigCircleRenderer,
    wrapperClass: 'wb-trig-circle-overlay',
    dataAttr: 'data-trig-id',
    testidPrefix: 'trig-circle-overlay',
    expandable: true,
    buildProps: expProps,
    buildEvents: expEvents,
  },

  helix: {
    component: HelixRenderer,
    wrapperClass: 'wb-helix-overlay',
    dataAttr: 'data-helix-id',
    testidPrefix: 'helix-overlay',
    expandable: true,
    buildProps: expProps,
    buildEvents: expEvents,
  },

  trig_solver: {
    component: TrigSolverRenderer,
    wrapperClass: 'wb-trig-solver-overlay',
    dataAttr: 'data-tslv-id',
    testidPrefix: 'trig-solver-overlay',
    expandable: false,
    buildProps: stdProps,
    buildEvents: stdEvents,
  },

  nmt3d: {
    component: Nmt3dRenderer,
    wrapperClass: 'wb-nmt3d-overlay',
    dataAttr: 'data-nmt3d-id',
    testidPrefix: 'nmt3d-overlay',
    expandable: true,
    buildProps: (a, ctx) => ({ ...expProps(a, ctx), boardMode: ctx.boardMode }),
    buildEvents: expEvents,
  },

  // §3.7.13 (A3 2026-07-07) — MASH Live Asset з публічної воронки (Proposal §8)
  mash_scene: {
    component: MashSceneRenderer,
    wrapperClass: 'wb-mash-scene-overlay',
    dataAttr: 'data-mash-scene-id',
    testidPrefix: 'mash-scene-overlay',
    expandable: false,
    buildProps: stdProps,
    buildEvents: stdEvents,
  },

  // §3.7.14 (B3 2026-07-07) — ЖИВА GeoMASH-геометрія (vendor/geomash)
  geomash_scene: {
    component: GeomashRenderer,
    wrapperClass: 'wb-geomash-overlay',
    dataAttr: 'data-geomash-id',
    testidPrefix: 'geomash-overlay',
    expandable: false,
    buildProps: stdProps,
    buildEvents: stdEvents,
  },

  // §3.7.15 (B4 2026-07-07) — ЖИВА GraphMASH 3D-поверхня (vendor/graphmash3d, WebGL)
  graphmash_3d: {
    component: Graphmash3dRenderer,
    wrapperClass: 'wb-graphmash3d-overlay',
    dataAttr: 'data-graphmash3d-id',
    testidPrefix: 'graphmash3d-overlay',
    expandable: true,
    buildProps: expProps,
    buildEvents: expEvents,
  },

  nmt_task: {
    component: NmtTaskRenderer,
    wrapperClass: 'wb-nmt-task-overlay',
    dataAttr: 'data-nmt-task-id',
    testidPrefix: 'nmt-task-overlay',
    expandable: false,
    buildProps: stdProps,
    buildEvents: (a, ctx) => ({
      ...stdEvents(a, ctx),
      'spawn-companions': (payload: unknown) => ctx.onSpawnCompanions(payload),
    }),
  },

  theory_card: {
    component: TheoryCardRenderer,
    wrapperClass: 'wb-theory-card-overlay',
    dataAttr: 'data-theory-card-id',
    testidPrefix: 'theory-card-overlay',
    expandable: false,
    buildProps: stdProps,
    buildEvents: stdEvents,
  },
}

/** Усі overlay-типи з registry (= ключі OVERLAY_RENDERERS). */
export const OVERLAY_ASSET_TYPES: ReadonlyArray<string> = Object.keys(OVERLAY_RENDERERS)

/** Чи рендериться asset цього типу через unified overlay layer. */
export function isOverlayType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(OVERLAY_RENDERERS, type)
}
