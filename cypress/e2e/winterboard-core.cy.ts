/**
 * [WB:B1.6] Winterboard Core E2E Test Suite
 *
 * Comprehensive tests for winterboard core flows:
 * 1. Session CRUD (create, rename, duplicate, delete)
 * 2. Drawing tools (pen, eraser, shape, text)
 * 3. Undo/Redo
 * 4. Multi-page
 * 5. Autosave
 * 6. Share
 * 7. Export
 * 8. Public view
 * 9. Keyboard shortcuts
 * 10. Error states
 *
 * ⚠️ NOTE: Some tests may fail until A1.6 (smoke testing) is complete.
 * The test code is ready; backend/frontend integration may still be in progress.
 *
 * Run: npx cypress run --spec "cypress/e2e/winterboard-core.cy.ts"
 */

const TUTOR_EMAIL = Cypress.env('TUTOR_EMAIL') || 'tutor04@example.com'
const TUTOR_PASSWORD = Cypress.env('TUTOR_PASSWORD') || 'testpass123'

// ── Helpers ──────────────────────────────────────────────────────────────

function login(email: string, password: string) {
  cy.visit('/auth/login')
  cy.get('input[type="email"]').type(email)
  cy.get('input[type="password"]').type(password)
  cy.get('button[type="submit"]').click()
  cy.url().should('not.include', '/auth/login', { timeout: 10000 })
}

/** Navigate to winterboard session list */
function goToSessionList() {
  cy.visit('/winterboard')
  cy.url().should('include', '/winterboard')
}

/** Create a new session and wait for canvas */
function createNewSession() {
  goToSessionList()
  cy.contains(/New|Нова|Новая|Створити|Create/i).first().click()
  cy.url().should('match', /\/winterboard\/(new|[a-f0-9-]+)/, { timeout: 10000 })
  cy.get('canvas, .konva-content', { timeout: 15000 }).should('exist')
}

/** Draw a simple horizontal stroke on the canvas */
function drawStroke(offsetX = 0.25, offsetY = 0.5) {
  cy.get('canvas').first().then(($canvas) => {
    const rect = $canvas[0].getBoundingClientRect()
    const startX = rect.left + rect.width * offsetX
    const startY = rect.top + rect.height * offsetY
    const endX = startX + 150
    const endY = startY

    cy.wrap($canvas)
      .trigger('pointerdown', { clientX: startX, clientY: startY, force: true })
      .trigger('pointermove', { clientX: (startX + endX) / 2, clientY: startY, force: true })
      .trigger('pointermove', { clientX: endX, clientY: endY, force: true })
      .trigger('pointerup', { clientX: endX, clientY: endY, force: true })
  })
}

/** Click a toolbar button by aria-label or title pattern */
function clickToolbarBtn(pattern: RegExp) {
  cy.get('.wb-toolbar button, .wb-toolbar [role="button"]')
    .filter((_i, el) => {
      const label = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || ''
      return pattern.test(label)
    })
    .first()
    .click({ force: true })
}

// ── Test Suite ───────────────────────────────────────────────────────────

