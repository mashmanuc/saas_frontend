/**
 * Phase G — graph_calculator defaults & throttle constants.
 *
 * Per OPS_SYNC_SSOT.md INV-21 + FE Architecture Rules:
 * - FE-RULE-5: snapshot debounce vs param throttle — DO NOT swap.
 */

import type { GraphCalculatorState } from '../types/graphCalculator'

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
