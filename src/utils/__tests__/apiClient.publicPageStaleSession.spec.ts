// Б-36 (2026-09-27): 401 від refresh на публічній сторінці — без тосту й без виходу на /start.
//
// Наживо на `origin/master`: посилання скидання пароля з листа при протухлій позначці
// сесії → bootstrap → `POST /auth/refresh/` 401 → гілка refresh обробника відповіді
// показувала «Сесію завершено» і робила `router.push('/start')`. Сесію знімаємо й
// далі (forceLogout), але людину з публічної сторінки не виводимо.
//
// Моки — за зразком apiClient.credentialForm401.spec.ts; роутер — з `resolve`
// (справжні метадані звіряє publicLocation.realRouter.spec.ts).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'

const SESSION_EXPIRED = 'Сесію завершено. Увійдіть знову.'

const h = vi.hoisted(() => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  push: vi.fn(async () => undefined),
  store: {
    access: '__cookie__' as string | null,
    accessExp: 0,
    lastRefreshAt: 0,
    csrfToken: 'csrf-token',
    sessionExpiredNotified: false,
    refreshAccess: vi.fn(),
    ensureCsrfToken: vi.fn(),
    forceLogout: vi.fn(),
  },
}))

vi.mock('../../modules/auth/store/authStore', () => ({ useAuthStore: () => h.store }))
vi.mock('../../stores/loaderStore', () => ({ useLoaderStore: () => ({ start: vi.fn(), stop: vi.fn() }) }))
vi.mock('../notify', () => ({ notifyError: h.notifyError, notifyWarning: h.notifyWarning }))
vi.mock('../../core/auth/onAuthDeath', () => ({ isAuthDead: () => false }))
vi.mock('../telemetryAgent', () => ({ trackEvent: vi.fn() }))

const PUBLIC = ['/auth/', '/start', '/winterboard/public/']
vi.mock('../../router', () => ({
  default: {
    push: h.push,
    resolve: (href: string) => ({
      matched: [{ meta: PUBLIC.some((p) => href.startsWith(p)) ? { requiresAuth: false } : {} }],
    }),
  },
}))

import apiClient, { resetCircuitBreaker } from '../apiClient'

type AdapterConfig = { url?: string }
const unauthorized = (config: AdapterConfig) => {
  throw new axios.AxiosError('Request failed with status code 401', axios.AxiosError.ERR_BAD_REQUEST,
    config as never, {}, {
      status: 401, statusText: 'Unauthorized', headers: {}, config: config as never,
      data: { error: 'invalid_credentials' },
    })
}
const adapter = vi.fn(async (config: AdapterConfig) => unauthorized(config))

const originalLocation = window.location
function stubLocation(pathname: string, search = '') {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname, search, href: `http://localhost${pathname}${search}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.store.access = '__cookie__'
  h.store.sessionExpiredNotified = false
  h.store.forceLogout.mockImplementation(async () => { h.store.access = null })
  resetCircuitBreaker()
  ;(apiClient as unknown as { defaults: { adapter: typeof adapter } }).defaults.adapter = adapter
})

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  resetCircuitBreaker()
})

describe('Б-36 · refresh 401 на публічній сторінці', () => {
  it.each([
    ['/auth/reset-password', '?uid=1&token=abc'],
    ['/auth/verify-email', '?token=abc'],
    ['/winterboard/public/abc123', ''],
  ])('%s — сесію знято, але ні тосту, ні переходу', async (pathname, search) => {
    stubLocation(pathname, search)

    await apiClient.post('/v1/auth/refresh/', {}).catch(() => undefined)

    expect(h.store.forceLogout).toHaveBeenCalled()
    expect(h.notifyWarning).not.toHaveBeenCalledWith(SESSION_EXPIRED)
    expect(h.push).not.toHaveBeenCalled()
  })

  it.each([
    ['/winterboard/public/abc123', false],
    ['/tutor', true],
  ])('реактивний refresh після 401 запиту (%s) — те саме правило (тост і /start: %s)', async (pathname, expectExit) => {
    stubLocation(pathname)
    h.store.access = 'access-token'
    h.store.accessExp = Math.floor(Date.now() / 1000) + 3600
    h.store.refreshAccess.mockRejectedValue(Object.assign(new Error('refresh 401'), { response: { status: 401 } }))

    await apiClient.get('/v1/me/').catch(() => undefined)

    expect(h.store.forceLogout).toHaveBeenCalledWith('session_expired')
    expect(h.notifyWarning.mock.calls.some(([m]) => m === SESSION_EXPIRED)).toBe(expectExit)
    expect(h.push.mock.calls.length > 0).toBe(expectExit)
  })

  it('контроль: сторінка з даними — тост і /start, як і раніше', async () => {
    stubLocation('/tutor')

    await apiClient.post('/v1/auth/refresh/', {}).catch(() => undefined)

    expect(h.store.forceLogout).toHaveBeenCalled()
    expect(h.notifyWarning).toHaveBeenCalledWith(SESSION_EXPIRED)
    expect(h.push).toHaveBeenCalledWith('/start')
  })
})
