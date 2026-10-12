// Б-161 (2026-10-12, власник: «роби Б-161»): автоповтор запиту з новим CSRF-токеном був мертвий.
//
// `isCsrfError` пропускав лише статус 400, а сервер на `/api/v1/auth/*` і `/api/v1/me*`
// (`VAuthAPIView` і `secure_endpoint`, `apps/users/api/views_v1_base.py`) відповідає на відсутній
// чи чужий токен 422 `{"error": "validation_failed", "fields": {"csrf": ["missing"]}}`. Гілка
// «взяти токен через /auth/csrf і повторити раз» не спрацьовувала ніколи. Серед захищених —
// і `/auth/refresh/`: 422 від нього `authStore.refreshAccess` вважає мертвою сесією й виходить.
//
// Тут справжній apiClient, підставний «сервер» перевіряє cookie `csrf` і заголовок
// `X-CSRF-Token`, як `VAuthAPIView.initial`. Моки — за зразком apiClient.credentialForm401.spec.ts.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'

const h = vi.hoisted(() => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  store: {
    access: null as string | null,
    accessExp: 0,
    lastRefreshAt: 0,
    csrfToken: null as string | null,
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

type Config = { url?: string; method?: string; headers?: Record<string, unknown> & { get?: (k: string) => unknown } }

const FRESH = 'fresh-token'

function cookieCsrf(): string | null {
  const m = document.cookie.match(/(?:^|; )csrf=([^;]*)/)
  return m ? m[1] : null
}

function clearCsrfCookie() {
  document.cookie = 'csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

function headerToken(config: Config): unknown {
  return config.headers?.get?.('X-CSRF-Token') ?? config.headers?.['X-CSRF-Token']
}

const ok = (config: Config) => ({
  data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config, request: {},
})

function reject(config: Config, status: number, data: unknown): never {
  throw new axios.AxiosError(`Request failed with status code ${status}`, axios.AxiosError.ERR_BAD_REQUEST,
    config as never, {}, { status, statusText: '', headers: {}, config: config as never, data })
}

// Як VAuthAPIView: 422 validation_failed з полем csrf.
const vauth422 = (config: Config, why: 'missing' | 'invalid') => reject(config, 422, {
  error: 'validation_failed', fields: { csrf: [why] }, message: 'Перевір поля форми та виправ помилки.',
})

// Підставний сервер: POST лише з cookie csrf і таким самим заголовком.
const server = vi.fn(async (config: Config) => {
  if (String(config.method).toUpperCase() !== 'POST') return ok(config)
  const cookie = cookieCsrf()
  const header = headerToken(config)
  if (!cookie || !header) return vauth422(config, 'missing')
  if (cookie !== header) return vauth422(config, 'invalid')
  return ok(config)
})

beforeEach(() => {
  vi.clearAllMocks()
  clearCsrfCookie()
  // Свіжий токен доступу: проактивний refresh request-інтерсептора не втручається.
  h.store.access = 'access-token'
  h.store.accessExp = Math.floor(Date.now() / 1000) + 3600
  h.store.lastRefreshAt = Date.now()
  h.store.csrfToken = null
  // Як authStore.ensureCsrfToken: GET /auth/csrf ставить cookie (асинхронно, як мережа).
  h.store.ensureCsrfToken.mockImplementation(async () => {
    await new Promise((r) => setTimeout(r, 5))
    document.cookie = `csrf=${FRESH}; path=/`
    h.store.csrfToken = FRESH
  })
  resetCircuitBreaker()
  ;(apiClient as unknown as { defaults: { adapter: unknown } }).defaults.adapter = server
})

afterEach(() => {
  clearCsrfCookie()
  resetCircuitBreaker()
})

describe('Б-161 — 422 csrf від сервера: новий токен і один повтор', () => {
  it.each([
    '/v1/me/settings/',
    '/v1/auth/refresh/',
    '/v1/auth/logout/',
  ])('немає cookie csrf, %s → токен узято, запит повторено й прийнято', async (url) => {
    const res = await apiClient.post(url, {})

    expect((res as { ok?: boolean }).ok ?? (res as { data?: { ok: boolean } }).data?.ok).toBe(true)
    expect(h.store.ensureCsrfToken).toHaveBeenCalledTimes(1)
    expect(server).toHaveBeenCalledTimes(2)
    expect(headerToken(server.mock.calls[1][0] as Config)).toBe(FRESH)
    expect(h.store.forceLogout).not.toHaveBeenCalled()
  })

  it('чужий токен (csrf: invalid) → так само один повтор зі свіжим', async () => {
    document.cookie = 'csrf=cookie-token; path=/'
    h.store.csrfToken = 'stale'

    await apiClient.post('/v1/me/settings/', {}, { headers: { 'X-CSRF-Token': 'stale' } })

    expect(h.store.ensureCsrfToken).toHaveBeenCalledTimes(1)
    expect(server).toHaveBeenCalledTimes(2)
    expect(headerToken(server.mock.calls[1][0] as Config)).toBe(FRESH)
  })

  it('старий формат 400 {csrf: ["missing"]} теж повторюється', async () => {
    server.mockImplementationOnce(async (config: Config) => reject(config, 400, { csrf: ['missing'] }))
    document.cookie = `csrf=${FRESH}; path=/`

    await apiClient.post('/v1/legacy/', {})

    expect(h.store.ensureCsrfToken).toHaveBeenCalledTimes(1)
    expect(server).toHaveBeenCalledTimes(2)
  })

  it('422 з іншими полями (не csrf) — без повтору й без запиту токена', async () => {
    server.mockImplementationOnce(async (config: Config) => reject(config, 422, {
      error: 'validation_failed', fields: { email: ['invalid'] },
    }))
    document.cookie = `csrf=${FRESH}; path=/`

    const err = await apiClient.post('/v1/me/', {}).catch((e: unknown) => e)

    expect((err as { response?: { status: number } }).response?.status).toBe(422)
    expect(h.store.ensureCsrfToken).not.toHaveBeenCalled()
    expect(server).toHaveBeenCalledTimes(1)
  })

  it('повтор лише один: сервер знову відмовив — помилка йде далі, без циклу', async () => {
    h.store.ensureCsrfToken.mockImplementation(async () => {}) // токен так і не з'явився

    const err = await apiClient.post('/v1/me/settings/', {}).catch((e: unknown) => e)

    expect((err as { response?: { status: number } }).response?.status).toBe(422)
    expect(h.store.ensureCsrfToken).toHaveBeenCalledTimes(1)
    expect(server).toHaveBeenCalledTimes(2)
  })

  it('два запити одночасно — токен беремо один раз, обидва повторені й прийняті', async () => {
    const [a, b] = await Promise.all([
      apiClient.post('/v1/me/settings/', {}),
      apiClient.post('/v1/me/preferences/', {}),
    ])

    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(h.store.ensureCsrfToken).toHaveBeenCalledTimes(1)
    expect(server).toHaveBeenCalledTimes(4)
  })
})
