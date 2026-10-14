/**
 * «Налаштування» учня — без помічника (власник 2026-10-14, знімок прода: учень бачив вимикач
 * «Помічник Інтегралик» і вибір вигляду «Інтегралик / Інтегралка»). Помічник — інструмент учителя:
 * учень за нього не платить і не має права ним користуватися. Сервер учня й так не пускає
 * (`IsIntegralykUser` → 403), вікно помічника — теж (`canUseIntegralyk`); тепер і форма налаштувань
 * бере те саме правило ролей (`isIntegralykRole`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const auth = vi.hoisted(() => ({ user: { id: 1, role: 'tutor' } as { id: number; role: string; is_staff?: boolean } | null }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => auth }))
vi.mock('@/modules/profile/store/profileStore', () => ({
  useProfileStore: () => ({
    settings: { ui_language: 'uk', timezone: 'Europe/Kyiv', integralyk_enabled: true, teaching_subjects: [] },
  }),
}))
vi.mock('@/api/users', () => ({ getUserSettings: vi.fn(async () => ({})), updateUserSettings: vi.fn(async () => ({})) }))
vi.mock('@/utils/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
const corridor = vi.hoisted(() => ({ fetchCorridorRegistry: vi.fn(async () => ({ available_subjects: [{ id: 'math', label: 'Математика' }] })) }))
vi.mock('@/modules/intent/corridors/corridorApi', () => corridor)
vi.mock('@/i18n', () => ({ i18n: { global: { locale: { value: 'uk' } } }, setLocale: vi.fn() }))

import GeneralSettingsTab from '../components/settings/GeneralSettingsTab.vue'
import { isIntegralykRole, canUseIntegralyk } from '@/modules/intent/integralykAccess'

let wrapper: VueWrapper | null = null
afterEach(() => { wrapper?.unmount(); wrapper = null; corridor.fetchCorridorRegistry.mockClear() })

async function mountAs(user: typeof auth.user) {
  auth.user = user
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  wrapper = mount(GeneralSettingsTab, {
    global: { plugins: [i18n], stubs: { AssistantLookPicker: { template: '<div data-testid="look-picker" />' } } },
  })
  await flushPromises()
  return wrapper
}

describe('«Налаштування»: помічник лише тим, кому він доступний', () => {
  it('учень — без вимикача помічника, без вибору вигляду, без «Моїх предметів»; коридори не питаємо', async () => {
    const w = await mountAs({ id: 7, role: 'student' })
    expect(w.find('[data-testid="integralyk-setting"]').exists()).toBe(false)
    expect(w.find('[data-testid="assistant-look-setting"]').exists()).toBe(false)
    expect(w.find('[data-testid="teaching-subjects"]').exists()).toBe(false)
    expect(corridor.fetchCorridorRegistry).not.toHaveBeenCalled()
    // Мова й часовий пояс — як і були.
    expect(w.find('select').exists()).toBe(true)
  })

  it('учитель — усе як раніше', async () => {
    const w = await mountAs({ id: 40, role: 'tutor' })
    expect(w.find('[data-testid="integralyk-setting"]').exists()).toBe(true)
    expect(w.find('[data-testid="assistant-look-setting"]').exists()).toBe(true)
    expect(w.find('[data-testid="teaching-subjects"]').exists()).toBe(true)
  })

  it('правило ролей одне для вікна помічника й налаштувань', () => {
    expect(isIntegralykRole({ role: 'student' })).toBe(false)
    expect(isIntegralykRole(null)).toBe(false)
    expect(isIntegralykRole({ role: 'tutor' })).toBe(true)
    expect(isIntegralykRole({ role: 'student', is_staff: true })).toBe(true)
    expect(canUseIntegralyk({ role: 'student' }, { path: '/settings' })).toBe(false)
    expect(canUseIntegralyk({ role: 'tutor' }, { path: '/settings' })).toBe(true)
  })
})
