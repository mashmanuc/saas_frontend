// Б-34 (2026-09-26): запит, скасований САМИМ apiClient, — не мережевий збій.
//
// Request-інтерсептор відхиляє запит через `axios.Cancel` у двох місцях: відкритий
// circuit breaker і «auth dead» (після forceLogout). Така відмова йде в обробник
// помилок відповіді, і гілка `!error.response` приймала її за обрив мережі: тост
// «Немає з’єднання з сервером» + _cbRecordFailure(). П'ять скасувань відкривали
// breaker на 30 с, а він блокує все без meta.bypassCircuitBreaker — зокрема
// /auth/login. Відтворено наживо до фіксу (2026-09-26): /start після SPA-виходу з
// «auth dead» — запиту /landing-config/ у мережі нема, а червоний тост є; ще п'ять
// переходів — і POST /auth/login у мережу вже не виходить.
//
// Контракт після фіксу: жодне скасування не рахується breaker-ом; тосту немає лише
// для «auth dead». Відмова відкритого breaker-а й abort() викликача тост лишають —
// для них це єдиний сигнал («Мої дошки», тайм-аут плеєра запису через abort).
//
// Моки — за зразком apiClient.authGuard.spec.ts; адаптер підміняємо на кожен тест.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import axios from 'axios'

const h = vi.hoisted(() => ({
  authDead: false,
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  loaderStart: vi.fn(),
  loaderStop: vi.fn(),
}))

// Користувач не залогінений (access=null): проактивний refresh не втручається.
vi.mock('../../modules/auth/store/authStore', () => ({
  useAuthStore: () => ({
    access: null,
    accessExp: 0,
    lastRefreshAt: 0,
    csrfToken: 'csrf-token',
    sessionExpiredNotified: false,
    refreshAccess: vi.fn(),
    ensureCsrfToken: vi.fn(),
    forceLogout: vi.fn(),
  }),
}))

vi.mock('../../stores/loaderStore', () => ({
  useLoaderStore: () => ({ start: h.loaderStart, stop: h.loaderStop }),
}))

vi.mock('../notify', () => ({
  notifyError: h.notifyError,
  notifyWarning: h.notifyWarning,
}))

vi.mock('../../core/auth/onAuthDeath', () => ({
  isAuthDead: () => h.authDead,
}))

vi.mock('../telemetryAgent', () => ({
  trackEvent: vi.fn(),
}))

import apiClient, { isCircuitBreakerOpen, resetCircuitBreaker } from '../apiClient'

const NO_CONNECTION = 'Немає з’єднання з сервером. Перевірте мережу.'

type AdapterConfig = { url?: string; signal?: AbortSignal }
type Adapter = (config: AdapterConfig) => Promise<unknown>

const ok: Adapter = async (config) => ({
  data: { ok: true, url: config.url },
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  request: {},
})

// Як xhr-адаптер axios на обрив мережі: AxiosError без response.
const networkDown: Adapter = async (config) => {
  throw new axios.AxiosError('Network Error', axios.AxiosError.ERR_NETWORK, config as never, {})
}

// Як xhr-адаптер axios на тайм-аут: теж без response, але це НЕ скасування.
const timedOut: Adapter = async (config) => {
  throw new axios.AxiosError('timeout of 30000ms exceeded', axios.AxiosError.ECONNABORTED, config as never, {})
}

const adapter = vi.fn(ok)

function useAdapter(impl: Adapter) {
  adapter.mockImplementation(impl)
}

let circuitOpenEvents = 0
const onCircuitOpen = () => { circuitOpenEvents++ }

beforeEach(() => {
  vi.clearAllMocks()
  h.authDead = false
  resetCircuitBreaker()
  useAdapter(ok)
  ;(apiClient as unknown as { defaults: { adapter: typeof adapter } }).defaults.adapter = adapter
  circuitOpenEvents = 0
  window.addEventListener('api:circuit-open', onCircuitOpen)
})

afterEach(() => {
  window.removeEventListener('api:circuit-open', onCircuitOpen)
  resetCircuitBreaker()
})

