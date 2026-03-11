// WB Responsive Phase 3 A5: Tests for useDisplayMode composable
// Ref: winterboard_dev/responsive/PHASE3.md A5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import type { DeviceMode } from '../types/responsive'
import {
  AUTO_HIDE_DELAY_MS,
  MAX_PIXEL_RATIO,
} from '../composables/useDisplayMode'

// ── Constants tests ─────────────────────────────────────────────────

describe('useDisplayMode constants (Phase 3 A5)', () => {
  it('AUTO_HIDE_DELAY_MS is 5 seconds', () => {
    expect(AUTO_HIDE_DELAY_MS).toBe(5000)
  })

  it('MAX_PIXEL_RATIO is 2', () => {
    expect(MAX_PIXEL_RATIO).toBe(2)
  })
})

// ── useDisplayMode composable tests ─────────────────────────────────

describe('useDisplayMode (Phase 3 A5)', () => {
  beforeEach(() => {
    vi.useFakeTimers()

    // Mock fullscreen API
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      writable: true,
      configurable: true,
    })
    document.documentElement.requestFullscreen = vi.fn().mockResolvedValue(undefined)
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined)

    // Mock devicePixelRatio
    Object.defineProperty(window, 'devicePixelRatio', {
      value: 2,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function importAndCreate(mode: DeviceMode = 'display') {
    const { useDisplayMode } = await import('../composables/useDisplayMode')
    const deviceMode = ref<DeviceMode>(mode)
    return { result: useDisplayMode(deviceMode), deviceMode }
  }

  it('isDisplayMode is true for display', async () => {
    const { result } = await importAndCreate('display')
    expect(result.isDisplayMode.value).toBe(true)
  })

  it('isDisplayMode is false for desktop', async () => {
    const { result } = await importAndCreate('desktop')
    expect(result.isDisplayMode.value).toBe(false)
  })

  it('displayScale is 1.5 for display', async () => {
    const { result } = await importAndCreate('display')
    expect(result.displayScale.value).toBe(1.5)
  })

  it('displayScale is 1.0 for desktop', async () => {
    const { result } = await importAndCreate('desktop')
    expect(result.displayScale.value).toBe(1.0)
  })

  it('displayScale is 1.1 for tablet', async () => {
    const { result } = await importAndCreate('tablet')
    expect(result.displayScale.value).toBe(1.1)
  })

  it('canvasQuality is high for display', async () => {
    const { result } = await importAndCreate('display')
    expect(result.canvasQuality.value).toBe('high')
  })

  it('canvasQuality is standard for desktop', async () => {
    const { result } = await importAndCreate('desktop')
    expect(result.canvasQuality.value).toBe('standard')
  })

  it('effectiveDpr caps at MAX_PIXEL_RATIO', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 4, writable: true, configurable: true })
    const { result } = await importAndCreate('display')
    expect(result.effectiveDpr.value).toBe(MAX_PIXEL_RATIO)
  })

  it('isFullscreen starts as false', async () => {
    const { result } = await importAndCreate('display')
    expect(result.isFullscreen.value).toBe(false)
  })

  it('hasWakeLock starts as false', async () => {
    const { result } = await importAndCreate('desktop')
    expect(result.hasWakeLock.value).toBe(false)
  })

  it('wakeLockMethod starts as none for desktop', async () => {
    const { result } = await importAndCreate('desktop')
    expect(result.wakeLockMethod.value).toBe('none')
  })

  it('uiVisible starts as true', async () => {
    const { result } = await importAndCreate('display')
    expect(result.uiVisible.value).toBe(true)
  })

  it('resetAutoHide resets timer and keeps UI visible', async () => {
    const { result } = await importAndCreate('display')
    result.resetAutoHide()
    expect(result.uiVisible.value).toBe(true)
  })
})
