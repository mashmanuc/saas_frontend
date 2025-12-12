import { createRouter, createWebHistory } from 'vue-router'
import AuthLayout from '../modules/auth/components/AuthLayout.vue'
import PageShell from '../ui/PageShell.vue'

import LoginView from '../modules/auth/views/LoginView.vue'
import RegisterView from '../modules/auth/views/RegisterView.vue'
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
const MarketplaceListView = () => import('../modules/marketplace/views/MarketplaceListView.vue')
const MarketplaceTutorView = () => import('../modules/marketplace/views/MarketplaceTutorView.vue')
const ProfileEditView = () => import('../modules/profile/views/ProfileEditView.vue')
const ProfileSettingsView = () => import('../modules/profile/views/ProfileSettingsView.vue')
const ProfileActivityView = () => import('../modules/profile/views/ProfileActivityView.vue')
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
        path: 'marketplace/tutors/:id',
        name: 'marketplace-tutor',
        component: MarketplaceTutorView,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] },
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
        path: 'book/:slug',
        name: 'book-lesson',
        component: () => import('../modules/booking/views/BookLessonView.vue'),
        meta: { roles: [USER_ROLES.STUDENT] },
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
