// WB Responsive Phase 5 A8: Tests for performance budgets per device mode
// Ref: winterboard_dev/responsive/PHASE5.md A8

import { describe, it, expect } from 'vitest'
import {
  PERFORMANCE_BUDGETS,
  getPerformanceBudget,
  type PerformanceBudget,
} from '../engine/performanceBudget'
import type { DeviceMode } from '../types/responsive'

const ALL_MODES: DeviceMode[] = ['mobile', 'tablet', 'desktop', 'display']

describe('PERFORMANCE_BUDGETS (Phase 5 A8)', () => {
  it('has all four device modes', () => {
    for (const mode of ALL_MODES) {
      expect(PERFORMANCE_BUDGETS[mode]).toBeDefined()
    }
  })

  it('all budgets have required fields', () => {
    const requiredKeys: (keyof PerformanceBudget)[] = [
      'maxStrokesRendered', 'maxAssetsLoaded', 'spatialGridSize',
      'konvaPixelRatio', 'smoothingPoints', 'maxUndoStack',
      'idleFps', 'cursorThrottleMs', 'autosaveIntervalMs', 'flattenBatchSize',
    ]
    for (const mode of ALL_MODES) {
      for (const key of requiredKeys) {
        expect(PERFORMANCE_BUDGETS[mode][key]).toBeDefined()
        expect(typeof PERFORMANCE_BUDGETS[mode][key]).toBe('number')
        expect(PERFORMANCE_BUDGETS[mode][key]).toBeGreaterThan(0)
      }
    }
  })

  it('mobile has fewest maxStrokesRendered', () => {
    expect(PERFORMANCE_BUDGETS.mobile.maxStrokesRendered)
      .toBeLessThan(PERFORMANCE_BUDGETS.desktop.maxStrokesRendered)
  })

  it('mobile has konvaPixelRatio 1 (battery saving)', () => {
    expect(PERFORMANCE_BUDGETS.mobile.konvaPixelRatio).toBe(1)
  })

  it('desktop has konvaPixelRatio 2 (retina)', () => {
    expect(PERFORMANCE_BUDGETS.desktop.konvaPixelRatio).toBe(2)
  })

  it('mobile has lowest idleFps (LAW-23 battery)', () => {
    expect(PERFORMANCE_BUDGETS.mobile.idleFps)
      .toBeLessThanOrEqual(PERFORMANCE_BUDGETS.tablet.idleFps)
    expect(PERFORMANCE_BUDGETS.mobile.idleFps)
      .toBeLessThan(PERFORMANCE_BUDGETS.desktop.idleFps)
  })

  it('mobile has highest cursorThrottleMs (LAW-16)', () => {
    expect(PERFORMANCE_BUDGETS.mobile.cursorThrottleMs)
      .toBeGreaterThanOrEqual(PERFORMANCE_BUDGETS.desktop.cursorThrottleMs)
  })

  it('mobile has highest autosaveIntervalMs (network saving)', () => {
    expect(PERFORMANCE_BUDGETS.mobile.autosaveIntervalMs)
      .toBeGreaterThanOrEqual(PERFORMANCE_BUDGETS.desktop.autosaveIntervalMs)
  })

  it('mobile has smallest undo stack', () => {
    expect(PERFORMANCE_BUDGETS.mobile.maxUndoStack)
      .toBeLessThan(PERFORMANCE_BUDGETS.desktop.maxUndoStack)
  })

  it('mobile has fewest smoothing points (speed)', () => {
    expect(PERFORMANCE_BUDGETS.mobile.smoothingPoints)
      .toBeLessThan(PERFORMANCE_BUDGETS.desktop.smoothingPoints)
  })

  it('display has largest spatialGridSize', () => {
    expect(PERFORMANCE_BUDGETS.display.spatialGridSize)
      .toBeGreaterThanOrEqual(PERFORMANCE_BUDGETS.desktop.spatialGridSize)
  })
})

describe('getPerformanceBudget (Phase 5 A8)', () => {
  it('returns correct budget for each mode', () => {
    for (const mode of ALL_MODES) {
      expect(getPerformanceBudget(mode)).toEqual(PERFORMANCE_BUDGETS[mode])
    }
  })

  it('falls back to desktop for unknown mode', () => {
    const result = getPerformanceBudget('unknown' as DeviceMode)
    expect(result).toEqual(PERFORMANCE_BUDGETS.desktop)
  })
})
