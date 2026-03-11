// WB Responsive Phase 2 A3: Tests for adaptive touch gesture thresholds + orientation lock
// Ref: winterboard_dev/responsive/PHASE2.md A3

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import {
  getAdaptiveThresholds,
  type AdaptiveThresholds,
} from '../components/gestures/useTouchGestures'
import type { DeviceMode } from '../types/responsive'

// ── getAdaptiveThresholds ───────────────────────────────────────────

describe('getAdaptiveThresholds (Phase 2 A3)', () => {
  it('returns mobile thresholds for mobile', () => {
    const t = getAdaptiveThresholds('mobile')
    expect(t.panThreshold).toBe(3)
    expect(t.longPressMs).toBe(400)
    expect(t.edgeZonePx).toBe(24)
    expect(t.inertiaFriction).toBe(0.94)
    expect(t.hapticMs).toBe(15)
  })

  it('returns tablet thresholds for tablet', () => {
    const t = getAdaptiveThresholds('tablet')
    expect(t.panThreshold).toBe(5)
    expect(t.longPressMs).toBe(500)
    expect(t.edgeZonePx).toBe(32)
    expect(t.inertiaFriction).toBe(0.92)
  })

  it('returns desktop thresholds for desktop', () => {
    const t = getAdaptiveThresholds('desktop')
    expect(t.panThreshold).toBe(5)
    expect(t.longPressMs).toBe(500)
    expect(t.edgeZonePx).toBe(24)
    expect(t.inertiaFriction).toBe(0.92)
  })

  it('returns display thresholds for display', () => {
    const t = getAdaptiveThresholds('display')
    expect(t.panThreshold).toBe(8)
    expect(t.longPressMs).toBe(600)
    expect(t.edgeZonePx).toBe(48)
    expect(t.inertiaFriction).toBe(0.88)
    expect(t.hapticMs).toBe(20)
  })

  it('mobile has smallest panThreshold', () => {
    const mobile = getAdaptiveThresholds('mobile')
    const desktop = getAdaptiveThresholds('desktop')
    const display = getAdaptiveThresholds('display')
    expect(mobile.panThreshold).toBeLessThan(desktop.panThreshold)
    expect(desktop.panThreshold).toBeLessThan(display.panThreshold)
  })

  it('mobile has fastest long press (shortest ms)', () => {
    const mobile = getAdaptiveThresholds('mobile')
    const tablet = getAdaptiveThresholds('tablet')
    const display = getAdaptiveThresholds('display')
    expect(mobile.longPressMs).toBeLessThan(tablet.longPressMs)
    expect(tablet.longPressMs).toBeLessThan(display.longPressMs)
  })

  it('display has largest edge zone', () => {
    const mobile = getAdaptiveThresholds('mobile')
    const display = getAdaptiveThresholds('display')
    expect(display.edgeZonePx).toBeGreaterThan(mobile.edgeZonePx)
  })

  it('mobile has lighter inertia (higher friction value = slower decel)', () => {
    const mobile = getAdaptiveThresholds('mobile')
    const display = getAdaptiveThresholds('display')
    expect(mobile.inertiaFriction).toBeGreaterThan(display.inertiaFriction)
  })

  it('all modes return valid AdaptiveThresholds', () => {
    const modes: DeviceMode[] = ['mobile', 'tablet', 'desktop', 'display']
    for (const mode of modes) {
      const t = getAdaptiveThresholds(mode)
      expect(t.panThreshold).toBeGreaterThan(0)
      expect(t.longPressMs).toBeGreaterThan(0)
      expect(t.edgeZonePx).toBeGreaterThan(0)
      expect(t.inertiaFriction).toBeGreaterThan(0)
      expect(t.inertiaFriction).toBeLessThan(1)
      expect(t.hapticMs).toBeGreaterThan(0)
    }
  })

  it('falls back to desktop for unknown mode', () => {
    const t = getAdaptiveThresholds('unknown' as DeviceMode)
    const desktop = getAdaptiveThresholds('desktop')
    expect(t).toEqual(desktop)
  })
})

// ── useOrientationLock ──────────────────────────────────────────────

describe('useOrientationLock (Phase 2 A3)', () => {
  beforeEach(() => {
    Object.defineProperty(screen, 'orientation', {
      value: {
        type: 'landscape-primary',
        lock: vi.fn().mockResolvedValue(undefined),
        unlock: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    })
  })

  it('suggests landscape for tablet in portrait', async () => {
    const { useOrientationLock } = await import('../composables/useOrientationLock')
    const deviceMode = ref<DeviceMode>('tablet')
    const orientation = ref<'portrait' | 'landscape'>('portrait')

    const { suggestion } = useOrientationLock(deviceMode, orientation)
    expect(suggestion.value).toBe('landscape')
  })

  it('no suggestion for tablet in landscape', async () => {
    const { useOrientationLock } = await import('../composables/useOrientationLock')
    const deviceMode = ref<DeviceMode>('tablet')
    const orientation = ref<'portrait' | 'landscape'>('landscape')

    const { suggestion } = useOrientationLock(deviceMode, orientation)
    expect(suggestion.value).toBeNull()
  })

  it('no suggestion for mobile in portrait', async () => {
    const { useOrientationLock } = await import('../composables/useOrientationLock')
    const deviceMode = ref<DeviceMode>('mobile')
    const orientation = ref<'portrait' | 'landscape'>('portrait')

    const { suggestion } = useOrientationLock(deviceMode, orientation)
    expect(suggestion.value).toBeNull()
  })

  it('no suggestion for desktop', async () => {
    const { useOrientationLock } = await import('../composables/useOrientationLock')
    const deviceMode = ref<DeviceMode>('desktop')
    const orientation = ref<'portrait' | 'landscape'>('portrait')

    const { suggestion } = useOrientationLock(deviceMode, orientation)
    expect(suggestion.value).toBeNull()
  })

  it('isLocked starts as false', async () => {
    const { useOrientationLock } = await import('../composables/useOrientationLock')
    const deviceMode = ref<DeviceMode>('desktop')
    const orientation = ref<'portrait' | 'landscape'>('landscape')

    const { isLocked } = useOrientationLock(deviceMode, orientation)
    expect(isLocked.value).toBe(false)
  })
})
