import { describe, it, expect } from 'vitest'

/**
 * URL Normalization Convention Tests.
 * Validates that all tutor routes follow /{role}/{domain} convention.
 *
 * These tests validate the URL map, not the actual router.
 * Router integration tested in E2E.
 */

const TUTOR_URL_MAP = {
  '/tutor': 'Tutor Dashboard',
  '/tutor/students': 'CRM Students',
  '/tutor/schedule': 'Tutor Calendar',
  '/tutor/knowledge': 'Knowledge Library',
  '/tutor/profile': 'Tutor Profile',
  '/tutor/billing': 'Billing',
  '/tutor/messages': 'Messages',
  '/tutor/contacts': 'Contacts',
  '/tutor/availability': 'Availability',
  '/tutor/bookings': 'My Lessons',
  '/tutor/inquiries': 'Inquiries',
  '/tutor/lesson-links': 'Lesson Links',
}

const STUDENT_URL_MAP = {
  '/student': 'Student Dashboard',
  '/student/schedule': 'Student Calendar',
  '/student/inquiries': 'Student Inquiries',
}

const SHARED_URL_MAP = {
  '/settings': 'User Settings',
  '/notifications': 'Notifications',
  '/marketplace': 'Marketplace',
}

const LEGACY_REDIRECTS = {
  '/booking/tutor': '/tutor/schedule',
  '/calendar': '/student/schedule',
  '/dashboard/knowledge': '/tutor/knowledge',
  '/marketplace/my-profile': '/tutor/profile',
  '/billing': '/tutor/billing',
  '/chat': '/tutor/messages',
  '/contacts': '/tutor/contacts',
  '/booking/availability': '/tutor/availability',
  '/bookings': '/tutor/bookings',
}

describe('URL Normalization Convention', () => {
  describe('Tutor URLs', () => {
    it('all tutor URLs start with /tutor/', () => {
      for (const url of Object.keys(TUTOR_URL_MAP)) {
        expect(url).toMatch(/^\/tutor(\/|$)/)
      }
    })

    it('no tutor URL uses legacy prefixes', () => {
      for (const url of Object.keys(TUTOR_URL_MAP)) {
        expect(url).not.toMatch(/^\/dashboard\//)
        expect(url).not.toMatch(/^\/booking\//)
        expect(url).not.toMatch(/^\/marketplace\/my/)
      }
    })
  })

  describe('Student URLs', () => {
    it('all student URLs start with /student/', () => {
      for (const url of Object.keys(STUDENT_URL_MAP)) {
        expect(url).toMatch(/^\/student(\/|$)/)
      }
    })
  })

  describe('Legacy Redirects', () => {
    it('all legacy URLs have redirect targets', () => {
      for (const [from, to] of Object.entries(LEGACY_REDIRECTS)) {
        expect(from).toBeTruthy()
        expect(to).toBeTruthy()
        expect(to).not.toBe(from)
      }
    })

    it('redirect targets follow new convention', () => {
      for (const [, to] of Object.entries(LEGACY_REDIRECTS)) {
        expect(to).toMatch(/^\/(tutor|student)\//)
      }
    })

    it('expected number of legacy redirects', () => {
      expect(Object.keys(LEGACY_REDIRECTS)).toHaveLength(9)
    })
  })
})
