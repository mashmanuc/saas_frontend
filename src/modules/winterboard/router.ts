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
    meta: { title: 'Winterboard', roles: ['student', 'tutor'] },
  },
  {
    path: '/winterboard/new',
    name: 'winterboard-new',
    component: () => import('./views/WBSoloRoom.vue'),
    meta: { title: 'Winterboard', roles: ['student', 'tutor'] },
  },
  {
    path: '/winterboard/:id',
    name: 'winterboard-solo',
    component: () => import('./views/WBSoloRoom.vue'),
    props: true,
    meta: { title: 'Winterboard', roles: ['student', 'tutor'] },
  },
  {
    path: '/winterboard/classroom/:lessonId',
    name: 'winterboard-classroom',
    component: () => import('./views/WBClassroomRoom.vue'),
    props: true,
    meta: { title: 'Winterboard — Classroom', roles: ['student', 'tutor'] },
  },
  {
    path: '/winterboard/public/:token',
    name: 'winterboard-public',
    component: () => import('./views/WBPublicView.vue'),
    props: true,
    meta: { title: 'Winterboard', public: true, requiresAuth: false },
  },
]

export { winterboardGuard }
export default winterboardRoutes
