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
import { LOGOUT_PENDING_ROUTE, isAllowedWhileLogoutPending, isLogoutPending } from './pendingLogout'

const ROUTE_NAME = 'logout-pending'

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
}
