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

// Phase 5 (Student solo-board removal):
//   Solo-scope роути (session list, dashboard, library, boards, new, :id) — tutor-only.
//   Classroom-scope роути (classroom-hub, classroom/:lessonId, lessons/:lessonId) — tutor + student.
//   Public роути — no auth.
//
// Причина: студент не створює контент. Спробу попасти на solo URL прямим вводом
// ловить `router.beforeEach` → `!hasRoleAccess` → redirect на `/student`.
// Ref: memory/project_nav_decisions.md (decision #2)

// Legacy route → redirect на Студію уроків (WBBoardList).
// WBSessionList.vue видалено як dead code (sidebar веде на /winterboard/boards,
// інші посилання прибрано). Цей route зберігається тільки як redirect для
// старих закладок та legacy classroom/* redirects з router/index.js.
const winterboardSessionListRoute: RouteRecordRaw = {
  path: 'winterboard',
  name: 'winterboard-sessions',
  redirect: { name: 'winterboard-boards' },
}

// Page-level routes — mounted inside PageShell (sidebar + header)
const winterboardPageRoutes: RouteRecordRaw[] = [
  {
    // Classroom Hub RETIRED (CLASSROOM_HUB_RETIREMENT_PLAN_2026-06-07).
    // Функції перенесено: join → Dashboard «Майбутні» + LESSON_STARTED notif;
    // re-entry → G4 CTA; conduct → «Мої уроки». Redirect на role-home (guard
    // resolves '/' → getDefaultRouteForRole) для старих закладок/redirect-ів.
    path: 'winterboard/classroom-hub',
    name: 'winterboard-classroom-hub',
    redirect: '/',
  },
  {
    // Legacy redirect — WBDashboard.vue видалено як dead code.
    // Зберігаємо path як redirect на Студію для старих закладок.
    path: 'winterboard/dashboard',
    name: 'winterboard-dashboard',
    redirect: { name: 'winterboard-boards' },
  },
  {
    // Library з tutor матеріалами — tutor-only
    path: 'winterboard/library',
    name: 'winterboard-library',
    component: () => import('./views/WBLibrary.vue'),
    meta: { title: 'Winterboard — Library', roles: ['tutor'] },
  },
  {
    path: 'winterboard/lessons',
    redirect: { name: 'MyLessons' },
  },
  {
    // Lesson detail — tutor + student (спільний перегляд уроку)
    path: 'winterboard/lessons/:lessonId',
    name: 'winterboard-lesson',
    component: () => import('./views/WBLessonDetail.vue'),
    props: true,
    meta: { title: 'Lesson', roles: ['student', 'tutor'] },
  },
  {
    // Solo board list — tutor-only (це фокус Фази 5)
    path: 'winterboard/boards',
    name: 'winterboard-boards',
    component: () => import('./views/WBBoardList.vue'),
    meta: { title: 'Студія уроків', roles: ['tutor'] },
  },
  {
    // Phase 1.6 → v4.1 (Replay Lifecycle): список записів тьютора з 3-tier lifecycle
    path: 'winterboard/replays',
    name: 'winterboard-replays',
    component: () => import('./views/WBReplayList.vue'),
    meta: { title: 'Winterboard — My Replays', roles: ['tutor'] },
  },
  {
    // Replay Lifecycle v4.1: архів
    path: 'winterboard/replays/archive',
    name: 'winterboard-replays-archive',
    component: () => import('./views/WBReplayList.vue'),
    props: { initialStatus: 'archived' },
    meta: { title: 'Winterboard — Archived Replays', roles: ['tutor'] },
  },
  {
    // Replay Lifecycle v4.1: кошик
    path: 'winterboard/replays/trash',
    name: 'winterboard-replays-trash',
    component: () => import('./views/WBReplayList.vue'),
    props: { initialStatus: 'trashed' },
    meta: { title: 'Winterboard — Trashed Replays', roles: ['tutor'] },
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
    // Legacy redirect — scratch board flow видалено. Все створення дошок
    // йде через Студію (winterboard-boards), де "+ Нова дошка" викликає
    // createDraftWithPrep() і веде у конструктор (winterboard-prepare).
    // Зберігаємо path тільки як redirect для старих закладок і legacy
    // solo/new + solo-v2/new redirects з router/index.js.
    path: '/winterboard/new',
    name: 'winterboard-new',
    redirect: { name: 'winterboard-boards' },
  },
  {
    path: '/winterboard/content-preview',
    name: 'winterboard-content-preview',
    component: () => import('./views/WBContentPreview.vue'),
    meta: { title: 'Winterboard — Content Preview', roles: ['tutor'] },
  },
  {
    // A2 (MASH funnel bridge): «Використати на дошці» з публічної воронки /mash/*.
    // Envelope чекає в localStorage['mash:handoff']; гість пройде auth-guard
    // (?redirect=/mash/import) і повернеться сюди. student допущений до view —
    // бачить чесний екран (solo-дошки tutor-only, Phase 5), а не глухий редирект.
    path: '/mash/import',
    name: 'mash-import',
    component: () => import('./views/MashImportView.vue'),
    meta: { title: 'MASH → дошка', roles: ['tutor', 'student'] },
  },
  {
    // Classroom runtime — tutor + student (живий урок)
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
    // Replay Lifecycle v4.1: 🪦 landing для trashed replays (HTTP 410 Gone)
    path: '/winterboard/replay-gone',
    name: 'winterboard-replay-gone',
    component: () => import('./views/PublicReplayGonePage.vue'),
    meta: { title: 'Запис видалено', public: true, requiresAuth: false },
  },
  // Phase B: публічний replay за share-token.
  // INV-L: єдиний anonymous endpoint; НЕ приймає session.id.
  // Legacy /replay/share/:token redirect → /winterboard/public/:token
  // (стара сторінка WBReplayPublicView була placeholder без канвасу;
  // справжнє замінено на WBPublicView з повним replay-плеєром і INV-T hydrate).
  {
    path: '/replay/share/:token',
    name: 'winterboard-replay-share',
    redirect: (to) => ({
      name: 'winterboard-public',
      params: { token: to.params.token },
    }),
    meta: { public: true, requiresAuth: false },
  },
  {
    // Short alias /wb/public/:token → /winterboard/public/:token (зберігає query params — ?replay=v2 тощо)
    path: '/wb/public/:token',
    name: 'winterboard-public-short',
    redirect: (to) => ({
      name: 'winterboard-public',
      params: { token: to.params.token },
      query: to.query,
    }),
    meta: { public: true, requiresAuth: false },
  },
  {
    // Студія уроків — редактор дошки. Той самий WBSoloRoom, але у режимі конструктора.
    // constructorMode: true → ховає запис/invite, показує amber badge + «Оновити шаблон».
    path: '/winterboard/prepare/:id',
    name: 'winterboard-prepare',
    component: () => import('./views/WBSoloRoom.vue'),
    props: true,
    meta: { title: 'Конструктор', roles: ['tutor'], constructorMode: true },
  },
  {
    // Solo session editor — tutor-only
    path: '/winterboard/:id',
    name: 'winterboard-solo',
    component: () => import('./views/WBSoloRoom.vue'),
    props: true,
    meta: { title: 'Winterboard', roles: ['tutor'] },
  },
]

export { winterboardGuard, winterboardSessionListRoute, winterboardPageRoutes }
export default winterboardStandaloneRoutes
