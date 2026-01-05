import { createRouter, createWebHistory } from 'vue-router'
import AuthLayout from '../modules/auth/components/AuthLayout.vue'
import PageShell from '../ui/PageShell.vue'

import LoginView from '../modules/auth/views/LoginView.vue'
import RegisterView from '../modules/auth/views/RegisterView.vue'
import CheckEmailView from '../modules/auth/views/CheckEmailView.vue'
import VerifyEmailView from '../modules/auth/views/VerifyEmailView.vue'
import ForgotPasswordView from '../modules/auth/views/ForgotPasswordView.vue'
import ResetPasswordView from '../modules/auth/views/ResetPasswordView.vue'
import InviteValidationView from '../modules/auth/views/InviteValidationView.vue'
import InviteAcceptView from '../modules/auth/views/InviteAcceptView.vue'

import DashboardTutor from '../modules/dashboard/views/DashboardTutor.vue'
import DashboardStudent from '../modules/dashboard/views/DashboardStudent.vue'
import ClassroomList from '../modules/classrooms/views/ClassroomList.vue'
import ClassroomView from '../modules/classrooms/views/ClassroomView.vue'
import ClassroomListView from '../modules/classrooms/views/ClassroomListView.vue'
import ClassroomDetailView from '../modules/classrooms/views/ClassroomDetailView.vue'
import DashboardClassroomsView from '../modules/classrooms/views/DashboardClassroomsView.vue'
import LessonList from '../modules/lessons/views/LessonList.vue'
import LessonView from '../modules/lessons/views/LessonView.vue'
import ProfileOverviewView from '../modules/profile/views/ProfileOverviewView.vue'
import LessonInviteResolveView from '../modules/lessons/views/LessonInviteResolveView.vue'
const MarketplaceListView = () => import('../modules/marketplace/views/TutorCatalogView.vue')
const MarketplaceTutorView = () => import('../modules/marketplace/views/TutorProfileView.vue')
const MarketplaceMyProfileView = () => import('../modules/marketplace/views/MyProfileView.vue')
const MarketplaceSearchResultsView = () => import('../modules/marketplace/views/SearchResultsView.vue')
const MarketplaceCategoryView = () => import('../modules/marketplace/views/CategoryView.vue')
const BookingRequestsView = () => import('../modules/booking/views/BookingRequestsView.vue')
const TutorAvailabilityView = () => import('../modules/booking/views/TutorAvailabilityView.vue')
const ProfileEditView = () => import('../modules/profile/views/ProfileEditView.vue')
const ProfileSettingsView = () => import('../modules/profile/views/ProfileSettingsView.vue')
const ProfileActivityView = () => import('../modules/profile/views/ProfileActivityView.vue')
const UserAccountView = () => import('../modules/profile/views/UserAccountView.vue')
const SettingsSecurityView = () => import('../modules/profile/views/SettingsSecurityView.vue')
const ChangeEmailView = () => import('../modules/profile/views/ChangeEmailView.vue')
const ChangePasswordView = () => import('../modules/profile/views/ChangePasswordView.vue')
const DevThemePlaygroundView = () => import('../modules/dev/views/DevThemePlayground.vue')

// Onboarding views
const OnboardingView = () => import('../modules/onboarding/views/OnboardingView.vue')
const StudentOnboardingView = () => import('../modules/onboarding/views/StudentOnboardingView.vue')
const TutorOnboardingView = () => import('../modules/onboarding/views/TutorOnboardingView.vue')
const ChecklistView = () => import('../modules/onboarding/views/ChecklistView.vue')

import { useAuthStore } from '../modules/auth/store/authStore'
import { useProfileStore } from '../modules/profile/store/profileStore'
import { USER_ROLES } from '../types/user'
import { getDefaultRouteForRole, hasAccess } from '../config/routes'
import { classroomGuard } from './guards/classroomGuard'
import { setCurrentRoute } from '@/modules/diagnostics/plugins/errorCollector'

// Classroom views (v0.24.2)
const LessonRoom = () => import('../modules/classroom/views/LessonRoom.vue')
const SoloRoom = () => import('../modules/classroom/views/SoloRoom.vue')

// Solo Workspace (v0.26, v0.27)
const SoloWorkspace = () => import('../modules/solo/views/SoloWorkspace.vue')
const SoloSessionList = () => import('../modules/solo/views/SoloSessionList.vue')
const SoloPublicView = () => import('../modules/solo/views/SoloPublicView.vue')

// Classroom views (v0.24.3)
const LessonSummary = () => import('../modules/classroom/summary/LessonSummary.vue')
const LessonReplay = () => import('../modules/classroom/views/LessonReplay.vue')
const LessonHistory = () => import('../modules/classroom/views/LessonHistory.vue')