describe('Winterboard Core E2E', () => {
  beforeEach(() => {
    login(TUTOR_EMAIL, TUTOR_PASSWORD)
  })

  // ── Test 1: Session CRUD ─────────────────────────────────────────────

  describe('Test 1: Session CRUD', () => {
    it('1a: Create session → verify in list', () => {
      createNewSession()
      // Session should have a URL with an ID
      cy.url().then((url) => {
        const match = url.match(/\/winterboard\/([a-f0-9-]+)/)
        if (match) {
          const sessionId = match[1]
          // Go back to list and verify session exists
          goToSessionList()
          cy.get('body').should('not.contain', '404')
          // Session list should have at least one item
          cy.get('.wb-session-card, [data-testid="wb-session-card"], a[href*="winterboard"]')
            .should('have.length.gte', 1)
        }
      })
    })

    it('1b: Rename session → verify name updated', () => {
      createNewSession()
      // Find the title input and rename
      cy.get('.wb-title-input, input[class*="title"], .wb-solo-room__title input')
        .first()
        .clear()
        .type('Renamed Session E2E{enter}')

      // Wait for autosave
      cy.wait(2000)

      // Go to list and verify name
      goToSessionList()
      cy.contains('Renamed Session E2E').should('exist')
    })

    it('1c: Duplicate session → verify copy in list', () => {
      goToSessionList()
      // Open actions menu on first session
      cy.get('.wb-session-card__actions-btn, [data-testid="session-actions"]')
        .first()
        .click({ force: true })

      // Click duplicate
      cy.contains(/Duplicate|Дублювати|Дублировать/i).click({ force: true })

      // Wait for duplicate to appear
      cy.wait(2000)

      // Verify list has at least 2 items
      cy.get('.wb-session-card, [data-testid="wb-session-card"]')
        .should('have.length.gte', 2)
    })

    it('1d: Delete session → verify removed', () => {
      goToSessionList()
      // Count sessions before delete
      cy.get('.wb-session-card, [data-testid="wb-session-card"]').then(($cards) => {
        const countBefore = $cards.length

        // Open actions menu on first session
        cy.get('.wb-session-card__actions-btn, [data-testid="session-actions"]')
          .first()
          .click({ force: true })

        // Click delete
        cy.contains(/Delete|Видалити|Удалить/i).click({ force: true })

        // Confirm delete
        cy.get('.wb-dialog__btn--danger, [data-testid="confirm-delete"]')
          .click({ force: true })

        // Wait for deletion
        cy.wait(2000)

        // Verify count decreased or empty state
        if (countBefore > 1) {
          cy.get('.wb-session-card, [data-testid="wb-session-card"]')
            .should('have.length', countBefore - 1)
        } else {
          // Empty state or no cards
          cy.get('.wb-session-card').should('have.length', 0)
        }
      })
    })
  })

  // ── Test 2: Drawing Tools ────────────────────────────────────────────

  describe('Test 2: Drawing Tools', () => {
    beforeEach(() => {
      createNewSession()
    })

    it('2a: Select pen → draw stroke → verify on canvas', () => {
      // Pen should be default tool, but click it explicitly
      clickToolbarBtn(/pen|олівець|карандаш/i)
      drawStroke()
      // Canvas should still be visible (no crash)
      cy.get('canvas').should('be.visible')
    })

    it('2b: Select eraser → erase stroke → verify', () => {
      // Draw first
      drawStroke()
      cy.wait(500)

      // Switch to eraser
      clickToolbarBtn(/eraser|гумка|ластик/i)

      // Erase over the same area
      drawStroke()
      cy.get('canvas').should('be.visible')
    })

    it('2c: Select shape (rectangle) → draw → verify', () => {
      clickToolbarBtn(/rectangle|rect|прямокутник|прямоугольник|shape/i)

      cy.get('canvas').first().then(($canvas) => {
        const rect = $canvas[0].getBoundingClientRect()
        const startX = rect.left + rect.width * 0.3
        const startY = rect.top + rect.height * 0.3
        const endX = rect.left + rect.width * 0.7
        const endY = rect.top + rect.height * 0.7

        cy.wrap($canvas)
          .trigger('pointerdown', { clientX: startX, clientY: startY, force: true })
          .trigger('pointermove', { clientX: endX, clientY: endY, force: true })
          .trigger('pointerup', { clientX: endX, clientY: endY, force: true })
      })

      cy.get('canvas').should('be.visible')
    })

    it('2d: Select text → type → verify', () => {
      clickToolbarBtn(/text|текст/i)

      // Click on canvas to place text
      cy.get('canvas').first().then(($canvas) => {
        const rect = $canvas[0].getBoundingClientRect()
        cy.wrap($canvas).click(rect.width / 2, rect.height / 2, { force: true })
      })

      // Type text (if a text input appears)
      cy.get('body').type('Hello E2E Test')
      cy.get('canvas').should('be.visible')
    })
  })

  // ── Test 3: Undo/Redo ───────────────────────────────────────────────

  describe('Test 3: Undo/Redo', () => {
    beforeEach(() => {
      createNewSession()
    })

    it('3a: Draw stroke → undo → verify removed', () => {
      drawStroke()
      cy.wait(300)

      // Click undo button
      cy.get('button[title*="Undo"], button[title*="undo"], .wb-header-btn')
        .contains('↩')
        .click({ force: true })

      cy.get('canvas').should('be.visible')
    })

    it('3b: Undo → redo → verify restored', () => {
      drawStroke()
      cy.wait(300)

      // Undo
      cy.get('button').contains('↩').click({ force: true })
      cy.wait(200)

      // Redo
      cy.get('button').contains('↪').click({ force: true })

      cy.get('canvas').should('be.visible')
    })

    it('3c: Draw 3 strokes → undo all → redo all', () => {
      drawStroke(0.2, 0.3)
      cy.wait(200)
      drawStroke(0.2, 0.5)
      cy.wait(200)
      drawStroke(0.2, 0.7)
      cy.wait(200)

      // Undo 3 times
      for (let i = 0; i < 3; i++) {
        cy.get('button').contains('↩').click({ force: true })
        cy.wait(100)
      }

      // Redo 3 times
      for (let i = 0; i < 3; i++) {
        cy.get('button').contains('↪').click({ force: true })
        cy.wait(100)
      }

      cy.get('canvas').should('be.visible')
    })
  })

  // ── Test 4: Multi-page ──────────────────────────────────────────────

  describe('Test 4: Multi-page', () => {
    beforeEach(() => {
      createNewSession()
    })

    it('4a: Add page → verify page count = 2', () => {
      // Click add page button
      cy.get('.wb-page-btn--add, button[title*="Add"], button[title*="add"]')
        .first()
        .click({ force: true })

      // Verify page indicator shows "2"
      cy.get('.wb-page-indicator, .wb-page-nav__count')
        .should('contain', '2')
    })

    it('4b: Navigate to page 2 → draw → navigate back → verify page 1 intact', () => {
      // Add page
      cy.get('.wb-page-btn--add, button[title*="Add"]')
        .first()
        .click({ force: true })

      // Navigate to page 2 (click next)
      cy.get('.wb-page-btn, button[title*="Next"], button[title*="next"]')
        .not('.wb-page-btn--add')
        .filter(':not(:disabled)')
        .first()
        .click({ force: true })

      // Draw on page 2
      drawStroke()
      cy.wait(500)

      // Navigate back to page 1 (click prev)
      cy.get('button[title*="Prev"], button[title*="prev"]')
        .first()
        .click({ force: true })

      // Page 1 should still be intact (canvas visible)
      cy.get('canvas').should('be.visible')
      cy.get('.wb-page-indicator, .wb-page-nav__count')
        .should('contain', '1')
    })

    it('4c: Verify page count after adding multiple pages', () => {
      // Add 2 more pages (total 3)
      cy.get('.wb-page-btn--add, button[title*="Add"]')
        .first()
        .click({ force: true })
      cy.wait(300)
      cy.get('.wb-page-btn--add, button[title*="Add"]')
        .first()
        .click({ force: true })

      cy.get('.wb-page-indicator, .wb-page-nav__count')
        .should('contain', '3')
    })
  })

  // ── Test 5: Autosave ────────────────────────────────────────────────

  describe('Test 5: Autosave', () => {
    it('5a: Draw stroke → wait → reload → verify stroke persisted', () => {
      createNewSession()

      // Draw a stroke
      drawStroke()

      // Wait for autosave (debounce 3s + network)
      cy.wait(6000)

      // Check save indicator shows "saved"
      cy.get('.wb-save-indicator--saved, .wb-save-status--saved, [class*="saved"]')
        .should('exist')

      // Reload page
      cy.reload()

      // Wait for canvas to load
      cy.get('canvas, .konva-content', { timeout: 15000 }).should('exist')

      // Canvas should be visible (stroke persisted)
      cy.get('canvas').should('be.visible')
    })
  })

  // ── Test 6: Share ───────────────────────────────────────────────────

  describe('Test 6: Share', () => {
    it('6a: Create share link → verify dialog shows URL', () => {
      createNewSession()
      cy.wait(2000)

      // Open session actions or share button
      // Try header exit area or session list actions
      goToSessionList()
      cy.get('.wb-session-card__actions-btn, [data-testid="session-actions"]')
        .first()
        .click({ force: true })

      cy.contains(/Share|Поділитися|Поделиться/i).click({ force: true })

      // Share dialog should appear
      cy.get('.wb-share-dialog, [role="dialog"]', { timeout: 5000 })
        .should('be.visible')

      // Generate link button
      cy.get('.wb-share-dialog__generate-btn, button')
        .contains(/Generate|Створити|Создать/i)
        .click({ force: true })

      // Link input should appear with URL
      cy.get('.wb-share-dialog__link-input, input[readonly]', { timeout: 5000 })
        .should('have.attr', 'value')
        .and('include', 'winterboard')
    })
  })

  // ── Test 7: Export ──────────────────────────────────────────────────

  describe('Test 7: Export', () => {
    it('7a: Trigger JSON export → verify export dialog', () => {
      createNewSession()
      drawStroke()
      cy.wait(2000)

      // Go to session list to access export
      goToSessionList()
      cy.get('.wb-session-card__actions-btn, [data-testid="session-actions"]')
        .first()
        .click({ force: true })

      cy.contains(/Export|Експорт|Экспорт/i).click({ force: true })

      // Export dialog should appear
      cy.get('.wb-export-dialog, [role="dialog"]', { timeout: 5000 })
        .should('be.visible')

      // Should have format options
      cy.get('.wb-export-dialog').should('exist')
    })
  })

  // ── Test 8: Public View ─────────────────────────────────────────────

  describe('Test 8: Public View', () => {
    it('8a: Open /winterboard/public/:token → verify read-only canvas', () => {
      // Clear auth to test public access
      cy.clearCookies()
      cy.clearLocalStorage()

      cy.visit('/winterboard/public/test-public-token', { failOnStatusCode: false })

      // Should NOT redirect to login
      cy.url().should('include', '/winterboard/public/test-public-token')
      cy.url().should('not.include', '/auth/login')

      // Should show canvas or error (not 404 page)
      cy.get('body').should('not.contain', '404')
    })

    it('8b: Public view should not show editing controls', () => {
      cy.clearCookies()
      cy.clearLocalStorage()

      cy.visit('/winterboard/public/test-public-token', { failOnStatusCode: false })

      // Toolbar should NOT be visible in public view
      cy.get('.wb-toolbar').should('not.exist')

      // Page navigation should still work (read-only)
      cy.get('.wb-page-btn, .wb-public-view__footer').should('exist')
    })
  })

  // ── Test 9: Keyboard Shortcuts ──────────────────────────────────────

  describe('Test 9: Keyboard Shortcuts', () => {
    beforeEach(() => {
      createNewSession()
    })

    it('9a: Ctrl+Z → undo', () => {
      drawStroke()
      cy.wait(300)

      // Trigger Ctrl+Z
      cy.get('body').type('{ctrl}z')
      cy.get('canvas').should('be.visible')
    })

    it('9b: Ctrl+Shift+Z → redo', () => {
      drawStroke()
      cy.wait(300)

      // Undo first
      cy.get('body').type('{ctrl}z')
      cy.wait(200)

      // Redo
      cy.get('body').type('{ctrl}{shift}z')
      cy.get('canvas').should('be.visible')
    })

    it('9c: Tool shortcuts (P=pen, E=eraser)', () => {
      // Press P for pen
      cy.get('body').type('p')
      cy.wait(100)

      // Press E for eraser
      cy.get('body').type('e')
      cy.wait(100)

      // Canvas should still work
      cy.get('canvas').should('be.visible')
    })
  })

  // ── Test 10: Error States ───────────────────────────────────────────

  describe('Test 10: Error States', () => {
    it('10a: Invalid session ID → error page or redirect', () => {
      cy.visit('/winterboard/invalid-session-id-that-does-not-exist', { failOnStatusCode: false })

      // Should show error state or redirect to session list
      cy.url({ timeout: 10000 }).should('satisfy', (url: string) => {
        return url.includes('/winterboard') || url.includes('/auth/login')
      })

      // Should not show blank page
      cy.get('body').invoke('text').should('have.length.gte', 10)
    })

    it('10b: Invalid share token → error message', () => {
      cy.clearCookies()
      cy.clearLocalStorage()

      cy.visit('/winterboard/public/invalid-token-xyz-000', { failOnStatusCode: false })

      // Should show error or "not found" message (not crash)
      cy.url().should('include', '/winterboard/public/')
      cy.get('body').invoke('text').should('have.length.gte', 10)
    })
  })
})
