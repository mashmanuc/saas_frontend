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
const ProfileActivityView = () => import('../modules/profile/views/ProfileActivityView.vue')
// TEMPORARILY DISABLED - using marketplace/my-profile instead
// const TutorProfileOverviewView = () => import('../modules/profile/views/TutorProfileOverviewView_NEW.vue')
// const TutorProfileEditView = () => import('../modules/profile/views/TutorProfileEditView_NEW.vue')
// const StudentProfileEditView = () => import('../modules/profile/views/StudentProfileEditView_NEW.vue')
const UserAccountView = () => import('../modules/profile/views/UserAccountView.vue')
const SettingsSecurityView = () => import('../modules/profile/views/SettingsSecurityView.vue')
const ChangeEmailView = () => import('../modules/profile/views/ChangeEmailView.vue')
const ChangePasswordView = () => import('../modules/profile/views/ChangePasswordView.vue')
const AccountBillingView = () => import('../modules/billing/views/AccountBillingView.vue')
const DevThemePlaygroundView = () => import('../modules/dev/views/DevThemePlayground.vue')

// UI Contract V2 views (feature-flagged)
const ProfileEditViewV2 = () => import('../modules/profileV2/views/ProfileEditView.vue')
const ProfileOverviewViewV2 = () => import('../modules/profileV2/views/ProfileOverviewView.vue')
const UserAccountViewV2 = () => import('../modules/profileV2/views/UserAccountView.vue')

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
import { requiresAdminOrOperator } from './guards/adminGuard'
import { setCurrentRoute } from '@/modules/diagnostics/plugins/errorCollector'

// P0.3: Lighthouse route без auth для стабільного audit
const LighthouseCalendarView = () => import('../views/__lighthouse__/LighthouseCalendarView.vue')

// Classroom views (v0.24.2)
const LessonRoom = () => import('../modules/classroom/views/LessonRoom.vue')
const SoloRoom = () => import('../modules/classroom/views/SoloRoom.vue')

