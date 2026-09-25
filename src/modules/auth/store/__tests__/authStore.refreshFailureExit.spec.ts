// Невдалий refresh (401) — рівно одна спроба й чистий вихід.
//
// Відтворено 2026-09-26 (Playwright, локальний стенд FE dev → BE runserver):
// чистий контекст, localStorage auth_session=1 через addInitScript (скрипт
// повертає позначку на КОЖЕН новий документ), cookie refresh, яку бекенд
// відхиляє 401. Відкриття /winterboard/boards → 31 POST /api/v1/auth/refresh/
// за 4,8 с (30 × 401 і 429 від ліміту 30 на 5 хв на IP), 64 навігації.
//
// Механізм: refreshAccess на 401 робив window.location.href = '/start…', тобто
// перезавантажував документ. Новий документ = новий bootstrap = новий refresh.
// Коло рвалося лише тому, що forceLogout знімав позначку сесії; щойно вона
// переживала вихід, коло зупиняв тільки бекендний ліміт — спільний для всієї
// IP (у школі за однією IP сидять усі).
//
// Інваріанти:
//  - refresh відмовив під час bootstrap → вихід на /start без перезавантаження,
//    рівно один refresh на документ, гостьова сторінка не в стані «auth dead»;
//  - сесія жила в документі → перезавантаження лишається (чистить кімнати,
//    WS, стори), але наступний документ більше не перезавантажується.

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
vi.mock('../../../../utils/telemetry/authEvents', () => ({
  logAuthEvent: vi.fn(),
  AUTH_EVENTS: {},
}))
vi.mock('../../../../utils/telemetryAgent', () => ({
  trackEvent: vi.fn(),
}))
vi.mock('../../../../app/queryClient', () => ({
  queryClient: { clear: vi.fn() },
}))

// Поточна адреса вкладки. SPA-перехід міняє її без нового документа.
let currentPath = '/'
vi.mock('../../../../router', () => ({
  default: {
    replace: vi.fn(async (to: { path: string }) => { currentPath = to.path }),
    push: vi.fn(async (to: { path: string }) => { currentPath = to.path }),
  },
}))

import { useAuthStore } from '../authStore'
import authApi from '../../api/authApi'
import router from '../../../../router'
import { isAuthDead, resetAuthDeath } from '../../../../core/auth/onAuthDeath'

const refresh401 = () => Object.assign(new Error('Request failed with status code 401'), {
  response: { status: 401, data: { detail: 'Token is invalid or expired' } },
})

// Кожне присвоєння location.href / assign / replace / reload — це запит
// на НОВИЙ документ, тобто новий bootstrap з новим refresh.
const documentLoads: string[] = []
const originalLocation = window.location

function stubLocation(path: string) {
  currentPath = path
  const loc = {
    get pathname() { return currentPath },
    get search() { return '' },
    get origin() { return 'http://localhost' },
    get href() { return `http://localhost${currentPath}` },
    set href(url: string) { documentLoads.push(url); currentPath = new URL(url, 'http://localhost').pathname },
    assign(url: string) { documentLoads.push(url) },
    replace(url: string) { documentLoads.push(url) },
    reload() { documentLoads.push('reload') },
  }
  Object.defineProperty(window, 'location', { configurable: true, value: loc })
}

// Новий документ, як його бачить стенд з addInitScript: позначка сесії знову є.
async function openDocument() {
  localStorage.setItem('auth_session', '1')
  documentLoads.length = 0
  setActivePinia(createPinia())
  await useAuthStore().bootstrap()
  return documentLoads.length > 0
}

describe('authStore: невдалий refresh 401 — одна спроба, чистий вихід', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(authApi.refresh).mockRejectedValue(refresh401())
    localStorage.clear()
    sessionStorage.clear()
    documentLoads.length = 0
    resetAuthDeath()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('bootstrap: один refresh, позначку знято, /start без перезавантаження, гостьові запити не заблоковані', async () => {
    stubLocation('/winterboard/boards')
    localStorage.setItem('auth_session', '1')
    const store = useAuthStore()
    expect(store.access).toBe('__cookie__')

    await store.bootstrap()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('auth_session')).toBeNull()
    expect(store.access).toBeNull()
    expect(documentLoads).toEqual([])
    expect(router.replace).toHaveBeenCalledWith({
      path: '/start',
      query: { redirect: '/winterboard/boards' },
    })
    // Інакше apiClient блокує landing-config і показує «Немає з'єднання».
    expect(isAuthDead()).toBe(false)
  })

  it('позначка повертається на кожен документ (як addInitScript) — refresh усе одно рівно один', async () => {
    stubLocation('/winterboard/boards')
    const MAX_DOCUMENTS = 5
    let documents = 1
    while ((await openDocument()) && documents < MAX_DOCUMENTS) documents += 1

    expect(documents).toBe(1)
    expect(authApi.refresh).toHaveBeenCalledTimes(1)
  })

  it('посеред сесії: перезавантаження на /start лишається, але наступний документ коло не продовжує', async () => {
    stubLocation('/winterboard/boards')
    localStorage.setItem('auth_session', '1')
    const store = useAuthStore()
    store.initialized = true
    store.access = 'enc:jwt'
    store.user = { id: 1, role: 'tutor' }

    await expect(store.refreshAccess()).rejects.toMatchObject({ response: { status: 401 } })
    await store.refreshAccess()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('auth_session')).toBeNull()
    expect(documentLoads).toEqual(['/start?redirect=%2Fwinterboard%2Fboards'])

    const MAX_DOCUMENTS = 5
    let documents = 2
    while ((await openDocument()) && documents < MAX_DOCUMENTS) documents += 1

    expect(documents).toBe(2)
    expect(authApi.refresh).toHaveBeenCalledTimes(2)
  })

  it('bootstrap: сесію зняв інший запит ще до нашого refresh — вихід той самий', async () => {
    stubLocation('/winterboard/boards')
    localStorage.setItem('auth_session', '1')
    const store = useAuthStore()
    // Поки bootstrap чекає CSRF, інший запит отримує 401 і сам робить refresh.
    vi.mocked(authApi.csrf).mockImplementationOnce(async () => {
      await store.refreshAccess().catch(() => undefined)
      return { csrf: 'csrf-token' }
    })

    await store.bootstrap()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('auth_session')).toBeNull()
    expect(documentLoads).toEqual([])
    expect(router.replace).toHaveBeenCalledWith({
      path: '/start',
      query: { redirect: '/winterboard/boards' },
    })
    expect(isAuthDead()).toBe(false)
  })

  it('уже на /start — нікуди не переходимо', async () => {
    stubLocation('/start')
    localStorage.setItem('auth_session', '1')

    await useAuthStore().bootstrap()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('auth_session')).toBeNull()
    expect(documentLoads).toEqual([])
    expect(router.replace).not.toHaveBeenCalled()
    expect(isAuthDead()).toBe(false)
  })
})
