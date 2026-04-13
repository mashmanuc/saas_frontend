/**
 * GeoBoard — Pure math functions for geometry measurements.
 * No Vue/Pinia deps — pure functions, fully testable.
 *
 * Units: coordinates & lengths = canvas pixels (px). Angles = degrees (°). Areas = px².
 */

import type {
  TriangleMeasurements,
  CircleMeasurements,
  PolygonMeasurements,
} from '../types/geometry'

type Point = { x: number; y: number }

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Euclidean distance between two points */
export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Radians to degrees */
export function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI
}

/** Degrees to radians */
export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Signed area of polygon via Shoelace formula.
 * Positive = counter-clockwise, negative = clockwise.
 */
export function signedArea(vertices: Point[]): number {
  const n = vertices.length
  if (n < 3) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    const curr = vertices[i]
    const next = vertices[(i + 1) % n]
    sum += curr.x * next.y - next.x * curr.y
  }
  return sum / 2
}

/** Absolute area of polygon */
export function polygonArea(vertices: Point[]): number {
  return Math.abs(signedArea(vertices))
}

/** Perimeter of polygon */
export function polygonPerimeter(vertices: Point[]): number {
  const n = vertices.length
  if (n < 2) return 0
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += distance(vertices[i], vertices[(i + 1) % n])
  }
  return sum
}

/**
 * Interior angle at vertex i of a polygon (degrees).
 * Uses the law of cosines on the three consecutive points.
 */
export function interiorAngle(vertices: Point[], i: number): number {
  const n = vertices.length
  if (n < 3) return 0
  const prev = vertices[(i - 1 + n) % n]
  const curr = vertices[i]
  const next = vertices[(i + 1) % n]

  const a = distance(curr, prev)
  const b = distance(curr, next)
  if (a < 1e-9 || b < 1e-9) return 0

  const dx1 = prev.x - curr.x
  const dy1 = prev.y - curr.y
  const dx2 = next.x - curr.x
  const dy2 = next.y - curr.y

  const dot = dx1 * dx2 + dy1 * dy2
  const cos = Math.max(-1, Math.min(1, dot / (a * b)))
  return toDegrees(Math.acos(cos))
}

/** Midpoint between two points */
export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// ─── Triangle ────────────────────────────────────────────────────────────

/**
 * Compute triangle measurements from 3 vertices.
 * Returns null if vertices are degenerate (collinear / collapsed).
 */
export function computeTriangleMeasurements(
  vertices: [Point, Point, Point],
): TriangleMeasurements | null {
  const [a, b, c] = vertices
  const sideAB = distance(a, b)
  const sideBC = distance(b, c)
  const sideCA = distance(c, a)
  const area = polygonArea(vertices)

  if (area < 1e-6) return null // degenerate

  const angleA = interiorAngle(vertices, 0)
  const angleB = interiorAngle(vertices, 1)
  const angleC = interiorAngle(vertices, 2)

  return {
    sides: [sideAB, sideBC, sideCA],
    angles: [angleA, angleB, angleC],
    area,
    perimeter: sideAB + sideBC + sideCA,
  }
}

// ─── Circle ──────────────────────────────────────────────────────────────

/** Compute circle measurements from radius */
export function computeCircleMeasurements(radius: number): CircleMeasurements {
  return {
    radius,
    diameter: 2 * radius,
    circumference: 2 * Math.PI * radius,
    area: Math.PI * radius * radius,
  }
}

// ─── Polygon ─────────────────────────────────────────────────────────────

/**
 * Compute polygon measurements from N vertices.
 * Returns null if polygon is degenerate (area ≈ 0).
 */
export function computePolygonMeasurements(vertices: Point[]): PolygonMeasurements | null {
  if (vertices.length < 3) return null
  const area = polygonArea(vertices)
  if (area < 1e-6) return null

  const n = vertices.length
  const sides: number[] = []
  const angles: number[] = []

  for (let i = 0; i < n; i++) {
    sides.push(distance(vertices[i], vertices[(i + 1) % n]))
    angles.push(interiorAngle(vertices, i))
  }

  return {
    sides,
    angles,
    area,
    perimeter: sides.reduce((sum, s) => sum + s, 0),
  }
}

