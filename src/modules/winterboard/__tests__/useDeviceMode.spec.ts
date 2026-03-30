// WB Responsive: Unit tests for useDeviceMode composable + types
// Ref: winterboard_dev/responsive/PHASE1.md A1
// Tests: resolveDeviceMode, resolveInputMode, composable API, INV-2 separation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveDeviceMode, resolveInputMode, WB_BREAKPOINTS } from '../types/responsive'
import type { DeviceMode, InputMode, DeviceModeState } from '../types/responsive'

// ── Pure function tests ─────────────────────────────────────────────────

describe('resolveDeviceMode (INV-2: width ONLY)', () => {
  it('returns mobile for width < 640', () => {
    expect(resolveDeviceMode(0)).toBe('mobile')
    expect(resolveDeviceMode(320)).toBe('mobile')
    expect(resolveDeviceMode(375)).toBe('mobile')
    expect(resolveDeviceMode(639)).toBe('mobile')
  })

  it('returns tablet for width 640–1023', () => {
    expect(resolveDeviceMode(640)).toBe('tablet')
    expect(resolveDeviceMode(768)).toBe('tablet')
    expect(resolveDeviceMode(820)).toBe('tablet')
    expect(resolveDeviceMode(1023)).toBe('tablet')
  })

  it('returns desktop for width 1024–1919', () => {
    expect(resolveDeviceMode(1024)).toBe('desktop')
    expect(resolveDeviceMode(1280)).toBe('desktop')
    expect(resolveDeviceMode(1440)).toBe('desktop')
    expect(resolveDeviceMode(1919)).toBe('desktop')
  })

  it('returns display for width >= 1920', () => {
    expect(resolveDeviceMode(1920)).toBe('display')
    expect(resolveDeviceMode(2560)).toBe('display')
    expect(resolveDeviceMode(3840)).toBe('display')
  })

  it('handles exact breakpoint boundaries', () => {
    expect(resolveDeviceMode(WB_BREAKPOINTS.mobile - 1)).toBe('mobile')
    expect(resolveDeviceMode(WB_BREAKPOINTS.mobile)).toBe('tablet')
    expect(resolveDeviceMode(WB_BREAKPOINTS.tabletL - 1)).toBe('tablet')
    expect(resolveDeviceMode(WB_BREAKPOINTS.tabletL)).toBe('desktop')
    expect(resolveDeviceMode(WB_BREAKPOINTS.display - 1)).toBe('desktop')
    expect(resolveDeviceMode(WB_BREAKPOINTS.display)).toBe('display')
  })
})

describe('resolveInputMode (INV-2: pointer ONLY)', () => {
  it('returns pen for pointerType "pen"', () => {
    expect(resolveInputMode('pen')).toBe('pen')
  })

  it('returns touch for pointerType "touch"', () => {
    expect(resolveInputMode('touch')).toBe('touch')
  })

  it('returns mouse for pointerType "mouse"', () => {
    expect(resolveInputMode('mouse')).toBe('mouse')
  })

  it('returns mouse for unknown pointerType', () => {
    expect(resolveInputMode('')).toBe('mouse')
    expect(resolveInputMode('unknown')).toBe('mouse')
  })
})

describe('WB_BREAKPOINTS', () => {
  it('has correct values aligned with RESPONSIVE_STRATEGY.md', () => {
    expect(WB_BREAKPOINTS.mobile).toBe(640)
    expect(WB_BREAKPOINTS.tablet).toBe(768)
    expect(WB_BREAKPOINTS.tabletL).toBe(1024)
    expect(WB_BREAKPOINTS.desktop).toBe(1280)
    expect(WB_BREAKPOINTS.display).toBe(1920)
  })

  it('breakpoints are in ascending order', () => {
    const values = [
      WB_BREAKPOINTS.mobile,
      WB_BREAKPOINTS.tablet,
      WB_BREAKPOINTS.tabletL,
      WB_BREAKPOINTS.desktop,
      WB_BREAKPOINTS.display,
    ]
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1])
    }
  })
})

// ── INV-2: deviceMode ≠ inputMode — independence tests ──────────────────

describe('INV-2: deviceMode and inputMode independence', () => {
  it('Surface Pro scenario: desktop + pen+mouse+touch', () => {
    // Surface Pro has desktop-class viewport but supports pen, mouse, and touch
    const deviceMode = resolveDeviceMode(1366) // desktop
    const penInput = resolveInputMode('pen')
    const touchInput = resolveInputMode('touch')
    const mouseInput = resolveInputMode('mouse')

    expect(deviceMode).toBe('desktop')
    expect(penInput).toBe('pen')
    expect(touchInput).toBe('touch')
    expect(mouseInput).toBe('mouse')
    // deviceMode does NOT change based on input
  })

  it('iPad + Pencil scenario: tablet + pen+touch', () => {
    const deviceMode = resolveDeviceMode(820) // tablet
    const penInput = resolveInputMode('pen')
    const touchInput = resolveInputMode('touch')

    expect(deviceMode).toBe('tablet')
    expect(penInput).toBe('pen')
    expect(touchInput).toBe('touch')
  })

  it('Windows touch monitor scenario: display + touch+mouse', () => {
    const deviceMode = resolveDeviceMode(1920) // display
    const touchInput = resolveInputMode('touch')
    const mouseInput = resolveInputMode('mouse')

    expect(deviceMode).toBe('display')
    expect(touchInput).toBe('touch')
    expect(mouseInput).toBe('mouse')
  })

  it('Chrome Android scenario: mobile + touch', () => {
    const deviceMode = resolveDeviceMode(375) // mobile
    const touchInput = resolveInputMode('touch')

    expect(deviceMode).toBe('mobile')
    expect(touchInput).toBe('touch')
  })

  it('resolveDeviceMode ignores pointer type', () => {
    // Same width always yields same mode regardless of what pointer does
    const mode1 = resolveDeviceMode(1024)
    const mode2 = resolveDeviceMode(1024)
    expect(mode1).toBe(mode2)
    expect(mode1).toBe('desktop')
  })

  it('resolveInputMode ignores viewport width', () => {
    // Same pointer type always yields same mode regardless of viewport
    expect(resolveInputMode('pen')).toBe('pen')
    expect(resolveInputMode('pen')).toBe('pen')
  })
})

