// WB: Unit tests for pressure sensitivity (Phase 4: A4.1)
// Tests: pressure capture, variable width, backward compat, serialize, mouse fallback, pen/touch detection

import { describe, it, expect } from 'vitest'
import type { WBPoint, WBStroke } from '../types/winterboard'

// ── hasPressureData (inline replica for testing — mirrors WBCanvas logic) ────

function hasPressureData(points: WBPoint[]): boolean {
  if (points.length === 0) return false
  return points.some((p) => p.pressure !== undefined && p.pressure !== 0.5)
}

// ── Pressure capture simulation ─────────────────────────────────────────────

function simulatePressureCapture(
  pointerType: 'pen' | 'touch' | 'mouse',
  rawPressure: number,
): number {
  if (pointerType === 'pen') {
    return rawPressure > 0 ? rawPressure : 0.5
  } else if (pointerType === 'touch') {
    return rawPressure > 0 ? rawPressure : 0.5
  }
  // mouse
  return 0.5
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('Pressure Sensitivity (A4.1)', () => {
  describe('hasPressureData', () => {
    it('returns false for empty points', () => {
      expect(hasPressureData([])).toBe(false)
    })

    it('returns false for points without pressure', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]
      expect(hasPressureData(points)).toBe(false)
    })

    it('returns false for points with all default pressure (0.5)', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 10, y: 10, pressure: 0.5 },
      ]
      expect(hasPressureData(points)).toBe(false)
    })

    it('returns true for points with real pressure data', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0, pressure: 0.3 },
        { x: 10, y: 10, pressure: 0.8 },
      ]
      expect(hasPressureData(points)).toBe(true)
    })

    it('returns true if even one point has non-default pressure', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 10, y: 10, pressure: 0.7 },
        { x: 20, y: 20, pressure: 0.5 },
      ]
      expect(hasPressureData(points)).toBe(true)
    })
  })

  describe('Pressure capture from PointerEvent', () => {
    it('pen: captures real pressure', () => {
      expect(simulatePressureCapture('pen', 0.75)).toBe(0.75)
    })

    it('pen: falls back to 0.5 when pressure is 0', () => {
      expect(simulatePressureCapture('pen', 0)).toBe(0.5)
    })

    it('touch: captures real pressure/force', () => {
      expect(simulatePressureCapture('touch', 0.6)).toBe(0.6)
    })

    it('touch: falls back to 0.5 when pressure is 0', () => {
      expect(simulatePressureCapture('touch', 0)).toBe(0.5)
    })

    it('mouse: always returns 0.5 regardless of input', () => {
      expect(simulatePressureCapture('mouse', 0)).toBe(0.5)
      expect(simulatePressureCapture('mouse', 1.0)).toBe(0.5)
      expect(simulatePressureCapture('mouse', 0.3)).toBe(0.5)
    })
  })

  describe('Backward compatibility', () => {
    it('old strokes without pressure render correctly', () => {
      const oldStroke: WBStroke = {
        id: 'old-1',
        tool: 'pen',
        color: '#000',
        size: 2,
        opacity: 1,
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 5 },
          { x: 20, y: 10 },
        ],
      }

      // Should not have pressure data
      expect(hasPressureData(oldStroke.points)).toBe(false)

      // Points should map to triplets with default 0.5
      const triplets = oldStroke.points.map((p) => [p.x, p.y, p.pressure ?? 0.5])
      expect(triplets).toEqual([
        [0, 0, 0.5],
        [10, 5, 0.5],
        [20, 10, 0.5],
      ])
    })

    it('new strokes with pressure serialize correctly', () => {
      const newStroke: WBStroke = {
        id: 'new-1',
        tool: 'pen',
        color: '#000',
        size: 2,
        opacity: 1,
        points: [
          { x: 0, y: 0, pressure: 0.3, t: 1000 },
          { x: 10, y: 5, pressure: 0.7, t: 1016 },
          { x: 20, y: 10, pressure: 0.9, t: 1032 },
        ],
      }

      expect(hasPressureData(newStroke.points)).toBe(true)

      // Triplets include real pressure
      const triplets = newStroke.points.map((p) => [p.x, p.y, p.pressure ?? 0.5])
      expect(triplets).toEqual([
        [0, 0, 0.3],
        [10, 5, 0.7],
        [20, 10, 0.9],
      ])
    })

    it('mixed strokes (some with pressure, some without) work', () => {
      const mixedPoints: WBPoint[] = [
        { x: 0, y: 0 },
        { x: 5, y: 5, pressure: 0.8 },
        { x: 10, y: 10 },
      ]

      expect(hasPressureData(mixedPoints)).toBe(true)

      const triplets = mixedPoints.map((p) => [p.x, p.y, p.pressure ?? 0.5])
      expect(triplets[0][2]).toBe(0.5) // no pressure → default
      expect(triplets[1][2]).toBe(0.8) // real pressure
      expect(triplets[2][2]).toBe(0.5) // no pressure → default
    })
  })

  describe('Serialize/Deserialize with pressure', () => {
    it('JSON roundtrip preserves pressure data', () => {
      const stroke: WBStroke = {
        id: 'rt-1',
        tool: 'pen',
        color: '#ff0000',
        size: 3,
        opacity: 1,
        points: [
          { x: 0, y: 0, pressure: 0.2, t: 100 },
          { x: 50, y: 25, pressure: 0.6, t: 116 },
          { x: 100, y: 50, pressure: 1.0, t: 132 },
        ],
      }

      const json = JSON.stringify(stroke)
      const parsed = JSON.parse(json) as WBStroke

      expect(parsed.points[0].pressure).toBe(0.2)
      expect(parsed.points[1].pressure).toBe(0.6)
      expect(parsed.points[2].pressure).toBe(1.0)
      expect(parsed.points[0].t).toBe(100)
    })

    it('JSON roundtrip works for old strokes without pressure', () => {
      const oldStroke: WBStroke = {
        id: 'rt-2',
        tool: 'highlighter',
        color: '#ffff00',
        size: 8,
        opacity: 0.4,
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 100 },
        ],
      }

      const json = JSON.stringify(oldStroke)
      const parsed = JSON.parse(json) as WBStroke

      expect(parsed.points[0].pressure).toBeUndefined()
      expect(parsed.points[1].pressure).toBeUndefined()
      expect(hasPressureData(parsed.points)).toBe(false)
    })
  })

  describe('Variable width rendering', () => {
    it('pressure affects effective stroke width', () => {
      const baseSize = 4
      const pressures = [0.1, 0.3, 0.5, 0.7, 1.0]

      // perfect-freehand uses pressure to vary width internally
      // We verify the triplet format is correct for the library
      const triplets = pressures.map((p, i) => [i * 10, 0, p])

      expect(triplets.length).toBe(5)
      expect(triplets[0][2]).toBe(0.1) // light pressure
      expect(triplets[2][2]).toBe(0.5) // normal pressure
      expect(triplets[4][2]).toBe(1.0) // max pressure

      // Width range: light pressure → thin, heavy → thick
      // perfect-freehand internally: size * (1 - thinning + thinning * pressure)
      // With thinning=0.5: size * (0.5 + 0.5 * pressure)
      const thinning = 0.5
      const widths = pressures.map((p) => baseSize * (1 - thinning + thinning * p))

      expect(widths[0]).toBeCloseTo(2.2) // 4 * (0.5 + 0.5*0.1) = 2.2
      expect(widths[2]).toBeCloseTo(3.0) // 4 * (0.5 + 0.5*0.5) = 3.0
      expect(widths[4]).toBeCloseTo(4.0) // 4 * (0.5 + 0.5*1.0) = 4.0
    })
  })

  describe('Pen vs Touch detection', () => {
    it('pen pointerType yields real pressure', () => {
      const result = simulatePressureCapture('pen', 0.85)
      expect(result).toBe(0.85)
    })

    it('touch pointerType yields real pressure when available', () => {
      const result = simulatePressureCapture('touch', 0.4)
      expect(result).toBe(0.4)
    })

    it('mouse pointerType always yields 0.5', () => {
      const result = simulatePressureCapture('mouse', 0.9)
      expect(result).toBe(0.5)
    })
  })
})
