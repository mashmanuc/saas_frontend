// Б-36 (2026-09-27): протухла сесія на публічній сторінці не виводить людину на /start.
//
// `main.js` запускає bootstrap на будь-якій сторінці. Позначка `auth_session` є, а
// refresh відмовив → bootstrap виходив на /start (`_exitToStartWithoutReload`), тож
// посилання з листа (скидання пароля, підтвердження email) спрацьовувало лише з
// другого разу (відтворено наживо на `origin/master`). Посеред сесії так само:
// `refreshAccess` перезавантажував на /start і з публічного запису.
//
// Інваріанти:
//  - публічна сторінка → сесію знято, людина лишається, ні переходу, ні документа;
//  - сторінка з даними → як і раніше: /start з redirect (bootstrap) чи
//    перезавантаження (сесія жила в документі).

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

// Роутер: публічні — вхід/скидання (/auth/*), стартова, публічний запис; решта — з даними
// (справжні метадані звіряє publicLocation.realRouter.spec.ts).
const PUBLIC = ['/auth/', '/start', '/winterboard/public/']
vi.mock('../../../../router', () => ({
  default: {
    replace: vi.fn(async () => undefined),
    push: vi.fn(async () => undefined),
    resolve: (href: string) => ({
      matched: [{ meta: PUBLIC.some((p) => href.startsWith(p)) ? { requiresAuth: false } : {} }],
    }),
  },
}))

import { useAuthStore } from '../authStore'
import authApi from '../../api/authApi'
import router from '../../../../router'
import { resetAuthDeath } from '../../../../core/auth/onAuthDeath'

const refresh401 = () => Object.assign(new Error('Request failed with status code 401'), {
  response: { status: 401, data: { detail: 'Token is invalid or expired' } },
})

const documentLoads: string[] = []
const originalLocation = window.location

function stubLocation(pathname: string, search = '') {
  const loc = {
    pathname,
    search,
    origin: 'http://localhost',
    get href() { return `http://localhost${pathname}${search}` },
    set href(url: string) { documentLoads.push(url) },
    assign(url: string) { documentLoads.push(url) },
    replace(url: string) { documentLoads.push(url) },
    reload() { documentLoads.push('reload') },
  }
  Object.defineProperty(window, 'location', { configurable: true, value: loc })
}

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

describe('Б-36 · bootstrap з протухлою сесією', () => {
  it.each([
    ['/auth/reset-password', '?uid=1&token=abc'],
    ['/auth/verify-email', '?token=abc'],
    ['/winterboard/public/abc123', ''],
  ])('%s — людина лишається на сторінці, сесію знято', async (pathname, search) => {
    stubLocation(pathname, search)
    localStorage.setItem('auth_session', '1')
    const store = useAuthStore()

    await store.bootstrap()

    expect(authApi.refresh).toHaveBeenCalledTimes(1)
    expect(store.access).toBeNull()
    expect(localStorage.getItem('auth_session')).toBeNull()
    expect(router.replace).not.toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    expect(documentLoads).toEqual([])
    expect(sessionStorage.getItem('auth_return_url')).toBeNull()
  })

  it('контроль: сторінка з даними — /start з redirect, як і раніше', async () => {
    stubLocation('/winterboard/boards')
    localStorage.setItem('auth_session', '1')

    await useAuthStore().bootstrap()

    expect(router.replace).toHaveBeenCalledWith({ path: '/start', query: { redirect: '/winterboard/boards' } })
  })
})

describe('Б-36 · refresh відмовив посеред сесії', () => {
  function liveSession() {
    const store = useAuthStore()
    store.initialized = true
    store.access = 'access-token'
    store.user = { id: 1, role: 'tutor' } as never
    return store
  }

  it('публічний запис — без перезавантаження на /start', async () => {
    stubLocation('/winterboard/public/abc123')
    const store = liveSession()

    await store.refreshAccess().catch(() => undefined)

    expect(store.access).toBeNull()
    expect(documentLoads).toEqual([])
  })

  it('контроль: сторінка з даними — перезавантаження на /start, як і раніше', async () => {
    stubLocation('/tutor')
    const store = liveSession()

    await store.refreshAccess().catch(() => undefined)

    expect(documentLoads).toEqual(['/start?redirect=%2Ftutor'])
  })
})
