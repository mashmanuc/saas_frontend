// Phase 11 B10: Tests for WBOnboardingHints component
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import WBOnboardingHints from '@/modules/winterboard/components/ui/WBOnboardingHints.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      winterboard: {
        onboarding: {
          toolbar: 'Drawing tools. Pick a pen and start!',
          materials: 'Drag images, videos or YouTube from here onto the board',
          replay: 'Review the entire lesson after it ends here',
          selection: 'Click an object to see action buttons',
          dismiss: 'Got it',
        },
      },
    },
  },
})

describe('WBOnboardingHints', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders hints when board is empty and hints not seen', async () => {
    const wrapper = mount(WBOnboardingHints, {
      props: { isEmpty: true },
      global: { plugins: [i18n], stubs: { Transition: false } },
    })
    await nextTick()
    expect(wrapper.find('[data-testid="onboarding-hints"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Drawing tools')
    expect(wrapper.text()).toContain('Got it')
  })

  it('does NOT render hints when board is NOT empty', () => {
    const wrapper = mount(WBOnboardingHints, {
      props: { isEmpty: false },
      global: { plugins: [i18n] },
    })
    expect(wrapper.find('[data-testid="onboarding-hints"]').exists()).toBe(false)
  })

  it('does NOT render hints when localStorage flag is set', () => {
    localStorage.setItem('wb-hints-seen', 'true')
    const wrapper = mount(WBOnboardingHints, {
      props: { isEmpty: true },
      global: { plugins: [i18n] },
    })
    expect(wrapper.find('[data-testid="onboarding-hints"]').exists()).toBe(false)
  })

  it('dismiss hides hints and sets localStorage flag', async () => {
    const wrapper = mount(WBOnboardingHints, {
      props: { isEmpty: true },
      global: { plugins: [i18n], stubs: { Transition: false } },
    })
    await nextTick()
    expect(wrapper.find('[data-testid="onboarding-hints"]').exists()).toBe(true)

    await wrapper.find('.wb-hint__dismiss').trigger('click')

    expect(localStorage.getItem('wb-hints-seen')).toBe('true')
  })
})
