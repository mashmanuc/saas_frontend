// WB: Winterboard routes — lazy-loaded views with feature flag guard
// Ref: ARCHITECTURE.md §2, TASK_BOARD.md A1.3, A7.2
// /winterboard              → Session list
// /winterboard/new          → New solo room
// /winterboard/:id          → Edit existing solo room
// /winterboard/public/:token → Public read-only view (no auth)

import type { RouteRecordRaw, NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { isWinterboardEnabled } from './config/featureFlags'

// A7.2: Route guard — blocks access when WB feature flag is disabled
function winterboardGuard(
  _to: RouteLocationNormalized,
  _from: RouteLocationNormalized,
  next: NavigationGuardNext,
): void {
  if (!isWinterboardEnabled()) {
    next({ path: '/404' })
  } else {
    next()
  }
}

const winterboardRoutes: RouteRecordRaw[] = [
  {
    path: '/winterboard',
    name: 'winterboard-sessions',
    component: () => import('./views/WBSessionList.vue'),
    beforeEnter: winterboardGuard,
    meta: { title: 'Winterboard', roles: ['STUDENT', 'TUTOR'] },
  },
  {
    path: '/winterboard/new',
    name: 'winterboard-new',
    component: () => import('./views/WBSoloRoom.vue'),
    beforeEnter: winterboardGuard,
    meta: { title: 'Winterboard', roles: ['STUDENT', 'TUTOR'] },
  },
  {
    path: '/winterboard/:id',
    name: 'winterboard-solo',
    component: () => import('./views/WBSoloRoom.vue'),
    beforeEnter: winterboardGuard,
    props: true,
    meta: { title: 'Winterboard', roles: ['STUDENT', 'TUTOR'] },
  },
  {
    // [WB:A3.1] Classroom whiteboard — teacher/student RBAC view
    path: '/winterboard/classroom/:lessonId',
    name: 'winterboard-classroom',
    component: () => import('./views/WBClassroomRoom.vue'),
    beforeEnter: winterboardGuard,
    props: true,
    meta: { title: 'Winterboard — Classroom', roles: ['STUDENT', 'TUTOR'] },
  },
  {
    // [WB:A1.3] Public view — read-only, no auth required
    // Public view bypasses feature flag — shared links should always work
    path: '/winterboard/public/:token',
    name: 'winterboard-public',
    component: () => import('./views/WBPublicView.vue'),
    props: true,
    meta: { title: 'Winterboard', public: true, requiresAuth: false },
  },
]

export { winterboardGuard }
export default winterboardRoutes
