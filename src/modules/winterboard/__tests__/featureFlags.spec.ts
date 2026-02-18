// WB: Unit tests for Feature Flags (Phase 7: A7.2)
// Tests: isWinterboardEnabled, isWinterboardYjsEnabled, URL override, localStorage, router guard

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// We need to test the module with different env values, so we use dynamic imports
// and mock import.meta.env

describe('Feature Flags (A7.2)', () => {
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    // Save original env
    originalEnv = { ...import.meta.env }
    // Clear localStorage
    window.localStorage.clear()
    // Clear URL params by mocking location
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '' },
      writable: true,
    })
  })

  afterEach(() => {
    // Restore env
    Object.assign(import.meta.env, originalEnv)
    window.localStorage.clear()
  })

  // ── isWinterboardEnabled ──────────────────────────────────────────────

  describe('isWinterboardEnabled', () => {
    it('returns false by default (no env, no localStorage, no URL param)', async () => {
      // Ensure env is not set
      delete (import.meta.env as Record<string, unknown>).VITE_WB_ENABLED

      const { isWinterboardEnabled } = await import('../config/featureFlags')
      expect(isWinterboardEnabled()).toBe(false)
    })

    it('returns true when VITE_WB_ENABLED=true', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_WB_ENABLED = 'true'

      // Re-import to pick up env change (module is stateless, reads env each call)
      const { isWinterboardEnabled } = await import('../config/featureFlags')
      expect(isWinterboardEnabled()).toBe(true)
    })

    it('returns false when VITE_WB_ENABLED=false', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_WB_ENABLED = 'false'

      const { isWinterboardEnabled } = await import('../config/featureFlags')
      expect(isWinterboardEnabled()).toBe(false)
    })

    it('URL param ?wb=true overrides env=false', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_WB_ENABLED = 'false'
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?wb=true' },
        writable: true,
      })

      const { isWinterboardEnabled } = await import('../config/featureFlags')
      expect(isWinterboardEnabled()).toBe(true)
    })

    it('URL param ?wb=true persists to localStorage', async () => {
      Object.defineProperty(window, 'location', {
        value: { ...window.location, search: '?wb=true' },
        writable: true,
      })

      const { isWinterboardEnabled } = await import('../config/featureFlags')
      isWinterboardEnabled()

      expect(window.localStorage.getItem('wb_enabled')).toBe('true')
    })

    it('localStorage override takes precedence over env', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_WB_ENABLED = 'false'
      window.localStorage.setItem('wb_enabled', 'true')

      const { isWinterboardEnabled } = await import('../config/featureFlags')
      expect(isWinterboardEnabled()).toBe(true)
    })

    it('setWinterboardEnabled persists to localStorage', async () => {
      const { setWinterboardEnabled, isWinterboardEnabled } = await import('../config/featureFlags')

      setWinterboardEnabled(true)
      expect(isWinterboardEnabled()).toBe(true)

      setWinterboardEnabled(false)
      expect(isWinterboardEnabled()).toBe(false)
    })

    it('clearWinterboardOverrides removes localStorage keys', async () => {
      const { setWinterboardEnabled, clearWinterboardOverrides } = await import('../config/featureFlags')

      setWinterboardEnabled(true)
      expect(window.localStorage.getItem('wb_enabled')).toBe('true')

      clearWinterboardOverrides()
      expect(window.localStorage.getItem('wb_enabled')).toBeNull()
    })
  })

  // ── isWinterboardYjsEnabled ───────────────────────────────────────────

  describe('isWinterboardYjsEnabled', () => {
    it('returns false when WB is disabled (nested flag)', async () => {
      delete (import.meta.env as Record<string, unknown>).VITE_WB_ENABLED
      ;(import.meta.env as Record<string, unknown>).VITE_WB_USE_YJS = 'true'

      const { isWinterboardYjsEnabled } = await import('../config/featureFlags')
      expect(isWinterboardYjsEnabled()).toBe(false)
    })

    it('returns true when WB enabled AND Yjs enabled', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_WB_ENABLED = 'true'
      ;(import.meta.env as Record<string, unknown>).VITE_WB_USE_YJS = 'true'

      const { isWinterboardYjsEnabled } = await import('../config/featureFlags')
      expect(isWinterboardYjsEnabled()).toBe(true)
    })

    it('returns false when WB enabled but Yjs not set', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_WB_ENABLED = 'true'
      delete (import.meta.env as Record<string, unknown>).VITE_WB_USE_YJS

      const { isWinterboardYjsEnabled } = await import('../config/featureFlags')
      expect(isWinterboardYjsEnabled()).toBe(false)
    })
  })

  // ── Router guard ──────────────────────────────────────────────────────

  describe('Router guard', () => {
    it('guard redirects to /404 when WB disabled', async () => {
      delete (import.meta.env as Record<string, unknown>).VITE_WB_ENABLED

      const { winterboardGuard } = await import('../router')
      const next = vi.fn()

      winterboardGuard(
        { path: '/winterboard' } as any,
        { path: '/' } as any,
        next,
      )

      expect(next).toHaveBeenCalledWith({ path: '/404' })
    })

    it('guard allows access when WB enabled', async () => {
      ;(import.meta.env as Record<string, unknown>).VITE_WB_ENABLED = 'true'

      const { winterboardGuard } = await import('../router')
      const next = vi.fn()

      winterboardGuard(
        { path: '/winterboard' } as any,
        { path: '/' } as any,
        next,
      )

      expect(next).toHaveBeenCalledWith()
    })

    it('all protected routes have beforeEnter guard', async () => {
      const routerModule = await import('../router')
      const routes = routerModule.default

      const protectedRoutes = routes.filter((r) => !r.meta?.requiresAuth === false && r.path !== '/winterboard/public/:token')
      const guarded = protectedRoutes.filter((r) => r.path !== '/winterboard/public/:token')

      for (const route of guarded) {
        expect(route.beforeEnter, `Route ${route.path} should have beforeEnter guard`).toBeDefined()
      }
    })

    it('public route does NOT have beforeEnter guard', async () => {
      const routerModule = await import('../router')
      const routes = routerModule.default

      const publicRoute = routes.find((r) => r.path === '/winterboard/public/:token')
      expect(publicRoute).toBeDefined()
      expect(publicRoute!.beforeEnter).toBeUndefined()
    })
  })
})
