/**
 * Час у спливному вікні (2026-10-17): з релізу 0.10 мову вибирав `t('lang.en')` — переклад «Англійська»
 * завжди непорожній, тож кожне вікно показувало «10:44 PM» і в українському інтерфейсі.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { vi } from 'vitest'

vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import ToastContainer from '../ToastContainer.vue'
import { useNotifyStore } from '../../stores/notifyStore'

function render(locale: 'uk' | 'en') {
  const i18n = createI18n({ legacy: false, locale, messages: { uk: { lang: { en: 'Англійська' } }, en: { lang: { en: 'English' } } } })
  const pinia = createPinia()
  setActivePinia(pinia)
  const notify = useNotifyStore()
  notify.$patch({ items: [{ id: 't1', type: 'info', title: 'Новий урок', message: 'Олена', timestamp: new Date(2026, 9, 17, 22, 44).getTime() }] } as never)
  return mount(ToastContainer, { global: { plugins: [pinia, i18n], mocks: { $t: (k: string) => k } } })
}

describe('ToastContainer — час', () => {
  beforeEach(() => { document.body.innerHTML = '' })

  it('український інтерфейс — 24-годинний час, без AM/PM', () => {
    const text = render('uk').find('small').text()
    expect(text).toBe('22:44')
  })

  it('англійський інтерфейс — англійський формат', () => {
    expect(render('en').find('small').text()).toMatch(/PM/)
  })
})
