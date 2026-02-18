// WB: Catmull-Rom spline interpolation for stroke smoothing
// Ref: TASK_BOARD.md A4.1, ManifestWinterboard_v2.md LAW-15 (drawing fidelity)
// Only for pen/highlighter — NOT for shapes/eraser/text

import type { WBPoint } from '../types/winterboard'

/**
 * Catmull-Rom interpolation between control points.
 *
 * Given 4 control points (p0, p1, p2, p3), produces `segments` intermediate
 * points between p1 and p2 using the Catmull-Rom spline formula.
 *
 * @param p0 - Control point before the segment start
 * @param p1 - Segment start
 * @param p2 - Segment end
 * @param p3 - Control point after the segment end
 * @param tension - Spline tension (0 = sharp, 1 = very smooth). Default 0.5
 * @param segments - Number of interpolated points between p1 and p2. Default 8
 * @returns Array of interpolated WBPoint between p1 and p2 (exclusive of p1, inclusive of p2 only at last segment)
 */
function catmullRomSegment(
  p0: WBPoint,
  p1: WBPoint,
  p2: WBPoint,
  p3: WBPoint,
  tension: number,
  segments: number,
): WBPoint[] {
  const result: WBPoint[] = []

  // Cardinal spline tangent scale factor.
  // tension=0.5 → standard Catmull-Rom (tau=1). tension=0 → tau=0 (linear).
  const tau = tension * 2

  for (let i = 1; i <= segments; i++) {
    const u = i / segments
    const u2 = u * u
    const u3 = u2 * u

    // Hermite basis functions
    const h00 = 2 * u3 - 3 * u2 + 1
    const h10 = u3 - 2 * u2 + u
    const h01 = -2 * u3 + 3 * u2
    const h11 = u3 - u2

    // Tangents scaled by tau
    const m1x = tau * (p2.x - p0.x) * 0.5
    const m1y = tau * (p2.y - p0.y) * 0.5
    const m2x = tau * (p3.x - p1.x) * 0.5
    const m2y = tau * (p3.y - p1.y) * 0.5

    const px = h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x
    const py = h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y

    const point: WBPoint = { x: px, y: py }

    // Interpolate optional fields (pressure, timestamp) linearly
    if (p1.pressure !== undefined && p2.pressure !== undefined) {
      point.pressure = p1.pressure + (p2.pressure - p1.pressure) * u
    }

    if (p1.t !== undefined && p2.t !== undefined) {
      point.t = Math.round(p1.t + (p2.t - p1.t) * u)
    }

    result.push(point)
  }

  return result
}

/**
 * Catmull-Rom spline interpolation for an array of WBPoints.
 *
 * Produces a smooth curve through all input points using Catmull-Rom
 * interpolation. The first and last points are duplicated as phantom
 * control points to ensure the curve passes through all original points.
 *
 * @param points - Original stroke points (minimum 4 for interpolation)
 * @param tension - Spline tension. Default 0.5 (standard Catmull-Rom)
 * @param segments - Interpolated points per segment. Default 8
 * @returns Smoothed array of WBPoints. Returns original if < 4 points.
 */
export function catmullRomInterpolate(
  points: WBPoint[],
  tension: number = 0.5,
  segments: number = 8,
): WBPoint[] {
  // Not enough points for Catmull-Rom — return original
  if (points.length < 4) return points

  // Clamp parameters to sane ranges
  const t = Math.max(0, Math.min(1, tension))
  const s = Math.max(1, Math.min(32, Math.round(segments)))

  const result: WBPoint[] = []

  // Always include the first point
  result.push(points[0])

  for (let i = 0; i < points.length - 1; i++) {
    // Phantom control points: duplicate first/last for boundary segments
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[Math.min(points.length - 1, i + 1)]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const interpolated = catmullRomSegment(p0, p1, p2, p3, t, s)
    result.push(...interpolated)
  }

  return result
}

// ─── Smoothed points cache ──────────────────────────────────────────────────

interface SmoothedCacheEntry {
  /** Signature: strokeId + pointsLength + last point coords */
  sig: string
  /** Smoothed points */
  points: WBPoint[]
}

const smoothedCache = new Map<string, SmoothedCacheEntry>()

// Prevent unbounded cache growth
const MAX_CACHE_SIZE = 500

/**
 * Build a cache signature for a stroke's points.
 * Invalidates when points change (length, first/last coords).
 */
function buildSig(strokeId: string, points: WBPoint[]): string {
  const len = points.length
  if (len === 0) return `${strokeId}|0`
  const first = points[0]
  const last = points[len - 1]
  return `${strokeId}|${len}|${first.x},${first.y}|${last.x},${last.y}`
}

/**
 * Get smoothed points for a stroke, with caching.
 * Only applies to pen/highlighter tools.
 *
 * @param strokeId - Unique stroke identifier
 * @param tool - Stroke tool type
 * @param points - Original stroke points
 * @param tension - Catmull-Rom tension. Default 0.5
 * @param segments - Points per segment. Default 8
 * @returns Smoothed points (or original for non-pen/highlighter or < 4 points)
 */
export function getSmoothedPoints(
  strokeId: string,
  tool: string,
  points: WBPoint[],
  tension: number = 0.5,
  segments: number = 8,
): WBPoint[] {
  // Only smooth pen and highlighter strokes
  if (tool !== 'pen' && tool !== 'highlighter') return points
  if (points.length < 4) return points

  const sig = buildSig(strokeId, points)
  const cached = smoothedCache.get(strokeId)
  if (cached && cached.sig === sig) return cached.points

  const smoothed = catmullRomInterpolate(points, tension, segments)

  // Evict oldest entries if cache is full
  if (smoothedCache.size >= MAX_CACHE_SIZE) {
    const firstKey = smoothedCache.keys().next().value
    if (firstKey !== undefined) {
      smoothedCache.delete(firstKey)
    }
  }

  smoothedCache.set(strokeId, { sig, points: smoothed })
  return smoothed
}

/**
 * Clear the smoothed points cache.
 * Call when switching pages or clearing the board.
 */
export function clearSmoothedCache(): void {
  smoothedCache.clear()
}
