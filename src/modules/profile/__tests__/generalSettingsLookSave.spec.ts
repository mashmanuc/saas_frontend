/**
 * Вигляд помічника у формі налаштувань (власник 2026-10-12, знімок: обрав «Інтегралку», а «Зберегти»
 * лишилась сірою — «після зміни треба активувати кнопку "зберегти" — щоб вікно закривалось»;
 * обрав «Зберегти й повернутися назад»).
 *
 * Монтуємо справжню вкладку з Pinia й i18n; підмінено лише мережу, повідомлення й роутер.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const h = vi.hoisted(() => ({
  updateUserSettings: vi.fn(),
  getUserSettings: vi.fn(),
  router: { back: vi.fn(), push: vi.fn() },
}))
vi.mock('@/api/users', () => ({ getUserSettings: h.getUserSettings, updateUserSettings: h.updateUserSettings }))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({
  fetchCorridorRegistry: vi.fn().mockRejectedValue({ response: { status: 404 } }),
}))
vi.mock('@/utils/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
vi.mock('vue-router', async (orig) => ({ ...(await orig<typeof import('vue-router')>()), useRouter: () => h.router }))
// Налаштування помічника бачить лише вчитель (і персонал) — як у settingsIntegralykRole.spec.
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => ({ user: { id: 1, role: 'tutor' } }) }))

import GeneralSettingsTab from '../components/settings/GeneralSettingsTab.vue'
import { useProfileStore } from '../store/profileStore'
import { i18n } from '@/i18n'

let pinia: ReturnType<typeof createPinia>

async function mountTab() {
  const w = mount(GeneralSettingsTab, { global: { plugins: [pinia, i18n] } })
  await flushPromises()
  return w
}

const save = (w: ReturnType<typeof mount>) => w.find('button[type="submit"]')
const card = (w: ReturnType<typeof mount>, look: string) => w.find(`[data-testid="assistant-look-${look}"]`)

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  vi.clearAllMocks()
  h.updateUserSettings.mockImplementation(async (p: Record<string, unknown>) => ({ ...p }))
  useProfileStore().settings = {
    ui_language: 'uk', timezone: 'Europe/Kyiv', integralyk_enabled: true,
    integralyk_appearance: 'integralyk', teaching_subjects: [],
  }
  window.history.replaceState({ back: '/winterboard/boards' }, '')
})

describe('вигляд помічника — частина форми', () => {
  it('зміна вигляду вмикає «Зберегти», але ще нічого не зберігає', async () => {
    const w = await mountTab()
    expect(save(w).attributes('disabled')).toBeDefined()

    await card(w, 'integralka').trigger('click')

    expect(save(w).attributes('disabled')).toBeUndefined()
    expect(card(w, 'integralka').attributes('aria-checked')).toBe('true')
    expect(useProfileStore().settings.integralyk_appearance).toBe('integralyk')   // ще не збережено
    expect(h.updateUserSettings).not.toHaveBeenCalled()
  })

  it('«Скинути» повертає попередній вигляд', async () => {
    const w = await mountTab()
    await card(w, 'integralka').trigger('click')
    await w.findAll('button[type="button"]').find((b) => b.text() === i18n.global.t('ui.reset'))!.trigger('click')

    expect(card(w, 'integralyk').attributes('aria-checked')).toBe('true')
    expect(save(w).attributes('disabled')).toBeDefined()
  })

  it('«Зберегти» зберігає вигляд, застосовує його й повертає туди, звідки прийшли', async () => {
    const w = await mountTab()
    await card(w, 'integralka').trigger('click')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(h.updateUserSettings).toHaveBeenCalledWith(expect.objectContaining({ integralyk_appearance: 'integralka' }))
    expect(useProfileStore().settings.integralyk_appearance).toBe('integralka')
    expect(h.router.back).toHaveBeenCalledTimes(1)
    expect(h.router.push).not.toHaveBeenCalled()
  })

  it('відкрили напряму чи з іншої вкладки налаштувань — після збереження на головну', async () => {
    window.history.replaceState({ back: '/settings/contacts' }, '')
    const w = await mountTab()
    await card(w, 'integralka').trigger('click')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(h.router.push).toHaveBeenCalledWith('/')
    expect(h.router.back).not.toHaveBeenCalled()
  })

  it('сервер відмовив — сторінка лишається, вигляд не змінено', async () => {
    h.updateUserSettings.mockRejectedValueOnce(new Error('500'))
    const w = await mountTab()
    await card(w, 'integralka').trigger('click')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(useProfileStore().settings.integralyk_appearance).toBe('integralyk')
    expect(h.router.back).not.toHaveBeenCalled()
    expect(h.router.push).not.toHaveBeenCalled()
  })
})
