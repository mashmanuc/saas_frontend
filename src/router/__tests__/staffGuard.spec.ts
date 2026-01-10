/**
 * Staff Route Guard Tests v0.67.0
 * 
 * Tests for staff route access control
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { USER_ROLES } from '@/types/user'

describe('Staff Route Guard', () => {
  let router: any
  let authStore: any

  beforeEach(async () => {
    setActivePinia(createPinia())
    
    // Create minimal router with staff routes and guard logic
    router = createRouter({
      history: createWebHistory(),
      routes: [
        {
          path: '/',
          name: 'home',
          component: { template: '<div>Home</div>' }
        },
        {
          path: '/staff',
          name: 'staff',
          component: { template: '<div>Staff</div>' },
          meta: { requiresAuth: true, requiresStaff: true, roles: [USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN] }
        },
        {
          path: '/tutor',
          name: 'tutor-dashboard',
          component: { template: '<div>Tutor</div>' },
          meta: { requiresAuth: true, roles: [USER_ROLES.TUTOR] }
        },
        {
          path: '/student',
          name: 'student-dashboard',
          component: { template: '<div>Student</div>' },
          meta: { requiresAuth: true, roles: [USER_ROLES.STUDENT] }
        }
      ]
    })

    // Add guard logic
    router.beforeEach((to: any, from: any, next: any) => {
      const auth = useAuthStore()
      const user = auth.user
      const requiresStaff = to.matched.some((record: any) => record.meta?.requiresStaff)
      
      if (requiresStaff) {
        const isStaff = user?.role === USER_ROLES.ADMIN || user?.role === USER_ROLES.SUPERADMIN
        if (!isStaff) {
          const homeRoute = user?.role === USER_ROLES.TUTOR ? '/tutor' : user?.role === USER_ROLES.STUDENT ? '/student' : '/'
          return next(homeRoute)
        }
      }
      
      next()
    })

    authStore = useAuthStore()
    authStore.initialized = true
  })

  it('allows ADMIN to access staff routes', async () => {
    authStore.access = 'mock-token'
    authStore.user = {
      id: 1,
      email: 'admin@example.com',
      role: USER_ROLES.ADMIN
    }

    await router.push('/staff')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/staff')
  })

  it('allows SUPERADMIN to access staff routes', async () => {
    authStore.access = 'mock-token'
    authStore.user = {
      id: 1,
      email: 'superadmin@example.com',
      role: USER_ROLES.SUPERADMIN
    }

    await router.push('/staff')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/staff')
  })

  it('blocks TUTOR from accessing staff routes', async () => {
    authStore.access = 'mock-token'
    authStore.user = {
      id: 1,
      email: 'tutor@example.com',
      role: USER_ROLES.TUTOR
    }

    await router.push('/staff')
    await router.isReady()

    // Should redirect to tutor dashboard
    expect(router.currentRoute.value.path).not.toBe('/staff')
  })

  it('blocks STUDENT from accessing staff routes', async () => {
    authStore.access = 'mock-token'
    authStore.user = {
      id: 1,
      email: 'student@example.com',
      role: USER_ROLES.STUDENT
    }

    await router.push('/staff')
    await router.isReady()

    // Should redirect away from staff
    expect(router.currentRoute.value.path).not.toBe('/staff')
  })

  it('blocks unauthenticated users from accessing staff routes', async () => {
    authStore.access = null
    authStore.user = null

    await router.push('/staff')
    await router.isReady()

    // Should redirect to login or home
    expect(router.currentRoute.value.path).not.toBe('/staff')
  })
})
