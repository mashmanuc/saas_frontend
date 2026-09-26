/**
 * Гейт «вихід не завершено» + маршрут екрана блокування (ТЗ спільного екрана, R6).
 *
 * Окремим модулем, а не правкою `src/router/index.js`: байти роутера V1 пильнує
 * сторож TLV2 (`teacher-lesson-v2/__tests__/v1RoutesUnchanged.spec.ts`), і з
 * роутером паралельно працюють інші сесії. Ставиться в `main.js` одразу після
 * створення застосунку, до `app.use(router)`.
 *
 * Порядок гардів: головний гард роутера (з bootstrap) реєструється раніше. Це
 * безпечно: `authStore._doBootstrap` при маркері не робить refresh, а цей гейт
 * перекидає будь-яку сторінку, крім дозволених, на екран блокування.
 */
import type { Router } from 'vue-router'
import {
  LOGOUT_PENDING_KEY, LOGOUT_PENDING_ROUTE, isAllowedWhileLogoutPending, isLogoutPending,
} from './pendingLogout'
import { DISCARD_BROADCAST_KEY, abandonOpenBoardQueue, parseDiscardBroadcast } from './openBoardQueue'

const ROUTE_NAME = 'logout-pending'
let listeningToOtherTabs = false

export function installLogoutGate(router: Router): void {
  if (!router.hasRoute(ROUTE_NAME)) {
    router.addRoute({
      path: LOGOUT_PENDING_ROUTE,
      name: ROUTE_NAME,
      component: () => import('@/modules/auth/views/LogoutPendingView.vue'),
      meta: { requiresAuth: false },
    })
  }
  router.beforeEach((to) => {
    if (isLogoutPending() && !isAllowedWhileLogoutPending(to.path, to.query as Record<string, unknown>)) {
      return LOGOUT_PENDING_ROUTE
    }
    return true
  })
  if (typeof window !== 'undefined' && !listeningToOtherTabs) {
    window.addEventListener('storage', onOtherTabLogout)
    listeningToOtherTabs = true
  }
}

/**
 * Вихід в ІНШІЙ вкладці цього браузера (подія `storage` приходить лише в інші вкладки;
 * рецензія пакета A, знахідка 5 і 4).
 * - Вчитель явно відкинув незбережені дії: черга тих самих дошок і тут геть із пам'яті,
 *   інакше ця вкладка записала б її знову при смерті сесії чи закритті.
 * - Вихід не підтверджено сервером: і ця вкладка — на екран блокування повним
 *   перезавантаженням, щоб дошка розмонтувалась, а не лишалась у DOM.
 * - Маркер знято (вихід підтверджено деінде або увійшов новий учитель): екран блокування
 *   тут більше не потрібен — повтор виходу звідси вивів би НОВОГО вчителя (друга
 *   рецензія, знахідка 2). Повне перезавантаження на головну з нинішніми cookie.
 */
export function onOtherTabLogout(event: StorageEvent): void {
  if (event.key === DISCARD_BROADCAST_KEY && event.newValue) {
    abandonOpenBoardQueue(parseDiscardBroadcast(event.newValue))
    return
  }
  if (event.key !== LOGOUT_PENDING_KEY) return
  const onLockScreen = window.location.pathname === LOGOUT_PENDING_ROUTE
  if (event.newValue && !onLockScreen) {
    window.location.href = LOGOUT_PENDING_ROUTE
  } else if (!event.newValue && onLockScreen) {
    window.location.href = '/'
  }
}
