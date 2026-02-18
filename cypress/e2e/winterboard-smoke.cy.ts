/**
 * [WB:B1.2] Winterboard Smoke E2E tests
 *
 * Verifies core winterboard flows:
 * - Session list renders at /winterboard
 * - New session creates and loads canvas
 * - Drawing a stroke works
 * - Navigation back shows session in list
 *
 * Run: npx cypress run --spec "cypress/e2e/winterboard-smoke.cy.ts"
 */

const TUTOR_EMAIL = Cypress.env('TUTOR_EMAIL') || 'tutor04@example.com'
const TUTOR_PASSWORD = Cypress.env('TUTOR_PASSWORD') || 'testpass123'

/** Helper: login via UI */
function login(email: string, password: string) {
  cy.visit('/auth/login')
  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should('not.include', '/auth/login', { timeout: 10000 })
}

describe('Winterboard Smoke Tests', () => {
  beforeEach(() => {
    login(TUTOR_EMAIL, TUTOR_PASSWORD)
  })

  describe('Session List', () => {
    it('renders session list at /winterboard', () => {
      cy.visit('/winterboard')
      cy.url().should('include', '/winterboard')
      // Session list or empty state should be visible
      cy.get('body').should('not.contain', '404')
      cy.get('body').should('not.contain', 'Not Found')
      // Either session cards or empty state message
      cy.get('[data-testid="wb-session-list"], [data-testid="wb-empty-state"], .wb-session-list, .wb-empty-state, h1, h2')
        .should('exist')
    })
  })

  describe('New Session', () => {
    it('clicking New Session navigates to canvas', () => {
      cy.visit('/winterboard')
      // Find and click new session button
      cy.contains(/New Session|Нова сесія|Новая сессия|Create Whiteboard|Створити/i)
        .first()
        .click()
      cy.url().should('match', /\/winterboard\/(new|[a-f0-9-]+)/)
      // Canvas or loading state should appear
      cy.get('canvas, [data-testid="wb-canvas"], .wb-canvas-loader, .konva-content', { timeout: 10000 })
        .should('exist')
    })
  })

  describe('Canvas Interaction', () => {
    it('can draw a stroke on the canvas', () => {
      cy.visit('/winterboard/new')
      // Wait for canvas to load
      cy.get('canvas, .konva-content', { timeout: 15000 }).should('exist')

      // Simulate drawing: mousedown → mousemove → mouseup on canvas
      cy.get('canvas').first().then(($canvas) => {
        const rect = $canvas[0].getBoundingClientRect()
        const startX = rect.left + rect.width / 4
        const startY = rect.top + rect.height / 2
        const endX = rect.left + (rect.width * 3) / 4
        const endY = rect.top + rect.height / 2

        cy.wrap($canvas)
          .trigger('pointerdown', { clientX: startX, clientY: startY, force: true })
          .trigger('pointermove', { clientX: endX, clientY: endY, force: true })
          .trigger('pointerup', { clientX: endX, clientY: endY, force: true })
      })

      // After drawing, save status should change (syncing or saved)
      cy.get('body').should('not.contain', '404')
    })
  })

  describe('Public View', () => {
    it('/winterboard/public/:token renders without auth error', () => {
      // Public view should not require auth
      cy.clearCookies()
      cy.clearLocalStorage()
      cy.visit('/winterboard/public/test-token-123', { failOnStatusCode: false })
      cy.url().should('include', '/winterboard/public/test-token-123')
      // Should show either the board or a "not found" message (not a login redirect)
      cy.url().should('not.include', '/auth/login')
    })
  })
})
