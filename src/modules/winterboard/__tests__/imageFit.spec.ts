// WB: Tests for containFit — aspect-preserving page-background fit (no stretch).
import { describe, it, expect } from 'vitest'
import { containFit } from '../engine/imageFit'

describe('containFit', () => {
  it('fits a portrait page into a landscape board BY HEIGHT, centered, no stretch', () => {
    // A4 portrait PDF (1241×1754) into the default landscape board (1920×1080)
    const fit = containFit(1241, 1754, 1920, 1080)

    // Constrained by height → fills height exactly, leaves side margins.
    expect(fit.height).toBeCloseTo(1080, 5)
    expect(fit.width).toBeLessThan(1920)
    expect(fit.y).toBeCloseTo(0, 5)
    expect(fit.x).toBeGreaterThan(0)
    // Centered horizontally.
    expect(fit.x).toBeCloseTo((1920 - fit.width) / 2, 5)
    // No stretch: output aspect ratio equals input aspect ratio.
    expect(fit.width / fit.height).toBeCloseTo(1241 / 1754, 5)
  })

  it('fits a landscape page into a portrait board BY WIDTH', () => {
    const fit = containFit(1754, 1241, 1080, 1920)
    expect(fit.width).toBeCloseTo(1080, 5)
    expect(fit.height).toBeLessThan(1920)
    expect(fit.x).toBeCloseTo(0, 5)
    expect(fit.y).toBeGreaterThan(0)
    expect(fit.width / fit.height).toBeCloseTo(1754 / 1241, 5)
  })

  it('fills the box exactly when aspect ratios match', () => {
    const fit = containFit(1000, 1000, 500, 500)
    expect(fit).toEqual({ x: 0, y: 0, width: 500, height: 500 })
  })

  it('preserves aspect ratio for any input (never stretches)', () => {
    const cases: Array<[number, number]> = [
      [800, 600], [600, 800], [1920, 1080], [100, 1000], [1241, 1754],
    ]
    for (const [iw, ih] of cases) {
      const fit = containFit(iw, ih, 1920, 1080)
      expect(fit.width / fit.height).toBeCloseTo(iw / ih, 5)
      // Never exceeds the box.
      expect(fit.width).toBeLessThanOrEqual(1920 + 1e-6)
      expect(fit.height).toBeLessThanOrEqual(1080 + 1e-6)
    }
  })

  it('falls back to filling the box when image dimensions are unknown', () => {
    expect(containFit(0, 0, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
    expect(containFit(-1, 100, 1920, 1080)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
  })
})
