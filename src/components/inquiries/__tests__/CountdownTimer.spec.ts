import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import CountdownTimer from '../CountdownTimer.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'uk',
  messages: {
    uk: {
      inquiries: {
        countdown: {
          expiresIn: 'Закінчується через',
          expired: 'Час вичерпано',
          days: '{count} д',
          hours: '{count} год',
          minutes: '{count} хв'
        }
      }
    }
  }
})

describe('CountdownTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('показує час до expires_at', () => {
    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    const wrapper = mount(CountdownTimer, {
      props: {
        expiresAt: futureDate
      },
      global: {
        plugins: [i18n]
      }
    })

    expect(wrapper.text()).toContain('Закінчується через')
    expect(wrapper.text()).toMatch(/\d+ д/)
  })

  it('показує "Час вичерпано" після дедлайну', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    const wrapper = mount(CountdownTimer, {
      props: {
        expiresAt: pastDate
      },
      global: {
        plugins: [i18n]
      }
    })

    expect(wrapper.text()).toBe('Час вичерпано')
  })

  it('оновлює час кожну хвилину', async () => {
    const futureDate = new Date(Date.now() + 61 * 60 * 1000).toISOString()
    const wrapper = mount(CountdownTimer, {
      props: {
        expiresAt: futureDate
      },
      global: {
        plugins: [i18n]
      }
    })

    const initialText = wrapper.text()
    
    vi.advanceTimersByTime(60000)
    await wrapper.vm.$nextTick()
    
    const updatedText = wrapper.text()
    expect(updatedText).not.toBe(initialText)
  })

  it('показує години та хвилини коректно', () => {
    const futureDate = new Date(Date.now() + 3 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
    const wrapper = mount(CountdownTimer, {
      props: {
        expiresAt: futureDate
      },
      global: {
        plugins: [i18n]
      }
    })

    expect(wrapper.text()).toContain('год')
    expect(wrapper.text()).toContain('хв')
  })
})
