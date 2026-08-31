import { createRouter, createWebHistory } from 'vue-router'
import { reportFatalError } from '../core/errors/appFatalError'
import AuthLayout from '../modules/auth/components/AuthLayout.vue'
import PageShell from '../ui/PageShell.vue'

import LoginView from '../modules/auth/views/LoginView.vue'
import RegisterStudentView from '../modules/auth/views/RegisterStudentView.vue'
import RegisterTutorView from '../modules/auth/views/RegisterTutorView.vue'
import CheckEmailView from '../modules/auth/views/CheckEmailView.vue'
import VerifyEmailView from '../modules/auth/views/VerifyEmailView.vue'
import ForgotPasswordView from '../modules/auth/views/ForgotPasswordView.vue'
import ResetPasswordView from '../modules/auth/views/ResetPasswordView.vue'

// Phase 29 (Activation): Dashboard as activation-focused entry point with hero CTA.
// Legacy DashboardTutor.vue / DashboardStudent.vue deleted — see saas_docs/plans/DASHBOARD_ACTIVATION_PLAN.md.
const TutorHome = () => import('../modules/dashboard/views/TutorHome.vue')
const StudentHome = () => import('../modules/dashboard/views/StudentHome.vue')
import ClassroomList from '../modules/classrooms/views/ClassroomList.vue'
import ClassroomView from '../modules/classrooms/views/ClassroomView.vue'
import ClassroomListView from '../modules/classrooms/views/ClassroomListView.vue'
import ClassroomDetailView from '../modules/classrooms/views/ClassroomDetailView.vue'
import DashboardClassroomsView from '../modules/classrooms/views/DashboardClassroomsView.vue'
import LessonView from '../modules/lessons/views/LessonView.vue'
import ProfileOverviewView from '../modules/profile/views/ProfileOverviewView.vue'
import LessonInviteResolveView from '../modules/lessons/views/LessonInviteResolveView.vue'
const MarketplaceListView = () => import('../modules/marketplace/views/TutorCatalogView.vue')
const MarketplaceTutorView = () => import('../modules/marketplace/views/TutorProfileView.vue')
const MarketplaceMyProfileView = () => import('../modules/marketplace/views/MyProfileView.vue')
const MarketplaceSearchResultsView = () => import('../modules/marketplace/views/SearchResultsView.vue')
const MarketplaceCategoryView = () => import('../modules/marketplace/views/CategoryView.vue')

// Marketplace DISABLED 2026-06-17 (extraction) — catalog routes redirect to role home.
const mpDisabledRedirect = () => {
  const auth = useAuthStore()
  return auth.user?.role === USER_ROLES.TUTOR ? '/tutor' : '/student'
}
// Practice (NMT puzzle-journey) — за флагом. import() нижче = BUILD-time залежність →
// `src/modules/practice/` МУСИТЬ бути закомічений разом (інакше CF clean-clone падає).
// Флаг лише runtime-gate (чи реєструються маршрути). Default OFF у проді, завжди ON у dev.
const PRACTICE_ENABLED = import.meta.env.DEV || import.meta.env.VITE_PRACTICE_ENABLED === 'true'
// Exam (Assessment / НМТ-симулятор Solo) — runtime-gate. Модуль `src/modules/exam/`
// закомічено разом (BUILD-time import). Default OFF у проді, завжди ON у dev.
const ASSESSMENT_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ASSESSMENT_ENABLED === 'true'
// Домашні завдання (ДЗ) — приховано з прода (ламається). Роути лишаються зареєстровані
// (щоб не зламати router.push з інших в'юх), але beforeEnter редіректить на home у проді.
const ASSIGNMENTS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ASSIGNMENTS_ENABLED === 'true'
const BookingRequestsView = () => import('../modules/booking/views/BookingRequestsView.vue')
const TutorAvailabilityView = () => import('../modules/booking/views/TutorAvailabilityView.vue')
const ProfileEditView = () => import('../modules/profile/views/ProfileEditView.vue')
const ProfileActivityView = () => import('../modules/profile/views/ProfileActivityView.vue')
const SettingsSecurityView = () => import('../modules/profile/views/SettingsSecurityView.vue')
const ChangeEmailView = () => import('../modules/profile/views/ChangeEmailView.vue')
const ChangePasswordView = () => import('../modules/profile/views/ChangePasswordView.vue')
const AccountBillingView = () => import('../modules/billing/views/AccountBillingView.vue')
const DevThemePlaygroundView = () => import('../modules/dev/views/DevThemePlayground.vue')

// UI Contract V2 views (feature-flagged)
const ProfileEditViewV2 = () => import('../modules/profileV2/views/ProfileEditView.vue')
const ProfileOverviewViewV2 = () => import('../modules/profileV2/views/ProfileOverviewView.vue')
const UserAccountViewV2 = () => import('../modules/profileV2/views/UserAccountView.vue')

// Onboarding views ВИДАЛЕНО (2026-06-13): візард замінено на Activation Engine
// (modules/activation). Мертві роути /onboarding/* + /checklist прибрано нижче.

import { useAuthStore } from '../modules/auth/store/authStore'
import { useProfileStore } from '../modules/profile/store/profileStore'
import { USER_ROLES } from '../types/user'
import { getDefaultRouteForRole, hasAccess } from '../config/routes'
import { requiresAdminOrOperator } from './guards/adminGuard'
import { setCurrentRoute } from '@/modules/diagnostics/plugins/errorCollector'

// P0.3: Lighthouse route без auth для стабільного audit
const LighthouseCalendarView = () => import('../views/__lighthouse__/LighthouseCalendarView.vue')