// ─── Regular polygon generator ───────────────────────────────────────────

/**
 * Generate vertices for a regular N-gon centered at (cx, cy) with given radius.
 * First vertex is at top (12 o'clock position).
 */
export function regularPolygonVertices(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
): Point[] {
  const vertices: Point[] = []
  for (let i = 0; i < sides; i++) {
    // Start from top (-π/2) and go clockwise
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / sides
    vertices.push({
      x: Math.round((cx + radius * Math.cos(angle)) * 100) / 100,
      y: Math.round((cy + radius * Math.sin(angle)) * 100) / 100,
    })
  }
  return vertices
}

// ─── Default shapes ──────────────────────────────────────────────────────

/** Create default equilateral triangle at position */
export function defaultTriangleVertices(cx: number, cy: number, size = 120): Point[] {
  return regularPolygonVertices(cx, cy, size / 2, 3)
}

/** Create default square at position */
export function defaultSquareVertices(cx: number, cy: number, size = 100): Point[] {
  return regularPolygonVertices(cx, cy, size / 2, 4)
}

// ─── Angle snap ──────────────────────────────────────────────────────────

/** Snap angle to nearest value if within threshold (5°) */
export function snapAngle(angle: number, snapValues: readonly number[], threshold = 5): number {
  for (const snap of snapValues) {
    if (Math.abs(angle - snap) < threshold) return snap
  }
  return angle
}

// ─── Vertex collapse guard (S7) ──────────────────────────────────────────

/**
 * Check if moving vertex at `vertexIndex` to `newPos` would collapse the polygon.
 * Returns true if the move should be blocked.
 */
export function wouldCollapse(
  vertices: Point[],
  vertexIndex: number,
  newPos: Point,
  epsilon = 1.0,
): boolean {
  if (vertices.length < 3) return true
  const testVertices = vertices.map((v, i) => (i === vertexIndex ? newPos : v))
  return polygonArea(testVertices) < epsilon
}

// ─── Bounding box ────────────────────────────────────────────────────────

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

/** Compute bounding box from vertices (for selection frame) */
export function verticesBBox(vertices: Point[]): BBox {
  if (vertices.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const v of vertices) {
    if (v.x < minX) minX = v.x
    if (v.y < minY) minY = v.y
    if (v.x > maxX) maxX = v.x
    if (v.y > maxY) maxY = v.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Compute bounding box for a circle */
export function circleBBox(cx: number, cy: number, radius: number): BBox {
  return {
    x: cx - radius,
    y: cy - radius,
    w: radius * 2,
    h: radius * 2,
  }
}

// ─── Point-in-polygon hit test (C6) ──────────────────────────────────────

/**
 * Ray-casting algorithm: true if point is inside polygon.
 * Used for proper hit testing instead of bbox check.
 */
export function pointInPolygon(point: Point, vertices: Point[]): boolean {
  const n = vertices.length
  if (n < 3) return false
  let inside = false
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y
    const xj = vertices[j].x, yj = vertices[j].y
    if ((yi > point.y) !== (yj > point.y) &&
        point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Check if point is inside circle */
export function pointInCircle(point: Point, cx: number, cy: number, radius: number): boolean {
  return Math.hypot(point.x - cx, point.y - cy) <= radius
}

// ─── Centroid ────────────────────────────────────────────────────────────

/** Compute centroid (geometric center) of polygon vertices */
export function centroid(vertices: Point[]): Point {
  if (vertices.length === 0) return { x: 0, y: 0 }
  let sx = 0, sy = 0
  for (const v of vertices) {
    sx += v.x
    sy += v.y
  }
  return { x: sx / vertices.length, y: sy / vertices.length }
}

// ─── Format ──────────────────────────────────────────────────────────────

/** Format number for display (2 decimal max, trim trailing zeros) */
export function formatMeasurement(val: number): string {
  return val.toFixed(1).replace(/\.0$/, '')
}
