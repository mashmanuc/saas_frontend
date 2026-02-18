/**
 * [WB:B1.4] Unit tests — Winterboard router configuration
 *
 * Validates route definitions, meta, names, and redirect mappings.
 * Run: npx vitest run tests/core/winterboardRouter.spec.js
 */
import { describe, it, expect } from 'vitest'
import winterboardRoutes from '@modules/winterboard/router.ts'

describe('winterboardRoutes', () => {
  it('exports an array of 4 routes', () => {
    expect(Array.isArray(winterboardRoutes)).toBe(true)
    expect(winterboardRoutes).toHaveLength(4)
  })

  describe('route: winterboard-sessions', () => {
    const route = winterboardRoutes.find(r => r.name === 'winterboard-sessions')

    it('exists', () => {
      expect(route).toBeDefined()
    })

    it('has path /winterboard', () => {
      expect(route.path).toBe('/winterboard')
    })

    it('has lazy-loaded component', () => {
      expect(typeof route.component).toBe('function')
    })

    it('has correct meta.roles', () => {
      expect(route.meta.roles).toEqual(['STUDENT', 'TUTOR'])
    })

    it('has meta.title = Winterboard', () => {
      expect(route.meta.title).toBe('Winterboard')
    })
  })

  describe('route: winterboard-new', () => {
    const route = winterboardRoutes.find(r => r.name === 'winterboard-new')

    it('exists', () => {
      expect(route).toBeDefined()
    })

    it('has path /winterboard/new', () => {
      expect(route.path).toBe('/winterboard/new')
    })

    it('has lazy-loaded component', () => {
      expect(typeof route.component).toBe('function')
    })

    it('has correct meta.roles', () => {
      expect(route.meta.roles).toEqual(['STUDENT', 'TUTOR'])
    })
  })

  describe('route: winterboard-solo', () => {
    const route = winterboardRoutes.find(r => r.name === 'winterboard-solo')

    it('exists', () => {
      expect(route).toBeDefined()
    })

    it('has path /winterboard/:id', () => {
      expect(route.path).toBe('/winterboard/:id')
    })

    it('has props: true for dynamic param', () => {
      expect(route.props).toBe(true)
    })

    it('has lazy-loaded component', () => {
      expect(typeof route.component).toBe('function')
    })

    it('has correct meta.roles', () => {
      expect(route.meta.roles).toEqual(['STUDENT', 'TUTOR'])
    })
  })

  describe('route: winterboard-public', () => {
    const route = winterboardRoutes.find(r => r.name === 'winterboard-public')

    it('exists', () => {
      expect(route).toBeDefined()
    })

    it('has path /winterboard/public/:token', () => {
      expect(route.path).toBe('/winterboard/public/:token')
    })

    it('has props: true for dynamic param', () => {
      expect(route.props).toBe(true)
    })

    it('has meta.requiresAuth = false (public)', () => {
      expect(route.meta.requiresAuth).toBe(false)
    })

    it('has meta.public = true', () => {
      expect(route.meta.public).toBe(true)
    })

    it('has lazy-loaded component', () => {
      expect(typeof route.component).toBe('function')
    })
  })

  describe('route naming conventions', () => {
    it('all route names start with winterboard-', () => {
      winterboardRoutes.forEach(route => {
        expect(route.name).toMatch(/^winterboard-/)
      })
    })

    it('all paths start with /winterboard', () => {
      winterboardRoutes.forEach(route => {
        expect(route.path).toMatch(/^\/winterboard/)
      })
    })
  })

  describe('no legacy solo module references', () => {
    it('no paths reference /solo/ prefix', () => {
      winterboardRoutes.forEach(route => {
        expect(route.path).not.toMatch(/^\/solo/)
      })
    })

    it('all routes use winterboard path prefix', () => {
      winterboardRoutes.forEach(route => {
        expect(route.path).toMatch(/^\/winterboard/)
      })
    })
  })
})
