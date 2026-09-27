// Б-58 (2026-09-27): у вбудованому браузері (Telegram…) кнопка Google пояснює, що робити,
// ДО натискання: Google там вхід блокує (`403 disallowed_useragent`).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

vi.mock('../../utils/gisLoader', () => ({
  loadGIS: vi.fn(async () => ({ initialize: vi.fn(), renderButton: vi.fn() })),
}))

const TELEGRAM_ANDROID = 'Mozilla/5.0 (Linux; Android 10; K) Telegram-Android/11.7.3 (Samsung SM-A750F; Android 10; SDK 29; LOW)'
const INSTAGRAM_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 305.0.0.20.110'
const CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'

const originalUA = navigator.userAgent
const i18n = () => createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })

async function mountWithUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true })
  vi.resetModules()
  const { default: GoogleSignInButton } = await import('../GoogleSignInButton.vue')
  const wrapper = mount(GoogleSignInButton, { global: { plugins: [i18n()] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
})
afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true })
  vi.restoreAllMocks()
})

describe('Б-58 · GoogleSignInButton у вбудованому браузері', () => {
  it('Telegram на Android — підказка, «Відкрити в Chrome» (intent) і копіювання; кнопка Google лишається', async () => {
    const wrapper = await mountWithUA(TELEGRAM_ANDROID)

    expect(wrapper.find('[data-testid="google-embedded-note"]').text()).toContain('вбудованому браузері')
    const chrome = wrapper.get('[data-testid="google-embedded-open-chrome"]')
    expect(chrome.attributes('href')).toMatch(/^intent:\/\/.*package=com\.android\.chrome/)
    expect(wrapper.find('[data-testid="google-embedded-copy"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="google-signin-button"]').exists()).toBe(true)
  })

  it('Instagram на iPhone — підказка без Android-кнопки', async () => {
    const wrapper = await mountWithUA(INSTAGRAM_IOS)

    expect(wrapper.find('[data-testid="google-embedded-note"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="google-embedded-open-chrome"]').exists()).toBe(false)
  })

  it('справжній Chrome — жодної підказки', async () => {
    const wrapper = await mountWithUA(CHROME_ANDROID)

    expect(wrapper.find('[data-testid="google-embedded-note"]').exists()).toBe(false)
  })

  it('копіювання: успіх — «Скопійовано»; буфер недоступний — адреса для ручного копіювання', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    let wrapper = await mountWithUA(TELEGRAM_ANDROID)
    await wrapper.get('[data-testid="google-embedded-copy"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(wrapper.get('[data-testid="google-embedded-copy"]').text()).toContain('Скопійовано')

    vi.spyOn(console, 'warn').mockImplementation(() => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => { throw new Error('NotAllowedError') }) }, configurable: true,
    })
    wrapper = await mountWithUA(TELEGRAM_ANDROID)
    await wrapper.get('[data-testid="google-embedded-copy"]').trigger('click')
    await flushPromises()
    expect((wrapper.get('[data-testid="google-embedded-address"]').element as HTMLInputElement).value)
      .toBe(window.location.href)
  })
})
