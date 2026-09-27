// Б-51 (2026-09-27): контракт, на який спирається діалог «Є незбережені дії».
//
// Діалог відрізняє «запит не пішов — відкритий circuit breaker» від «сервер недоступний»
// за `reason.blockedBy === 'circuit_breaker'`. Тут — справжні apiClient і winterboardApi:
// п'ять мережевих збоїв відкривають breaker, і `getSession` відхиляється саме з цією
// позначкою (а не обгорнутою помилкою без неї).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'

vi.mock('@/modules/auth/store/authStore', () => ({
  useAuthStore: () => ({
    access: null, accessExp: 0, lastRefreshAt: 0, csrfToken: 'csrf-token',
    sessionExpiredNotified: false, refreshAccess: vi.fn(), ensureCsrfToken: vi.fn(), forceLogout: vi.fn(),
  }),
}))
vi.mock('@/stores/loaderStore', () => ({ useLoaderStore: () => ({ start: vi.fn(), stop: vi.fn() }) }))
vi.mock('@/utils/notify', () => ({ notifyError: vi.fn(), notifyWarning: vi.fn() }))
vi.mock('@/core/auth/onAuthDeath', () => ({ isAuthDead: () => false }))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))

import apiClient, { isCircuitBreakerOpen, resetCircuitBreaker } from '@/utils/apiClient'
import { winterboardApi } from '@/modules/winterboard/api/winterboardApi'

const networkDown = vi.fn(async (config: unknown) => {
  throw new axios.AxiosError('Network Error', axios.AxiosError.ERR_NETWORK, config as never, {})
})

beforeEach(() => {
  resetCircuitBreaker()
  ;(apiClient as unknown as { defaults: { adapter: typeof networkDown } }).defaults.adapter = networkDown
})
afterEach(() => {
  resetCircuitBreaker()
})

describe('Б-51 · відмова відкритого breaker-а доходить до діалогу з позначкою', () => {
  it('getSession під відкритим breaker-ом → blockedBy = circuit_breaker, у мережу не йде', async () => {
    for (let i = 0; i < 5; i++) {
      await apiClient.get(`/v1/winterboard/sessions/warmup-${i}/`).catch(() => undefined)
    }
    expect(isCircuitBreakerOpen()).toBe(true)
    networkDown.mockClear()

    const reason = await winterboardApi.getSession('11111111-1111-4111-8111-111111111111').catch((e: unknown) => e)

    expect((reason as { blockedBy?: string }).blockedBy).toBe('circuit_breaker')
    expect(networkDown).not.toHaveBeenCalled()
  })
})
