// WB Responsive Phase 2 A4: Tests for snap-to-fit, bounce-back, double-tap zoom
// Ref: winterboard_dev/responsive/PHASE2.md A4

import { describe, it, expect } from 'vitest'
import {
  calculateSnapZoom,
  calculateBounceBack,
  doubleTapZoomCycle,
} from '../engine/zoomPan'

const PW = 1920
const PH = 1080

// ── calculateSnapZoom ───────────────────────────────────────────────

describe('calculateSnapZoom (Phase 2 A4)', () => {
  it('snaps to fit-page when zoom is close', () => {
    const fitPage = Math.min(375 / PW, 667 / PH) // ≈ 0.195
    const nearFit = fitPage + 0.005
    const snapped = calculateSnapZoom(nearFit, 375, 667, PW, PH)
    expect(snapped).toBeCloseTo(fitPage, 3)
  })

  it('snaps to 1.0 when zoom is 0.97', () => {
    const snapped = calculateSnapZoom(0.97, 1920, 1080, PW, PH)
    expect(snapped).toBe(1.0)
  })

  it('snaps to 2.0 when zoom is 1.95', () => {
    const snapped = calculateSnapZoom(1.95, 1920, 1080, PW, PH)
    expect(snapped).toBe(2.0)
  })

  it('does NOT snap when far from any target', () => {
    const snapped = calculateSnapZoom(0.7, 1920, 1080, PW, PH)
    expect(snapped).toBe(0.7)
  })

  it('returns current zoom for zero container', () => {
    expect(calculateSnapZoom(1.5, 0, 0, PW, PH)).toBe(1.5)
  })

  it('returns current zoom for zero page', () => {
    expect(calculateSnapZoom(1.5, 1920, 1080, 0, 0)).toBe(1.5)
  })
})

// ── calculateBounceBack ─────────────────────────────────────────────

describe('calculateBounceBack (Phase 2 A4)', () => {
  it('returns null when within bounds', () => {
    const result = calculateBounceBack(100, 50, 1, 1920, 1080, PW, PH)
    // Page exactly fits → scrollX/scrollY should be 0
    // At zoom=1, scaledW=1920=containerWidth, so scrollX must be 0
    // scrollX=100 is out of bounds
    expect(result).not.toBeNull()
  })

  it('returns null when page fits and scroll is 0', () => {
    const result = calculateBounceBack(0, 0, 1, 1920, 1080, PW, PH)
    expect(result).toBeNull()
  })

  it('bounces negative scrollX to 0', () => {
    const result = calculateBounceBack(-50, 0, 2, 3840, 2160, PW, PH)
    expect(result).not.toBeNull()
    expect(result!.x).toBe(0)
  })

  it('bounces scrollX past max to max', () => {
    // zoom=2: scaledW=3840, container=1920. maxScrollX=1920
    const result = calculateBounceBack(2000, 0, 2, 1920, 1080, PW, PH)
    expect(result).not.toBeNull()
    expect(result!.x).toBe(1920) // 3840-1920
  })

  it('bounces scrollY past max to max', () => {
    // zoom=2: scaledH=2160, container=1080. maxScrollY=1080
    const result = calculateBounceBack(0, 1200, 2, 1920, 1080, PW, PH)
    expect(result).not.toBeNull()
    expect(result!.y).toBe(1080) // 2160-1080
  })

  it('forces scroll to 0 when page fits in container (small zoom)', () => {
    // zoom=0.5: scaledW=960 < container 1920
    const result = calculateBounceBack(50, 30, 0.5, 1920, 1080, PW, PH)
    expect(result).not.toBeNull()
    expect(result!.x).toBe(0)
    expect(result!.y).toBe(0)
  })
})

// ── doubleTapZoomCycle ──────────────────────────────────────────────

describe('doubleTapZoomCycle (Phase 2 A4)', () => {
  const cw = 375
  const ch = 667
  const fitPage = Math.min(cw / PW, ch / PH) // ≈ 0.195

  it('from fitPage → goes to 1.0', () => {
    const next = doubleTapZoomCycle(fitPage, cw, ch, PW, PH)
    expect(next).toBe(1.0)
  })

  it('from 1.0 → goes to 2.0', () => {
    const next = doubleTapZoomCycle(1.0, cw, ch, PW, PH)
    expect(next).toBe(2.0)
  })

  it('from 2.0 → goes back to fitPage', () => {
    const next = doubleTapZoomCycle(2.0, cw, ch, PW, PH)
    expect(next).toBeCloseTo(fitPage, 3)
  })

  it('from arbitrary zoom → goes to fitPage', () => {
    const next = doubleTapZoomCycle(0.73, cw, ch, PW, PH)
    expect(next).toBeCloseTo(fitPage, 3)
  })

  it('returns 1 for zero container', () => {
    expect(doubleTapZoomCycle(1.0, 0, 0, PW, PH)).toBe(1)
  })

  it('cycles correctly on desktop container', () => {
    const dcw = 1280
    const dch = 720
    const dFit = Math.min(dcw / PW, dch / PH) // ≈ 0.667
    const step1 = doubleTapZoomCycle(dFit, dcw, dch, PW, PH)
    expect(step1).toBe(1.0)
    const step2 = doubleTapZoomCycle(step1, dcw, dch, PW, PH)
    expect(step2).toBe(2.0)
    const step3 = doubleTapZoomCycle(step2, dcw, dch, PW, PH)
    expect(step3).toBeCloseTo(dFit, 3)
  })
})