describe('Б-34 — скасування власним гардом apiClient не є мережевим збоєм', () => {
  it('auth dead: запит не йде в мережу, тосту «Немає з’єднання» нема, loader не чіпається', async () => {
    h.authDead = true

    const err = await apiClient.get('/landing-config/').catch((e: unknown) => e)

    // Викликач і далі отримує саме скасування (useGeoApi, WBBoardList тощо
    // розпізнають його за CanceledError / ERR_CANCELED).
    expect(axios.isCancel(err)).toBe(true)
    expect(adapter).not.toHaveBeenCalled()
    expect(h.notifyError).not.toHaveBeenCalled()
    // Гард відмовляє ДО loader.start() — зупиняти нічого.
    expect(h.loaderStart).not.toHaveBeenCalled()
    expect(h.loaderStop).not.toHaveBeenCalled()
  })

  it('auth dead: шість скасувань не відкривають breaker — вхід доходить до мережі', async () => {
    h.authDead = true
    for (let i = 0; i < 6; i++) {
      await apiClient.get(`/v1/me/item-${i}/`).catch(() => undefined)
    }

    // «auth dead» знімається лише успішним входом, тож вхід іде при живому гарді:
    // /auth/* гард пропускає, а breaker — ні. Відкритий breaker = вхід скасовано.
    const res = await apiClient.post('/v1/auth/login', { email: 'a@b.c', password: 'x' })
      .catch((e: unknown) => e)

    expect(adapter).toHaveBeenCalledTimes(1)
    expect(adapter.mock.calls[0][0].url).toBe('/v1/auth/login')
    expect((res as { ok: boolean }).ok).toBe(true)
    expect(isCircuitBreakerOpen()).toBe(false)
    expect(circuitOpenEvents).toBe(0)
    expect(h.notifyError).not.toHaveBeenCalled()
  })

  it('скасування не рахуються: чотири скасування + один справжній обрив breaker не відкривають', async () => {
    h.authDead = true
    for (let i = 0; i < 4; i++) {
      await apiClient.get(`/v1/me/item-${i}/`).catch(() => undefined)
    }

    h.authDead = false
    useAdapter(networkDown)
    await apiClient.get('/v1/me/').catch(() => undefined)

    // Тост лише один — від справжнього обриву.
    expect(h.notifyError).toHaveBeenCalledTimes(1)
    expect(isCircuitBreakerOpen()).toBe(false)

    useAdapter(ok)
    await expect(apiClient.get('/v1/me/')).resolves.toMatchObject({ ok: true })
  })

  it('breaker відкритий: заблокований ним запит у мережу не йде, але тост лишається — інакше екрани мовчать', async () => {
    useAdapter(networkDown)
    for (let i = 0; i < 5; i++) {
      await apiClient.get(`/v1/poll-${i}/`).catch(() => undefined)
    }
    expect(isCircuitBreakerOpen()).toBe(true)
    expect(h.notifyError).toHaveBeenCalledTimes(5)

    h.notifyError.mockClear()
    adapter.mockClear()
    const err = await apiClient.get('/v1/me/').catch((e: unknown) => e)

    expect(axios.isCancel(err)).toBe(true)
    expect(adapter).not.toHaveBeenCalled()
    // «Мої дошки» на CanceledError показують порожній список, слухача
    // 'api:circuit-open' нема — тост тут єдиний сигнал, як і до фіксу.
    expect(h.notifyError).toHaveBeenCalledTimes(1)
    expect(h.notifyError).toHaveBeenCalledWith(NO_CONNECTION)
  })

  it('викликач сам перервав запит у мережі (AbortController): loader зупинено рівно раз, п\'ять abort-ів breaker не відкривають', async () => {
    let entered: () => void = () => {}
    const thrown: unknown[] = []
    // Як xhr-адаптер axios: abort → CanceledError з config. У рантаймі конструктор
    // (message, config, request); типи ж успадковують його від AxiosError — звідси never.
    useAdapter((config) => new Promise((_, reject) => {
      config.signal?.addEventListener('abort', () => {
        const e = new axios.CanceledError(undefined, config as never, {} as never)
        thrown.push(e)
        reject(e)
      })
      entered()
    }))

    for (let i = 0; i < 5; i++) {
      const inFlight = new Promise<void>((resolve) => { entered = resolve })
      const ctrl = new AbortController()
      const pending = apiClient.get('/v1/geo/cities/', { params: { query: `k${i}` }, signal: ctrl.signal })
      await inFlight
      ctrl.abort()
      const err = await pending.catch((e: unknown) => e)
      // Викликач отримує саме ту помилку, яку кинув адаптер.
      expect(err).toBe(thrown[i])
    }

    // Loader стартував до мережі — і має бути зупинений стільки ж разів.
    expect(h.loaderStart).toHaveBeenCalledTimes(5)
    expect(h.loaderStop).toHaveBeenCalledTimes(5)
    // Раніше п'ять abort-ів (напр. пакетна вставка картинок) відкривали breaker,
    // і наступний flush дошки ставав хибним SAVE_BLOCKED.
    expect(isCircuitBreakerOpen()).toBe(false)
    expect(circuitOpenEvents).toBe(0)
    // Тост лишається: плеєр запису робить тайм-аут через abort, іншого сигналу нема.
    expect(h.notifyError).toHaveBeenCalledTimes(5)
  })
})

describe('Б-34 — справжня відсутність відповіді й далі видна і рахується', () => {
  it.each([
    ['обрив мережі (ERR_NETWORK)', networkDown],
    ['тайм-аут (ECONNABORTED)', timedOut],
  ])('%s: тост і лічба breaker-а як раніше', async (_label, impl) => {
    useAdapter(impl)
    for (let i = 0; i < 5; i++) {
      const err = await apiClient.get(`/v1/poll-${i}/`).catch((e: unknown) => e)
      expect(axios.isCancel(err)).toBe(false)
    }

    expect(h.notifyError).toHaveBeenCalledTimes(5)
    expect(h.notifyError).toHaveBeenLastCalledWith(NO_CONNECTION)
    expect(isCircuitBreakerOpen()).toBe(true)
    expect(circuitOpenEvents).toBe(1)
    // Кожен запит стартував loader — кожен і зупинив.
    expect(h.loaderStop).toHaveBeenCalledTimes(h.loaderStart.mock.calls.length)
  })
})
