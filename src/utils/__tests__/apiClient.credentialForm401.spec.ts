// Б-37 (2026-09-27): 401 форми входу — відповідь форми, а не стан сесії.
//
// `POST /v1/auth/login` на невірний пароль відповідає 401 `invalid_credentials`.
// Гілка 401 обробника відповіді виключала лише refresh і logout, тож:
//  - анонімний відвідувач поруч із «Невірний email або пароль» отримував ще й тост
//    «Сесію завершено. Увійдіть знову.» (відтворено наживо 2026-09-26);
//  - якщо в сторі лишався `access` (роутер пускає на форму, коли немає `user`) —
//    refresh, повтор того самого невірного пароля, знову 401 і forceLogout.
//
// Межа — ендпойнти, що сесії не читають зовсім (`authentication_classes = []` на
// бекенді): login, register, google, google/register. Решта `/auth/*` з
// `M4SHJWTAuthentication` (mfa/verify, reset-password, oauth/google/link…) дає 401 і від
// протухлого токена — там refresh лишається (контрольні тести нижче).
//
// Моки — за зразком apiClient.ownCancel.spec.ts; стор змінний, адаптер — на кожен тест.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'

const SESSION_EXPIRED = 'Сесію завершено. Увійдіть знову.'

const h = vi.hoisted(() => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  store: {
    access: null as string | null,
    accessExp: 0,
    lastRefreshAt: 0,
    csrfToken: 'csrf-token',
    sessionExpiredNotified: false,
    refreshAccess: vi.fn(),
    ensureCsrfToken: vi.fn(),
    forceLogout: vi.fn(),
  },
}))

vi.mock('../../modules/auth/store/authStore', () => ({
  useAuthStore: () => h.store,
}))

vi.mock('../../stores/loaderStore', () => ({
  useLoaderStore: () => ({ start: vi.fn(), stop: vi.fn() }),
}))

vi.mock('../notify', () => ({
  notifyError: h.notifyError,
  notifyWarning: h.notifyWarning,
}))

vi.mock('../../core/auth/onAuthDeath', () => ({
  isAuthDead: () => false,
}))

vi.mock('../telemetryAgent', () => ({
  trackEvent: vi.fn(),
}))

import apiClient, { resetCircuitBreaker } from '../apiClient'

type AdapterConfig = { url?: string }
type Adapter = (config: AdapterConfig) => Promise<unknown>

const ok = (config: AdapterConfig) => ({
  data: { ok: true, url: config.url },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  request: {},
})

// Як xhr-адаптер axios на 401: AxiosError з response.
const unauthorized = (config: AdapterConfig, error = 'invalid_credentials') => {
  throw new axios.AxiosError('Request failed with status code 401', axios.AxiosError.ERR_BAD_REQUEST,
    config as never, {}, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: config as never,
      data: { error, message: 'Невірний email або пароль.' },
    })
}

const adapter = vi.fn<Adapter>()

function loggedIn() {
  // Свіжий токен: проактивний refresh request-інтерсептора не втручається.
  h.store.access = 'access-token'
  h.store.accessExp = Math.floor(Date.now() / 1000) + 3600
  h.store.lastRefreshAt = Date.now()
}

beforeEach(() => {
  vi.clearAllMocks()
  h.store.access = null
  h.store.accessExp = 0
  h.store.lastRefreshAt = 0
  h.store.sessionExpiredNotified = false
  resetCircuitBreaker()
  ;(apiClient as unknown as { defaults: { adapter: typeof adapter } }).defaults.adapter = adapter
})

afterEach(() => {
  resetCircuitBreaker()
})

const FORM_ENDPOINTS = ['/v1/auth/login', '/v1/auth/register', '/v1/auth/google', '/v1/auth/google/register/']

