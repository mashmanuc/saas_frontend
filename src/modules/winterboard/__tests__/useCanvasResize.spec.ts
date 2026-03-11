// WB Responsive: Unit tests for useCanvasResize viewport transform functions
// Ref: winterboard_dev/responsive/PHASE1.md A2
// INV-1: Canvas NEVER resizes — only stage.scale() + stage.position()

import { describe, it, expect } from 'vitest'
import {
  calculateFitZoom,
  calculateCenterOffset,
  clampZoom,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../composables/useCanvasResize'

// ── Constants ───────────────────────────────────────────────────────

describe('Canvas resize constants', () => {
  it('PAGE_WIDTH is 1920', () => {
    expect(PAGE_WIDTH).toBe(1920)
  })

  it('PAGE_HEIGHT is 1080', () => {
    expect(PAGE_HEIGHT).toBe(1080)
  })

  it('MIN_ZOOM is 0.1', () => {
    expect(MIN_ZOOM).toBe(0.1)
  })

  it('MAX_ZOOM is 5.0', () => {
    expect(MAX_ZOOM).toBe(5.0)
  })
})

// ── calculateFitZoom ────────────────────────────────────────────────

describe('calculateFitZoom (INV-1: for stage.scale() only)', () => {
  it('returns 1 for exact page size container', () => {
    const zoom = calculateFitZoom(1920, 1080)
    expect(zoom).toBe(1)
  })

  it('returns < 1 for smaller container (mobile)', () => {
    const zoom = calculateFitZoom(375, 667)
    expect(zoom).toBeLessThan(1)
    expect(zoom).toBeGreaterThan(0)
    // 375/1920 ≈ 0.195, 667/1080 ≈ 0.617 → min = 0.195
    expect(zoom).toBeCloseTo(375 / 1920, 5)
  })

  it('returns < 1 for tablet container', () => {
    const zoom = calculateFitZoom(768, 1024)
    expect(zoom).toBeLessThan(1)
    // 768/1920 = 0.4, 1024/1080 ≈ 0.948 → min = 0.4
    expect(zoom).toBeCloseTo(0.4, 5)
  })

  it('returns > 1 for larger-than-page container', () => {
    const zoom = calculateFitZoom(3840, 2160)
    expect(zoom).toBe(2)
  })

  it('returns 1 for zero container width', () => {
    expect(calculateFitZoom(0, 1080)).toBe(1)
  })

  it('returns 1 for zero container height', () => {
    expect(calculateFitZoom(1920, 0)).toBe(1)
  })

  it('returns 1 for negative dimensions', () => {
    expect(calculateFitZoom(-100, -100)).toBe(1)
  })

  it('uses custom page dimensions when provided', () => {
    const zoom = calculateFitZoom(800, 600, 800, 600)
    expect(zoom).toBe(1)
  })

  it('respects landscape vs portrait containers', () => {
    const landscapeZoom = calculateFitZoom(1280, 720)
    const portraitZoom = calculateFitZoom(720, 1280)
    // Portrait container is narrower → smaller zoom
    expect(portraitZoom).toBeLessThan(landscapeZoom)
  })
})

// ── clampZoom ───────────────────────────────────────────────────────

describe('clampZoom', () => {
  it('returns value within bounds', () => {
    expect(clampZoom(1)).toBe(1)
    expect(clampZoom(0.5)).toBe(0.5)
    expect(clampZoom(3)).toBe(3)
  })

  it('clamps below MIN_ZOOM', () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM)
    expect(clampZoom(-1)).toBe(MIN_ZOOM)
    expect(clampZoom(0.05)).toBe(MIN_ZOOM)
  })

  it('clamps above MAX_ZOOM', () => {
    expect(clampZoom(10)).toBe(MAX_ZOOM)
    expect(clampZoom(100)).toBe(MAX_ZOOM)
    expect(clampZoom(5.1)).toBe(MAX_ZOOM)
  })

  it('returns exact boundary values', () => {
    expect(clampZoom(MIN_ZOOM)).toBe(MIN_ZOOM)
    expect(clampZoom(MAX_ZOOM)).toBe(MAX_ZOOM)
  })
})

// ── calculateCenterOffset ───────────────────────────────────────────

describe('calculateCenterOffset (INV-1: for stage.position() only)', () => {
  it('returns {0,0} when page fills container exactly', () => {
    const offset = calculateCenterOffset(1920, 1080, 1920, 1080, 1)
    expect(offset.x).toBe(0)
    expect(offset.y).toBe(0)
  })

  it('returns positive x offset when container is wider', () => {
    const offset = calculateCenterOffset(2000, 1080, 1920, 1080, 1)
    expect(offset.x).toBe(40) // (2000-1920)/2
    expect(offset.y).toBe(0)
  })

  it('returns positive y offset when container is taller', () => {
    const offset = calculateCenterOffset(1920, 1200, 1920, 1080, 1)
    expect(offset.x).toBe(0)
    expect(offset.y).toBe(60) // (1200-1080)/2
  })

  it('centers both axes in oversized container', () => {
    const offset = calculateCenterOffset(2000, 1200, 1920, 1080, 1)
    expect(offset.x).toBe(40)
    expect(offset.y).toBe(60)
  })

  it('returns {0,0} when scaled page exceeds container', () => {
    // Page at zoom 2 = 3840x2160, container is 1920x1080
    const offset = calculateCenterOffset(1920, 1080, 1920, 1080, 2)
    expect(offset.x).toBe(0)
    expect(offset.y).toBe(0)
  })

  it('handles zoom < 1 correctly', () => {
    // Page at zoom 0.5 = 960x540, container is 1920x1080
    const offset = calculateCenterOffset(1920, 1080, 1920, 1080, 0.5)
    expect(offset.x).toBe(480) // (1920-960)/2
    expect(offset.y).toBe(270) // (1080-540)/2
  })

  it('handles mobile viewport', () => {
    // Mobile: 375x667, page 1920x1080, fitZoom ≈ 0.195
    const fitZoom = Math.min(375 / 1920, 667 / 1080)
    const offset = calculateCenterOffset(375, 667, 1920, 1080, fitZoom)
    // Horizontally fits exactly → x ≈ 0
    expect(offset.x).toBeCloseTo(0, 0)
    // Vertically has spare space
    expect(offset.y).toBeGreaterThan(0)
  })
})

// ── boardStore viewport getters (integration-like pure tests) ───────

describe('boardStore viewport calculations', () => {
  it('optimalZoom matches calculateFitZoom', () => {
    const cw = 1280
    const ch = 720
    const pw = 1920
    const ph = 1080
    const optimalZoom = Math.min(cw / pw, ch / ph)
    const fitZoom = calculateFitZoom(cw, ch, pw, ph)
    expect(optimalZoom).toBeCloseTo(fitZoom, 10)
  })

  it('viewportOffset centers page when zoom < fitZoom', () => {
    const cw = 1280
    const ch = 720
    const pw = 1920
    const ph = 1080
    const zoom = 0.5
    const scaledW = pw * zoom
    const scaledH = ph * zoom
    const offset = {
      x: Math.max(0, (cw - scaledW) / 2),
      y: Math.max(0, (ch - scaledH) / 2),
    }
    expect(offset.x).toBe((1280 - 960) / 2) // 160
    expect(offset.y).toBe((720 - 540) / 2) // 90
  })
})