const routes = [
  {
    path: '/auth',
    component: AuthLayout,
    children: [
      { path: 'login', name: 'login', component: LoginView },
      { path: 'register', name: 'register', component: RegisterView },
      { path: 'check-email', name: 'auth-check-email', component: CheckEmailView },
      { path: 'verify-email', name: 'auth-verify-email', component: VerifyEmailView },
      { path: 'forgot-password', name: 'auth-forgot-password', component: ForgotPasswordView },
      { path: 'reset-password', name: 'auth-reset-password', component: ResetPasswordView },
    ],
  },
  {
    path: '/invite',
    component: AuthLayout,
    children: [
      { path: 'validation/:token', name: 'invite-validation', component: InviteValidationView },
      { path: 'accept/:token', name: 'invite-accept', component: InviteAcceptView },
    ],
  },
  {
    path: '/lesson-invites/:token',
    name: 'lesson-invite-resolve',
    component: LessonInviteResolveView,
    meta: { requiresAuth: true },
  },
  {
    path: '/',
    component: PageShell,
    meta: { requiresAuth: true },
    children: [
      {
        path: 'tutor',
        name: 'tutor-dashboard',
        component: DashboardTutor,
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
        component: DashboardStudent,
        meta: { roles: [USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/account',
        name: 'user-account',
        component: UserAccountView,
      },
      {
        path: 'dashboard/account/change-email',
        name: 'change-email',
        component: ChangeEmailView,
      },
      {
        path: 'dashboard/account/change-password',
        name: 'change-password',
        component: ChangePasswordView,
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
        name: 'lessons',
        component: LessonList,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'lessons/:id',
        name: 'lesson',
        component: LessonView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/profile',
        name: 'profile-overview',
        component: ProfileOverviewView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/profile/edit',
        name: 'profile-edit',
        component: ProfileEditView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/profile/settings',
        name: 'profile-settings',
        component: ProfileSettingsView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/profile/security',
        name: 'profile-security',
        component: SettingsSecurityView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/profile/activity',
        name: 'profile-activity',
        component: ProfileActivityView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'marketplace',
        name: 'marketplace-list',
        component: MarketplaceListView,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
      },
      {
        path: 'marketplace/tutors/:slug',
        name: 'marketplace-tutor',
        component: MarketplaceTutorView,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
      },
      {
        path: 'marketplace/search',
        name: 'marketplace-search',
        component: MarketplaceSearchResultsView,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
      },
      {
        path: 'marketplace/categories/:slug',
        name: 'marketplace-category',
        component: MarketplaceCategoryView,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
      },
      {
        path: 'marketplace/my-profile',
        name: 'marketplace-my-profile',
        component: MarketplaceMyProfileView,
        meta: {
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN],
        },
        beforeEnter: (to, from, next) => {
          const auth = useAuthStore()
          if (auth.user?.role !== USER_ROLES.TUTOR) {
            return next('/marketplace')
          }
          return next()
        },
      },
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
      // Onboarding routes
      {
        path: 'onboarding',
        name: 'onboarding',
        component: OnboardingView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'onboarding/student',
        name: 'onboarding-student',
        component: StudentOnboardingView,
        meta: { roles: [USER_ROLES.STUDENT] },
      },
      {
        path: 'onboarding/tutor',
        name: 'onboarding-tutor',
        component: TutorOnboardingView,
        meta: { roles: [USER_ROLES.TUTOR] },
      },
      {
        path: 'checklist',
        name: 'checklist',
        component: ChecklistView,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // v0.25-FIX: Booking routes
      {
        path: 'bookings',
        name: 'bookings',
        component: () => import('../modules/booking/views/MyLessonsView.vue'),
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'bookings/:id',
        name: 'booking-detail',
        component: () => import('../modules/booking/views/BookingDetailView.vue'),
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'booking/tutor',
        name: 'tutor-calendar',
        component: () => import('../modules/booking/views/TutorCalendarView.vue'),
        meta: { roles: [USER_ROLES.TUTOR] },
      },
      {
        path: 'booking/availability',
        name: 'booking-availability',
        component: TutorAvailabilityView,
        meta: { roles: [USER_ROLES.TUTOR] },
      },
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
      // v0.42: Matches routes
      {
        path: 'matches',
        name: 'matches',
        component: () => import('../modules/matches/views/MatchListView.vue'),
        meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'matches/:id',
        name: 'match-detail',
        component: () => import('../modules/matches/views/MatchDetailView.vue'),
        meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // v0.24.2: Classroom routes
      {
        path: 'classroom/:sessionId',
        name: 'lesson-room',
        component: LessonRoom,
        beforeEnter: classroomGuard,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'classroom/solo',
        name: 'solo-room',
        component: SoloRoom,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      // v0.26-v0.27: Solo Workspace
      {
        path: 'solo',
        name: 'solo-sessions',
        component: SoloSessionList,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
      },
      {
        path: 'solo/new',
        name: 'solo-workspace',
        component: SoloWorkspace,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
      },
      {
        path: 'solo/:id',
        name: 'solo-workspace-edit',
        component: SoloWorkspace,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
      },
      {
        path: 'solo/shared/:token',
        name: 'solo-public',
        component: SoloPublicView,
        meta: { public: true },
      },
      // v0.24.3: Classroom history routes
      {
        path: 'classroom/:sessionId/summary',
        name: 'lesson-summary',
        component: LessonSummary,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'classroom/:sessionId/replay',
        name: 'lesson-replay',
        component: LessonReplay,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'classroom/:sessionId/history',
        name: 'lesson-history',
        component: LessonHistory,
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/auth/login' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, from, next) => {
  const auth = useAuthStore()
  const profileStore = useProfileStore()

  if (!auth.isBootstrapped) {
    await auth.bootstrap()
  }

  const isAuthenticated = auth.isAuthenticated
  const user = auth.user
  const homeRoute = user?.role ? getDefaultRouteForRole(user.role) : '/auth/login'
  const isAuthRoute = to.path.startsWith('/auth')
  const isInviteRoute = to.path.startsWith('/invite')
  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth)
  const hasRoleAccess = hasAccess(user, to)

  if (!isAuthenticated) {
    if (isAuthRoute || isInviteRoute) {
      return next()
    }
    return next({ path: '/auth/login', query: { redirect: to.fullPath } })
  }

  if (isAuthRoute || (isInviteRoute && isAuthenticated)) {
    if (to.path !== homeRoute) {
      return next(homeRoute)
    }
    return next()
  }

  if (requiresAuth && !isAuthenticated) {
    return next({ path: '/auth/login', query: { redirect: to.fullPath } })
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

export default router
