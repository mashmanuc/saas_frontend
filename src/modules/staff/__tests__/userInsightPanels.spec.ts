/**
 * Картка користувача в staff: «Пристрої й входи» і «Помилки».
 * Власник 2026-09-26 перед стартом реклами: «з якого гаджета зайшов вчитель і які
 * помилки в нього вийшли — це треба моніторити».
 *
 * Переклади — справжній uk.json: тест падає, якщо ключа немає (інакше в UI
 * стояв би сирий ключ `staff.insight…`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

vi.mock('@/api/staff', () => ({
  getUserSessions: vi.fn(),
  getUserErrors: vi.fn(),
}))

import { getUserSessions, getUserErrors } from '@/api/staff'
import UserDevicesPanel from '../components/UserDevicesPanel.vue'
import UserErrorsPanel from '../components/UserErrorsPanel.vue'

function i18n() {
  return createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
}

function mountWith(component: any) {
  return mount(component, { props: { userId: 42 }, global: { plugins: [i18n()] } })
}

beforeEach(() => {
  vi.mocked(getUserSessions).mockReset()
  vi.mocked(getUserErrors).mockReset()
})

describe('UserDevicesPanel', () => {
  it('показує пристрій людською мовою, країну і стан сесії', async () => {
    vi.mocked(getUserSessions).mockResolvedValue({
      count: 3,
      results: [
        {
          id: 'a', created_at: '2026-09-26T08:00:00Z', last_active_at: '2026-09-26T08:30:00Z', revoked_at: null,
          revocation_reason: '', status: 'open', country: 'UA', user_agent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
          device: { kind: 'phone', os: 'Android 14', browser: 'Chrome Mobile 153', model: 'Pixel 8' },
        },
        {
          id: 'b', created_at: '2026-09-25T08:00:00Z', last_active_at: null, revoked_at: '2026-09-25T09:00:00Z',
          revocation_reason: 'logout', status: 'ended', country: '', user_agent: '',
          device: { kind: 'computer', os: 'Windows 10', browser: 'Chrome 152', model: '' },
        },
      ],
    })
    const w = mountWith(UserDevicesPanel)
    await flushPromises()

    expect(getUserSessions).toHaveBeenCalledWith('42', { limit: 20 })
    const text = w.text()
    expect(text).toContain('Телефон · Android 14 · Chrome Mobile 153')
    expect(text).toContain('Pixel 8')
    expect(text).toContain('Країна: UA')
    expect(text).toContain("Комп'ютер · Windows 10 · Chrome 152")
    expect(text).toContain('Не завершена')
    expect(text).toContain('Завершена · вихід')
    expect(text).not.toContain('Активна')
    expect(text).toContain('Показано 2 з 3')
    expect(text).not.toContain('staff.insight')
  })

  it('сесія, мовчазна довше за строк refresh, — «Строк минув»; невідома причина — як є', async () => {
    vi.mocked(getUserSessions).mockResolvedValue({
      count: 2,
      results: [
        { id: 'c', created_at: '2026-06-01T08:00:00Z', last_active_at: '2026-06-01T09:00:00Z', revoked_at: null,
          revocation_reason: '', status: 'expired', country: '', user_agent: '',
          device: { kind: 'unknown', os: '', browser: '', model: '' } },
        { id: 'd', created_at: '2026-09-01T08:00:00Z', last_active_at: null, revoked_at: '2026-09-01T09:00:00Z',
          revocation_reason: 'mystery_reason', status: 'ended', country: '', user_agent: '',
          device: { kind: 'computer', os: 'Windows', browser: 'Chrome 152', model: '' } },
      ],
    })
    const w = mountWith(UserDevicesPanel)
    await flushPromises()

    expect(w.text()).toContain('Строк минув')
    expect(w.text()).toContain('Невідомий пристрій')
    expect(w.text()).toContain('Завершена · mystery_reason')
  })

  it('збій завантаження — це збій, а не «входів не було»', async () => {
    vi.mocked(getUserSessions).mockRejectedValue(new Error('500'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = mountWith(UserDevicesPanel)
    await flushPromises()

    expect(w.text()).toContain('Не вдалося завантажити входи')
    expect(w.text()).not.toContain('Входів ще не було')
  })
})

describe('UserErrorsPanel', () => {
  it('помилки сторінок і збої з телеметрії — людськими словами', async () => {
    vi.mocked(getUserErrors).mockResolvedValue({
      frontend_count: 5,
      frontend: [{
        id: 1, timestamp: '2026-09-26T08:10:00Z', severity: 'error', message: 'TypeError: boom',
        page: '/workspace', browser: 'Chrome 153', platform: 'Android', app_version: 'v1-abc',
        component: 'WBCanvas', resource_url: '', device_kind: 'phone', device: null,
      }],
      events_count: 1,
      events: [{ id: 7, timestamp: '2026-09-26T08:11:00Z', event_type: 'wb.ops.save_blocked',
                 details: { kind: 'final', http_status: 413 } }],
    })
    const w = mountWith(UserErrorsPanel)
    await flushPromises()

    const text = w.text()
    expect(text).toContain('помилка')
    expect(text).not.toMatch(/\berror\b/)
    expect(text).toContain('TypeError: boom')
    expect(text).toContain('/workspace')
    expect(text).toContain('Chrome 153 · Android')
    expect(text).toContain('Телефон')
    expect(text).toContain('WBCanvas')
    expect(text).toContain('v1-abc')
    expect(text).toContain('Показано 1 з 5')
    expect(text).toContain('Дошка не змогла зберегти зміни')
    expect(text).toContain('http_status: 413')
    expect(text).not.toContain('staff.insight')
  })

  it('пристрій з розбору бекенда (сирий UA) має перевагу над розбором фронту', async () => {
    vi.mocked(getUserErrors).mockResolvedValue({
      frontend_count: 1,
      frontend: [{
        id: 2, timestamp: '2026-09-26T08:10:00Z', severity: 'warning', message: 'm', page: '/start',
        browser: 'Chrome 129', platform: 'Linux', app_version: '', component: '', resource_url: '',
        device_kind: 'phone',
        device: { kind: 'phone', os: 'Android 14', browser: 'Chrome Mobile WebView 129', model: 'Samsung SM-S918B' },
      }],
      events_count: 0, events: [],
    })
    const w = mountWith(UserErrorsPanel)
    await flushPromises()

    expect(w.text()).toContain('Телефон · Android 14 · Chrome Mobile WebView 129')
    expect(w.text()).not.toContain('Chrome 129 · Linux')
    expect(w.text()).toContain('попередження')
  })

  it('невідомий тип події показується як є, а не порожнім рядком', async () => {
    vi.mocked(getUserErrors).mockResolvedValue({
      frontend_count: 0, frontend: [], events_count: 1,
      events: [{ id: 8, timestamp: '2026-09-26T08:12:00Z', event_type: 'booking.update_failed', details: {} }],
    })
    const w = mountWith(UserErrorsPanel)
    await flushPromises()

    expect(w.text()).toContain('booking.update_failed')
  })

  it('немає ні помилок, ні збоїв — так і кажемо', async () => {
    vi.mocked(getUserErrors).mockResolvedValue({ frontend_count: 0, frontend: [], events_count: 0, events: [] })
    const w = mountWith(UserErrorsPanel)
    await flushPromises()

    expect(w.text()).toContain('Помилок не зафіксовано')
  })

  it('збій завантаження — не «помилок немає»', async () => {
    vi.mocked(getUserErrors).mockRejectedValue(new Error('500'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const w = mountWith(UserErrorsPanel)
    await flushPromises()

    expect(w.text()).toContain('Не вдалося завантажити помилки')
    expect(w.text()).not.toContain('Помилок не зафіксовано')
  })
})
