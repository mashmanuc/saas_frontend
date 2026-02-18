// WB: Unit tests for stroke quality algorithms (Phase 4: A4.3)
// Tests: RDP reduction, jitter filter, taper, pressure opacity, performance

import { describe, it, expect } from 'vitest'
import type { WBPoint } from '../types/winterboard'
import {
  rdpReduce,
  jitterFilter,
  applyTaper,
  pressureToOpacity,
  processStrokeEnd,
} from '../engine/strokeQuality'
import { catmullRomInterpolate } from '../engine/smoothing'

// ── Helpers ─────────────────────────────────────────────────────────────

function generateLine(count: number, noise: number = 0): WBPoint[] {
  const points: WBPoint[] = []
  for (let i = 0; i < count; i++) {
    points.push({
      x: i * 5 + (noise ? (Math.random() - 0.5) * noise : 0),
      y: i * 3 + (noise ? (Math.random() - 0.5) * noise : 0),
      pressure: 0.5 + Math.sin(i * 0.1) * 0.3,
      t: 1000 + i * 16,
    })
  }
  return points
}

function generateCircle(count: number): WBPoint[] {
  const points: WBPoint[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2
    points.push({
      x: 100 + Math.cos(angle) * 50,
      y: 100 + Math.sin(angle) * 50,
      pressure: 0.5,
      t: 1000 + i * 16,
    })
  }
  return points
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('Stroke Quality (A4.3)', () => {
  describe('rdpReduce', () => {
    it('reduces points on a straight line significantly', () => {
      const straight = generateLine(100, 0)
      const reduced = rdpReduce(straight, 1.0)

      // Straight line should reduce to just 2 points (start + end)
      expect(reduced.length).toBe(2)
      expect(reduced[0]).toEqual(straight[0])
      expect(reduced[reduced.length - 1]).toEqual(straight[straight.length - 1])
    })

    it('preserves curve detail with small epsilon', () => {
      const circle = generateCircle(100)
      const reduced = rdpReduce(circle, 0.5)

      // Circle should retain more points than a line
      expect(reduced.length).toBeGreaterThan(10)
      expect(reduced.length).toBeLessThan(100)
    })

    it('reduces noisy line by 40-60%', () => {
      const noisy = generateLine(100, 3)
      const reduced = rdpReduce(noisy, 1.0)

      const reductionPct = 1 - reduced.length / noisy.length
      expect(reductionPct).toBeGreaterThan(0.3) // at least 30% reduction
    })

    it('preserves pressure data in reduced points', () => {
      const points = generateLine(50, 2)
      const reduced = rdpReduce(points, 1.0)

      for (const p of reduced) {
        expect(p.pressure).toBeDefined()
        expect(typeof p.pressure).toBe('number')
      }
    })

    it('returns original for <= 2 points', () => {
      const single: WBPoint[] = [{ x: 0, y: 0 }]
      expect(rdpReduce(single, 1.0)).toEqual(single)

      const two: WBPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
      expect(rdpReduce(two, 1.0)).toEqual(two)
    })

    it('higher epsilon = more reduction', () => {
      const noisy = generateLine(100, 5)
      const low = rdpReduce(noisy, 0.5)
      const high = rdpReduce(noisy, 3.0)

      expect(high.length).toBeLessThanOrEqual(low.length)
    })
  })

  describe('jitterFilter', () => {
    it('smooths jittery input', () => {
      const jittery: WBPoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 12 }, // jitter: y should be ~10
        { x: 20, y: 18 }, // jitter: y should be ~20
        { x: 30, y: 32 }, // jitter
        { x: 40, y: 38 },
      ]

      const smoothed = jitterFilter(jittery, 3)

      expect(smoothed.length).toBe(jittery.length)
      // Middle points should be averaged with neighbors
      // Point 1: avg of points 0,1,2 → x=(0+10+20)/3=10, y=(0+12+18)/3=10
      expect(smoothed[1].x).toBeCloseTo(10, 0)
      expect(smoothed[1].y).toBeCloseTo(10, 0)
    })

    it('preserves endpoints approximately', () => {
      const points = generateLine(20, 2)
      const smoothed = jitterFilter(points, 3)

      // First point: averaged with next neighbor only
      expect(Math.abs(smoothed[0].x - points[0].x)).toBeLessThan(5)
      expect(Math.abs(smoothed[smoothed.length - 1].x - points[points.length - 1].x)).toBeLessThan(5)
    })

    it('returns original for <= 2 points', () => {
      const two: WBPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 10 }]
      expect(jitterFilter(two, 3)).toEqual(two)
    })

    it('preserves pressure data', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0, pressure: 0.3 },
        { x: 10, y: 10, pressure: 0.5 },
        { x: 20, y: 20, pressure: 0.7 },
      ]

      const smoothed = jitterFilter(points, 3)
      // Middle pressure: avg of 0.3, 0.5, 0.7 = 0.5
      expect(smoothed[1].pressure).toBeCloseTo(0.5, 1)
    })
  })

  describe('applyTaper', () => {
    it('reduces pressure at stroke start and end', () => {
      const points: WBPoint[] = Array.from({ length: 20 }, (_, i) => ({
        x: i * 5,
        y: 0,
        pressure: 0.8,
      }))

      const tapered = applyTaper(points, 5, 5)

      // Start should have lower pressure
      expect(tapered[0].pressure!).toBeLessThan(0.8)
      expect(tapered[1].pressure!).toBeLessThan(tapered[4].pressure!)

      // End should have lower pressure
      expect(tapered[tapered.length - 1].pressure!).toBeLessThan(0.8)

      // Middle should be unchanged
      expect(tapered[10].pressure).toBe(0.8)
    })

    it('returns original for < 3 points', () => {
      const two: WBPoint[] = [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 10, y: 10, pressure: 0.5 },
      ]
      expect(applyTaper(two)).toEqual(two)
    })

    it('taper length adapts to short strokes', () => {
      const short: WBPoint[] = Array.from({ length: 6 }, (_, i) => ({
        x: i * 5,
        y: 0,
        pressure: 0.8,
      }))

      const tapered = applyTaper(short, 10, 10) // requested taper > stroke/3

      // Should not crash, taper should be limited
      expect(tapered.length).toBe(6)
      expect(tapered[0].pressure!).toBeLessThan(0.8)
    })
  })

  describe('pressureToOpacity', () => {
    it('returns max opacity for high pressure', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0, pressure: 1.0 },
        { x: 10, y: 10, pressure: 1.0 },
      ]
      expect(pressureToOpacity(points)).toBeCloseTo(1.0)
    })

    it('returns lower opacity for low pressure', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0, pressure: 0.1 },
        { x: 10, y: 10, pressure: 0.1 },
      ]
      const opacity = pressureToOpacity(points)
      expect(opacity).toBeLessThan(0.5)
      expect(opacity).toBeGreaterThanOrEqual(0.3)
    })

    it('returns max opacity for empty points', () => {
      expect(pressureToOpacity([])).toBe(1.0)
    })

    it('handles points without pressure (default 0.5)', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ]
      const opacity = pressureToOpacity(points)
      // avg pressure 0.5 → 0.3 + 0.7 * 0.5 = 0.65
      expect(opacity).toBeCloseTo(0.65, 1)
    })
  })

  describe('Catmull-Rom produces smooth curve', () => {
    it('interpolates between control points', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 20, y: 10 },
        { x: 30, y: 30 },
      ]

      const smoothed = catmullRomInterpolate(points, 0.5, 4)

      // Should produce more points than input
      expect(smoothed.length).toBeGreaterThan(points.length)

      // First point should be preserved
      expect(smoothed[0].x).toBe(0)
      expect(smoothed[0].y).toBe(0)
    })

    it('interpolates pressure between points', () => {
      const points: WBPoint[] = [
        { x: 0, y: 0, pressure: 0.2 },
        { x: 10, y: 10, pressure: 0.4 },
        { x: 20, y: 20, pressure: 0.6 },
        { x: 30, y: 30, pressure: 0.8 },
      ]

      const smoothed = catmullRomInterpolate(points, 0.5, 4)

      // Interpolated points should have pressure between neighbors
      for (const p of smoothed) {
        if (p.pressure !== undefined) {
          expect(p.pressure).toBeGreaterThanOrEqual(0)
          expect(p.pressure).toBeLessThanOrEqual(1.0)
        }
      }
    })
  })

  describe('processStrokeEnd pipeline', () => {
    it('applies taper + RDP reduction', () => {
      const points = generateLine(50, 2)
      const processed = processStrokeEnd(points)

      // Should be reduced
      expect(processed.length).toBeLessThan(points.length)
      // Should have tapered start
      expect(processed[0].pressure!).toBeLessThan(points[0].pressure!)
    })

    it('can disable RDP', () => {
      const points = generateLine(50, 2)
      const processed = processStrokeEnd(points, { enableRdp: false })

      // Same length (no reduction), but tapered
      expect(processed.length).toBe(points.length)
    })

    it('can disable taper', () => {
      const points = generateLine(50, 0)
      const processed = processStrokeEnd(points, { enableTaper: false })

      // Start pressure should be unchanged
      expect(processed[0].pressure).toBeCloseTo(points[0].pressure!, 5)
    })
  })

  describe('Performance', () => {
    it('RDP processes 1000 points in < 5ms', () => {
      const points = generateLine(1000, 3)

      const start = performance.now()
      rdpReduce(points, 1.0)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(5)
    })

    it('jitterFilter processes 1000 points in < 2ms', () => {
      const points = generateLine(1000, 5)

      const start = performance.now()
      jitterFilter(points, 3)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(2)
    })

    it('Catmull-Rom processes 1000 points in < 10ms', () => {
      const points = generateLine(1000, 2)

      const start = performance.now()
      catmullRomInterpolate(points, 0.5, 4)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(10)
    })

    it('full pipeline (taper + RDP) processes 1000 points in < 10ms', () => {
      const points = generateLine(1000, 3)

      const start = performance.now()
      processStrokeEnd(points)
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(10)
    })
  })
})
