/**
 * GeoBoard — Composable for 2D geometry interaction logic.
 *
 * Handles:
 * - Vertex drag with distance-based emit (G1.1)
 * - Vertex collapse guard (S7)
 * - Angle snap (15°/30°/45°/90°)
 * - Floating point rounding (invariant: 2 decimals)
 * - Measurement recomputation (dirty flag)
 * - Undo group management (AD-2)
 * - Authoritative mouseup (G9)
 */

import { ref, computed, type Ref } from 'vue'
import type { Geometry2DParams } from '../types/geometry'
import {
  VERTEX_COLLAPSE_EPSILON,
  MIN_EMIT_DISTANCE_PX,
  roundCoord,
} from '../types/geometry'
import {
  wouldCollapse,
  computeTriangleMeasurements,
  computeCircleMeasurements,
  computePolygonMeasurements,
  verticesBBox,
  circleBBox,
  type BBox,
} from '../engine/geometryMeasurements'
import type { WBAsset } from '../types/winterboard'

type Point = { x: number; y: number }

interface UseGeometry2DOptions {
  /** Callback to emit vertex move op (lightweight, throttled) */
  onVertexMove: (assetId: string, vertexIndex: number, x: number, y: number) => void
  /** Callback to emit authoritative final state on mouseup (G9) */
  onDragEnd: (asset: WBAsset) => void
  /** Callback to emit circle drag */
  onCircleMove: (assetId: string, cx: number, cy: number, radius: number) => void
}

export function useGeometry2D(options: UseGeometry2DOptions) {
  // ─── Local interaction state ──────────────────────────────
  const isDraggingVertex = ref(false)
  const activeVertexIndex = ref<number | null>(null)
  const activeAssetId = ref<string | null>(null)
  const lastEmittedPoint = ref<Point | null>(null)
  const currentUndoGroupId = ref<string | null>(null)

  // ─── Measurements (dirty flag pattern, R2) ────────────────

  function computeMeasurements(params: Geometry2DParams) {
    if (params.shape === 'triangle' && params.vertices?.length === 3) {
      return computeTriangleMeasurements(params.vertices as [Point, Point, Point])
    }
    if (params.shape === 'circle' && params.radius != null) {
      return computeCircleMeasurements(params.radius)
    }
    if (params.shape === 'polygon' && params.vertices && params.vertices.length >= 3) {
      return computePolygonMeasurements(params.vertices)
    }
    return null
  }

  function computeBBox(params: Geometry2DParams): BBox {
    if (params.shape === 'circle' && params.cx != null && params.cy != null && params.radius != null) {
      return circleBBox(params.cx, params.cy, params.radius)
    }
    if (params.vertices && params.vertices.length > 0) {
      return verticesBBox(params.vertices)
    }
    return { x: 0, y: 0, w: 0, h: 0 }
  }

  // ─── Vertex drag (G1.1: distance-based emit) ─────────────

  function startVertexDrag(assetId: string, vertexIndex: number, point: Point): void {
    isDraggingVertex.value = true
    activeVertexIndex.value = vertexIndex
    activeAssetId.value = assetId
    lastEmittedPoint.value = { x: point.x, y: point.y }
    // AD-2: generate undo_group_id for this drag session
    currentUndoGroupId.value = `ug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  }

  /**
   * Handle vertex move during drag.
   * Returns the new position (possibly snapped) or null if move is blocked.
   *
   * R6: localPos = raw float for smooth visual, rounded only on emit.
   */
  function handleVertexMove(
    vertices: Point[],
    vertexIndex: number,
    rawPos: Point,
  ): Point | null {
    const pos = { x: rawPos.x, y: rawPos.y }

    // S7: vertex collapse guard
    if (wouldCollapse(vertices, vertexIndex, pos, VERTEX_COLLAPSE_EPSILON)) {
      return null // block move
    }

    // Distance-based emit (G1.1)
    if (lastEmittedPoint.value) {
      const dist = Math.hypot(
        pos.x - lastEmittedPoint.value.x,
        pos.y - lastEmittedPoint.value.y,
      )
      if (dist >= MIN_EMIT_DISTANCE_PX && activeAssetId.value) {
        const rx = roundCoord(pos.x)
        const ry = roundCoord(pos.y)
        options.onVertexMove(activeAssetId.value, vertexIndex, rx, ry)
        lastEmittedPoint.value = { x: rx, y: ry }
      }
    }

    return pos
  }

  /**
   * End vertex drag — emit authoritative final state (G9).
   */
  function endVertexDrag(asset: WBAsset): void {
    if (!isDraggingVertex.value) return
    isDraggingVertex.value = false
    activeVertexIndex.value = null
    activeAssetId.value = null
    lastEmittedPoint.value = null

    // G9: authoritative final state
    options.onDragEnd(asset)

    currentUndoGroupId.value = null
  }

  // ─── Circle drag ──────────────────────────────────────────

  const isDraggingCircle = ref(false)
  const circleDragStart = ref<{ cx: number; cy: number; mouseX: number; mouseY: number } | null>(null)

  function startCircleDrag(assetId: string, cx: number, cy: number, mousePos: Point): void {
    isDraggingCircle.value = true
    activeAssetId.value = assetId
    circleDragStart.value = { cx, cy, mouseX: mousePos.x, mouseY: mousePos.y }
    lastEmittedPoint.value = { x: mousePos.x, y: mousePos.y }
    currentUndoGroupId.value = `ug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  }

  function handleCircleRadiusDrag(
    cx: number,
    cy: number,
    mousePos: Point,
  ): number | null {
    const newRadius = Math.hypot(mousePos.x - cx, mousePos.y - cy)
    if (newRadius < 5) return null // too small

    if (lastEmittedPoint.value && activeAssetId.value) {
      const dist = Math.hypot(
        mousePos.x - lastEmittedPoint.value.x,
        mousePos.y - lastEmittedPoint.value.y,
      )
      if (dist >= MIN_EMIT_DISTANCE_PX) {
        options.onCircleMove(activeAssetId.value, roundCoord(cx), roundCoord(cy), roundCoord(newRadius))
        lastEmittedPoint.value = { x: mousePos.x, y: mousePos.y }
      }
    }

    return newRadius
  }

  function endCircleDrag(asset: WBAsset): void {
    isDraggingCircle.value = false
    circleDragStart.value = null
    activeAssetId.value = null
    lastEmittedPoint.value = null
    options.onDragEnd(asset)
    currentUndoGroupId.value = null
  }

  return {
    // State
    isDraggingVertex,
    isDraggingCircle,
    activeVertexIndex,
    activeAssetId,
    currentUndoGroupId,
    // Methods
    computeMeasurements,
    computeBBox,
    startVertexDrag,
    handleVertexMove,
    endVertexDrag,
    startCircleDrag,
    handleCircleRadiusDrag,
    endCircleDrag,
  }
}
