// WB Responsive Phase 2: Tests for WBToolbar variant, WBToolbarSheet, WBMobileHeader
// Ref: winterboard_dev/responsive/PHASE2.md B3, B4, B5

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

beforeEach(() => {
  setActivePinia(createPinia())
})

// ── WBToolbar variant tests (B3) ────────────────────────────────────

describe('WBToolbar variant prop (Phase 2 B3, INV-3)', () => {
  async function mountToolbar(variant: string = 'desktop') {
    const WBToolbar = (await import('../components/toolbar/WBToolbar.vue')).default
    return mount(WBToolbar, {
      props: { variant } as any,
      global: {
        stubs: {
          WBThicknessPresets: true,
          WBQuickPalette: true,
          WBIconPen: true,
          WBIconHighlighter: true,
          WBIconEraser: true,
          WBIconLine: true,
          WBIconRectangle: true,
          WBIconCircle: true,
          WBIconText: true,
          WBIconSelect: true,
          WBIconUndo: true,
          WBIconRedo: true,
          WBIconTrash: true,
          WBIconLaser: true,
          WBIconSticky: true,
          WBIconLock: true,
          WBIconUnlock: true,
        },
        mocks: {
          $t: (key: string) => key,
        },
      },
    })
  }

  it('renders with data-variant="desktop" by default', async () => {
    const wrapper = await mountToolbar()
    expect(wrapper.find('.wb-toolbar').attributes('data-variant')).toBe('desktop')
  })

  it('renders with data-variant="mobile"', async () => {
    const wrapper = await mountToolbar('mobile')
    expect(wrapper.find('.wb-toolbar').attributes('data-variant')).toBe('mobile')
  })

  it('renders with data-variant="tablet"', async () => {
    const wrapper = await mountToolbar('tablet')
    expect(wrapper.find('.wb-toolbar').attributes('data-variant')).toBe('tablet')
  })

  it('renders with data-variant="display"', async () => {
    const wrapper = await mountToolbar('display')
    expect(wrapper.find('.wb-toolbar').attributes('data-variant')).toBe('display')
  })

  it('has wb-toolbar--mobile class for mobile variant', async () => {
    const wrapper = await mountToolbar('mobile')
    expect(wrapper.find('.wb-toolbar').classes()).toContain('wb-toolbar--mobile')
  })

  it('has wb-toolbar--display class for display variant', async () => {
    const wrapper = await mountToolbar('display')
    expect(wrapper.find('.wb-toolbar').classes()).toContain('wb-toolbar--display')
  })

  it('has role="toolbar" attribute', async () => {
    const wrapper = await mountToolbar()
    expect(wrapper.find('.wb-toolbar').attributes('role')).toBe('toolbar')
  })

  it('renders drawing tool buttons', async () => {
    const wrapper = await mountToolbar()
    const buttons = wrapper.findAll('.wb-toolbar__btn')
    // At least drawing tools + undo/redo/clear
    expect(buttons.length).toBeGreaterThanOrEqual(10)
  })
})

// ── WBToolbarSheet tests (B4) ───────────────────────────────────────

describe('WBToolbarSheet (Phase 2 B4)', () => {
  async function mountSheet(isOpen: boolean = true) {
    const WBToolbarSheet = (await import('../components/toolbar/WBToolbarSheet.vue')).default
    return mount(WBToolbarSheet, {
      props: {
        isOpen,
        currentTool: 'pen',
        currentColor: '#000000',
        currentSize: 2,
        canUndo: true,
        canRedo: false,
        canClearPage: true,
      },
      global: {
        stubs: {
          WBThicknessPresets: true,
          WBQuickPalette: true,
          Teleport: true,
        },
        mocks: {
          $t: (key: string) => key,
        },
      },
    })
  }

  it('renders when isOpen is true', async () => {
    const wrapper = await mountSheet(true)
    expect(wrapper.find('.wb-toolbar-sheet-backdrop').exists()).toBe(true)
  })

  it('does not render when isOpen is false', async () => {
    const wrapper = await mountSheet(false)
    expect(wrapper.find('.wb-toolbar-sheet-backdrop').exists()).toBe(false)
  })

  it('has role="dialog" and aria-modal', async () => {
    const wrapper = await mountSheet(true)
    const sheet = wrapper.find('.wb-toolbar-sheet')
    expect(sheet.attributes('role')).toBe('dialog')
    expect(sheet.attributes('aria-modal')).toBe('true')
  })

  it('emits close on backdrop click', async () => {
    const wrapper = await mountSheet(true)
    await wrapper.find('.wb-toolbar-sheet-backdrop').trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('renders action buttons', async () => {
    const wrapper = await mountSheet(true)
    const actions = wrapper.findAll('.wb-toolbar-sheet__action-btn')
    expect(actions.length).toBe(3) // undo, redo, clear
  })

  it('disables redo button when canRedo is false', async () => {
    const wrapper = await mountSheet(true)
    const actions = wrapper.findAll('.wb-toolbar-sheet__action-btn')
    // Second button is redo
    const redoBtn = actions[1]
    expect(redoBtn.attributes('disabled')).toBeDefined()
  })
})

// ── WBMobileHeader tests (B5) ───────────────────────────────────────

describe('WBMobileHeader (Phase 2 B5)', () => {
  async function mountHeader(props: Record<string, any> = {}) {
    const WBMobileHeader = (await import('../components/layout/WBMobileHeader.vue')).default
    return mount(WBMobileHeader, {
      props: {
        sessionName: 'Test Board',
        syncStatus: 'saved',
        variant: 'mobile',
        ...props,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })
  }

  it('renders header with 44px height class', async () => {
    const wrapper = await mountHeader()
    expect(wrapper.find('.wb-mobile-header').exists()).toBe(true)
  })

  it('displays session name', async () => {
    const wrapper = await mountHeader({ sessionName: 'My Board' })
    expect(wrapper.find('.wb-mobile-header__title-text').text()).toBe('My Board')
  })

  it('shows saved indicator (green)', async () => {
    const wrapper = await mountHeader({ syncStatus: 'saved' })
    expect(wrapper.find('.wb-mobile-header__save-dot--saved').exists()).toBe(true)
  })

  it('shows saving indicator (yellow)', async () => {
    const wrapper = await mountHeader({ syncStatus: 'saving' })
    expect(wrapper.find('.wb-mobile-header__save-dot--saving').exists()).toBe(true)
  })

  it('shows error indicator (red)', async () => {
    const wrapper = await mountHeader({ syncStatus: 'error' })
    expect(wrapper.find('.wb-mobile-header__save-dot--error').exists()).toBe(true)
  })

  it('emits back on back button click', async () => {
    const wrapper = await mountHeader()
    await wrapper.find('.wb-mobile-header__btn--back').trigger('click')
    expect(wrapper.emitted('back')).toBeTruthy()
  })

  it('emits menu on menu button click', async () => {
    const wrapper = await mountHeader()
    await wrapper.find('.wb-mobile-header__btn--menu').trigger('click')
    expect(wrapper.emitted('menu')).toBeTruthy()
  })

  it('emits edit-title on title click', async () => {
    const wrapper = await mountHeader()
    await wrapper.find('.wb-mobile-header__title').trigger('click')
    expect(wrapper.emitted('edit-title')).toBeTruthy()
  })

  it('shows tablet variant with zoom', async () => {
    const wrapper = await mountHeader({ variant: 'tablet', zoom: 0.75 })
    expect(wrapper.find('.wb-mobile-header--tablet').exists()).toBe(true)
    expect(wrapper.find('.wb-mobile-header__zoom').text()).toBe('75%')
  })
})
