/**
 * GeoBoard — Geometry types for Winterboard
 * Phase 1: 2D geometry (triangle, circle, polygon)
 *
 * INVARIANTS:
 * - vertices = ABSOLUTE canvas coordinates (not relative 0-1!)
 * - bbox = derived from min/max(vertices), NOT source of truth
 * - geometry does NOT depend on asset.x/y for its logic
 * - All coordinates rounded to 2 decimal places for deterministic replay
 */

// ─── 2D Geometry ────────────────────────────────────────────────────────────

export type Geometry2DShape = 'triangle' | 'circle' | 'polygon'

export interface Geometry2DParams {
  shape: Geometry2DShape
  // INVARIANT: vertices = ABSOLUTE canvas coords (not relative 0-1!)
  // bbox = derived (min/max vertices) — only for selection frame / resize handles
  vertices?: Array<{ x: number; y: number }>
  // Circle: EXPLICIT center (NOT dependent on asset.x/y)
  cx?: number
  cy?: number
  radius?: number
  // Polygon
  sides?: number // 3-12
  // Style
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  showMeasurements?: boolean
  // Replay build animation: 0 = invisible, 0.33 = 1 edge, 1.0 = complete
  buildProgress?: number // 0.0 - 1.0, renderer interprets per shape
}

// ─── 3D Geometry (Phase 3, types defined now for future-proofing) ─────────

export type Geometry3DShape = 'cube' | 'sphere'

export interface Geometry3DParams {
  shape: Geometry3DShape
  rotation3d: { x: number; y: number; z: number }
  wireframe: boolean
  faceColor?: string
  showMeasurements?: boolean
}

// ─── Measurements (computed, not stored) ─────────────────────────────────

export interface TriangleMeasurements {
  sides: [number, number, number]
  angles: [number, number, number] // degrees
  area: number
  perimeter: number
}

export interface CircleMeasurements {
  radius: number
  diameter: number
  circumference: number
  area: number
}

export interface PolygonMeasurements {
  sides: number[]
  angles: number[] // degrees
  area: number
  perimeter: number
}

// ─── Interaction ─────────────────────────────────────────────────────────

export type GeometryInteractionMode = 'select' | 'interact'

// ─── Constraints (defined but NOT implemented in Phase 1) ────────────────

export interface GeometryConstraints {
  lockAspectRatio?: boolean
  perpendicular?: [number, number][]
  parallel?: [number, number][]
  equalLength?: [number, number][]
  fixedAngle?: { vertexIndex: number; degrees: number }[]
}

// ─── Op payloads ─────────────────────────────────────────────────────────

export interface VertexMovePayload {
  id: string
  vertexIndex: number
  x: number
  y: number
}

// ─── Presets (Phase 2) ───────────────────────────────────────────────────

export interface PresetOp {
  op_type: string
  payload: Record<string, unknown>
  /** ms from preset start (absolute, NOT relative to previous op) */
  relativeDelay: number
  easing?: 'linear' | 'easeInOut'
}

export interface GeometryPreset {
  id: string
  name: string
  description?: string
  ops: PresetOp[]
}

// ─── Defaults ────────────────────────────────────────────────────────────

export const GEOMETRY_DEFAULTS = {
  fillColor: 'rgba(59, 130, 246, 0.15)', // blue-500 15%
  strokeColor: '#3b82f6', // blue-500
  strokeWidth: 2,
  showMeasurements: true,
  buildProgress: 1.0,
  vertexRadius: 6, // px — visual handle size
  vertexHitRadius: 12, // px — hit area (larger for touch)
  vertexFillColor: '#ffffff',
  vertexStrokeColor: '#3b82f6',
  vertexStrokeWidth: 2,
  measurementFontSize: 12,
  measurementFontFamily: 'Inter, sans-serif',
  measurementColor: '#64748b', // slate-500
} as const

/** Vertex collapse guard: block move if triangle area < epsilon (px²) */
export const VERTEX_COLLAPSE_EPSILON = 1.0

/** Distance-based emit thresholds for vertex drag (G1.1) */
export const MIN_EMIT_DISTANCE_PX = 3
export const MAX_EMIT_DISTANCE_PX = 20

/** Angle snap values in degrees */
export const ANGLE_SNAP_VALUES = [15, 30, 45, 60, 90, 120, 135, 150, 180] as const

/** Floating point precision: round to 2 decimal places */
export function roundCoord(val: number): number {
  return Math.round(val * 100) / 100
}
