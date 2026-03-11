// WB Responsive Phase 4: Tests for keyboard avoidance, collapsible toolbar, mobile page nav
// Ref: winterboard_dev/responsive/PHASE4.md A7, B8, B9

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { KEYBOARD_MIN_DIFF_PX } from '../composables/useKeyboardAvoidance'

beforeEach(() => {
  setActivePinia(createPinia())
})

// ── useKeyboardAvoidance constants (A7) ─────────────────────────────

describe('useKeyboardAvoidance (Phase 4 A7, INV-5)', () => {
  it('KEYBOARD_MIN_DIFF_PX is 150', () => {
    expect(KEYBOARD_MIN_DIFF_PX).toBe(150)
  })

  it('composable exports getStableViewportHeight', async () => {
    const { useKeyboardAvoidance } = await import('../composables/useKeyboardAvoidance')
    const containerRef = ref<HTMLElement | null>(null)
    const result = useKeyboardAvoidance(containerRef)
    expect(typeof result.getStableViewportHeight).toBe('function')
  })

  it('keyboardHeight starts at 0', async () => {
    const { useKeyboardAvoidance } = await import('../composables/useKeyboardAvoidance')
    const containerRef = ref<HTMLElement | null>(null)
    const result = useKeyboardAvoidance(containerRef)
    expect(result.keyboardHeight.value).toBe(0)
  })

  it('isKeyboardVisible starts as false', async () => {
    const { useKeyboardAvoidance } = await import('../composables/useKeyboardAvoidance')
    const containerRef = ref<HTMLElement | null>(null)
    const result = useKeyboardAvoidance(containerRef)
    expect(result.isKeyboardVisible.value).toBe(false)
  })

  it('viewportOffset starts at 0', async () => {
    const { useKeyboardAvoidance } = await import('../composables/useKeyboardAvoidance')
    const containerRef = ref<HTMLElement | null>(null)
    const result = useKeyboardAvoidance(containerRef)
    expect(result.viewportOffset.value).toBe(0)
  })

  it('adjustForKeyboard and resetAfterKeyboard are functions', async () => {
    const { useKeyboardAvoidance } = await import('../composables/useKeyboardAvoidance')
    const containerRef = ref<HTMLElement | null>(null)
    const result = useKeyboardAvoidance(containerRef)
    expect(typeof result.adjustForKeyboard).toBe('function')
    expect(typeof result.resetAfterKeyboard).toBe('function')
  })
})

// ── WBToolbar tablet expand/collapse (B8) ───────────────────────────

describe('WBToolbar tablet expand/collapse (Phase 4 B8)', () => {
  async function mountToolbar(variant: string = 'tablet') {
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

  it('shows toggle button on tablet variant', async () => {
    const wrapper = await mountToolbar('tablet')
    expect(wrapper.find('.wb-toolbar__toggle').exists()).toBe(true)
  })

  it('does not show toggle button on desktop variant', async () => {
    const wrapper = await mountToolbar('desktop')
    expect(wrapper.find('.wb-toolbar__toggle').exists()).toBe(false)
  })

  it('does not show toggle button on mobile variant', async () => {
    const wrapper = await mountToolbar('mobile')
    expect(wrapper.find('.wb-toolbar__toggle').exists()).toBe(false)
  })

  it('toggle button has aria-expanded attribute', async () => {
    const wrapper = await mountToolbar('tablet')
    const toggle = wrapper.find('.wb-toolbar__toggle')
    expect(toggle.attributes('aria-expanded')).toBeDefined()
  })

  it('clicking toggle toggles expanded class', async () => {
    const wrapper = await mountToolbar('tablet')
    const root = wrapper.find('.wb-toolbar')
    const initialExpanded = root.classes().includes('wb-toolbar--expanded')
    await wrapper.find('.wb-toolbar__toggle').trigger('click')
    const afterToggle = root.classes().includes('wb-toolbar--expanded')
    expect(afterToggle).not.toBe(initialExpanded)
  })
})

// ── WBMobilePageNav (B9) ────────────────────────────────────────────

describe('WBMobilePageNav (Phase 4 B9)', () => {
  async function mountPageNav(props: Record<string, any> = {}) {
    const WBMobilePageNav = (await import('../components/pages/WBMobilePageNav.vue')).default
    return mount(WBMobilePageNav, {
      props: {
        currentPage: 2,
        totalPages: 5,
        ...props,
      },
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    })
  }

  it('renders navigation element', async () => {
    const wrapper = await mountPageNav()
    expect(wrapper.find('.wb-page-nav').exists()).toBe(true)
    expect(wrapper.find('.wb-page-nav').attributes('role')).toBe('navigation')
  })

  it('displays page counter', async () => {
    const wrapper = await mountPageNav({ currentPage: 3, totalPages: 7 })
    expect(wrapper.find('.wb-page-nav__counter').text()).toContain('3')
    expect(wrapper.find('.wb-page-nav__counter').text()).toContain('7')
  })

  it('emits prev on prev button click', async () => {
    const wrapper = await mountPageNav()
    const buttons = wrapper.findAll('.wb-page-nav__btn')
    await buttons[0].trigger('click')
    expect(wrapper.emitted('prev')).toBeTruthy()
  })

  it('emits next on next button click', async () => {
    const wrapper = await mountPageNav()
    const buttons = wrapper.findAll('.wb-page-nav__btn')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()
  })

  it('disables prev button on page 1', async () => {
    const wrapper = await mountPageNav({ currentPage: 1, totalPages: 5 })
    const buttons = wrapper.findAll('.wb-page-nav__btn')
    expect(buttons[0].attributes('disabled')).toBeDefined()
  })

  it('disables next button on last page', async () => {
    const wrapper = await mountPageNav({ currentPage: 5, totalPages: 5 })
    const buttons = wrapper.findAll('.wb-page-nav__btn')
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })

  it('emits add on add button click', async () => {
    const wrapper = await mountPageNav()
    const buttons = wrapper.findAll('.wb-page-nav__btn')
    // 3rd button is add (after separator)
    await buttons[2].trigger('click')
    expect(wrapper.emitted('add')).toBeTruthy()
  })

  it('emits open-thumbnails on pages button click', async () => {
    const wrapper = await mountPageNav()
    const pagesBtn = wrapper.find('.wb-page-nav__btn--pages')
    await pagesBtn.trigger('click')
    expect(wrapper.emitted('open-thumbnails')).toBeTruthy()
  })

  it('has aria-live on page counter', async () => {
    const wrapper = await mountPageNav()
    expect(wrapper.find('.wb-page-nav__counter').attributes('aria-live')).toBe('polite')
  })
})
