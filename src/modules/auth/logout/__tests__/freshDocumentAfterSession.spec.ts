/**
 * Б-41 (2026-09-27): документ, що пережив сесію, не віддає її стори наступному вчителю.
 *
 * Вихід свідомо не скидає частину сторів (`STORES_KEPT_ON_LOGOUT`: модуль дошки під
 * SYSTEM_LAW, `replay`, легасі-кімната). Власний вихід і смерть refresh посеред роботи
 * перезавантажують сторінку, а вихід в ІНШІЙ вкладці — ні: якщо ця вкладка стояла на
 * публічній сторінці, наступний учитель входив у тому самому документі й бачив теку й
 * пошук «Моїх записів» попереднього (відтворено наживо на `origin/master`).
 *
 * Інваріанти:
 *  - сесія жила в документі (bootstrap завершено) і померла → перша сторінка з даними
 *    відкривається повним завантаженням;
 *  - публічні сторінки (вхід, стартова) — як і раніше SPA;
 *  - новий вхід прапорець не знімає — лише перезавантаження;
 *  - відмова refresh усередині bootstrap (даних ще не було) прапорця не ставить:
 *    учитель, що повернувся за тиждень, входить без зайвого перезавантаження.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

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
vi.mock('../../../../services/realtime', () => ({ realtimeService: { subscribe: vi.fn() } }))

import { resetAuthDeath } from '@/core/auth/onAuthDeath'
import { useAuthStore } from '../../store/authStore'
import { installLogoutGate } from '../logoutGate'
import {
  markDocumentOutlivedSession, needsFreshDocument, resetDocumentOutlivedSessionForTests,
  resetSessionEndedView,
} from '../sessionEndedView'

let location: { href: string; pathname: string; search: string }

const Page = { template: '<div />' }

function gatedRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/start', component: Page, meta: { requiresAuth: false } },
      { path: '/auth/login', component: Page, meta: { requiresAuth: false } },
      { path: '/tutor', component: Page },
      { path: '/winterboard/replays', component: Page, meta: { requiresAuth: true } },
    ],
  })
  installLogoutGate(router)
  return router
}

const protectedRoute = { matched: [{ meta: {} }] } as never

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  resetAuthDeath()
  resetSessionEndedView()
  resetDocumentOutlivedSessionForTests()
  location = { href: '', pathname: '/start', search: '' }
  Object.defineProperty(window, 'location', { value: location, writable: true, configurable: true })
})

afterEach(() => {
  resetAuthDeath()
  resetSessionEndedView()
  resetDocumentOutlivedSessionForTests()
})

describe('Б-41 · роутер: документ, що пережив сесію', () => {
  it('сесія в документі не вмирала — переходи SPA, як і були', async () => {
    const router = gatedRouter()
    await router.push('/start')
    await router.push('/tutor')

    expect(router.currentRoute.value.path).toBe('/tutor')
    expect(location.href).toBe('')
  })

  it('сесія жила й померла → сторінка з даними лише повним завантаженням (зі збереженим query)', async () => {
    const router = gatedRouter()
    await router.push('/start')
    markDocumentOutlivedSession()

    await router.push('/tutor?tab=replays')

    expect(location.href).toBe('/tutor?tab=replays')
    expect(router.currentRoute.value.path).toBe('/start')   // SPA-перехід скасовано
  })

  it('публічна сторінка після смерті сесії — SPA: вхід не перезавантажується', async () => {
    const router = gatedRouter()
    await router.push('/start')
    markDocumentOutlivedSession()

    await router.push('/auth/login')

    expect(router.currentRoute.value.path).toBe('/auth/login')
    expect(location.href).toBe('')
  })

  it('новий вхід прапорець не знімає — дані старого документа живі до перезавантаження', async () => {
    const router = gatedRouter()
    await router.push('/auth/login')
    markDocumentOutlivedSession()
    resetSessionEndedView()   // так робить App.vue на новий вхід

    await router.push('/winterboard/replays')

    expect(location.href).toBe('/winterboard/replays')
  })
})

describe('Б-41 · forceLogout ставить прапорець лише для сесії, що жила в документі', () => {
  it('вихід в іншій вкладці після bootstrap → документ пережив сесію', async () => {
    const auth = useAuthStore()
    auth.initialized = true
    auth.access = 'access-token'
    auth.user = { id: 1, role: 'tutor' } as never

    await auth.forceLogout('other_tab_logout')

    expect(needsFreshDocument(protectedRoute)).toBe(true)
  })

  it('відмова refresh усередині bootstrap (initialized ще false) — прапорця немає', async () => {
    const auth = useAuthStore()
    auth.initialized = false
    auth.access = '__cookie__'

    await auth.forceLogout('session_expired')

    expect(needsFreshDocument(protectedRoute)).toBe(false)
  })
})
