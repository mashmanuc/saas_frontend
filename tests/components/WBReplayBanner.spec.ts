// Phase 11 B10: Tests for WBReplayBanner component
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBReplayBanner from '@/modules/winterboard/components/replay/WBReplayBanner.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      winterboard: {
        replay: {
          viewingMode: 'Viewing mode — editing disabled',
          exitReplay: 'Exit',
        },
      },
    },
  },
})

describe('WBReplayBanner', () => {
  it('renders banner with correct text', () => {
    const wrapper = mount(WBReplayBanner, {
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).toContain('Viewing mode')
    expect(wrapper.text()).toContain('Exit')
  })

  it('emits exit when exit button is clicked', async () => {
    const wrapper = mount(WBReplayBanner, {
      global: { plugins: [i18n] },
    })
    await wrapper.find('.wb-replay-banner__exit').trigger('click')
    expect(wrapper.emitted('exit')).toHaveLength(1)
  })

  it('has blinking indicator', () => {
    const wrapper = mount(WBReplayBanner, {
      global: { plugins: [i18n] },
    })
    expect(wrapper.find('.wb-replay-banner__indicator').exists()).toBe(true)
  })
})
