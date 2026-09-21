/**
 * «Мої предмети» у налаштуваннях (рішення власника 2026-09-21).
 *
 * Інваріант: профіль — ВИДИМІСТЬ і дефолт Інтегралика, не дозвіл.
 *   • «Усі предмети» — за замовчуванням (`teaching_subjects: []`);
 *   • список — лише активні предмети з реєстру сервера (`available_subjects`),
 *     без `general` (це стан «Авто», не предмет);
 *   • коридори для акаунта закриті (реєстр 404) → секції немає;
 *   • незмінений вибір на сервер не шлемо — інакше кеш без поля стер би його.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  getUserSettings: vi.fn(),
  updateUserSettings: vi.fn(),
  fetchCorridorRegistry: vi.fn(),
  store: { settings: null as Record<string, unknown> | null },
}))

vi.mock('@/api/users', () => ({
  getUserSettings: api.getUserSettings,
  updateUserSettings: api.updateUserSettings,
}))
vi.mock('@/modules/intent/corridors/corridorApi', () => ({
  fetchCorridorRegistry: api.fetchCorridorRegistry,
}))
vi.mock('@/utils/notify', () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }))
vi.mock('../store/profileStore', () => ({ useProfileStore: () => api.store }))

import { i18n } from '@/i18n'
import GeneralSettingsTab from '../components/settings/GeneralSettingsTab.vue'

// Реєстр історика: у `subjects` лише історія, але `available_subjects` — усі активні.
const REGISTRY = {
  subjects: [{ id: 'general', labels: { uk: 'Загальний', en: 'General' } },
             { id: 'history', labels: { uk: 'Історія', en: 'History' } }],
  lockable_subjects: ['history'],
  available_subjects: [
    { id: 'general', labels: { uk: 'Загальний', en: 'General' } },
    { id: 'math', labels: { uk: 'Математика', en: 'Mathematics' } },
    { id: 'history', labels: { uk: 'Історія', en: 'History' } },
  ],
}

function settings(teaching_subjects: string[] | undefined = []) {
  return { ui_language: 'uk', timezone: 'Europe/Kyiv', integralyk_enabled: true,
           ...(teaching_subjects ? { teaching_subjects } : {}) }
}

async function mountTab() {
  const w = mount(GeneralSettingsTab, { global: { plugins: [i18n] } })
  await flushPromises()
  return w
}

const box = (w: any, id: string) => w.get(`[data-testid="${id}"]`).element as HTMLInputElement

beforeEach(() => {
  vi.clearAllMocks()
  i18n.global.locale.value = 'uk'
  api.store.settings = null
  api.fetchCorridorRegistry.mockResolvedValue(REGISTRY)
  api.getUserSettings.mockResolvedValue(settings())
  api.updateUserSettings.mockImplementation(async (p: object) => ({ ...settings(), ...p }))
})

describe('«Мої предмети» · показ', () => {
  it('за замовчуванням — «Усі предмети», предмети відмічені й неактивні', async () => {
    const w = await mountTab()
    expect(box(w, 'teaching-subjects-all').checked).toBe(true)
    expect(box(w, 'teaching-subject-history').checked).toBe(true)
    expect(box(w, 'teaching-subject-history').disabled).toBe(true)
  })

  it('лише активні предмети з реєстру, без «Загального»', async () => {
    const w = await mountTab()
    const ids = w.findAll('[data-testid^="teaching-subject-"]').map(n => n.attributes('data-testid'))
    expect(ids).toEqual(['teaching-subject-math', 'teaching-subject-history'])
    expect(w.text()).toContain('Мої предмети')
    expect(w.text()).toContain('Усі предмети')
  })

  it('коридори закриті (реєстр 404) — секції немає', async () => {
    api.fetchCorridorRegistry.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }))
    const w = await mountTab()
    expect(w.find('[data-testid="teaching-subjects"]').exists()).toBe(false)
  })

  it('збережений вибір показується як є', async () => {
    api.getUserSettings.mockResolvedValue(settings(['history']))
    const w = await mountTab()
    expect(box(w, 'teaching-subjects-all').checked).toBe(false)
    expect(box(w, 'teaching-subject-history').checked).toBe(true)
    expect(box(w, 'teaching-subject-math').checked).toBe(false)
  })

  it('кеш профілю без поля — перечитуємо налаштування, а не вважаємо «Усі»', async () => {
    api.store.settings = { ui_language: 'uk', timezone: 'Europe/Kyiv', integralyk_enabled: true }
    api.getUserSettings.mockResolvedValue(settings(['history']))
    const w = await mountTab()
    expect(api.getUserSettings).toHaveBeenCalled()
    expect(box(w, 'teaching-subjects-all').checked).toBe(false)
  })
})

describe('«Мої предмети» · збереження', () => {
  it('зняли «Усі», прибрали математику → на сервер іде лише історія', async () => {
    const w = await mountTab()
    await w.get('[data-testid="teaching-subjects-all"]').setValue(false)
    expect(box(w, 'teaching-subject-math').checked).toBe(true)      // стартуємо з повного
    await w.get('[data-testid="teaching-subject-math"]').setValue(false)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateUserSettings).toHaveBeenCalledTimes(1)
    expect(api.updateUserSettings.mock.calls[0][0].teaching_subjects).toEqual(['history'])
  })

  it('прибрали всі предмети — це знову «Усі» ([]), а не порожній профіль', async () => {
    api.getUserSettings.mockResolvedValue(settings(['history']))
    const w = await mountTab()
    await w.get('[data-testid="teaching-subject-history"]').setValue(false)
    expect(box(w, 'teaching-subjects-all').checked).toBe(true)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateUserSettings.mock.calls[0][0].teaching_subjects).toEqual([])
  })

  it('змінили лише часовий пояс — `teaching_subjects` на сервер не йде', async () => {
    api.getUserSettings.mockResolvedValue(settings(['history']))
    const w = await mountTab()
    await w.get('#timezone').setValue('UTC')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.updateUserSettings.mock.calls[0][0]).not.toHaveProperty('teaching_subjects')
  })
})
