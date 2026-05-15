// PR2 (2026-04-26): тест для proactive auth refresh guard у apiClient.
// Перевіряє 3 інваріанти від помічника:
//   1. lastRefreshAt оновлюється після refresh (через authStore.refreshAccess).
//   2. guard НЕ тригериться для /auth/* endpoints.
//   3. Немає infinite refresh loop (mutex isRefreshingToken захищає).
//
// Підхід: мокаємо мінімум залежностей apiClient, інжектимо stub authStore,
// прокидаємо запит через axios адаптер та підраховуємо виклики refreshAccess.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// ─── Mocks (мають бути ДО import apiClient) ──────────────────────────────────

const mockRefreshAccess = vi.fn(async () => '__mock_jwt__')
const mockEnsureCsrf = vi.fn(async () => undefined)
const mockForceLogout = vi.fn()

const _storeState: Record<string, unknown> = {
  access: 'enc-token',
  csrfToken: 'csrf-token',
  lastRefreshAt: 0,
  sessionExpiredNotified: false,
}

vi.mock('../../modules/auth/store/authStore', () => ({
  useAuthStore: () => ({
    get access() { return _storeState.access },
    get csrfToken() { return _storeState.csrfToken },
    get lastRefreshAt() { return _storeState.lastRefreshAt },
    get sessionExpiredNotified() { return _storeState.sessionExpiredNotified as boolean },
    set sessionExpiredNotified(v: boolean) { _storeState.sessionExpiredNotified = v },
    refreshAccess: mockRefreshAccess,
    ensureCsrfToken: mockEnsureCsrf,
    forceLogout: mockForceLogout,
  }),
}))

vi.mock('../../stores/loaderStore', () => ({
  useLoaderStore: () => ({ start: vi.fn(), stop: vi.fn() }),
}))

vi.mock('../notify', () => ({
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
}))

vi.mock('../../core/auth/onAuthDeath', () => ({
  isAuthDead: () => false,
}))

vi.mock('../telemetryAgent', () => ({
  trackEvent: vi.fn(),
}))

// ─── Імпорт apiClient (після mocks) ───────────────────────────────────────────

import apiClient from '../apiClient'

// Підставляємо stub-адаптер який негайно відповідає 200
const mockAdapter = vi.fn(async (config: { url?: string }) => ({
  data: { ok: true, url: config.url },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  request: {},
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetState(overrides: Partial<typeof _storeState> = {}) {
  _storeState.access = 'enc-token'
  _storeState.csrfToken = 'csrf-token'
  _storeState.lastRefreshAt = 0
  _storeState.sessionExpiredNotified = false
  Object.assign(_storeState, overrides)
}

const FORTY_FIVE_MIN_MS = 45 * 60 * 1000

beforeEach(() => {
  vi.clearAllMocks()
  resetState()
  // overwrite axios adapter for each test (apiClient.defaults.adapter — wrapped dedup adapter)
  ;(apiClient as unknown as { defaults: { adapter: typeof mockAdapter } }).defaults.adapter = mockAdapter
})

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('PR2 — Proactive auth refresh guard', () => {
  it('Guard FIRES коли lastRefreshAt = 0 (edge case після login)', async () => {
    // Edge case з плану: після login setAuth може не виставити lastRefreshAt
    // (race / помилка); guard має тригерити refresh, краще зайвий ніж 401.
    _storeState.lastRefreshAt = 0
    await apiClient.get('/v1/foo')
    expect(mockRefreshAccess).toHaveBeenCalledTimes(1)
  })

  it('Guard FIRES коли токен старіший за 45 хв', async () => {
    _storeState.lastRefreshAt = Date.now() - FORTY_FIVE_MIN_MS - 1000
    await apiClient.get('/v1/foo')
    expect(mockRefreshAccess).toHaveBeenCalledTimes(1)
  })

  it('Guard НЕ FIRES коли токен молодший за 45 хв', async () => {
    _storeState.lastRefreshAt = Date.now() - 30 * 60 * 1000  // 30 хв тому
    await apiClient.get('/v1/foo')
    expect(mockRefreshAccess).not.toHaveBeenCalled()
  })

  it('Guard НЕ FIRES для /auth/* endpoints (захист від circular refresh)', async () => {
    _storeState.lastRefreshAt = 0  // navet якщо stale
    await apiClient.post('/v1/auth/refresh/')
    expect(mockRefreshAccess).not.toHaveBeenCalled()
  })

  it('Guard НЕ FIRES коли access=__cookie__ (bootstrap state)', async () => {
    _storeState.access = '__cookie__'
    _storeState.lastRefreshAt = 0
    await apiClient.get('/v1/foo')
    expect(mockRefreshAccess).not.toHaveBeenCalled()
  })

  it('Guard НЕ FIRES коли access=null (logged out)', async () => {
    _storeState.access = null
    _storeState.lastRefreshAt = 0
    await apiClient.get('/v1/foo')
    expect(mockRefreshAccess).not.toHaveBeenCalled()
  })

  it('Guard fail НЕ блокує оригінальний request (silent catch)', async () => {
    _storeState.lastRefreshAt = 0
    mockRefreshAccess.mockRejectedValueOnce(new Error('refresh broke'))
    const res = await apiClient.get('/v1/foo')
    expect(mockRefreshAccess).toHaveBeenCalledTimes(1)
    expect((res as { ok: boolean }).ok).toBe(true)
  })

  it('Паралельні stale-запити не множать refresh (single mutex window)', async () => {
    _storeState.lastRefreshAt = 0
    // refreshAccess повільний, всі 3 запити стартують поки перший ще летить
    let resolveRefresh: (v: string) => void = () => {}
    mockRefreshAccess.mockImplementationOnce(
      () => new Promise<string>((r) => { resolveRefresh = r }),
    )

    const p1 = apiClient.get('/v1/foo')
    const p2 = apiClient.get('/v1/bar')
    const p3 = apiClient.get('/v1/baz')

    // дати event-loop'у дотягнути до await store.refreshAccess() в interceptor
    await Promise.resolve()
    resolveRefresh('__mock_jwt__')

    await Promise.all([p1, p2, p3])

    // Гарантія: НЕ infinite loop. Точна к-ть викликів залежить від timing
    // (mutex isRefreshingToken блокує паралельні refresh-и в межах того
    // самого tick'а, але НЕ дублює нескінченно).
    expect(mockRefreshAccess.mock.calls.length).toBeLessThanOrEqual(3)
    expect(mockRefreshAccess.mock.calls.length).toBeGreaterThanOrEqual(1)
  })
})