// Solo Workspace (v0.26, v0.27)
const SoloWorkspace = () => import('../modules/solo/views/SoloWorkspace.vue')
const SoloWorkspaceV2 = () => import('../modules/solo/views/SoloWorkspaceV2.vue')
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
    meta: { requiresAuth: false },
    children: [
      { path: 'login', name: 'login', component: LoginView, meta: { requiresAuth: false } },
      { path: 'register', name: 'register', component: RegisterView, meta: { requiresAuth: false } },
      { path: 'check-email', name: 'auth-check-email', component: CheckEmailView, meta: { requiresAuth: false } },
      { path: 'verify-email', name: 'auth-verify-email', component: VerifyEmailView, meta: { requiresAuth: false } },
      { path: 'forgot-password', name: 'auth-forgot-password', component: ForgotPasswordView, meta: { requiresAuth: false } },
      { path: 'reset-password', name: 'auth-reset-password', component: ResetPasswordView, meta: { requiresAuth: false } },
    ],
  },
  {
    path: '/invite',
    component: AuthLayout,
    meta: { requiresAuth: false },
    children: [
      { path: 'validation/:token', name: 'invite-validation', component: InviteValidationView, meta: { requiresAuth: false } },
      { path: 'accept/:token', name: 'invite-accept', component: InviteAcceptView, meta: { requiresAuth: false } },
    ],
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
    path: '/contacts',
    name: 'contacts',
    component: () => import('../views/ContactsView.vue'),
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
        path: 'notifications',
        name: 'notifications',
        component: () => import('../views/NotificationsView.vue'),
        meta: { roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'dashboard/account',
        name: 'user-account',
        component: UserAccountView,
      },
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
        redirect: '/calendar',
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
      // Tutor Profile routes - REDIRECTED TO MARKETPLACE
      {
        path: 'tutor/profile',
        redirect: '/marketplace/my-profile',
      },
      {
        path: 'tutor/profile/edit',
        redirect: '/marketplace/my-profile',
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
        beforeEnter: async (to, from, next) => {
          const auth = useAuthStore()

          if (!auth.isBootstrapped) {
            await auth.bootstrap()
          }

          if (!auth.user && auth.access) {
            try {
              await auth.reloadUser()
            } catch (error) {
              console.warn('[router] Failed to load user for marketplace/my-profile', error)
            }
          }

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
      // Phase 1 v0.86: Inquiry routes
      {
        path: 'student/inquiries',
        name: 'student-inquiries',
        component: () => import('../modules/inquiries/views/StudentInquiriesView.vue'),
        meta: { roles: [USER_ROLES.STUDENT] },
      },
      {
        path: 'tutor/inquiries',
        name: 'tutor-inquiries',
        component: () => import('../modules/inquiries/views/TutorInquiriesView.vue'),
        meta: { roles: [USER_ROLES.TUTOR] },
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
        path: 'calendar',
        name: 'calendar',
        component: () => import('../modules/booking/views/StudentCalendarView.vue'),
        meta: { roles: [USER_ROLES.STUDENT] },
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
      // v0.70: Chat routes (Smart Polling)
      {
        path: 'chat',
        name: 'chat-list',
        component: () => import('../modules/negotiation/views/ChatListView.vue'),
        meta: { roles: [USER_ROLES.TUTOR, USER_ROLES.STUDENT] },
      },
      {
        path: 'chat/:threadId',
        name: 'chat-thread',
        component: () => import('../modules/negotiation/views/ChatView.vue'),
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
      // Solo V2 (NEW) - parallel to old version
      {
        path: 'solo-v2/new',
        name: 'solo-workspace-v2',
        component: SoloWorkspaceV2,
        meta: { roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR] },
      },
      {
        path: 'solo-v2/:id',
        name: 'solo-workspace-v2-edit',
        component: SoloWorkspaceV2,
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
      // v0.69: People & Negotiation Chat routes
      {
        path: 'beta/people',
        name: 'people-inquiries-student',
        component: () => import('../modules/people/views/StudentInquiriesView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT]
        },
      },
      {
        path: 'beta/people/inbox',
        name: 'people-inquiries-tutor',
        component: () => import('../modules/people/views/TutorInquiriesInbox.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.TUTOR]
        },
      },
      {
        path: 'chat/thread/:threadId',
        name: 'chat-thread',
        component: () => import('../modules/people/views/ChatThreadView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR]
        },
      },
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
        path: 'billing',
        name: 'billing',
        component: () => import('../modules/billing/views/BillingView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR]
        },
      },
      {
        path: 'billing/plans',
        name: 'billing-plans',
        component: () => import('../modules/payments/views/PlansView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR]
        },
      },
      {
        path: 'billing/success',
        name: 'billing-success',
        component: () => import('../modules/billing/views/BillingSuccessView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
        },
      },
      {
        path: 'billing/cancel',
        name: 'billing-cancel',
        component: () => import('../modules/billing/views/BillingCancelView.vue'),
        meta: { 
          requiresAuth: true,
          roles: [USER_ROLES.STUDENT, USER_ROLES.TUTOR, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]
        },
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
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'reports',
            name: 'staff-reports',
            component: () => import('../modules/staff/views/StaffReportsView.vue'),
            meta: { 
              requiresAuth: true,
              roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN],
              requiresStaff: true
            },
          },
          {
            path: 'users/:id',
            name: 'staff-user-overview',
            component: () => import('../modules/staff/views/StaffUserOverviewView.vue'),
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
        ],
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

  const hasAccessToken = Boolean(auth.access)
  let isAuthenticated = auth.isAuthenticated
  const user = auth.user
  // v0.88.4: Staff users have /staff as home
  const homeRoute = user?.is_staff ? '/staff' : (user?.role ? getDefaultRouteForRole(user.role) : '/auth/login')
  const isAuthRoute = to.path.startsWith('/auth')
  const isInviteRoute = to.path.startsWith('/invite')
  const requiresAuth = to.matched.some((record) => record.meta?.requiresAuth !== false && record.meta?.requiresAuth !== undefined ? record.meta.requiresAuth : true)
  const isPublicRoute = to.matched.some((record) => record.meta?.requiresAuth === false)
  const hasRoleAccess = hasAccess(user, to)

  // Public routes (requiresAuth: false) - завжди пропускаємо
  if (isPublicRoute) {
    return next()
  }

  if (!isAuthenticated && hasAccessToken) {
    try {
      await auth.reloadUser()
      isAuthenticated = auth.isAuthenticated
    } catch (error) {
      console.warn('[router] Failed to restore user session', error)
    }
  }

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

  // v0.88.4: Redirect staff users from root to /staff
  if (to.path === '/' && user?.is_staff) {
    return next('/staff')
  }

  if (requiresAuth && !isAuthenticated) {
    return next({ path: '/auth/login', query: { redirect: to.fullPath } })
  }

  // v0.88.4: Staff guard - check if route requires staff access
  const requiresStaff = to.matched.some((record) => record.meta?.requiresStaff)
  if (requiresStaff) {
    // Use is_staff flag from backend (v0.88.4) or fallback to role check
    const isStaff = user?.is_staff || user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPERADMIN
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

export default router
