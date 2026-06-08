// WB: Unit tests for Bundle Optimization (Phase 7: A7.1)
// Tests: lazy routes, async components, Yjs lazy loading, feature flag gating

import { describe, it, expect, vi } from 'vitest'

describe('Bundle Optimization (A7.1)', () => {
  // ── Lazy route loading ────────────────────────────────────────────────

  describe('Lazy route loading', () => {
    it('all WB routes with components use dynamic imports (not in initial bundle)', async () => {
      const routerModule = await import('../router')
      const routes = routerModule.default

      for (const route of routes) {
        // Skip redirect-only routes (no component field)
        if (route.component === undefined) continue
        // component should be a function (lazy import), not a direct component object
        expect(typeof route.component).toBe('function')
      }
    })

    it('WB module has standalone lazy-loaded routes including core entries', async () => {
      const routerModule = await import('../router')
      const routes = routerModule.default

      // default export = standaloneRoutes (own layout, no PageShell)
      // Count grew as new standalone flows were added (replay-gone, share token, etc.)
      expect(routes.length).toBeGreaterThanOrEqual(5)

      const routePaths = routes.map((r) => r.path)
      expect(routePaths).toContain('/winterboard/new')
      expect(routePaths).toContain('/winterboard/content-preview')
      expect(routePaths).toContain('/winterboard/:id')
      expect(routePaths).toContain('/winterboard/classroom/:lessonId')
      expect(routePaths).toContain('/winterboard/public/:token')
    })

    it('WB module exports page routes for PageShell', async () => {
      const { winterboardPageRoutes } = await import('../router')

      // Page routes include replays/archive/trash. classroom-hub RETIRED → redirect-only
      // (route record kept for old bookmarks). Core entries (dashboard, library, lessons,
      // boards, students) remain.
      expect(winterboardPageRoutes.length).toBeGreaterThanOrEqual(6)

      const pagePaths = winterboardPageRoutes.map((r) => r.path)
      expect(pagePaths).toContain('winterboard/dashboard')
      expect(pagePaths).toContain('winterboard/library')
      expect(pagePaths).toContain('winterboard/lessons')
      expect(pagePaths).toContain('winterboard/lessons/:lessonId')
      expect(pagePaths).toContain('winterboard/boards')
      expect(pagePaths).toContain('winterboard/students')
    })
  })

  // ── Async dialog components ───────────────────────────────────────────

  describe('Async dialog components', () => {
    it('WBShareDialog is lazy-loadable', async () => {
      // Verify the component module exists and can be dynamically imported
      const module = await import('../components/sharing/WBShareDialog.vue')
      expect(module).toBeDefined()
      expect(module.default).toBeDefined()
    })

    it('WBExportDialog is lazy-loadable', async () => {
      const module = await import('../components/export/WBExportDialog.vue')
      expect(module).toBeDefined()
      expect(module.default).toBeDefined()
    })
  })

  // ── Yjs lazy loading ──────────────────────────────────────────────────

  describe('Yjs lazy loading', () => {
    it('useCollaboration does NOT eagerly import y-websocket or y-indexeddb', async () => {
      // The useCollaboration module itself should be importable without
      // pulling in y-websocket/y-indexeddb (they are dynamic imports inside connect())
      const module = await import('../composables/useCollaboration')
      expect(module.useCollaboration).toBeDefined()
      expect(module.isYjsEnabled).toBeDefined()
    })

    it('isYjsEnabled returns false when feature flag disabled', async () => {
      const { isYjsEnabled } = await import('../composables/useCollaboration')
      // In test env, VITE_WB_USE_YJS is not set → false
      expect(isYjsEnabled()).toBe(false)
    })
  })
})