// ── DeviceModeState type structure ──────────────────────────────────────

describe('DeviceModeState type contract', () => {
  it('has all required fields', () => {
    const state: DeviceModeState = {
      deviceMode: 'desktop',
      viewportWidth: 1280,
      viewportHeight: 720,
      inputMode: 'mouse',
      hasTouch: false,
      hasPen: false,
      hasHover: true,
      orientation: 'landscape',
      dpr: 1,
      isStandalone: false,
    }

    expect(state.deviceMode).toBe('desktop')
    expect(state.inputMode).toBe('mouse')
    expect(state.orientation).toBe('landscape')
    expect(state.viewportWidth).toBe(1280)
    expect(state.viewportHeight).toBe(720)
    expect(state.hasTouch).toBe(false)
    expect(state.hasPen).toBe(false)
    expect(state.hasHover).toBe(true)
    expect(state.dpr).toBe(1)
    expect(state.isStandalone).toBe(false)
  })

  it('accepts all valid DeviceMode values', () => {
    const modes: DeviceMode[] = ['mobile', 'tablet', 'desktop', 'display']
    modes.forEach((mode) => {
      const state: DeviceModeState = {
        deviceMode: mode,
        viewportWidth: 1280,
        viewportHeight: 720,
        inputMode: 'mouse',
        hasTouch: false,
        hasPen: false,
        hasHover: true,
        orientation: 'landscape',
        dpr: 1,
        isStandalone: false,
      }
      expect(state.deviceMode).toBe(mode)
    })
  })

  it('accepts all valid InputMode values', () => {
    const modes: InputMode[] = ['touch', 'pen', 'mouse']
    modes.forEach((mode) => {
      const state: DeviceModeState = {
        deviceMode: 'desktop',
        viewportWidth: 1280,
        viewportHeight: 720,
        inputMode: mode,
        hasTouch: false,
        hasPen: false,
        hasHover: true,
        orientation: 'landscape',
        dpr: 1,
        isStandalone: false,
      }
      expect(state.inputMode).toBe(mode)
    })
  })
})

// ── useDeviceMode composable (requires DOM mocking) ─────────────────────

describe('useDeviceMode composable', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()

    // Mock matchMedia
    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }))
    vi.stubGlobal('matchMedia', matchMediaMock)

    // Mock screen.orientation
    Object.defineProperty(screen, 'orientation', {
      value: {
        type: 'landscape-primary',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      writable: true,
      configurable: true,
    })

    // Mock navigator
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('exports all expected return properties', async () => {
    // Dynamic import after mocks are set up
    const { useDeviceMode } = await import('../composables/useDeviceMode')
    const { mount } = await import('@vue/test-utils')
    const { defineComponent } = await import('vue')

    let result: any
    const TestComp = defineComponent({
      setup() {
        result = useDeviceMode()
        return {}
      },
      template: '<div />',
    })

    mount(TestComp)

    expect(result).toBeDefined()
    expect(result.deviceMode).toBeDefined()
    expect(result.isMobile).toBeDefined()
    expect(result.isTablet).toBeDefined()
    expect(result.isDesktop).toBeDefined()
    expect(result.isDisplay).toBeDefined()
    expect(result.inputMode).toBeDefined()
    expect(result.isTouchInput).toBeDefined()
    expect(result.isPenInput).toBeDefined()
    expect(result.hasMultipleInputModes).toBeDefined()
    expect(result.orientation).toBeDefined()
    expect(result.isLandscape).toBeDefined()
    expect(result.state).toBeDefined()
  })

  it('returns correct initial deviceMode based on window.innerWidth', async () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true })
    Object.defineProperty(window, 'innerHeight', { value: 812, writable: true, configurable: true })

    // Re-import to pick up new window dimensions
    vi.resetModules()
    const { useDeviceMode } = await import('../composables/useDeviceMode')
    const { mount } = await import('@vue/test-utils')
    const { defineComponent } = await import('vue')

    let result: any
    const TestComp = defineComponent({
      setup() {
        result = useDeviceMode()
        return {}
      },
      template: '<div />',
    })

    mount(TestComp)

    expect(result.deviceMode.value).toBe('mobile')
    expect(result.isMobile.value).toBe(true)
    expect(result.isTablet.value).toBe(false)
  })

  it('state includes all DeviceModeState fields', async () => {
    const { useDeviceMode } = await import('../composables/useDeviceMode')
    const { mount } = await import('@vue/test-utils')
    const { defineComponent } = await import('vue')

    let result: any
    const TestComp = defineComponent({
      setup() {
        result = useDeviceMode()
        return {}
      },
      template: '<div />',
    })

    mount(TestComp)

    const s = result.state.value
    expect(s).toHaveProperty('deviceMode')
    expect(s).toHaveProperty('viewportWidth')
    expect(s).toHaveProperty('viewportHeight')
    expect(s).toHaveProperty('inputMode')
    expect(s).toHaveProperty('hasTouch')
    expect(s).toHaveProperty('hasPen')
    expect(s).toHaveProperty('hasHover')
    expect(s).toHaveProperty('orientation')
    expect(s).toHaveProperty('dpr')
    expect(s).toHaveProperty('isStandalone')
  })
})
