/**
 * Сесію завершено — сторінку з даними прибрано ДО переходу (прийняття власника 2026-09-26:
 * «відкликана сесія не повинна залишати дошку видимою, навіть якщо йде запис і користувач
 * скасував «Покинути сайт?»»). Живий тест — `live_check_rec.cjs` у звіті пакета A.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import { onAuthDeath, resetAuthDeath } from '@/core/auth/onAuthDeath'
import { installLogoutGate, onOtherTabLogout } from '../logoutGate'
import { resetSessionEndedView, sessionEnded, shouldHidePage } from '../sessionEndedView'
import SessionEndedView from '../../views/SessionEndedView.vue'

let location: { href: string; pathname: string; search: string }

beforeEach(() => {
  resetAuthDeath()
  resetSessionEndedView()
  location = { href: '', pathname: '/winterboard/abc', search: '' }
  Object.defineProperty(window, 'location', { value: location, writable: true, configurable: true })
})
afterEach(() => {
  resetAuthDeath()
  resetSessionEndedView()
})

const protectedRoute = { matched: [{ meta: {} }] } as never
const publicRoute = { matched: [{ meta: { requiresAuth: false } }] } as never

describe('сесію завершено — сторінку прибрано до переходу', () => {
  it('прибирається лише сторінка з даними акаунта, не вхід чи стартова', () => {
    expect(shouldHidePage(true, protectedRoute)).toBe(true)
    expect(shouldHidePage(true, publicRoute)).toBe(false)
    expect(shouldHidePage(false, protectedRoute)).toBe(false)
  })

  it('смерть сесії будь-яким шляхом (вихід, «Завершити» з телефона) прибирає сторінку одразу', () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] })
    installLogoutGate(router)
    expect(sessionEnded.value).toBe(false)
    onAuthDeath()
    expect(sessionEnded.value).toBe(true)
  })

  it('інша вкладка: вихід не підтверджено → спершу сторінку прибрано, потім перехід', async () => {
    onOtherTabLogout(new StorageEvent('storage', { key: 'm4sh_logout_pending', newValue: '2026-09-26T09:00:00Z' }))
    expect(sessionEnded.value).toBe(true)
    // Ще не перейшли: кімната дошки мусить розмонтуватися разом зі своїм «Покинути сайт?».
    expect(location.href).toBe('')
    await nextTick()
    expect(location.href).toBe('/logout-pending')
  })

  it('нейтральна сторінка без даних акаунта веде на стартову повним перезавантаженням', async () => {
    const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })
    const wrapper = mount(SessionEndedView, { global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Сесію завершено')
    await wrapper.get('[data-testid="session-ended-login"]').trigger('click')
    expect(location.href).toBe('/start')
  })
})
