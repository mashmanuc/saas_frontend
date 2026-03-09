/**
 * Full UX Redesign E2E Test
 * Covers: Sidebar (R1), Dashboard (R2), TopNav (R3), URL Normalization (R4)
 *
 * Run: npx cypress run --spec "cypress/e2e/ux-redesign-full.cy.ts"
 */

const TUTOR_EMAIL = Cypress.env('TUTOR_EMAIL') || 'tutor04@example.com'
const TUTOR_PASSWORD = Cypress.env('TUTOR_PASSWORD') || 'testpass123'
const STUDENT_EMAIL = Cypress.env('STUDENT_EMAIL') || 'student01@example.com'
const STUDENT_PASSWORD = Cypress.env('STUDENT_PASSWORD') || 'testpass123'

function loginAs(email: string, password: string) {
  cy.visit('/auth/login')
  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should('not.include', '/auth/login', { timeout: 10_000 })
}

describe('UX Redesign — Full Flow', () => {

  context('Tutor Flow', () => {
    beforeEach(() => {
      loginAs(TUTOR_EMAIL, TUTOR_PASSWORD)
    })

    it('R1: Sidebar renders with sections and Lucide icons', () => {
      cy.visit('/tutor')
      cy.get('[data-testid="app-sidebar"]').should('exist')
      cy.get('[data-testid="app-sidebar"]').within(() => {
        // Sections exist
        cy.get('[role="group"]').should('have.length.at.least', 2)
        // No emoji icons
        cy.get('[aria-hidden="true"]').should('not.contain', '🏠')
      })
    })

    it('R1: Sidebar collapse/expand', () => {
      cy.visit('/tutor')
      // Find collapse button
      cy.get('[aria-expanded]').first().click()
      // Sidebar should collapse
      cy.get('[data-testid="app-sidebar"]').should('have.class', 'collapsed')
    })

    it('R2: Dashboard shows greeting + stats + schedule', () => {
      cy.visit('/tutor')
      cy.get('.dashboard-greeting, .greeting-title').should('exist')
      cy.get('[role="region"]').should('exist') // stats row
      cy.get('.stat-card, [role="article"]').should('have.length.at.least', 3)
    })

    it('R2: /tutor/students shows CRM', () => {
      cy.visit('/tutor/students')
      cy.get('h1, h2').should('exist')
    })

    it('R3: TopNav has AvatarDropdown', () => {
      cy.visit('/tutor')
      cy.get('.avatar-trigger').should('exist')
      // Open dropdown
      cy.get('.avatar-trigger').click()
      cy.get('[role="menu"]').should('exist')
      // Should have settings, theme, language, logout
      cy.get('[role="menuitem"]').should('have.length.at.least', 2)
      cy.get('[role="menuitemradio"]').should('have.length.at.least', 3)
    })

    it('R3: No separate logout/theme/language buttons in TopNav', () => {
      cy.visit('/tutor')
      // These should NOT exist as separate elements in TopNav header
      cy.get('header').within(() => {
        // Role badge removed
        cy.contains('Tutor').should('not.exist')
      })
    })

    it('R4: New URLs work', () => {
      cy.visit('/tutor/schedule')
      cy.url().should('include', '/tutor/schedule')

      cy.visit('/tutor/knowledge')
      cy.url().should('include', '/tutor/knowledge')

      cy.visit('/tutor/profile')
      cy.url().should('include', '/tutor/profile')

      cy.visit('/tutor/billing')
      cy.url().should('include', '/tutor/billing')

      cy.visit('/tutor/messages')
      cy.url().should('include', '/tutor/messages')
    })

    it('R4: Legacy URLs redirect', () => {
      cy.visit('/booking/tutor')
      cy.url().should('include', '/tutor/schedule')

      cy.visit('/dashboard/knowledge')
      cy.url().should('include', '/tutor/knowledge')

      cy.visit('/billing')
      cy.url().should('include', '/tutor/billing')
    })

    it('R5: Sidebar has ARIA attributes', () => {
      cy.visit('/tutor')
      cy.get('[role="navigation"]').should('exist')
      cy.get('[role="group"]').should('exist')
      cy.get('[aria-current="page"]').should('exist')
    })
  })

  context('Student Flow', () => {
    beforeEach(() => {
      loginAs(STUDENT_EMAIL, STUDENT_PASSWORD)
    })

    it('R2: Student dashboard shows greeting + stats', () => {
      cy.visit('/student')
      cy.get('.dashboard-greeting, .greeting-title').should('exist')
      cy.get('[role="region"]').should('exist')
    })

    it('R4: /student/schedule works', () => {
      cy.visit('/student/schedule')
      cy.url().should('include', '/student/schedule')
    })

    it('R4: /calendar redirects to /student/schedule', () => {
      cy.visit('/calendar')
      cy.url().should('include', '/student/schedule')
    })
  })

  context('Mobile', () => {
    beforeEach(() => {
      cy.viewport('iphone-x')
      loginAs(TUTOR_EMAIL, TUTOR_PASSWORD)
    })

    it('R1: Mobile sidebar opens via hamburger', () => {
      cy.visit('/tutor')
      // Hamburger button — Lucide icon, no text
      cy.get('button').contains('Menu').should('not.exist')
      cy.get('header button').first().click()
      // Sidebar overlay should appear
      cy.get('[data-testid="app-sidebar"]').should('be.visible')
    })

    it('R2: Dashboard responsive on mobile', () => {
      cy.visit('/tutor')
      cy.get('.dashboard-greeting, .greeting-title').should('be.visible')
    })

    it('R3: AvatarDropdown works on mobile', () => {
      cy.visit('/tutor')
      cy.get('.avatar-trigger').click()
      cy.get('[role="menu"]').should('be.visible')
    })
  })

  context('Themes', () => {
    beforeEach(() => {
      loginAs(TUTOR_EMAIL, TUTOR_PASSWORD)
    })

    it('R3: Theme switch via AvatarDropdown', () => {
      cy.visit('/tutor')
      cy.get('.avatar-trigger').click()
      // Find dark theme option
      cy.get('[role="menuitemradio"]').contains('Dark').click({ force: true })
      // Check data-theme attribute
      cy.get('html').should('have.attr', 'data-theme', 'dark')
    })
  })
})
