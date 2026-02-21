/**
 * Test real Vue Router navigation to /staff with actual route config
 * to reproduce the infinite loop
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { USER_ROLES } from '@/types/user'
import { getDefaultRouteForRole, hasAccess } from '@/config/routes'

// Minimal stub components
const Stub = { template: '<div><router-view /></div>' }

describe('Real router navigation to /staff', () => {
  let router: any
  let authStore: any
  let guardCallCount: number

  beforeEach(async () => {
    setActivePinia(createPinia())
    guardCallCount = 0

    // Recreate the REAL route structure from router/index.js
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/start',
          name: 'role-selection',
          component: Stub,
          meta: { requiresAuth: false },
        },
        {
          path: '/auth',
          component: Stub,
          meta: { requiresAuth: false },
          children: [
            { path: 'login', name: 'login', component: Stub, meta: { requiresAuth: false } },
          ],
        },
        {
          path: '/',
          component: Stub, // PageShell
          meta: { requiresAuth: true },
          children: [
            {
              path: 'tutor',
              name: 'tutor-dashboard',
              component: Stub,
              meta: { roles: [USER_ROLES.TUTOR] },
            },
            {
              path: 'student',
              name: 'student-dashboard',
              component: Stub,
              meta: { roles: [USER_ROLES.STUDENT] },
            },
            {
              path: 'staff',
              component: Stub, // StaffLayout
              meta: { requiresAuth: true, requiresStaff: true },
              children: [
                {
                  path: '',
                  name: 'staff-dashboard',
                  component: Stub,
                  meta: {
                    requiresAuth: true,
                    roles: [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF],
                    requiresStaff: true,
                  },
                },
              ],
            },
          ],
        },
        { path: '/:pathMatch(.*)*', redirect: '/start' },
      ],
    })

    // Add the REAL guard logic (copy from router/index.js)
    router.beforeEach(async (to: any, from: any, next: any) => {
      guardCallCount++
      const n = guardCallCount
      console.log(`[guard #${n}] ${from.path} → ${to.path} (matched: ${to.matched.length})`)

      if (guardCallCount > 20) {
        console.error(`[guard] LOOP DETECTED at call #${n}`)
        return next(false)
      }

      const auth = useAuthStore()

      const hasAccessToken = Boolean(auth.access)
      let isAuthenticated = Boolean(auth.access && auth.user)
      const user = auth.user
      const homeRoute = user?.role ? getDefaultRouteForRole(user.role) : '/start'
      const isAuthRoute = to.path.startsWith('/auth')
      const isInviteRoute = to.path.startsWith('/invite')
      const isStartRoute = to.path === '/start'
      const requiresAuth = to.matched.some((record: any) =>
        record.meta?.requiresAuth !== false && record.meta?.requiresAuth !== undefined
          ? record.meta.requiresAuth
          : true
      )
      const isPublicRoute = to.matched.some((record: any) => record.meta?.requiresAuth === false)
      const hasRoleAccess = hasAccess(user, to)

      console.log(`[guard #${n}] auth=${isAuthenticated} role=${user?.role} home=${homeRoute} isAuth=${isAuthRoute} isPub=${isPublicRoute} hasRole=${hasRoleAccess} reqAuth=${requiresAuth}`)

      if (isPublicRoute) {
        console.log(`[guard #${n}] → PASS (public)`)
        return next()
      }

      if (!isAuthenticated) {
        if (isAuthRoute || isInviteRoute || isStartRoute) {
          console.log(`[guard #${n}] → PASS (unauth + special)`)
          return next()
        }
        console.log(`[guard #${n}] → REDIRECT /start`)
        return next({ path: '/start', query: { redirect: to.fullPath } })
      }

      if (isAuthRoute || (isInviteRoute && isAuthenticated)) {
        if (to.path !== homeRoute) {
          console.log(`[guard #${n}] → REDIRECT ${homeRoute} (auth on authRoute)`)
          return next(homeRoute)
        }
        console.log(`[guard #${n}] → PASS (authRoute=homeRoute)`)
        return next()
      }

      if (to.path === '/') {
        if (isAuthenticated && user?.role) {
          console.log(`[guard #${n}] → REDIRECT ${getDefaultRouteForRole(user.role)} (root)`)
          return next(getDefaultRouteForRole(user.role))
        }
        return next('/start')
      }

      if (requiresAuth && !isAuthenticated) {
        console.log(`[guard #${n}] → REDIRECT /auth/login`)
        return next({ path: '/auth/login', query: { redirect: to.fullPath } })
      }

      const requiresStaff = to.matched.some((record: any) => record.meta?.requiresStaff)
      if (requiresStaff) {
        const staffRoles = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF]
        const isStaff = staffRoles.includes(user?.role)
        if (!isStaff) {
          console.log(`[guard #${n}] → REDIRECT ${homeRoute} (not staff)`)
          return next(homeRoute)
        }
      }

      if (!hasRoleAccess) {
        if (to.path !== homeRoute) {
          console.log(`[guard #${n}] → REDIRECT ${homeRoute} (no role)`)
          return next(homeRoute)
        }
        console.log(`[guard #${n}] → BLOCK (no role, at home)`)
        return next(false)
      }

      console.log(`[guard #${n}] → PASS (final)`)
      next()
    })

    authStore = useAuthStore()
  })

  it('unauthenticated user visiting /staff → redirects to /start', async () => {
    authStore.access = null
    authStore.user = null

    await router.push('/staff')
    await router.isReady()

    console.log('Final path:', router.currentRoute.value.path)
    console.log('Guard calls:', guardCallCount)
    expect(router.currentRoute.value.path).toBe('/start')
    expect(guardCallCount).toBeLessThan(10)
  })

  it('authenticated superadmin visiting /auth/login → stays (public route, LoginView handles redirect)', async () => {
    authStore.access = 'mock-token'
    authStore.user = { id: 10, email: 'superadmin@m4sh.org', role: USER_ROLES.SUPERADMIN }

    // Auth routes are public — guard lets them through
    // LoginView.onSubmit() handles redirect via router.push(getDefaultRouteForRole(role))
    await router.push('/auth/login')
    await router.isReady()

    console.log('Final path:', router.currentRoute.value.path)
    console.log('Guard calls:', guardCallCount)
    expect(router.currentRoute.value.path).toBe('/auth/login')
    expect(guardCallCount).toBeLessThan(10)
  })

  it('authenticated superadmin directly visiting /staff → lands on /staff', async () => {
    authStore.access = 'mock-token'
    authStore.user = { id: 10, email: 'superadmin@m4sh.org', role: USER_ROLES.SUPERADMIN }

    await router.push('/staff')
    await router.isReady()

    console.log('Final path:', router.currentRoute.value.path)
    console.log('Guard calls:', guardCallCount)
    expect(router.currentRoute.value.path).toBe('/staff')
    expect(guardCallCount).toBeLessThan(10)
  })

  it('authenticated superadmin visiting / → redirects to /staff', async () => {
    authStore.access = 'mock-token'
    authStore.user = { id: 10, email: 'superadmin@m4sh.org', role: USER_ROLES.SUPERADMIN }

    await router.push('/')
    await router.isReady()

    console.log('Final path:', router.currentRoute.value.path)
    console.log('Guard calls:', guardCallCount)
    expect(router.currentRoute.value.path).toBe('/staff')
    expect(guardCallCount).toBeLessThan(10)
  })
})