// Role selection landing page
const RoleSelectionView = () => import('../views/RoleSelectionView.vue')

// Winterboard v3 (lazy-loaded module routes)
import winterboardRoutes, { winterboardSessionListRoute, winterboardPageRoutes } from '../modules/winterboard/router'
// Local Workspace (ТЗ Точка 3): неавторизований корінь / → одразу робочий стіл
import { isLocalWorkspaceEnabled } from '../modules/winterboard/config/featureFlags'

const routes = [
  // Role selection landing page (root redirect)
  {
    path: '/start',
    name: 'role-selection',
    component: RoleSelectionView,
    meta: { requiresAuth: false }
  },
  {
    path: '/auth',
    component: AuthLayout,
    meta: { requiresAuth: false },
    children: [
      { path: 'login', name: 'login', component: LoginView, meta: { requiresAuth: false } },
      // 2026-07-23: раніше вело на лендінг і МОВЧКИ губило query (?redirect=/workspace,
      // ?ref=...). Гість, що клікнув «в хмару», втрачав шлях назад до своєї дошки.
      // v1 = BYO tutor-tool → безролеве /auth/register веде одразу на форму тьютора
      // (перемикач «зареєструватися як студент» є всередині форми), query зберігаємо.
      { path: 'register', redirect: (to) => ({ path: '/auth/register/tutor', query: to.query }) },
      // 2026-07-26: у моделі BYO учень потрапляє в продукт ЛИШЕ за запрошенням
      // тьютора (`/invite/:token` → POST /v1/invites/{token}/accept/). Публічна
      // самореєстрація створювала «сирітські» акаунти без зв'язку з тьютором —
      // шлях, якого в продукті не існує. Компонент лишаємо (легкий відкат),
      // але вхід закриваємо: гість іде на лендінг, авторизований — до себе.
      {
        path: 'register/student',
        name: 'register-student',
        component: RegisterStudentView,
        meta: { requiresAuth: false },
        beforeEnter: () => ({ path: '/start' }),
      },
      { path: 'register/tutor', name: 'register-tutor', component: RegisterTutorView, meta: { requiresAuth: false } },
      { path: 'check-email', name: 'auth-check-email', component: CheckEmailView, meta: { requiresAuth: false } },
      { path: 'verify-email', name: 'auth-verify-email', component: VerifyEmailView, meta: { requiresAuth: false } },
      { path: 'forgot-password', name: 'auth-forgot-password', component: ForgotPasswordView, meta: { requiresAuth: false } },
      { path: 'reset-password', name: 'auth-reset-password', component: ResetPasswordView, meta: { requiresAuth: false } },
    ],
  },
  // TutorInvite system (invite-based onboarding)
  {
    path: '/invite/:token',
    name: 'tutor-invite-accept',
    component: () => import('../components/invites/InviteAcceptPage.vue'),
    meta: { requiresAuth: false, isTutorInvite: true }
  },
  // v1.0: Redirect legacy email URLs to /auth/* routes (safety net for old emails)
  {
    path: '/reset-password',
    redirect: to => ({ path: '/auth/reset-password', query: to.query }),
  },
  {
    path: '/verify-email',
    redirect: to => ({ path: '/auth/verify-email', query: to.query }),
  },
  {
    path: '/forgot-password',
    redirect: '/auth/forgot-password',
  },
  {
    path: '/lesson-invite/:token',
    name: 'lesson-invite-resolve',
    component: LessonInviteResolveView,
    meta: { requiresAuth: false }
  },
  // v0.77: Legal and Contact pages
  {
    path: '/legal/terms',
    name: 'legal-terms',
    component: () => import('../views/legal/TermsView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/legal/privacy',
    name: 'legal-privacy',
    component: () => import('../views/legal/PrivacyView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/legal/payment',
    name: 'legal-payment',
    component: () => import('../views/legal/PaymentView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/legal/refund',
    name: 'legal-refund',
    component: () => import('../views/legal/RefundView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/legal/tutor-offer',
    name: 'legal-tutor-offer',
    component: () => import('../views/legal/TutorOfferView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/legal/student-offer',
    name: 'legal-student-offer',
    component: () => import('../views/legal/StudentOfferView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/contacts',
    name: 'contacts',
    component: () => import('../views/ContactsView.vue'),
    meta: { requiresAuth: false }
  },
  {
    // Демо-доріжка одного заняття очима учня. Публічна свідомо: щоб
    // побачити потік, акаунт не потрібен (як і для демо-дошки).
    // Дані статичні (public/demo-lesson-percent.json), бекенд не чіпано.
    path: '/demo-lesson',
    name: 'demo-lesson',
    component: () => import('../modules/learning-content/views/DemoLessonView.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: PageShell,
    meta: { requiresAuth: true },
    // v0.88.4: Root path will redirect staff to /staff via beforeEach guard
    children: [
      {
        path: 'tutor',
        name: 'tutor-dashboard',
        component: TutorHome,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR] },
      },
      {
        path: 'tutor/students',
        name: 'tutor-students',
        component: () => import('../modules/dashboard/views/TutorStudents.vue'),
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR] },
      },
      {
        path: 'dashboard/classrooms',
        name: 'dashboard-classrooms',
        component: DashboardClassroomsView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR] },
      },
      {
        path: 'dashboard/classrooms/:id',
        name: 'dashboard-classroom-detail',
        component: ClassroomDetailView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR] },
      },
      {
        path: 'tutor/classrooms',
        name: 'tutor-classrooms',
        component: ClassroomListView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR] },
      },
      {
        path: 'tutor/classrooms/:id',
        name: 'tutor-classroom-detail',
        component: ClassroomDetailView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR] },
      },
      {
        path: 'student',
        name: 'student-dashboard',
        component: StudentHome,
        meta: { roles: [USER_ROLES.STUDENT] },
      },
      // Practice (NMT puzzle-journey) — gated by VITE_PRACTICE_ENABLED (build-safe: модуль
      // закомічено разом із цим; флаг = runtime-gate). Default OFF у проді, ON у dev.
      ...(PRACTICE_ENABLED
        ? [
            {
              path: 'practice',
              name: 'practice',
              component: () => import('../modules/practice/views/PracticeHomeView.vue'),
              meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
            },
            {
              path: 'practice/worlds',
              name: 'practice-worlds',
              component: () => import('../modules/practice/views/PracticeProgressionView.vue'),
              meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
            },
            {
              // F3 World-System (Campaign) — backend FEATURE_PRACTICE_PROGRESSION; 404 → 'unavailable'
              path: 'practice/campaign',
              name: 'practice-campaign',
              component: () => import('../modules/practice/views/PracticeCampaignView.vue'),
              meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
            },
          ]
        : []),
      // Exam (Assessment / НМТ-симулятор Solo) — gated by VITE_ASSESSMENT_ENABLED.
      ...(ASSESSMENT_ENABLED
        ? [
            {
              path: 'exam',
              name: 'exam-start',
              component: () => import('../modules/exam/views/ExamStartView.vue'),
              meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
            },
            {
              path: 'exam/create',
              name: 'exam-create',
              component: () => import('../modules/exam/views/ExamCreateView.vue'),
              meta: { roles: [USER_ROLES.TUTOR] },
            },
            {
              path: 'exam/run/:runId',
              name: 'exam-run',
              component: () => import('../modules/exam/views/ExamRunView.vue'),
              meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
            },
            {
              path: 'exam/run/:runId/result',
              name: 'exam-result',
              component: () => import('../modules/exam/views/ExamResultView.vue'),
              meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
            },
          ]
        : []),
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('../views/NotificationsView.vue'),
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // 2026-07-28: роут 'user-account' (/dashboard/account) ВИДАЛЕНО як дубль
      // /settings (вкладка «account» = AccountSettingsTab, окремий живий компонент).
      // Сторінка була сиротою: у сайдбарі «Акаунт» веде на /settings, а сюди не
      // вело нічого, крім кнопки «Назад» з білінгу (прибрана 7e312554).
      // change-email / change-password лишаються — вони досяжні з /settings.
      {
        path: 'dashboard/account/billing',
        name: 'account-billing',
        component: AccountBillingView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/account/change-email',
        name: 'change-email',
        component: ChangeEmailView,
        meta: { requiresAuth: true, roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/account/change-password',
        name: 'change-password',
        component: ChangePasswordView,
        meta: { requiresAuth: true, roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'classrooms',
        name: 'classrooms',
        component: ClassroomList,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR] },
      },
      {
        path: 'classrooms/:id',
        name: 'classroom',
        component: ClassroomView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR] },
      },
      {
        path: 'lessons',
        redirect: '/student/schedule',
      },
      {
        path: 'lessons/:id',
        name: 'lesson',
        component: LessonView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'templates/marketplace',
        name: 'template-marketplace',
        component: () => import('../modules/lessons/views/TemplateMarketplace.vue'),
        meta: { requiresAuth: true, roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // Phase 2: Redirect old profile routes to new settings
      {
        path: 'dashboard/profile',
        redirect: '/settings',
      },
      {
        path: 'dashboard/profile/edit',
        redirect: '/settings',
      },
      {
        path: 'dashboard/profile/security',
        redirect: '/settings',
      },
      {
        path: 'dashboard/profile/activity',
        redirect: '/settings',
      },
      // UI Contract V2 routes (feature-flagged)
      ...(import.meta.env.VITE_ENABLE_UI_CONTRACT_V2 === 'true' ? [
        {
          path: 'profile-v2/overview',
          name: 'profile-overview-v2',
          component: ProfileOverviewViewV2,
          meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
        },
        {
          path: 'profile-v2/edit',
          name: 'profile-edit-v2',
          component: ProfileEditViewV2,
          meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
        },
        {
          path: 'profile-v2/account',
          name: 'profile-account-v2',
          component: UserAccountViewV2,
          meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
        },
      ] : []),
      // USERS domain routes
      {
        path: 'settings',
        name: 'user-settings',
        component: () => import('../modules/profile/views/UserSettingsView.vue'),
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'settings/security',
        name: 'settings-security',
        component: SettingsSecurityView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // R4: tutor/profile/edit legacy redirect
      {
        path: 'tutor/profile/edit',
        redirect: '/tutor/profile',
      },
      // Student Profile routes - TEMPORARILY DISABLED (using _NEW version)
      // {
      //   path: 'student/profile/edit',
      //   name: 'student-profile-edit',
      //   component: StudentProfileEditView,
      //   meta: { roles: [USER_ROLES.STUDENT] },
      // },
      {
        path: 'profile/:userId',
        name: 'tutor-public-profile',
        component: () => import('../modules/profile/views/TutorProfilePublicView.vue'),
        meta: { requiresAuth: false },
      },
      {
        path: 'admin/users/:userId/role-history',
        name: 'admin-role-history',
        component: () => import('../modules/profile/views/RoleHistoryView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
          requiresAdminOrOperator: true
        },
      },
      // Marketplace catalog DISABLED 2026-06-17 (extraction) — redirect to role home.
      // Компоненти лишено lazy-importable для відновлення.
      { path: 'marketplace', redirect: mpDisabledRedirect },
      { path: 'marketplace/tutors/:slug', redirect: mpDisabledRedirect },
      { path: 'marketplace/search', redirect: mpDisabledRedirect },
      { path: 'marketplace/categories/:slug', redirect: mpDisabledRedirect },
      {
        // tutor/profile (marketplace listing editor) DISABLED 2026-06-17 — BYO не потребує
        // публічного лістингу; акаунт тьютора живе у /settings. Redirect → role home.
        path: 'tutor/profile',
        redirect: mpDisabledRedirect,
      },
      // R4: Legacy redirect
      { path: 'marketplace/my-profile', redirect: '/tutor/profile' },
      {
        path: 'booking/requests',
        name: 'booking-requests',
        component: BookingRequestsView,
        meta: {
          requiresAuth: true,
          roles: [USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
        },
      },
      {
        path: 'dev/theme',
        name: 'dev-theme-playground',
        component: DevThemePlaygroundView,
        meta: { roles: [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
      },
      // Onboarding/checklist routes ВИДАЛЕНО (2026-06-13): візард замінено на
      // Activation Engine (modules/activation). Жоден живий код сюди не лінкував.
      // Inquiry routes DISABLED 2026-06-18 (Marketplace extraction) — без discovery нові
      // inquiry не творяться; інбокси порожні. Redirect → role home (як marketplace).
      // Імена лишено (backward-compat для {name:...}-навігації); компоненти lazy-importable.
      { path: 'student/inquiries', name: 'student-inquiries', redirect: mpDisabledRedirect },
      { path: 'tutor/inquiries', name: 'tutor-inquiries', redirect: mpDisabledRedirect },
      // v0.25-FIX: Booking routes
      {
        path: 'tutor/bookings',
        name: 'tutor-bookings',
        component: () => import('../modules/booking/views/MyLessonsView.vue'),
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // R4: Legacy redirect
      { path: 'bookings', redirect: '/tutor/bookings' },
      {
        path: 'tutor/bookings/:id',
        name: 'tutor-booking-detail',
        component: () => import('../modules/booking/views/BookingDetailView.vue'),
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // R4: Legacy redirect
      { path: 'bookings/:id', redirect: to => `/tutor/bookings/${to.params.id}` },
      {
        path: 'tutor/schedule',
        name: 'tutor-calendar',
        component: () => import('../modules/booking/views/TutorCalendarView.vue'),
        meta: { roles: [USER_ROLES.TUTOR] },
      },
      // R4: Legacy redirect
      { path: 'booking/tutor', redirect: '/tutor/schedule' },
      {
        path: 'student/schedule',
        name: 'student-calendar',
        component: () => import('../modules/booking/views/StudentCalendarView.vue'),
        meta: { roles: [USER_ROLES.STUDENT] },
      },
      // R4: Legacy redirect
      { path: 'calendar', redirect: '/student/schedule' },
      {
        path: 'tutor/availability',
        name: 'tutor-availability',
        component: TutorAvailabilityView,
        meta: { roles: [USER_ROLES.TUTOR] },
      },
      // R4: Legacy redirect
      { path: 'booking/availability', redirect: '/tutor/availability' },
      {
        path: 'tutor/lesson-links',
        name: 'tutor-lesson-links',
        component: () => import('../modules/booking/views/TutorLessonLinksView.vue'),
        meta: { roles: [USER_ROLES.TUTOR] },
      },
      {
        path: 'book/:slug',
        name: 'book-lesson',
        component: () => import('../modules/booking/views/BookLessonView.vue'),
        meta: { roles: [USER_ROLES.STUDENT] },
      },
      // Matches routes DISABLED 2026-06-18 (Marketplace extraction) — matching = marketplace
      // feature, dead in BYO (no inquiries/discovery). Orphaned (no sidebar link) → redirect to
      // role home to avoid direct-URL 404s into disabled marketplace API. Names kept (backward-compat).
      { path: 'matches', name: 'matches', redirect: mpDisabledRedirect },
      { path: 'matches/:id', name: 'match-detail', redirect: mpDisabledRedirect },
      // v0.70: Chat routes (Smart Polling)
      {
        path: 'tutor/messages',
        name: 'tutor-messages',
        component: () => import('../modules/negotiation/views/ChatListView.vue'),
        meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'tutor/messages/:threadId',
        name: 'tutor-message-thread',
        component: () => import('../modules/negotiation/views/ChatView.vue'),
        meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // R4: Legacy redirects
      { path: 'chat', redirect: '/tutor/messages' },
      { path: 'chat/:threadId', redirect: to => `/tutor/messages/${to.params.threadId}` },
      // [LEGACY→WB] Old classroom routes redirected to Студію (winterboard-boards).
      // winterboard-sessions та winterboard-new redirect до boards теж, але через
      // 2 hops — даємо короткий шлях для старих URL.
      { path: 'classroom/board', redirect: { name: 'winterboard-boards' } },
      { path: 'classroom/solo', redirect: { name: 'winterboard-boards' } },
      { path: 'classroom/:sessionId', redirect: { name: 'winterboard-boards' } },
      { path: 'classroom/:sessionId/summary', redirect: { name: 'winterboard-boards' } },
      { path: 'classroom/:sessionId/replay', redirect: { name: 'winterboard-boards' } },
      { path: 'classroom/:sessionId/history', redirect: { name: 'winterboard-boards' } },
      // [WB:A1.1] Solo → Winterboard redirects (v0.26-v0.27 routes deprecated)
      { path: 'solo', redirect: { name: 'winterboard-boards' } },
      { path: 'solo/new', redirect: { name: 'winterboard-boards' } },
      { path: 'solo/:id', redirect: to => ({ name: 'winterboard-solo', params: { id: to.params.id } }) },
      { path: 'solo-v2/new', redirect: { name: 'winterboard-boards' } },
      { path: 'solo-v2/:id', redirect: to => ({ name: 'winterboard-solo', params: { id: to.params.id } }) },
      { path: 'solo/shared/:token', redirect: to => ({ name: 'winterboard-public', params: { token: to.params.token } }) },
      // v0.69: People & Negotiation Chat routes
      // People inquiry-inboxes DISABLED 2026-06-18 (Marketplace extraction) — negotiation
      // inbox порожній без discovery. Redirect → role home. (Relation/CONTACT chat нижче ЛИШЕНО.)
      { path: 'beta/people', name: 'people-inquiries-student', redirect: mpDisabledRedirect },
      { path: 'beta/people/inbox', name: 'people-inquiries-tutor', redirect: mpDisabledRedirect },
      {
        path: 'chat/thread/:threadId',
        name: 'chat-thread-people',
        component: () => import('../modules/people/views/ChatThreadView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR]
        },
      },
      // Phase 16: Redirect legacy Knowledge Library to Knowledge Hub
      { path: 'tutor/knowledge', redirect: '/knowledge' },
      // R4: Legacy redirect
      { path: 'dashboard/knowledge', redirect: '/tutor/knowledge' },
      // v0.71: Chat with tutor route
      {
        path: 'chat/tutor/:tutorId',
        name: 'chat_with_tutor',
        component: () => import('../modules/chat/views/ChatWithTutorView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR]
        },
      },
      // v0.70: Contact→Chat integration - Chat with student route
      {
        path: 'chat/student/:studentId',
        name: 'chat-student',
        component: () => import('../modules/chat/views/ChatWithStudentView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.TUTOR]
        },
      },
      // v0.72: Billing routes
      {
        path: 'tutor/billing',
        name: 'tutor-billing',
        // §5З Крок 3 (2026-07-27): канонічна сторінка підписки = AccountBillingView.
        // BillingView видалено як дубль (менше вміла, мала баг «None», 390 рядків
        // inline проти 157 на компонентах). Обидві адреси → одна сторінка.
        component: AccountBillingView,
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR]
        },
      },
      // R4: Legacy redirect
      { path: 'billing', redirect: '/tutor/billing' },
      {
        path: 'tutor/billing/plans',
        name: 'billing-plans',
        component: () => import('../modules/payments/views/PlansView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR]
        },
      },
      // R4: Legacy redirect
      { path: 'billing/plans', redirect: '/tutor/billing/plans' },
      {
        path: 'tutor/billing/success',
        name: 'billing-success',
        component: () => import('../modules/billing/views/BillingSuccessView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
        },
      },
      // R4: Legacy redirect
      { path: 'billing/success', redirect: '/tutor/billing/success' },
      {
        path: 'tutor/billing/cancel',
        name: 'billing-cancel',
        component: () => import('../modules/billing/views/BillingCancelView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
        },
      },
      // R4: Legacy redirect
      { path: 'billing/cancel', redirect: '/tutor/billing/cancel' },
      // DOMAIN-06: Entitlements module routes
      {
        path: 'plan-features',
        name: 'plan-features',
        component: () => import('../modules/entitlements/views/PlanFeaturesView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
        },
      },
      // DOMAIN-12: Trust & Safety module routes
      {
        path: 'trust/blocked',
        name: 'trust-blocked-users',
        component: () => import('../modules/trust/views/BlockedUsersView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
        },
      },
      {
        path: 'trust/appeals',
        name: 'trust-appeals',
        component: () => import('../modules/trust/views/AppealsView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
        },
      },
      // DOMAIN-09: Reviews module routes
      {
        path: 'reviews/my',
        name: 'my-reviews',
        component: () => import('../modules/reviews/views/MyReviewsView.vue'),
        meta: {
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT]
        },
      },
      // Platform Feedback domain (community roadmap / voting / feedback governance)
      // SSOT: backend/apps/platform_feedback/PLATFORM_FEEDBACK_SSOT.md
      {
        path: 'feedback',
        name: 'FeedbackLanding',
        component: () => import('../modules/platform-feedback/views/FeedbackLanding.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'feedback/new',
        name: 'NewFeedbackThread',
        component: () => import('../modules/platform-feedback/views/NewThread.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'feedback/roadmap',
        name: 'FeedbackRoadmap',
        component: () => import('../modules/platform-feedback/views/Roadmap.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'feedback/search',
        name: 'FeedbackSearch',
        component: () => import('../modules/platform-feedback/views/FeedbackSearch.vue'),
        meta: { requiresAuth: true },
      },
      {
        path: 'feedback/thread/:id',
        name: 'FeedbackThread',
        component: () => import('../modules/platform-feedback/views/ThreadDetail.vue'),
        meta: { requiresAuth: true },
        props: true,
      },
      // v0.88.4: Staff Console with dedicated layout
      {
        path: 'staff',
        component: () => import('../modules/staff/layouts/StaffLayout.vue'),
        meta: { 
          requiresAuth: true,
          requiresStaff: true
        },
        children: [
          {
            path: '',
            name: 'staff-dashboard',
            component: () => import('../modules/staff/views/StaffDashboard.vue'),
            meta: { 
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF],
              requiresStaff: true
            },
          },
          {
            path: 'users',
            name: 'staff-users',
            component: () => import('../modules/staff/views/StaffUsersListView.vue'),
            meta: { 
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF],
              requiresStaff: true
            },
          },
          {
            path: 'users/:id',
            name: 'staff-user-overview',
            component: () => import('../modules/staff/views/StaffUserOverviewView.vue'),
            meta: { 
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF],
              requiresStaff: true
            },
          },
          {
            path: 'reports',
            name: 'staff-reports',
            component: () => import('../modules/staff/views/StaffReportsView.vue'),
            meta: { 
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF],
              requiresStaff: true
            },
          },
          {
            path: 'payouts',
            name: 'staff-payouts',
            component: () => import('../modules/staff/views/StaffPayoutsView.vue'),
            meta: {
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'profile-moderation',
            name: 'staff-profile-moderation',
            component: () => import('../modules/staff/views/StaffProfileModerationView.vue'),
            meta: { 
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'verification',
            name: 'staff-verification',
            component: () => import('../modules/staff/views/StaffVerificationView.vue'),
            meta: { 
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'tutor-activity',
            name: 'staff-tutor-activity',
            component: () => import('../modules/staff/views/TutorActivityManagement.vue'),
            meta: {
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          // S6 (audit 2026-05-24): Platform Feedback staff triage console.
          // Permission `platform_feedback.moderate_feedback` enforced at API level.
          {
            path: 'feedback',
            name: 'staff-platform-feedback',
            component: () => import('../modules/platform-feedback/views/StaffFeedbackList.vue'),
            meta: {
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true,
            },
          },
          {
            path: 'billing',
            name: 'staff-billing',
            component: () => import('../modules/staff/views/StaffBillingView.vue'),
            meta: { 
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'health',
            name: 'staff-health',
            component: () => import('../modules/staff/views/StaffSystemHealthView.vue'),
            meta: {
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'health/realtime',
            name: 'staff-cascade-health',
            component: () => import('../modules/staff/views/StaffCascadeHealthView.vue'),
            meta: {
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          // 2026-07-28: /staff/operator ВИДАЛЕНО разом з доменом apps.operator.
          // Консоль обслуговувала роль `operator`, якої на платформі не існує
          // (0 юзерів з такою роллю), і не працювала: RBAC-middleware читав
          // session-user, тоді як автентифікація JWT-only → 401 назавжди.
          // Деталі: FINAL/PRODUCTION_READINESS_AUDIT_2026-07-28_VERIFIED.md §10.
          {
            path: 'subscription-plans',
            name: 'staff-subscription-plans',
            component: () => import('../modules/staff/views/StaffSubscriptionPlansView.vue'),
            meta: {
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'platform-settings',
            name: 'staff-platform-settings',
            component: () => import('../modules/staff/views/StaffPlatformSettingsView.vue'),
            meta: {
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'analytics',
            name: 'staff-analytics',
            component: () => import('../modules/staff/views/StaffAnalyticsView.vue'),
            meta: {
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
        ],
      },
      // Phase 16: Knowledge domain routes (inside PageShell for sidebar + header)
      {
        path: 'knowledge',
        children: [
          {
            path: '',
            name: 'KnowledgeHub',
            redirect: { name: 'MyLessons' },
          },
          {
            path: 'library',
            name: 'LessonLibrary',
            component: () => import('../modules/knowledge/views/LessonLibraryPage.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
          },
          {
            path: 'packs',
            name: 'MyPacks',
            component: () => import('../modules/knowledge/views/MyPacksPage.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
          },
          {
            path: 'analytics',
            name: 'KnowledgeAnalytics',
            component: () => import('../modules/knowledge/views/KnowledgeAnalyticsPage.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
          },
          {
            path: 'catalog',
            name: 'KnowledgeCatalog',
            component: () => import('../modules/knowledge/views/KnowledgeCatalogPage.vue'),
            meta: { requiresAuth: false },
          },
          // Phase 21: My saved lessons
          {
            path: 'my-lessons',
            name: 'MyLessons',
            component: () => import('../modules/knowledge/views/WBMyLessonsPage.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
          },
          // LessonGrant (2026-07): активація коду передачі паку уроків.
          // STUDENT свідомо включено: сторінка сама показує чесний екран
          // «доступно тьюторам» (redirect заплутав би покупця, що прийшов з лінка).
          {
            path: '/grant/:code',
            name: 'GrantActivate',
            component: () => import('../modules/knowledge/views/GrantActivatePage.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN, USER_ROLES.STUDENT] },
          },
        ],
      },
      // FIX-5: Winterboard session list — inside PageShell for header + sidebar
      winterboardSessionListRoute,
      // Winterboard page-level routes (library, dashboard, boards, lessons, students)
      // NOTE: Lesson Constructor живе всередині WBBoardList.vue (вкладка "Конструктор"),
      // а не як окрема сторінка. Гейтується через isLessonConstructorEnabled().

      // Must be inside PageShell so they get header + sidebar.
      // NOTE: these must be registered BEFORE standalone /winterboard/:id route
      // or else /winterboard/library would match as id='library' → 404.
      ...winterboardPageRoutes,
      // Assignment (Homework) — Vertical Slice (SSOT 2026-07-01). Inside PageShell (header+sidebar).
      {
        path: 'assignments',
        // Приховано з прода: редірект на home, поки ДЗ не полагоджено (VITE_ASSIGNMENTS_ENABLED).
        beforeEnter: () => (ASSIGNMENTS_ENABLED ? true : { path: '/' }),
        children: [
          {
            path: '',
            name: 'assignments-list',
            component: () => import('../modules/assignments/views/MyAssignmentsView.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.STUDENT, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
          },
          {
            path: 'new',
            name: 'assignment-compose',
            component: () => import('../modules/assignments/views/AssignmentComposeView.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
          },
          {
            // ДЗ конкретного учня (вхід — картка «Мої учні»); product intent 2026-07-22.
            path: 'student/:studentId',
            name: 'student-assignments',
            component: () => import('../modules/assignments/views/StudentAssignmentsView.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
          },
          {
            path: ':id',
            name: 'assignment-detail',
            component: () => import('../modules/assignments/views/AssignmentDetailView.vue'),
            meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.STUDENT, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
          },
        ],
      },
      // Центр «Допомога» — вбудована довідка (план TUTOR_DOCUMENTATION_PLAN_2026-06-25).
      // Будь-який залогінений користувач (PageShell → requiresAuth); контент тьютор-орієнтований.
      {
        path: 'help/:slug?',
        name: 'help',
        component: () => import('../modules/help/views/HelpView.vue'),
      },
    ],
  },
  // P0.3: Lighthouse route без auth для performance testing
  {
    path: '/__lighthouse__/calendar',
    name: 'lighthouse-calendar',
    component: LighthouseCalendarView,
    meta: { requiresAuth: false },
  },
  // DOMAIN-09: Public tutor reviews route
  {
    path: '/tutor/:tutorId/reviews',
    name: 'tutor-reviews',
    component: () => import('../modules/reviews/views/TutorReviewsView.vue'),
    meta: { requiresAuth: false },
  },
  // Winterboard v3 routes (top-level, own layout)
  ...winterboardRoutes,
  // Phase 15: Knowledge catalog (public fallback for anonymous users)
  {
    path: '/knowledge/catalog',
    name: 'KnowledgeCatalogPublic',
    component: () => import('../modules/knowledge/views/KnowledgeCatalogPage.vue'),
    meta: { requiresAuth: false }
  },
  // Phase 14 A3.2: Public lesson pack page (Knowledge domain — no auth, blank layout)
  {
    path: '/pack/:tutorSlug/:packSlug',
    name: 'LessonPack',
    component: () => import('../modules/knowledge/views/LessonPackPage.vue'),
    meta: { requiresAuth: false, layout: 'blank' }
  },
  // Phase 15 A3.2: Collections list (public — no auth)
  {
    path: '/knowledge/collections',
    name: 'CollectionsList',
    component: () => import('../modules/knowledge/views/CollectionsListPage.vue'),
    meta: { requiresAuth: false }
  },
  // Phase 15 A3.2: Collection detail (public — no auth, blank layout)
  {
    path: '/knowledge/collections/:slug',
    name: 'CollectionDetail',
    component: () => import('../modules/knowledge/views/CollectionPage.vue'),
    meta: { requiresAuth: false, layout: 'blank' }
  },
  // Phase 13 A1.1: Public lesson page (Knowledge domain — no auth, blank layout)
  {
    path: '/lesson/:tutorSlug/:lessonSlug',
    name: 'PublicLesson',
    component: () => import('../modules/knowledge/views/PublicLessonPage.vue'),
    meta: { requiresAuth: false, layout: 'blank' }
  },
  // Phase 22: Unified lesson view with access policy (/l/:lessonSlug)
  {
    path: '/l/:lessonSlug',
    name: 'LessonView',
    component: () => import('../modules/knowledge/views/LessonViewPage.vue'),
    meta: { requiresAuth: false, layout: 'blank' }
  },
  { path: '/:pathMatch(.*)*', redirect: '/start' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()
  const profileStore = useProfileStore()

  // P0: Public routes (requiresAuth: false) — skip bootstrap entirely.
  // Without this, expired cookies trigger 401 → "Сесію завершено" toast → redirect to /start
  // even though the page doesn't need auth (e.g. /winterboard/public/:token).
  // 2026-07-23: авторизованого НЕ тримаємо на сторінках входу/реєстрації.
  // Логіка «authenticated + /auth/* → додому» нижче була МЕРТВИМ кодом: гілка
  // /auth має meta.requiresAuth:false, тож isPublicRoute-early-return спрацьовував
  // раніше і виходив з гарда. Наслідок — залогінена людина вічно бачила форму
  // реєстрації («авторизувався, а ніфіга»).
  // Читаємо ЛИШЕ відновлений із localStorage стан (access+user, див. authStore
  // state-init) — bootstrap() свідомо НЕ викликаємо, щоб не зачепити P0-кейс
  // публічних winterboard-роутів (протухла cookie → 401 → «Сесію завершено»).
  // Свідомо звужено до login/register: verify-email, reset-password,
  // forgot-password, check-email залогіненому бувають потрібні.
  const isAuthEntryPage = to.path === '/auth/login' || to.path.startsWith('/auth/register')
  if (isAuthEntryPage && auth.isAuthenticated) {
    return next(getDefaultRouteForRole(auth.user?.role))
  }

  const isPublicRoute = to.matched.some((record) => record.meta?.requiresAuth === false)
  if (isPublicRoute) {
    return next()
  }

  if (!auth.isBootstrapped) {
    await auth.bootstrap()
  }

  const hasAccessToken = Boolean(auth.access)
  let isAuthenticated = auth.isAuthenticated
  const user = auth.user
  // v0.88.4: homeRoute визначається через role (SSOT: config/routes.js)
  const homeRoute = user?.role ? getDefaultRouteForRole(user.role) : '/start'
  const isAuthRoute = to.path.startsWith('/auth')
  const isInviteRoute = to.path.startsWith('/invite')
  const isTutorInvite = to.matched.some(r => r.meta?.isTutorInvite)
  const isStartRoute = to.path === '/start'
  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth !== false && record.meta?.requiresAuth !== undefined ? record.meta.requiresAuth : true)
  const hasRoleAccess = hasAccess(user, to)

  if (!isAuthenticated && hasAccessToken) {
    try {
      await auth.reloadUser()
      isAuthenticated = auth.isAuthenticated
    } catch (error) {
      console.warn('[router] Failed to restore user session', error)
    }
  }

  if (!isAuthenticated) {
    if (isAuthRoute || isInviteRoute || isStartRoute) {
      return next()
    }
    // Local Workspace (ТЗ Точка 3, 2026-07-16): неавторизований корінь `/` веде
    // ОДРАЗУ на робочий стіл `/workspace` (не на лендінг `/start`). Лендінг і
    // логін лишаються доступні окремими кнопками ([Підключити хмару] → /start →
    // «Увійти»), але не як обов'язковий перший крок. Гейт — той самий флаг фічі.
    // Лише корінь: інші protected-роути неавторизованого досі ведуть на /start.
    if (to.path === '/' && isLocalWorkspaceEnabled()) {
      return next('/workspace')
    }
    return next({ path: '/start', query: { redirect: to.fullPath } })
  }

  // Authenticated users on auth/legacy-invite routes → redirect home
  // BUT tutor invites must pass through (student needs to see & accept)
  if (isAuthRoute || (isInviteRoute && isAuthenticated && !isTutorInvite)) {
    if (to.path !== homeRoute) {
      return next(homeRoute)
    }
    return next()
  }

  // P0-6 ВИДАЛЕНО (2026-06-13): onboarding-візард замінено на Activation Engine
  // (apps.activation / modules/activation, монтується в TutorHome). Старий eager
  // onboardingStore.loadProgress() стріляв GET /api/onboarding/progress/ на КОЖНІЙ
  // навігації → 404 (FE кликав легасі-шлях без /v1; роут живе лише під
  // /api/v1/onboarding/*). Редірект і так був no-op (shouldShowOnboarding завжди
  // false через catch у getProgress). Прибрано, щоб заглушити 404; onboarding
  // лишається похованим. НЕ відновлювати — використовувати Activation Engine.

  // Redirect from root path based on auth status
  if (to.path === '/') {
    if (isAuthenticated && user?.role) {
      return next(getDefaultRouteForRole(user.role))
    } else {
      return next('/start')
    }
  }

  if (requiresAuth && !isAuthenticated) {
    return next({ path: '/auth/login', query: { redirect: to.fullPath } })
  }

  // v0.88.4: Staff guard - check if route requires staff access (role-based SSOT)
  const requiresStaff = to.matched.some((record) => record.meta?.requiresStaff)
  if (requiresStaff) {
    const staffRoles = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF]
    const isStaff = staffRoles.includes(user?.role)
    if (!isStaff) {
      return next(homeRoute)
    }
  }

  // USERS domain: Admin/Operator guard
  const needsAdminOrOperator = to.matched.some((record) => record.meta?.requiresAdminOrOperator)
  if (needsAdminOrOperator) {
    const allowedRoles = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, 'OPERATOR']
    const hasAdminAccess = allowedRoles.includes(user?.role)
    if (!hasAdminAccess) {
      return next(homeRoute)
    }
  }

  if (!hasRoleAccess) {
    if (to.path !== homeRoute) {
      return next(homeRoute)
    }
    return next(false)
  }

  const isProfileRoute = to.path.startsWith('/dashboard/profile')
  if (isProfileRoute && auth.isAuthenticated && !profileStore.initialized) {
    try {
      await profileStore.loadProfile()
    } catch (error) {
      console.error('Failed to bootstrap profile', error)
    }
  }

  next()
})

// Update route context for diagnostics
router.afterEach((to) => {
  setCurrentRoute({
    name: to.name,
    path: to.path,
    params: to.params,
    query: to.query
  })
})

// Handle stale chunk errors after deploy.
// When Vite produces new hashes, old chunks return 404.
// We do a single hard reload to pick up fresh assets.
// sessionStorage flag prevents infinite reload loop.
router.onError((error) => {
  const isChunkError =
    error?.message?.includes('Failed to fetch dynamically imported module') ||
    error?.message?.includes('Importing a module script failed') ||
    error?.name === 'ChunkLoadError'

  if (!isChunkError) return

  const RELOAD_KEY = 'chunk_reload_attempted'
  const alreadyAttempted = sessionStorage.getItem(RELOAD_KEY)

  if (alreadyAttempted) {
    sessionStorage.removeItem(RELOAD_KEY)
    console.error('[router] Chunk reload failed twice — giving up to avoid loop', error)
    // 2026-07-26: раніше на цьому й закінчувалось — мовчазний console.error, а юзер
    // лишався на застряглій сторінці без жодного пояснення (owner зловив це після
    // УСПІШНОЇ реєстрації: акаунт створено, а показати /tutor не вдалось).
    // AppErrorBoundary не бачить цей збій сам (`onErrorCaptured` спрацьовує лише для
    // ВЖЕ змонтованих компонентів, а тут chunk не завантажився ДО монтування), тому
    // кажемо йому явно показати готову сторінку «Онови».
    reportFatalError('stale-version')
    return
  }

  sessionStorage.setItem(RELOAD_KEY, '1')
  console.warn('[router] Stale chunk detected after deploy — reloading to fetch fresh assets')
  window.location.reload()
})

export default router
