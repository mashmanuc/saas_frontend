// Б-55 (2026-09-27): джерела бур refresh на фронті — ті, що в межах SYSTEM_LAW §6.
//
// Рецензія Б-47 знайшла на фронті кілька джерел зайвих `POST /auth/refresh/`. Після Б-47
// бекенд обмежує їх на сесію (30 / 5 хв), але сама сесія до кінця вікна ловить 429.
// Тут закрито три:
//  - повернення на вкладку робило refresh ЗАВЖДИ — тепер лише коли токен уже треба
//    оновлювати за правилом LAW §6 (`now > exp - 60 с`), інакше лише переставляє таймер;
//  - на 429 фронт вгадував затримку експонентою, хоча сервер каже її в
//    `details.retry_after` (Б-47);
//  - відкладання після 429 не скидалося після успішного refresh.
// Годинник, що поспішає, і міжвкладковий замок — нова поведінка (LAW FINAL RULE,
// §11 V1) — чекають рішення власника.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('../../api/authApi', () => ({
  default: {
    refresh: vi.fn(),
    csrf: vi.fn(async () => ({ csrf: 'csrf-token' })),
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
}))
vi.mock('../../../../utils/tokenVault', () => ({
  tokenVault: {
    init: vi.fn(async () => undefined),
    encrypt: vi.fn(async (value: string) => `enc:${value}`),
    decrypt: vi.fn(async (value: string) => value.replace(/^enc:/, '')),
  },
}))
vi.mock('../../../../utils/telemetry/authEvents', () => ({ logAuthEvent: vi.fn(), AUTH_EVENTS: {} }))
vi.mock('../../../../utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('../../../../app/queryClient', () => ({ queryClient: { clear: vi.fn() } }))

import { useAuthStore } from '../authStore'
import authApi from '../../api/authApi'

const nowS = () => Math.floor(Date.now() / 1000)
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const rateLimited = (retryAfter?: number) => Object.assign(new Error('Request failed with status code 429'), {
  response: {
    status: 429,
    data: { error: 'rate_limited', details: retryAfter ? { reason: 'session', retry_after: retryAfter } : {} },
  },
})

function liveStore(expInSeconds: number) {
  const store = useAuthStore()
  store.access = 'access-token'
  store.csrfToken = 'csrf-token'
  store.accessExp = nowS() + expInSeconds
  store.lastRefreshAt = Date.now()
  return store
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setActivePinia(createPinia())
  vi.mocked(authApi.refresh).mockResolvedValue({ access: 'fresh', exp: nowS() + 3600 } as never)
})

afterEach(() => {
  useAuthStore().stopProactiveRefresh()
})

describe('Б-55 · повернення на вкладку', () => {
  it('токен ще свіжий (30 хв до exp) — refresh НЕ йде', async () => {
    const store = liveStore(30 * 60)
    store.startProactiveRefresh()

    document.dispatchEvent(new Event('visibilitychange'))
    await settle()

    expect(authApi.refresh).not.toHaveBeenCalled()
  })

  it('до exp менше хвилини (LAW §6) — refresh іде, рівно один', async () => {
    const store = liveStore(30)
    store.startProactiveRefresh()

    document.dispatchEvent(new Event('visibilitychange'))
    await settle()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
  })

  it('десять перемикань вкладки зі свіжим токеном — нуль refresh', async () => {
    const store = liveStore(30 * 60)
    store.startProactiveRefresh()

    for (let i = 0; i < 10; i++) document.dispatchEvent(new Event('visibilitychange'))
    await settle()

    expect(authApi.refresh).not.toHaveBeenCalled()
  })
})

describe('Б-55 · 429 від refresh', () => {
  it('затримку бере з details.retry_after — і до її кінця не стукає знову', async () => {
    const store = liveStore(30)
    vi.mocked(authApi.refresh).mockRejectedValueOnce(rateLimited(120))

    expect(await store.refreshAccess()).toBeNull()
    const lockedMs = Date.parse(store.lockedUntil as unknown as string) - Date.now()
    expect(lockedMs).toBeGreaterThan(118_000)
    expect(lockedMs).toBeLessThanOrEqual(120_000)

    expect(await store.refreshAccess()).toBeNull()
    expect(authApi.refresh).toHaveBeenCalledTimes(1)
  })

  it('без retry_after — як і раніше, 5 с', async () => {
    const store = liveStore(30)
    vi.mocked(authApi.refresh).mockRejectedValueOnce(rateLimited())

    await store.refreshAccess()

    const lockedMs = Date.parse(store.lockedUntil as unknown as string) - Date.now()
    expect(lockedMs).toBeGreaterThan(4_000)
    expect(lockedMs).toBeLessThanOrEqual(5_000)
  })

  it('успішний refresh скидає відкладання — наступний 429 знову від 5 с, а не подвоєний', async () => {
    const store = liveStore(30)
    vi.mocked(authApi.refresh).mockRejectedValueOnce(rateLimited())
    await store.refreshAccess()
    store.lockedUntil = null            // вікно минуло

    await store.refreshAccess()         // успіх
    vi.mocked(authApi.refresh).mockRejectedValueOnce(rateLimited())
    await store.refreshAccess()

    const lockedMs = Date.parse(store.lockedUntil as unknown as string) - Date.now()
    expect(lockedMs).toBeLessThanOrEqual(5_000)
  })
})
