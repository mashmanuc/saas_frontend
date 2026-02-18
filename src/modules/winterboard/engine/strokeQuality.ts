// WB: Stroke quality algorithms — RDP reduction, jitter removal, taper
// Ref: TASK_BOARD_PHASES.md A4.3, LAW-15 (drawing fidelity)
// Applied: RDP on stroke end (before save), jitter during capture (real-time)

import type { WBPoint } from '../types/winterboard'

// ─── Ramer-Douglas-Peucker Point Reduction ──────────────────────────────────

/**
 * Perpendicular distance from point `p` to the line segment `start`→`end`.
 */
function perpendicularDistance(p: WBPoint, start: WBPoint, end: WBPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lenSq = dx * dx + dy * dy

  if (lenSq === 0) {
    // start === end → distance to point
    const ex = p.x - start.x
    const ey = p.y - start.y
    return Math.sqrt(ex * ex + ey * ey)
  }

  const t = Math.max(0, Math.min(1, ((p.x - start.x) * dx + (p.y - start.y) * dy) / lenSq))
  const projX = start.x + t * dx
  const projY = start.y + t * dy
  const ex = p.x - projX
  const ey = p.y - projY
  return Math.sqrt(ex * ex + ey * ey)
}

/**
 * Ramer-Douglas-Peucker algorithm for point reduction.
 *
 * Reduces point count by 40-60% without visible quality loss.
 * Preserves pressure and timestamp data.
 *
 * @param points - Original stroke points
 * @param epsilon - Distance tolerance (higher = more reduction). Default 1.0
 * @returns Reduced array of WBPoints
 */
export function rdpReduce(points: WBPoint[], epsilon: number = 1.0): WBPoint[] {
  if (points.length <= 2) return points

  // Find the point with the maximum distance from the line start→end
  let maxDist = 0
  let maxIdx = 0
  const start = points[0]
  const end = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end)
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }

  // If max distance exceeds epsilon, recursively simplify
  if (maxDist > epsilon) {
    const left = rdpReduce(points.slice(0, maxIdx + 1), epsilon)
    const right = rdpReduce(points.slice(maxIdx), epsilon)
    // Combine (remove duplicate at junction)
    return [...left.slice(0, -1), ...right]
  }

  // All points within tolerance — keep only endpoints
  return [start, end]
}

// ─── Jitter Removal (Moving Average Filter) ─────────────────────────────────

/**
 * Moving average filter for jitter removal.
 *
 * Smooths shaky input by averaging each point with its neighbors.
 * Applied during capture (real-time) to reduce noise from touch devices.
 *
 * @param points - Raw input points
 * @param windowSize - Number of points in the averaging window. Default 3
 * @returns Smoothed array of WBPoints (same length as input)
 */
export function jitterFilter(points: WBPoint[], windowSize: number = 3): WBPoint[] {
  if (points.length <= 2 || windowSize < 2) return points

  const half = Math.floor(windowSize / 2)
  const result: WBPoint[] = []

  for (let i = 0; i < points.length; i++) {
    let sumX = 0
    let sumY = 0
    let sumP = 0
    let count = 0

    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      sumX += points[j].x
      sumY += points[j].y
      sumP += points[j].pressure ?? 0.5
      count++
    }

    result.push({
      x: sumX / count,
      y: sumY / count,
      pressure: sumP / count,
      t: points[i].t,
    })
  }

  return result
}

// ─── Stroke Taper ───────────────────────────────────────────────────────────

/**
 * Apply taper effect to stroke start and end.
 *
 * Gradually reduces pressure at the beginning and end of a stroke
 * to create natural-looking thin edges.
 *
 * @param points - Stroke points with pressure
 * @param taperStart - Number of points to taper at start. Default 5
 * @param taperEnd - Number of points to taper at end. Default 5
 * @returns Points with tapered pressure values
 */
export function applyTaper(
  points: WBPoint[],
  taperStart: number = 5,
  taperEnd: number = 5,
): WBPoint[] {
  if (points.length < 3) return points

  const result = points.map((p) => ({ ...p }))
  const effectiveStart = Math.min(taperStart, Math.floor(points.length / 3))
  const effectiveEnd = Math.min(taperEnd, Math.floor(points.length / 3))

  // Taper start: ease-in pressure
  for (let i = 0; i < effectiveStart; i++) {
    const t = (i + 1) / (effectiveStart + 1)
    // Ease-in cubic
    const factor = t * t * t
    result[i].pressure = (result[i].pressure ?? 0.5) * factor
  }

  // Taper end: ease-out pressure
  for (let i = 0; i < effectiveEnd; i++) {
    const idx = points.length - 1 - i
    const t = (i + 1) / (effectiveEnd + 1)
    // Ease-out cubic
    const factor = t * t * t
    result[idx].pressure = (result[idx].pressure ?? 0.5) * factor
  }

  return result
}

// ─── Pressure-based Opacity ─────────────────────────────────────────────────

/**
 * Calculate opacity based on average pressure of a stroke.
 *
 * Light pressure → semi-transparent, heavy pressure → fully opaque.
 *
 * @param points - Stroke points
 * @param minOpacity - Minimum opacity. Default 0.3
 * @param maxOpacity - Maximum opacity. Default 1.0
 * @returns Opacity value between minOpacity and maxOpacity
 */
export function pressureToOpacity(
  points: WBPoint[],
  minOpacity: number = 0.3,
  maxOpacity: number = 1.0,
): number {
  if (points.length === 0) return maxOpacity

  const avgPressure =
    points.reduce((sum, p) => sum + (p.pressure ?? 0.5), 0) / points.length

  return minOpacity + (maxOpacity - minOpacity) * avgPressure
}

// ─── Pipeline: Process stroke on end ────────────────────────────────────────

export interface StrokeQualityOptions {
  enableRdp?: boolean
  rdpEpsilon?: number
  enableTaper?: boolean
  taperStart?: number
  taperEnd?: number
}

const DEFAULT_OPTIONS: Required<StrokeQualityOptions> = {
  enableRdp: true,
  rdpEpsilon: 1.0,
  enableTaper: true,
  taperStart: 5,
  taperEnd: 5,
}

/**
 * Process stroke points on stroke end (before save).
 *
 * Pipeline:
 * 1. Apply taper (thin edges)
 * 2. RDP point reduction (reduce storage)
 *
 * @param points - Raw stroke points
 * @param options - Processing options
 * @returns Processed points
 */
export function processStrokeEnd(
  points: WBPoint[],
  options: StrokeQualityOptions = {},
): WBPoint[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let result = points

  // 1. Taper
  if (opts.enableTaper && result.length >= 6) {
    result = applyTaper(result, opts.taperStart, opts.taperEnd)
  }

  // 2. RDP reduction
  if (opts.enableRdp && result.length > 10) {
    result = rdpReduce(result, opts.rdpEpsilon)
  }

  return result
}
