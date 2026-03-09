/**
 * E2E: Tutor Dashboard — Phase R2
 *
 * Tests the redesigned tutor dashboard with greeting, stats, schedule,
 * quick actions, and inquiries preview.
 *
 * Run: npx cypress run --spec "cypress/e2e/dashboard-tutor.cy.ts"
 */

const TUTOR_EMAIL = 'tutor04@example.com'
const TUTOR_PASSWORD = 'testpass123'

function loginAsTutor() {
  cy.visit('/auth/login')
  cy.get('input[type="email"]').type(TUTOR_EMAIL)
  cy.get('input[type="password"]').type(TUTOR_PASSWORD)
  cy.get('button[type="submit"]').click()
  cy.url().should('include', '/tutor', { timeout: 10_000 })
}

describe('Tutor Dashboard', () => {
  beforeEach(() => {
    loginAsTutor()
  })

  // ── Greeting ──

  it('displays greeting section', () => {
    cy.visit('/tutor')
    cy.get('.dashboard-greeting, .greeting-title, h1').should('exist')
  })

  // ── Stats ──

  it('displays stats region', () => {
    cy.visit('/tutor')
    cy.get('.stats-row, [role="region"]').should('exist')
  })

  it('displays at least 3 stat cards', () => {
    cy.visit('/tutor')
    cy.get('.stat-card, [role="article"]').should('have.length.at.least', 3)
  })

  it('stat cards show numeric values', () => {
    cy.visit('/tutor')
    cy.get('.stat-value').first().invoke('text').should('match', /\d+|—/)
  })

  // ── Today Schedule ──

  it('displays today schedule section', () => {
    cy.visit('/tutor')
    cy.get('.schedule-header').should('exist')
  })

  // ── Quick Actions ──

  it('displays quick actions', () => {
    cy.visit('/tutor')
    cy.get('.quick-actions-grid').should('exist')
    cy.get('.quick-action-btn').should('have.length.at.least', 2)
  })

  it('quick action navigates to /tutor/schedule', () => {
    cy.visit('/tutor')
    cy.get('.quick-action-btn[href*="/tutor/schedule"]').click()
    cy.url().should('include', '/tutor/schedule')
  })

  it('quick action navigates to /tutor/students', () => {
    cy.visit('/tutor')
    cy.get('.quick-action-btn[href*="/tutor/students"]').click()
    cy.url().should('include', '/tutor/students')
  })

  // ── CRM Page ──

  it('navigates to /tutor/students from sidebar', () => {
    cy.visit('/tutor')
    cy.get('[data-testid="app-sidebar"]').within(() => {
      cy.get('.nav-item[href*="/tutor/students"]').click({ force: true })
    })
    cy.url().should('include', '/tutor/students')
  })

  it('CRM page renders with heading', () => {
    cy.visit('/tutor/students')
    cy.get('h1, h2, [class*="title"]').should('exist')
  })

  // ── No 404 ──

  it('/tutor does not 404', () => {
    cy.visit('/tutor')
    cy.get('body').should('not.contain', '404')
    cy.get('body').should('not.contain', 'Not Found')
  })

  it('/tutor/students does not 404', () => {
    cy.visit('/tutor/students')
    cy.get('body').should('not.contain', '404')
    cy.get('body').should('not.contain', 'Not Found')
  })

  // ── Empty state ──

  context('Empty state (new tutor)', () => {
    it.skip('shows empty state with CTA', () => {
      // Requires a tutor account with no students and no lessons
      cy.visit('/tutor')
      cy.get('.dashboard-empty-state, [class*="empty"]').should('exist')
    })
  })

  // ── Mobile ──

  context('Mobile viewport', () => {
    beforeEach(() => {
      cy.viewport('iphone-x')
    })

    it('dashboard renders correctly on mobile', () => {
      cy.visit('/tutor')
      cy.get('.dashboard-greeting, .greeting-title, h1').should('exist')
    })

    it('stats region renders on mobile', () => {
      cy.visit('/tutor')
      cy.get('.stats-row, [role="region"]').should('exist')
    })
  })
})
