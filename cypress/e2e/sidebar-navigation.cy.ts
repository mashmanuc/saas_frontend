/**
 * E2E: Sidebar Navigation — Phase R1
 *
 * Tests the new sectioned sidebar navigation for tutor role.
 * Requires running app with a test tutor account.
 *
 * Run: npx cypress run --spec "cypress/e2e/sidebar-navigation.cy.ts"
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

describe('Sidebar Navigation', () => {
  beforeEach(() => {
    loginAsTutor()
  })

  // ── Structure ──

  it('displays sidebar with data-testid', () => {
    cy.get('[data-testid="app-sidebar"]').should('exist')
  })

  it('displays sections for tutor', () => {
    cy.get('[data-testid="app-sidebar"]').should('be.visible')
    cy.get('.nav-section').should('have.length.at.least', 4)
  })

  it('displays section labels', () => {
    cy.get('.nav-section-label').should('have.length.at.least', 3)
  })

  it('shows Lucide icons (SVG, not emoji)', () => {
    cy.get('.nav-icon-svg').should('have.length.at.least', 5)
    // Old emoji-based icons should not exist
    cy.get('.menu-item-icon').should('not.exist')
  })

  // ── Navigation ──

  it('navigates to schedule on click', () => {
    cy.get('[data-testid="app-sidebar"]')
      .find('.nav-item')
      .filter('[href*="/tutor/schedule"]')
      .click()
    cy.url().should('include', '/tutor/schedule')
  })

  it('highlights active item', () => {
    cy.get('[data-testid="app-sidebar"]')
      .find('.nav-item')
      .filter('[href*="/tutor/schedule"]')
      .click()
    cy.get('.nav-item.active').should('exist')
    cy.url().should('include', '/tutor/schedule')
  })

  it('navigates to knowledge base', () => {
    cy.get('[data-testid="app-sidebar"]')
      .find('.nav-item')
      .filter('[href*="/tutor/knowledge"]')
      .click()
    cy.url().should('include', '/tutor/knowledge')
  })

  it('no 404 on navigation', () => {
    cy.get('[data-testid="app-sidebar"]')
      .find('.nav-item')
      .filter('[href*="/tutor/schedule"]')
      .click()
    cy.get('body').should('not.contain', '404')
    cy.get('body').should('not.contain', 'Not Found')
  })

  // ── Collapse / Expand ──

  it('collapses sidebar on button click', () => {
    // Collapse button is .collapse-btn.desktop-only
    cy.get('.collapse-btn.desktop-only').click()
    cy.get('.app-sidebar').should('have.class', 'collapsed')
  })

  it('hides labels when collapsed', () => {
    cy.get('.collapse-btn.desktop-only').click()
    cy.get('.app-sidebar').should('have.class', 'collapsed')
    // Section labels hidden via CSS (display:none in collapsed)
    cy.get('.nav-section-label').should('not.be.visible')
  })

  it('expands sidebar on button click', () => {
    // Collapse first
    cy.get('.collapse-btn.desktop-only').click()
    cy.get('.app-sidebar').should('have.class', 'collapsed')
    // Expand — after collapse, the visible .collapse-btn changes to expand icon
    cy.get('.collapse-btn.desktop-only').click()
    cy.get('.app-sidebar').should('not.have.class', 'collapsed')
  })

  it('remembers collapsed state after reload', () => {
    cy.get('.collapse-btn.desktop-only').click()
    cy.get('.app-sidebar').should('have.class', 'collapsed')
    cy.reload()
    // After reload, sidebar should restore collapsed state from localStorage
    cy.get('.app-sidebar', { timeout: 10_000 }).should('have.class', 'collapsed')
  })

  // ── Logo ──

  it('shows logo text when expanded', () => {
    cy.get('.logo-text').should('be.visible').and('contain.text', 'M4SH')
  })

  it('hides logo text when collapsed', () => {
    cy.get('.collapse-btn.desktop-only').click()
    cy.get('.logo-text').should('not.exist')
  })

  // ── Footer ──

  it('shows version in footer when expanded', () => {
    cy.get('.sidebar-version').should('be.visible')
  })

  // ── Mobile viewport ──

  context('Mobile viewport', () => {
    beforeEach(() => {
      cy.viewport('iphone-x')
    })

    it('sidebar is hidden by default on mobile', () => {
      cy.get('.app-sidebar').should('not.have.class', 'mobile-open')
    })

    it('opens sidebar via hamburger button', () => {
      // TopNav hamburger: button with aria-label containing sidebar.expand i18n text
      // It's the lg:hidden button with Menu icon
      cy.get('header button').filter(':visible').first().click()
      cy.get('.app-sidebar').should('have.class', 'mobile-open')
    })

    it('shows overlay when sidebar is open on mobile', () => {
      cy.get('header button').filter(':visible').first().click()
      cy.get('.sidebar-overlay').should('exist')
    })

    it('closes sidebar on overlay click', () => {
      // Open sidebar
      cy.get('header button').filter(':visible').first().click()
      cy.get('.app-sidebar').should('have.class', 'mobile-open')
      // Click overlay
      cy.get('.sidebar-overlay').click({ force: true })
      cy.get('.app-sidebar').should('not.have.class', 'mobile-open')
    })

    it('closes sidebar on navigation', () => {
      // Open sidebar
      cy.get('header button').filter(':visible').first().click()
      cy.get('.app-sidebar').should('have.class', 'mobile-open')
      // Click a nav item
      cy.get('.nav-item').first().click()
      // Sidebar should close after navigation (route-aware close from useSidebar)
      cy.get('.app-sidebar').should('not.have.class', 'mobile-open')
    })

    it('mobile close button works', () => {
      // Open sidebar
      cy.get('header button').filter(':visible').first().click()
      cy.get('.app-sidebar').should('have.class', 'mobile-open')
      // Close via .close-btn
      cy.get('.close-btn.mobile-only').click()
      cy.get('.app-sidebar').should('not.have.class', 'mobile-open')
    })
  })
})
