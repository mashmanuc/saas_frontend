/**
 * GeoBoard Phase 2 — Built-in geometry presets.
 *
 * Each preset = array of ops with relativeDelay.
 * Presets use the same op format as the replay system.
 * New presets can be added without code changes (JSON config).
 */

import type { GeometryPreset } from '../types/geometry'
import { GEOMETRY_DEFAULTS, roundCoord } from '../types/geometry'
import { regularPolygonVertices } from './geometryMeasurements'

type Point = { x: number; y: number }

// ─── Helpers ─────────────────────────────────────────────────────────────

function makeAssetId(): string {
  return `geometry_2d-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Build a triangle preset with edge-by-edge animation (AD-3).
 * 300ms per edge, 200ms fill fade-in.
 */
function buildTriangleAnimated(
  id: string,
  vertices: [Point, Point, Point],
  opts?: { fillColor?: string; strokeColor?: string },
): GeometryPreset['ops'] {
  const fill = opts?.fillColor ?? GEOMETRY_DEFAULTS.fillColor
  const stroke = opts?.strokeColor ?? GEOMETRY_DEFAULTS.strokeColor

  return [
    {
      op_type: 'asset_add',
      relativeDelay: 0,
      payload: {
        asset: {
          id,
          type: 'geometry_2d',
          src: '',
          x: 0, y: 0, w: 0, h: 0,
          rotation: 0,
          geometryParams: {
            shape: 'triangle',
            vertices,
            fillColor: fill,
            strokeColor: stroke,
            strokeWidth: GEOMETRY_DEFAULTS.strokeWidth,
            showMeasurements: true,
            buildProgress: 0,
          },
        },
      },
    },
    {
      op_type: 'asset_update',
      relativeDelay: 300,
      easing: 'linear',
      payload: {
        asset: { id, type: 'geometry_2d', src: '', x: 0, y: 0, w: 0, h: 0, rotation: 0,
          geometryParams: { shape: 'triangle', vertices, fillColor: fill, strokeColor: stroke,
            strokeWidth: GEOMETRY_DEFAULTS.strokeWidth, showMeasurements: true, buildProgress: 0.33 } },
      },
    },
    {
      op_type: 'asset_update',
      relativeDelay: 600,
      easing: 'linear',
      payload: {
        asset: { id, type: 'geometry_2d', src: '', x: 0, y: 0, w: 0, h: 0, rotation: 0,
          geometryParams: { shape: 'triangle', vertices, fillColor: fill, strokeColor: stroke,
            strokeWidth: GEOMETRY_DEFAULTS.strokeWidth, showMeasurements: true, buildProgress: 0.66 } },
      },
    },
    {
      op_type: 'asset_update',
      relativeDelay: 900,
      easing: 'linear',
      payload: {
        asset: { id, type: 'geometry_2d', src: '', x: 0, y: 0, w: 0, h: 0, rotation: 0,
          geometryParams: { shape: 'triangle', vertices, fillColor: fill, strokeColor: stroke,
            strokeWidth: GEOMETRY_DEFAULTS.strokeWidth, showMeasurements: true, buildProgress: 1.0 } },
      },
    },
  ]
}

/**
 * Build a square (4 vertices) for Pythagoras squares on triangle sides.
 * Edge-by-edge animation.
 */
function buildSquareOnEdge(
  id: string,
  a: Point,
  b: Point,
  fillColor: string,
  baseDelay: number,
): GeometryPreset['ops'] {
  // Square on the outside of edge A→B
  const dx = b.x - a.x
  const dy = b.y - a.y
  // Perpendicular direction (outward from triangle)
  const c: Point = { x: roundCoord(b.x - dy), y: roundCoord(b.y + dx) }
  const d: Point = { x: roundCoord(a.x - dy), y: roundCoord(a.y + dx) }

  const vertices = [
    { x: roundCoord(a.x), y: roundCoord(a.y) },
    { x: roundCoord(b.x), y: roundCoord(b.y) },
    c, d,
  ]

  return [
    {
      op_type: 'asset_add',
      relativeDelay: baseDelay,
      payload: {
        asset: {
          id,
          type: 'geometry_2d',
          src: '',
          x: 0, y: 0, w: 0, h: 0,
          rotation: 0,
          geometryParams: {
            shape: 'polygon',
            sides: 4,
            vertices,
            fillColor,
            strokeColor: GEOMETRY_DEFAULTS.strokeColor,
            strokeWidth: 1.5,
            showMeasurements: false,
            buildProgress: 0,
          },
        },
      },
    },
    {
      op_type: 'asset_update',
      relativeDelay: baseDelay + 200,
      easing: 'easeInOut',
      payload: {
        asset: { id, type: 'geometry_2d', src: '', x: 0, y: 0, w: 0, h: 0, rotation: 0,
          geometryParams: { shape: 'polygon', sides: 4, vertices, fillColor,
            strokeColor: GEOMETRY_DEFAULTS.strokeColor, strokeWidth: 1.5,
            showMeasurements: false, buildProgress: 0.5 } },
      },
    },
    {
      op_type: 'asset_update',
      relativeDelay: baseDelay + 400,
      easing: 'easeInOut',
      payload: {
        asset: { id, type: 'geometry_2d', src: '', x: 0, y: 0, w: 0, h: 0, rotation: 0,
          geometryParams: { shape: 'polygon', sides: 4, vertices, fillColor,
            strokeColor: GEOMETRY_DEFAULTS.strokeColor, strokeWidth: 1.5,
            showMeasurements: false, buildProgress: 1.0 } },
      },
    },
  ]
}

// ─── Presets ──────────────────────────────────────────────────────────────

/**
 * Simple triangle — edge-by-edge build at position.
 */
export function createTriangleBuildPreset(cx: number, cy: number, size = 120): GeometryPreset {
  const h = (size * Math.sqrt(3)) / 2
  const vertices: [Point, Point, Point] = [
    { x: roundCoord(cx), y: roundCoord(cy - h * 2 / 3) },
    { x: roundCoord(cx - size / 2), y: roundCoord(cy + h / 3) },
    { x: roundCoord(cx + size / 2), y: roundCoord(cy + h / 3) },
  ]

  return {
    id: 'triangle_build',
    name: 'Побудова трикутника',
    ops: buildTriangleAnimated(makeAssetId(), vertices),
  }
}

/**
 * Pythagoras theorem — right triangle + 3 squares on sides.
 * a² + b² = c² visualized with colored squares.
 */
export function createPythagorasPreset(cx: number, cy: number, scale = 1): GeometryPreset {
  const a = roundCoord(80 * scale) // short leg
  const b = roundCoord(60 * scale) // other leg

  // Right triangle (right angle at C)
  const A: Point = { x: roundCoord(cx - b / 2), y: roundCoord(cy + a / 2) } // bottom-left
  const B: Point = { x: roundCoord(cx + b / 2), y: roundCoord(cy + a / 2) } // bottom-right
  const C: Point = { x: roundCoord(cx - b / 2), y: roundCoord(cy - a / 2) } // top-left (right angle)

  const triId = makeAssetId()
  const sqAId = makeAssetId()
  const sqBId = makeAssetId()
  const sqCId = makeAssetId()

  const ops: GeometryPreset['ops'] = [
    // 1. Triangle (edge-by-edge, 0-900ms)
    ...buildTriangleAnimated(triId, [A, B, C]),

    // 2. Square on side a (A→C), delay 1200ms — RED
    ...buildSquareOnEdge(sqAId, A, C, 'rgba(239, 68, 68, 0.2)', 1200),

    // 3. Square on side b (B→A), delay 1800ms — GREEN
    ...buildSquareOnEdge(sqBId, B, A, 'rgba(34, 197, 94, 0.2)', 1800),

    // 4. Square on side c = hypotenuse (C→B), delay 2400ms — BLUE
    ...buildSquareOnEdge(sqCId, C, B, 'rgba(59, 130, 246, 0.25)', 2400),
  ]

  return {
    id: 'pythagoras',
    name: 'Теорема Піфагора',
    description: 'a² + b² = c²',
    ops,
  }
}

/**
 * Circle build — arc 0→2π animation.
 */
export function createCircleBuildPreset(cx: number, cy: number, radius = 60): GeometryPreset {
  const id = makeAssetId()
  const steps = 8 // 8 steps for smooth arc
  const ops: GeometryPreset['ops'] = [
    {
      op_type: 'asset_add',
      relativeDelay: 0,
      payload: {
        asset: {
          id,
          type: 'geometry_2d',
          src: '',
          x: 0, y: 0, w: 0, h: 0,
          rotation: 0,
          geometryParams: {
            shape: 'circle',
            cx: roundCoord(cx),
            cy: roundCoord(cy),
            radius: roundCoord(radius),
            fillColor: GEOMETRY_DEFAULTS.fillColor,
            strokeColor: GEOMETRY_DEFAULTS.strokeColor,
            strokeWidth: GEOMETRY_DEFAULTS.strokeWidth,
            showMeasurements: true,
            buildProgress: 0,
          },
        },
      },
    },
  ]

  for (let i = 1; i <= steps; i++) {
    const progress = roundCoord(i / steps)
    ops.push({
      op_type: 'asset_update',
      relativeDelay: Math.round(500 * (i / steps)),
      easing: 'linear',
      payload: {
        asset: {
          id,
          type: 'geometry_2d',
          src: '',
          x: 0, y: 0, w: 0, h: 0,
          rotation: 0,
          geometryParams: {
            shape: 'circle',
            cx: roundCoord(cx),
            cy: roundCoord(cy),
            radius: roundCoord(radius),
            fillColor: GEOMETRY_DEFAULTS.fillColor,
            strokeColor: GEOMETRY_DEFAULTS.strokeColor,
            strokeWidth: GEOMETRY_DEFAULTS.strokeWidth,
            showMeasurements: true,
            buildProgress: progress,
          },
        },
      },
    })
  }

  return {
    id: 'circle_build',
    name: 'Побудова кола',
    ops,
  }
}

/**
 * Regular polygon build — edge-by-edge.
 */
export function createPolygonBuildPreset(
  cx: number,
  cy: number,
  sides: number,
  radius = 60,
): GeometryPreset {
  const id = makeAssetId()
  const vertices = regularPolygonVertices(roundCoord(cx), roundCoord(cy), radius, sides)
  const msPerEdge = 300

  const ops: GeometryPreset['ops'] = [
    {
      op_type: 'asset_add',
      relativeDelay: 0,
      payload: {
        asset: {
          id,
          type: 'geometry_2d',
          src: '',
          x: 0, y: 0, w: 0, h: 0,
          rotation: 0,
          geometryParams: {
            shape: 'polygon',
            sides,
            vertices,
            fillColor: GEOMETRY_DEFAULTS.fillColor,
            strokeColor: GEOMETRY_DEFAULTS.strokeColor,
            strokeWidth: GEOMETRY_DEFAULTS.strokeWidth,
            showMeasurements: true,
            buildProgress: 0,
          },
        },
      },
    },
  ]

  for (let i = 1; i <= sides; i++) {
    const progress = roundCoord(i / sides)
    ops.push({
      op_type: 'asset_update',
      relativeDelay: msPerEdge * i,
      easing: 'linear',
      payload: {
        asset: {
          id,
          type: 'geometry_2d',
          src: '',
          x: 0, y: 0, w: 0, h: 0,
          rotation: 0,
          geometryParams: {
            shape: 'polygon',
            sides,
            vertices,
            fillColor: GEOMETRY_DEFAULTS.fillColor,
            strokeColor: GEOMETRY_DEFAULTS.strokeColor,
            strokeWidth: GEOMETRY_DEFAULTS.strokeWidth,
            showMeasurements: true,
            buildProgress: progress,
          },
        },
      },
    })
  }

  return {
    id: 'polygon_build',
    name: `Побудова ${sides}-кутника`,
    ops,
  }
}

// ─── Registry ────────────────────────────────────────────────────────────

export const BUILT_IN_PRESETS = [
  { id: 'triangle_build', name: 'Побудова трикутника', factory: createTriangleBuildPreset },
  { id: 'circle_build', name: 'Побудова кола', factory: createCircleBuildPreset },
  { id: 'pythagoras', name: 'Теорема Піфагора', factory: createPythagorasPreset },
] as const
