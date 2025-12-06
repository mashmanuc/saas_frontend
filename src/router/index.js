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

import { useAuthStore } from '../modules/auth/store/authStore'
import { USER_ROLES } from '../types/user'
import { getDefaultRouteForRole, hasAccess } from '../config/routes'

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

  next()
})

export default router
