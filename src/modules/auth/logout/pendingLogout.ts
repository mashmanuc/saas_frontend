/**
 * «Вихід не завершено на сервері» — маркер, що переживає F5 і закриту вкладку.
 *
 * ТЗ «Сесія спільного екрана і безпечний вихід», R6
 * (saas_docs/domains/users/TZ_SHARED_SCREEN_SESSION_AND_SAFE_LOGOUT_2026-09-25.md).
 *
 * Чому потрібен: refresh- і access-cookie — HttpOnly, JS їх стерти не може. Якщо сервер
 * не підтвердив вихід, ці cookie живі, і без маркера наступне відкриття сайту увійшло б
 * знову як попередній учитель. Поки маркер стоїть, роутер відкриває лише екран
 * блокування (без даних) і вхід іншим акаунтом; bootstrap не робить refresh.
 * Маркер знімає лише підтверджений сервером вихід або новий успішний вхід (нові cookie
 * замінюють старі).
 */

const KEY = 'm4sh_logout_pending'

export const LOGOUT_PENDING_ROUTE = '/logout-pending'

export function markLogoutPending(): void {
  try {
    localStorage.setItem(KEY, new Date().toISOString())
  } catch (err) {
    // Без маркера захист від F5 не працює — це треба бачити в логах, а не ковтати.
    console.error('[auth:logout] cannot persist pending-logout marker', err)
  }
}

export function isLogoutPending(): boolean {
  try {
    return localStorage.getItem(KEY) !== null
  } catch (err) {
    console.warn('[auth:logout] cannot read pending-logout marker', err)
    return false
  }
}

export function clearLogoutPending(): void {
  try {
    localStorage.removeItem(KEY)
  } catch (err) {
    console.warn('[auth:logout] cannot clear pending-logout marker', err)
  }
}

/** Куди можна піти, поки вихід не завершено: сам екран блокування і вхід іншим акаунтом. */
export function isAllowedWhileLogoutPending(path: string, query: Record<string, unknown> = {}): boolean {
  if (path === LOGOUT_PENDING_ROUTE) return true
  return path === '/auth/login' && query.switch === '1'
}
