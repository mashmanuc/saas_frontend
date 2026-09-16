/**
 * Phase G — graph_calculator defaults & throttle constants.
 *
 * Per OPS_SYNC_SSOT.md INV-21 + FE Architecture Rules:
 * - FE-RULE-5: snapshot debounce vs param throttle — DO NOT swap.
 */

import type { GraphCalculatorState, GraphViewport } from '../types/graphCalculator'
import type { WBAsset } from '../types/winterboard'

/** Default empty graph snapshot used when a new graph_calculator asset is dropped. */
export const DEFAULT_GRAPH_STATE: GraphCalculatorState = {
  expressions: [],
  params: {},
  viewport: { cx: 0, cy: 0, scale: 38 },
}

/**
 * Snapshot debounce — `asset_update` (full state).
 * Inv-21.5: ≥150ms; trailing edge; flush hooks per inv-21.11
 * (visibilitychange, beforeunload, unmount, stopRecording, page_navigate,
 * before-new-expression-emit).
 */
export const GRAPH_THROTTLE_SNAPSHOT_MS = 150

/**
 * Param throttle — `graph_param_set` (slider/animation delta).
 * Inv-21.10: ≤30 fps coalesce trailing — last-value-wins у вікні.
 * 33ms ≈ 30 FPS; backend rate limits sit higher (см. INV-NET-3).
 */
export const GRAPH_THROTTLE_PARAM_MS = 33

/**
 * Default initial dimensions (px) for a new graph_calculator dropped on board.
 */
export const DEFAULT_GRAPH_WIDTH = 480
export const DEFAULT_GRAPH_HEIGHT = 360

/** MIME type for drag-drop from sidebar tray (per inv-21 live recording flow). */
export const GRAPH_CALCULATOR_MIME = 'application/x-graph-calculator'

/** Початковий вміст картки: вирази (id видає factory) і вікно. Порожньо = DEFAULT_GRAPH_STATE. */
export interface GraphCalculatorInit {
  expressions?: ReadonlyArray<{ readonly src: string; readonly color: string }>
  viewport?: GraphViewport
}

function uuidOr(prefix: string): string {
  return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * TLV2-06R.1 · ЄДИНИЙ конструктор картки `graph_calculator` — для drag/`+` інструмента
 * (`useContentDrop`) і готових рецептів (`board/preparedBoardRecipes.ts`).
 * Per OPS_SYNC_SSOT.md INV-21 + UX-RULE-1: повний snapshot — version + state (копія
 * DEFAULT) + meta; `meta.last_snapshot_seq = 0` — placeholder, BE проставляє при apply.
 * `center` — центр картки в координатах сторінки.
 */
export function buildGraphCalculatorAsset(
  center: { x: number; y: number },
  init: GraphCalculatorInit = {},
): WBAsset {
  return {
    id: uuidOr('gc'),
    type: 'graph_calculator',
    // src field — kept for WBAsset shape compat; graph_calculator не використовує src.
    src: '',
    x: center.x - DEFAULT_GRAPH_WIDTH / 2,
    y: center.y - DEFAULT_GRAPH_HEIGHT / 2,
    w: DEFAULT_GRAPH_WIDTH,
    h: DEFAULT_GRAPH_HEIGHT,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      state: {
        expressions: init.expressions
          ? init.expressions.map((e) => ({ id: uuidOr('expr'), src: e.src, color: e.color, hidden: false }))
          : [...DEFAULT_GRAPH_STATE.expressions],
        params: { ...DEFAULT_GRAPH_STATE.params },
        viewport: { ...(init.viewport ?? DEFAULT_GRAPH_STATE.viewport) },
      },
      meta: { last_snapshot_seq: 0 },
    } as unknown as WBAsset['data'],
  }
}
