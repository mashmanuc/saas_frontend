// 15.10 (власник): у нової вчительки тричі за годину «Завантаження…» висіло хвилину
// (прод, акаунт 244: wb.loader.stuck + INV-FE-4 о 18:19, 18:23, 19:27 за Києвом —
// кожне за 1–2 с після перезавантаження сторінки).
//
// Механізм, який тут перевіряється: склеювання однакових GET (dedupAdapter). Другий
// викликач отримує проміс першого — і при ВІДМОВІ ту саму помилку, у якої
// `error.config` = config ПЕРШОГО запиту. Обробник відповіді першого вже зупинив
// свій лоадер і погасив прапорець `_loaderStarted`; обробник другого бачить погашений
// прапорець чужого config і свій лоадер не зупиняє. Лічильник лишається > 0, оверлей
// «Завантаження…» (PageShell) висить, доки запобіжник loaderStore не скине його за 60 с.
//
// Мережу підміняємо під dedupAdapter (через axios.getAdapter), щоб склеювання працювало
// так само, як у браузері.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({
  active: 0,
  impl: null as null | ((config: Record<string, unknown>) => Promise<unknown>),
  calls: 0,
}))

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>()
  const ax = actual.default
  ;(ax as unknown as { getAdapter: () => unknown }).getAdapter = () => (config: Record<string, unknown>) => {
    h.calls++
    return h.impl!(config)
  }
  return { ...actual, default: ax }
})

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
  useLoaderStore: () => ({
    start: () => { h.active++ },
    stop: () => { if (h.active > 0) h.active-- },
  }),
}))

vi.mock('../notify', () => ({ notifyError: vi.fn(), notifyWarning: vi.fn() }))
vi.mock('../../core/auth/onAuthDeath', () => ({ isAuthDead: () => false }))
vi.mock('../telemetryAgent', () => ({ trackEvent: vi.fn() }))

import axios from 'axios'
import apiClient, { resetCircuitBreaker } from '../apiClient'

function respondAfterTick(status: number) {
  return (config: Record<string, unknown>) => new Promise((resolve, reject) => {
    setTimeout(() => {
      const response = { data: status < 400 ? { ok: true } : { detail: 'x' }, status, statusText: '', headers: {}, config, request: {} }
      if (status < 400) resolve(response)
      else reject(new axios.AxiosError(`Request failed with status code ${status}`,
        axios.AxiosError.ERR_BAD_REQUEST, config as never, {}, response as never))
    }, 5)
  })
}

beforeEach(() => {
  h.active = 0
  h.calls = 0
  resetCircuitBreaker()
})

describe('склеєні GET і лічильник «Завантаження…»', () => {
  it('успіх: два однакові одночасні GET — у мережу один, лоадер повертається до 0', async () => {
    h.impl = respondAfterTick(200)
    await Promise.all([apiClient.get('/v1/me/thing/'), apiClient.get('/v1/me/thing/')])
    expect(h.calls).toBe(1)
    expect(h.active).toBe(0)
  })

  it('один GET з відмовою 404 — лоадер повертається до 0', async () => {
    h.impl = respondAfterTick(404)
    await apiClient.get('/v1/me/missing/').catch(() => undefined)
    expect(h.active).toBe(0)
  })

  it('відмова 404: два однакові одночасні GET — лоадер теж має повернутись до 0', async () => {
    h.impl = respondAfterTick(404)
    await Promise.all([
      apiClient.get('/v1/me/missing/').catch(() => undefined),
      apiClient.get('/v1/me/missing/').catch(() => undefined),
    ])
    expect(h.calls).toBe(1)
    expect(h.active).toBe(0)
  })

  it('відмова 403: три однакові одночасні GET — лоадер теж має повернутись до 0', async () => {
    h.impl = respondAfterTick(403)
    await Promise.all([1, 2, 3].map(() => apiClient.get('/v1/me/forbidden/').catch(() => undefined)))
    expect(h.calls).toBe(1)
    expect(h.active).toBe(0)
  })

  it('кожен склеєний викликач отримує помилку зі СВОЇМ config і тим самим статусом', async () => {
    h.impl = respondAfterTick(404)
    const [a, b] = await Promise.all([
      apiClient.get('/v1/me/missing/', { meta: { tag: 'a' } }).catch((e: unknown) => e),
      apiClient.get('/v1/me/missing/', { meta: { tag: 'b' } }).catch((e: unknown) => e),
    ]) as Array<{ config: { meta: { tag: string } }, response: { status: number, config: unknown }, isAxiosError: boolean }>
    expect(a.config.meta.tag).toBe('a')
    expect(b.config.meta.tag).toBe('b')
    expect(b.response.config).toBe(b.config)
    expect(a.response.status).toBe(404)
    expect(b.response.status).toBe(404)
    expect(axios.isAxiosError(b)).toBe(true)
    expect(b).toBeInstanceOf(axios.AxiosError)
  })

  it('скасування лишається скасуванням для кожного склеєного викликача, лоадер — 0', async () => {
    h.impl = (config) => new Promise((_, reject) => {
      setTimeout(() => reject(new axios.CanceledError(undefined, config as never, undefined)), 5)
    })
    const errs = await Promise.all([1, 2].map(() => apiClient.get('/v1/me/slow/').catch((e: unknown) => e)))
    expect(errs.every((e) => axios.isCancel(e))).toBe(true)
    expect(h.active).toBe(0)
  })
})
