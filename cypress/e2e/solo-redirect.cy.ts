/**
 * [WB:B1.2] Solo → Winterboard redirect E2E tests
 *
 * Verifies that all deprecated /solo* routes redirect to /winterboard* equivalents.
 * Routes are defined in router/index.js under PageShell (path: '/').
 *
 * Run: npx cypress run --spec "cypress/e2e/solo-redirect.cy.ts"
 */

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'
const TEST_TOKEN = 'abc123def456'

describe('Solo → Winterboard Redirects', () => {
  // These redirects are inside authenticated layout, so we need to be logged in.
  // If auth guard redirects to /auth/login, the test still validates
  // that the solo route itself resolves (no 404) and targets winterboard.

  describe('Session list redirect', () => {
    it('/solo → /winterboard', () => {
      cy.visit('/solo', { failOnStatusCode: false })
      cy.url().should('include', '/winterboard')
      cy.url().should('not.include', '/solo')
    })
  })

  describe('New session redirect', () => {
    it('/solo/new → /winterboard/new', () => {
      cy.visit('/solo/new', { failOnStatusCode: false })
      cy.url().should('include', '/winterboard/new')
    })
  })

  describe('Session by ID redirect', () => {
    it(`/solo/${TEST_UUID} → /winterboard/${TEST_UUID}`, () => {
      cy.visit(`/solo/${TEST_UUID}`, { failOnStatusCode: false })
      cy.url().should('include', `/winterboard/${TEST_UUID}`)
    })
  })

  describe('Solo v2 redirects', () => {
    it('/solo-v2/new → /winterboard/new', () => {
      cy.visit('/solo-v2/new', { failOnStatusCode: false })
      cy.url().should('include', '/winterboard/new')
    })

    it(`/solo-v2/${TEST_UUID} → /winterboard/${TEST_UUID}`, () => {
      cy.visit(`/solo-v2/${TEST_UUID}`, { failOnStatusCode: false })
      cy.url().should('include', `/winterboard/${TEST_UUID}`)
    })
  })

  describe('Shared board redirect', () => {
    it(`/solo/shared/${TEST_TOKEN} → /winterboard/public/${TEST_TOKEN}`, () => {
      cy.visit(`/solo/shared/${TEST_TOKEN}`, { failOnStatusCode: false })
      cy.url().should('include', `/winterboard/public/${TEST_TOKEN}`)
    })
  })
})
