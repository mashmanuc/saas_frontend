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

// FIX-5: Session list route — mounted inside PageShell for full header + sidebar
const winterboardSessionListRoute: RouteRecordRaw = {
  path: 'winterboard',
  name: 'winterboard-sessions',
  component: () => import('./views/WBSessionList.vue'),
  meta: { title: 'Winterboard', roles: ['student', 'tutor'] },
}

// Page-level routes — mounted inside PageShell (sidebar + header)
const winterboardPageRoutes: RouteRecordRaw[] = [
  {
    path: 'winterboard/dashboard',
    name: 'winterboard-dashboard',
    component: () => import('./views/WBDashboard.vue'),
    meta: { title: 'Winterboard — Dashboard', roles: ['student', 'tutor'] },
  },
  {
    path: 'winterboard/library',
    name: 'winterboard-library',
    component: () => import('./views/WBLibrary.vue'),
    meta: { title: 'Winterboard — Library', roles: ['student', 'tutor'] },
  },
  {
    path: 'winterboard/lessons',
    name: 'winterboard-lessons',
    component: () => import('./views/WBLessons.vue'),
    meta: { title: 'Lessons', roles: ['student', 'tutor'] },
  },
  {
    path: 'winterboard/lessons/:lessonId',
    name: 'winterboard-lesson',
    component: () => import('./views/WBLessonDetail.vue'),
    props: true,
    meta: { title: 'Lesson', roles: ['student', 'tutor'] },
  },
  {
    path: 'winterboard/boards',
    name: 'winterboard-boards',
    component: () => import('./views/WBBoardList.vue'),
    meta: { title: 'Winterboard — Boards', roles: ['student', 'tutor'] },
  },
  {
    path: 'winterboard/students',
    name: 'winterboard-students',
    component: () => import('./views/WBStudents.vue'),
    meta: { title: 'Winterboard — Students', roles: ['tutor'] },
  },
]

// Standalone routes — own layout (solo room has compact header, public has no auth)
const winterboardStandaloneRoutes: RouteRecordRaw[] = [
  {
    path: '/winterboard/new',
    name: 'winterboard-new',
    component: () => import('./views/WBSoloRoom.vue'),
    meta: { title: 'Winterboard', roles: ['student', 'tutor'] },
  },
  {
    path: '/winterboard/content-preview',
    name: 'winterboard-content-preview',
    component: () => import('./views/WBContentPreview.vue'),
    meta: { title: 'Winterboard — Content Preview', roles: ['tutor'] },
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
  {
    path: '/winterboard/:id',
    name: 'winterboard-solo',
    component: () => import('./views/WBSoloRoom.vue'),
    props: true,
    meta: { title: 'Winterboard', roles: ['student', 'tutor'] },
  },
]

export { winterboardGuard, winterboardSessionListRoute, winterboardPageRoutes }
export default winterboardStandaloneRoutes
