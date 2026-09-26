/**
 * Безпечний вихід (ТЗ «Сесія спільного екрана і безпечний вихід», R6–R7, A4).
 *
 * Було: `try { await authApi.logout() } catch {}` → локальний «вихід», навіть коли
 * сервер відмовив, — сесія жила, HttpOnly-cookie лишались, F5 входив знову.
 * Незбережені дії на дошках при виході ніхто не показував.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../api/authApi', () => ({
  default: {
    logout: vi.fn(),
    csrf: vi.fn(async () => ({ csrf: 't' })),
    getCurrentUser: vi.fn(),
    refresh: vi.fn(),
  },
}))

import authApi from '../../api/authApi'
import { useAuthStore } from '../../store/authStore'
import { useLogoutGuardStore } from '../../store/logoutGuardStore'
import { isLogoutPending, markLogoutPending, clearLogoutPending, isAllowedWhileLogoutPending } from '../pendingLogout'
import { discardUnsentWork, listUnsentWork, totalUnsentOps } from '../unsentWork'

const BOARD_A = '11111111-1111-4111-8111-111111111111'
const BOARD_B = '22222222-2222-4222-8222-222222222222'
const copy = (pending: number, inFlight = 0) =>
  JSON.stringify({ pending: Array(pending).fill({}), inFlight: Array(inFlight).fill({}), savedAt: 'x' })

let location: { href: string; pathname: string; search: string }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  document.cookie = 'csrf=t'
  location = { href: '', pathname: '/winterboard/abc', search: '' }
  Object.defineProperty(window, 'location', { value: location, writable: true, configurable: true })
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('unsentWork · незбережена робота користувача в цьому браузері', () => {
  it('рахує обидва види копій по всіх вкладках; чужі, анонімні й старі без власника — ні', () => {
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_A}_u7_tab1`, copy(2, 1))
    localStorage.setItem(`wb_ops_blocked_v2_${BOARD_A}_u7_tab2`, copy(4))
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_B}_u7_tab1`, copy(1))
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_B}_u8_tab1`, copy(9))       // інший користувач
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_B}_anon_tab1`, copy(9))     // без власника
    localStorage.setItem(`wb_ops_backup_${BOARD_B}`, copy(9))                  // старий формат

    const work = listUnsentWork(7)
    expect(work.map(w => [w.sessionId, w.ops, w.blocked])).toEqual([
      [BOARD_A, 7, true],
      [BOARD_B, 1, false],
    ])
    expect(totalUnsentOps(work)).toBe(8)
  })

  it('порожня копія не є роботою; нечитабельна — є, з позначкою', () => {
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_A}_u7_tab1`, copy(0))
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_B}_u7_tab1`, '{зламано')
    const work = listUnsentWork(7)
    expect(work).toHaveLength(1)
    expect(work[0]).toMatchObject({ sessionId: BOARD_B, ops: 0, unreadable: true })
  })

  it('відкидання прибирає лише перелічені ключі', () => {
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_A}_u7_tab1`, copy(1))
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_A}_u8_tab1`, copy(1))
    discardUnsentWork(listUnsentWork(7))
    expect(localStorage.getItem(`wb_ops_backup_v2_${BOARD_A}_u7_tab1`)).toBeNull()
    expect(localStorage.getItem(`wb_ops_backup_v2_${BOARD_A}_u8_tab1`)).not.toBeNull()
  })

  it('без користувача — нічого', () => {
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_A}_u7_tab1`, copy(1))
    expect(listUnsentWork(null)).toEqual([])
  })
})

describe('pendingLogout · маркер «вихід не завершено»', () => {
  it('ставиться, читається, знімається', () => {
    expect(isLogoutPending()).toBe(false)
    markLogoutPending()
    expect(isLogoutPending()).toBe(true)
    clearLogoutPending()
    expect(isLogoutPending()).toBe(false)
  })

  it('поки маркер стоїть, можна лише на екран блокування і на вхід іншим акаунтом', () => {
    expect(isAllowedWhileLogoutPending('/logout-pending')).toBe(true)
    expect(isAllowedWhileLogoutPending('/auth/login', { switch: '1' })).toBe(true)
    expect(isAllowedWhileLogoutPending('/auth/login')).toBe(false)
    expect(isAllowedWhileLogoutPending('/winterboard/abc')).toBe(false)
    expect(isAllowedWhileLogoutPending('/start')).toBe(false)
  })
})

describe('authStore.logout · спершу сервер (R6)', () => {
  function signedIn() {
    const store = useAuthStore()
    store.access = 'jwt'
    store.user = { id: 7, email: 't@example.com', role: 'tutor' }
    return store
  }

  it('сервер підтвердив → вийшли, маркера немає', async () => {
    vi.mocked(authApi.logout).mockResolvedValueOnce({} as never)
    const store = signedIn()
    const result = await store.logout()
    expect(result).toEqual({ status: 'done' })
    expect(isLogoutPending()).toBe(false)
    expect(store.user).toBeNull()
    expect(location.href).toBe('/start?redirect=%2Fwinterboard%2Fabc')
  })

  it('сервер відмовив → НЕ «вийшли»: маркер, дані сховано, повне перезавантаження на екран блокування', async () => {
    vi.mocked(authApi.logout).mockRejectedValueOnce({ response: { status: 500 } })
    const store = signedIn()
    const result = await store.logout()
    expect(result).toEqual({ status: 'pending' })
    expect(isLogoutPending()).toBe(true)
    expect(store.user).toBeNull()
    expect(store.access).toBeNull()
    expect(sessionStorage.getItem('auth_return_url')).toBeNull()
    expect(location.href).toBe('/logout-pending')
  })

  it('незбережені дії → вихід зупинено, діалог показано, до сервера не ходили', async () => {
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_A}_u7_tab1`, copy(3))
    const store = signedIn()
    const result = await store.logout()
    expect(result.status).toBe('blocked_unsent')
    expect(authApi.logout).not.toHaveBeenCalled()
    const guard = useLogoutGuardStore()
    expect(guard.open).toBe(true)
    expect(guard.work.map(w => w.ops)).toEqual([3])
    expect(store.user).not.toBeNull()
  })

  it('явне відкидання → копії прибрано, вихід пішов на сервер', async () => {
    localStorage.setItem(`wb_ops_backup_v2_${BOARD_A}_u7_tab1`, copy(3))
    vi.mocked(authApi.logout).mockResolvedValueOnce({} as never)
    const store = signedIn()
    const result = await store.logout({ discardUnsent: true })
    expect(result).toEqual({ status: 'done' })
    expect(localStorage.getItem(`wb_ops_backup_v2_${BOARD_A}_u7_tab1`)).toBeNull()
    expect(authApi.logout).toHaveBeenCalledTimes(1)
  })

  it('повтор з екрана блокування: успіх знімає маркер, невдача — ні', async () => {
    markLogoutPending()
    const store = useAuthStore()
    vi.mocked(authApi.logout).mockRejectedValueOnce(new Error('offline'))
    expect(await store.retryPendingLogout()).toBe(false)
    expect(isLogoutPending()).toBe(true)

    vi.mocked(authApi.logout).mockResolvedValueOnce({} as never)
    expect(await store.retryPendingLogout()).toBe(true)
    expect(isLogoutPending()).toBe(false)
    expect(location.href).toBe('/start')
  })
})

describe('authStore · маркер і вхід', () => {
  it('bootstrap при маркері НЕ робить refresh — інакше увійшов би попередній учитель', async () => {
    markLogoutPending()
    const store = useAuthStore()
    store.access = '__cookie__'
    const refresh = vi.spyOn(store, 'refreshAccess').mockResolvedValue(undefined as never)
    await store._doBootstrap()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('новий вхід (з користувачем) знімає маркер; refresh (без користувача) — ні', async () => {
    markLogoutPending()
    const store = useAuthStore()
    await store.setAuth({ access: '__cookie__' })
    expect(isLogoutPending()).toBe(true)
    await store.setAuth({ access: '__cookie__', user: { id: 9, role: 'tutor' } })
    expect(isLogoutPending()).toBe(false)
  })
})
