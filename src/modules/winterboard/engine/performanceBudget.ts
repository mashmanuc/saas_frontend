// WB Responsive Phase 5 A8: Performance budgets per device mode
// Ref: winterboard_dev/responsive/PHASE5.md A8.1
//
// Device-aware rendering limits, spatial grid sizes, smoothing quality,
// battery optimization flags. Used by spatial index, stroke renderer,
// and canvas render loop.

import type { DeviceMode } from '../types/responsive'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PerformanceBudget {
  /** Max strokes rendered per frame (viewport culling limit) */
  maxStrokesRendered: number
  /** Max assets loaded simultaneously (lazy load rest) */
  maxAssetsLoaded: number
  /** Spatial grid cell size in canvas units */
  spatialGridSize: number
  /** Konva pixel ratio (1 = standard, 2 = retina) */
  konvaPixelRatio: number
  /** Catmull-Rom smoothing points per segment */
  smoothingPoints: number
  /** Max undo stack depth */
  maxUndoStack: number
  /** Target FPS when idle (not drawing) — LAW-23 battery */
  idleFps: number
  /** Cursor broadcast throttle (ms) — LAW-16 */
  cursorThrottleMs: number
  /** Autosave interval (ms) — LAW-02 offline awareness */
  autosaveIntervalMs: number
  /** Stroke flattening batch size (INV-6) */
  flattenBatchSize: number
}

// ─── Budgets ────────────────────────────────────────────────────────────────

export const PERFORMANCE_BUDGETS: Record<DeviceMode, PerformanceBudget> = {
  mobile: {
    maxStrokesRendered: 500,
    maxAssetsLoaded: 10,
    spatialGridSize: 300,
    konvaPixelRatio: 1,
    smoothingPoints: 3,
    maxUndoStack: 30,
    idleFps: 15,
    cursorThrottleMs: 100,
    autosaveIntervalMs: 5000,
    flattenBatchSize: 30,
  },
  tablet: {
    maxStrokesRendered: 1500,
    maxAssetsLoaded: 25,
    spatialGridSize: 400,
    konvaPixelRatio: 2,
    smoothingPoints: 5,
    maxUndoStack: 50,
    idleFps: 30,
    cursorThrottleMs: 75,
    autosaveIntervalMs: 4000,
    flattenBatchSize: 50,
  },
  desktop: {
    maxStrokesRendered: 5000,
    maxAssetsLoaded: 50,
    spatialGridSize: 500,
    konvaPixelRatio: 2,
    smoothingPoints: 8,
    maxUndoStack: 100,
    idleFps: 60,
    cursorThrottleMs: 50,
    autosaveIntervalMs: 3000,
    flattenBatchSize: 50,
  },
  display: {
    maxStrokesRendered: 3000,
    maxAssetsLoaded: 40,
    spatialGridSize: 600,
    konvaPixelRatio: 1,
    smoothingPoints: 5,
    maxUndoStack: 100,
    idleFps: 30,
    cursorThrottleMs: 100,
    autosaveIntervalMs: 3000,
    flattenBatchSize: 50,
  },
}

/**
 * Get performance budget for a device mode.
 * Falls back to desktop if unknown mode.
 */
export function getPerformanceBudget(deviceMode: DeviceMode): PerformanceBudget {
  return PERFORMANCE_BUDGETS[deviceMode] ?? PERFORMANCE_BUDGETS.desktop
}
