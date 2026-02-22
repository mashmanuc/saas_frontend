/**
 * Test to reproduce the infinite redirect loop on /staff
 * Uses a simplified version of the real guard logic
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { USER_ROLES } from '@/types/user'
import { getDefaultRouteForRole, hasAccess } from '@/config/routes'

describe('Guard loop analysis', () => {
  // Simulate the guard logic step by step
  function simulateGuard(opts: {
    toPath: string
    fromPath: string
    isAuthenticated: boolean
    user: any
    matchedMeta: Array<Record<string, any>>
  }) {
    const { toPath, fromPath, isAuthenticated, user, matchedMeta } = opts
    const homeRoute = user?.role ? getDefaultRouteForRole(user.role) : '/start'
    const isAuthRoute = toPath.startsWith('/auth')
    const isInviteRoute = toPath.startsWith('/invite')
    const isStartRoute = toPath === '/start'
    
    const requiresAuth = matchedMeta.some((meta) =>
      meta?.requiresAuth !== false && meta?.requiresAuth !== undefined
        ? meta.requiresAuth
        : true
    )
    const isPublicRoute = matchedMeta.some((meta) => meta?.requiresAuth === false)
    
    // Simulate hasAccess with the last matched meta
    const lastMeta = matchedMeta[matchedMeta.length - 1] || {}
    const allowedRoles = lastMeta?.roles
    let hasRoleAccess = true
    if (allowedRoles && allowedRoles.length) {
      hasRoleAccess = user?.role ? allowedRoles.includes(user.role) : false
    }

    const requiresStaff = matchedMeta.some((meta) => meta?.requiresStaff)
    const staffRoles = [USER_ROLES.SUPERADMIN, USER_ROLES.ADMIN, USER_ROLES.STAFF]
    
    // Step through guard logic
    if (isPublicRoute) return { action: 'PASS', reason: 'public' }
    
    if (!isAuthenticated) {
      if (isAuthRoute || isInviteRoute || isStartRoute) {
        return { action: 'PASS', reason: 'unauth + auth/invite/start' }
      }
      return { action: 'REDIRECT', target: '/start', reason: 'unauth' }
    }
    
    if (isAuthRoute || (isInviteRoute && isAuthenticated)) {
      if (toPath !== homeRoute) {
        return { action: 'REDIRECT', target: homeRoute, reason: 'auth on authRoute' }
      }
      return { action: 'PASS', reason: 'authRoute=homeRoute' }
    }
    
    if (toPath === '/') {
      if (isAuthenticated && user?.role) {
        return { action: 'REDIRECT', target: getDefaultRouteForRole(user.role), reason: 'root redirect' }
      }
      return { action: 'REDIRECT', target: '/start', reason: 'root no role' }
    }
    
    if (requiresAuth && !isAuthenticated) {
      return { action: 'REDIRECT', target: '/auth/login', reason: 'requiresAuth' }
    }
    
    if (requiresStaff) {
      const isStaff = staffRoles.includes(user?.role)
      if (!isStaff) {
        return { action: 'REDIRECT', target: homeRoute, reason: 'not staff' }
      }
    }
    
    if (!hasRoleAccess) {
      if (toPath !== homeRoute) {
        return { action: 'REDIRECT', target: homeRoute, reason: 'no role access' }
      }
      return { action: 'BLOCK', reason: 'no role access, already home' }
    }
    
    return { action: 'PASS', reason: 'final' }
  }

  const staffMatchedMeta = [
    { requiresAuth: true },  // parent: /
    { requiresAuth: true, requiresStaff: true },  // staff layout
    { requiresAuth: true, roles: ['superadmin', 'admin', 'staff'], requiresStaff: true },  // staff-dashboard
  ]

  const superadmin = { role: 'superadmin', id: 10, email: 'superadmin@m4sh.org' }

  it('superadmin on /auth/login → should redirect to /staff', () => {
    const result = simulateGuard({
      toPath: '/auth/login',
      fromPath: '/',
      isAuthenticated: true,
      user: superadmin,
      matchedMeta: [{ requiresAuth: false }],  // auth routes are public
    })
    console.log('auth/login result:', result)
    // This should redirect to homeRoute = /staff
    expect(result.action).toBe('PASS')  // isPublicRoute = true because requiresAuth: false
  })

  it('superadmin navigating to /staff → should pass', () => {
    const result = simulateGuard({
      toPath: '/staff',
      fromPath: '/auth/login',
      isAuthenticated: true,
      user: superadmin,
      matchedMeta: staffMatchedMeta,
    })
    console.log('/staff result:', result)
    expect(result.action).toBe('PASS')
    expect(result.reason).toBe('final')
  })

  it('check homeRoute for superadmin', () => {
    const home = getDefaultRouteForRole('superadmin')
    console.log('homeRoute for superadmin:', home)
    expect(home).toBe('/staff')
  })

  it('simulate full login flow', () => {
    const steps: string[] = []
    let currentPath = '/auth/login'
    let maxSteps = 10
    
    while (maxSteps-- > 0) {
      // Determine matched meta based on path
      let matchedMeta: any[]
      if (currentPath.startsWith('/auth')) {
        matchedMeta = [{ requiresAuth: false }]
      } else if (currentPath === '/staff') {
        matchedMeta = staffMatchedMeta
      } else if (currentPath === '/start') {
        matchedMeta = [{ requiresAuth: false }]
      } else if (currentPath === '/') {
        matchedMeta = [{ requiresAuth: true }]
      } else {
        // catch-all → redirect to /start
        steps.push(`${currentPath} → catch-all → /start`)
        currentPath = '/start'
        continue
      }
      
      const result = simulateGuard({
        toPath: currentPath,
        fromPath: '/auth/login',
        isAuthenticated: true,
        user: superadmin,
        matchedMeta,
      })
      
      steps.push(`${currentPath} → ${result.action} (${result.reason})${result.target ? ' → ' + result.target : ''}`)
      
      if (result.action === 'PASS' || result.action === 'BLOCK') break
      if (result.action === 'REDIRECT') {
        currentPath = result.target!
      }
    }
    
    console.log('Login flow steps:', steps)
    expect(maxSteps).toBeGreaterThan(0) // Should not exhaust steps (no loop)
  })

  it('check what happens when auth route is NOT public', () => {
    // What if /auth/login matched meta does NOT have requiresAuth: false?
    const result = simulateGuard({
      toPath: '/auth/login',
      fromPath: '/',
      isAuthenticated: true,
      user: superadmin,
      matchedMeta: [{ requiresAuth: true }],  // What if auth layout has requiresAuth: true?
    })
    console.log('auth/login with requiresAuth:true result:', result)
    // isAuthRoute = true, isAuthenticated = true → redirect to homeRoute
    expect(result.action).toBe('REDIRECT')
    expect(result.target).toBe('/staff')
  })
})