describe('Б-37 — 401 форми входу не вважається завершеною сесією', () => {
  it.each(FORM_ENDPOINTS)('анонім, %s → 401 іде формі; тосту «Сесію завершено» нема', async (url) => {
    adapter.mockImplementation(async (config) => unauthorized(config))

    const err = await apiClient.post(url, { email: 'a@b.c', password: 'bad' }).catch((e: unknown) => e)

    // Форма отримує саму відповідь — з неї вона й показує «Невірний email або пароль».
    expect((err as { response?: { status: number } }).response?.status).toBe(401)
    expect((err as { response?: { data: { error: string } } }).response?.data.error).toBe('invalid_credentials')
    expect(h.notifyWarning).not.toHaveBeenCalledWith(SESSION_EXPIRED)
    expect(h.store.refreshAccess).not.toHaveBeenCalled()
    expect(h.store.forceLogout).not.toHaveBeenCalled()
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('email не підтверджено (теж 401) — так само лише відповідь формі', async () => {
    adapter.mockImplementation(async (config) => unauthorized(config, 'email_not_verified'))

    const err = await apiClient.post('/v1/auth/login', { email: 'a@b.c', password: 'x' }).catch((e: unknown) => e)

    expect((err as { response?: { data: { error: string } } }).response?.data.error).toBe('email_not_verified')
    expect(h.notifyWarning).not.toHaveBeenCalled()
  })

  it('у сторі лишився access: невірний пароль не запускає refresh, повтор і вихід', async () => {
    loggedIn()
    adapter.mockImplementation(async (config) => unauthorized(config))

    const err = await apiClient.post('/v1/auth/login', { email: 'other@b.c', password: 'bad' })
      .catch((e: unknown) => e)

    expect((err as { response?: { status: number } }).response?.status).toBe(401)
    // Ні refresh, ні повтору того самого пароля, ні виходу — чинна сесія ціла.
    expect(h.store.refreshAccess).not.toHaveBeenCalled()
    expect(adapter).toHaveBeenCalledTimes(1)
    expect(h.store.forceLogout).not.toHaveBeenCalled()
    expect(h.store.access).toBe('access-token')
    expect(h.notifyWarning).not.toHaveBeenCalled()
  })
})

describe('Б-37 — контроль: там, де 401 буває від протухлого токена, refresh лишається', () => {
  it.each([
    '/v1/auth/login?next=/studio',
    '/v1/auth/login/',
  ])('форма входу з query чи кінцевим «/» (%s) — теж форма', async (url) => {
    loggedIn()
    adapter.mockImplementation(async (config) => unauthorized(config))

    await apiClient.post(url, { email: 'a@b.c', password: 'bad' }).catch(() => undefined)

    expect(h.store.refreshAccess).not.toHaveBeenCalled()
    expect(h.store.forceLogout).not.toHaveBeenCalled()
  })

  it.each([
    '/v1/me/',
    '/v1/auth/oauth/google/link',   // схоже ім'я, але вимагає сесії
    '/v1/auth/mfa/verify',          // AllowAny, але з M4SHJWTAuthentication
    '/v1/auth/login-history',       // межа імені: лише сам `login`, не все, що з нього починається
  ])('залогінений, %s → 401 → refresh і повтор', async (url) => {
    loggedIn()
    h.store.refreshAccess.mockResolvedValue('new-access')
    adapter
      .mockImplementationOnce(async (config) => unauthorized(config, 'authentication_required'))
      .mockImplementation(async (config) => ok(config))

    const res = await apiClient.post(url, {})

    expect(h.store.refreshAccess).toHaveBeenCalledTimes(1)
    expect(adapter).toHaveBeenCalledTimes(2)
    expect((res as { ok: boolean }).ok).toBe(true)
  })

  it('анонім, звичайний ендпойнт → 401 → тост «Сесію завершено», як і раніше', async () => {
    adapter.mockImplementation(async (config) => unauthorized(config, 'authentication_required'))

    await apiClient.get('/v1/me/').catch(() => undefined)

    expect(h.notifyWarning).toHaveBeenCalledWith(SESSION_EXPIRED)
  })
})
