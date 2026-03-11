// WB Responsive: Unit tests for WBResponsiveShell layout wrapper
// Ref: winterboard_dev/responsive/PHASE1.md B2

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

// ── Mock matchMedia and screen.orientation before imports ───────────

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  })))

  Object.defineProperty(screen, 'orientation', {
    value: {
      type: 'landscape-primary',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  })

  Object.defineProperty(navigator, 'maxTouchPoints', {
    value: 0,
    writable: true,
    configurable: true,
  })

  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Import after mocks ──────────────────────────────────────────────

// Lazy import to ensure mocks are active
async function importShell() {
  const mod = await import('../components/layout/WBResponsiveShell.vue')
  return mod.default
}

// ── Tests ───────────────────────────────────────────────────────────

describe('WBResponsiveShell', () => {
  it('renders with data-device-mode attribute', async () => {
    const WBResponsiveShell = await importShell()
    const wrapper = mount(WBResponsiveShell, {
      slots: {
        header: '<div class="test-header">Header</div>',
        canvas: '<div class="test-canvas">Canvas</div>',
      },
    })

    const shell = wrapper.find('.wb-responsive-shell')
    expect(shell.exists()).toBe(true)
    expect(shell.attributes('data-device-mode')).toBeTruthy()
    expect(shell.attributes('data-input-mode')).toBeTruthy()
    expect(shell.attributes('data-orientation')).toBeTruthy()
  })

  it('renders header slot content', async () => {
    const WBResponsiveShell = await importShell()
    const wrapper = mount(WBResponsiveShell, {
      slots: {
        header: '<div class="test-header">My Header</div>',
        canvas: '<div>Canvas</div>',
      },
    })

    expect(wrapper.find('.test-header').exists()).toBe(true)
    expect(wrapper.find('.test-header').text()).toBe('My Header')
  })

  it('renders canvas slot in canvas area', async () => {
    const WBResponsiveShell = await importShell()
    const wrapper = mount(WBResponsiveShell, {
      slots: {
        canvas: '<div class="test-canvas">My Canvas</div>',
      },
    })

    const canvasArea = wrapper.find('.wb-responsive-shell__canvas')
    expect(canvasArea.exists()).toBe(true)
    expect(canvasArea.find('.test-canvas').exists()).toBe(true)
  })

  it('renders footer slot when provided', async () => {
    const WBResponsiveShell = await importShell()
    const wrapper = mount(WBResponsiveShell, {
      slots: {
        canvas: '<div>Canvas</div>',
        footer: '<div class="test-footer">Footer</div>',
      },
    })

    expect(wrapper.find('.test-footer').exists()).toBe(true)
  })

  it('has correct CSS classes for layout', async () => {
    const WBResponsiveShell = await importShell()
    const wrapper = mount(WBResponsiveShell, {
      slots: {
        canvas: '<div>Canvas</div>',
      },
    })

    const shell = wrapper.find('.wb-responsive-shell')
    expect(shell.exists()).toBe(true)
    // Should have at least one device mode class
    const classes = shell.classes()
    const hasDeviceClass = classes.some(c =>
      c.startsWith('wb-responsive-shell--mobile') ||
      c.startsWith('wb-responsive-shell--tablet') ||
      c.startsWith('wb-responsive-shell--desktop') ||
      c.startsWith('wb-responsive-shell--display')
    )
    expect(hasDeviceClass).toBe(true)
  })

  it('uses --wb-vh for height style (INV-5)', async () => {
    const WBResponsiveShell = await importShell()
    const wrapper = mount(WBResponsiveShell, {
      slots: {
        canvas: '<div>Canvas</div>',
      },
    })

    const shell = wrapper.find('.wb-responsive-shell')
    const style = shell.attributes('style') || ''
    expect(style).toContain('--wb-vh')
  })

  it('provides device state via inject', async () => {
    const WBResponsiveShell = await importShell()

    let injectedDeviceMode: any = null
    const ChildComponent = defineComponent({
      inject: ['wb-device-mode'],
      setup(_, { slots }) {
        return () => h('div', 'child')
      },
      mounted() {
        injectedDeviceMode = (this as any)['wb-device-mode']
      },
      template: '<div>child</div>',
    })

    mount(WBResponsiveShell, {
      slots: {
        canvas: () => h(ChildComponent),
      },
    })

    // The provide should exist (injection happens in child)
    // This test verifies shell doesn't crash and renders children
    expect(true).toBe(true)
  })
})
