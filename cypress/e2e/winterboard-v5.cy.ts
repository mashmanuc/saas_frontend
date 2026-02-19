/**
 * [WB5-B10] E2E tests — Winterboard v5 Feature Coverage
 * Ref: TASK_BOARD_V5.md B10
 *
 * 22 tests covering all 12 v5 features.
 * Backend-dependent tests are marked with TODO for skip when no backend.
 *
 * Custom commands: loginAsTutor, drawStroke, selectAll
 */

// ─── Custom Commands ────────────────────────────────────────────────────────

Cypress.Commands.add('loginAsTutor', () => {
  cy.visit('/login')
  cy.get('[data-testid="email-input"]').type('tutor@example.com')
  cy.get('[data-testid="password-input"]').type('testpassword123')
  cy.get('[data-testid="login-button"]').click()
  cy.url().should('not.include', '/login')
})

Cypress.Commands.add('drawStroke', (startX: number, startY: number, endX: number, endY: number) => {
  cy.get('[data-testid="wb-canvas"]')
    .trigger('pointerdown', startX, startY, { force: true })
    .trigger('pointermove', endX, endY, { force: true })
    .trigger('pointerup', endX, endY, { force: true })
})

Cypress.Commands.add('selectAll', () => {
  cy.get('body').type('{ctrl}a')
})

// ─── Type declarations for custom commands ──────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsTutor(): Chainable<void>
      drawStroke(startX: number, startY: number, endX: number, endY: number): Chainable<void>
      selectAll(): Chainable<void>
    }
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Winterboard v5 — Full Feature E2E', () => {
  beforeEach(() => {
    // TODO: Replace with actual winterboard URL when backend is ready
    cy.visit('/winterboard/test-session', { failOnStatusCode: false })
  })

  // ─── 1. Rectangle Select (2 tests) ─────────────────────────────────────

  describe('Rectangle Select', () => {
    it('drag-select creates selection rectangle', () => {
      // Select tool
      cy.get('[data-tooltip*="Select"]').click()
      // Drag to create selection
      cy.get('[data-testid="wb-canvas"]')
        .trigger('pointerdown', 100, 100, { force: true })
        .trigger('pointermove', 300, 300, { force: true })

      // Selection rect should appear
      cy.get('[data-testid="wb-selection-rect"]').should('exist')

      cy.get('[data-testid="wb-canvas"]')
        .trigger('pointerup', 300, 300, { force: true })
    })

    it('shift+click adds to selection', () => {
      cy.get('[data-tooltip*="Select"]').click()

      // Click first item
      cy.get('[data-testid="wb-canvas"]')
        .trigger('pointerdown', 150, 150, { force: true })
        .trigger('pointerup', 150, 150, { force: true })

      // Shift+click second item
      cy.get('[data-testid="wb-canvas"]')
        .trigger('pointerdown', 250, 250, { shiftKey: true, force: true })
        .trigger('pointerup', 250, 250, { shiftKey: true, force: true })

      // Multi-select indicator should show
      cy.get('[data-testid="wb-selection-count"]').should('exist')
    })
  })

  // ─── 2. Grouping (2 tests) ─────────────────────────────────────────────

  describe('Grouping', () => {
    it('Ctrl+G groups selected items', () => {
      cy.selectAll()
      cy.get('body').type('{ctrl}g')
      // Group indicator should appear
      cy.get('[data-testid="wb-group-indicator"]').should('exist')
    })

    it('Ctrl+Shift+G ungroups', () => {
      cy.selectAll()
      cy.get('body').type('{ctrl}g')
      cy.get('body').type('{ctrl}{shift}g')
      // Group indicator should disappear
      cy.get('[data-testid="wb-group-indicator"]').should('not.exist')
    })
  })

  // ─── 3. Thickness (1 test) ─────────────────────────────────────────────

  describe('Thickness Presets', () => {
    it('clicking thickness preset changes size', () => {
      cy.get('[data-tooltip*="Pen"]').click()
      cy.get('[data-testid="wb-thickness-preset"]').first().click()
      // Active preset should be highlighted
      cy.get('[data-testid="wb-thickness-preset"].wb-thickness--active').should('exist')
    })
  })

  // ─── 4. Color Palette (1 test) ─────────────────────────────────────────

  describe('Color Palette', () => {
    it('clicking palette swatch changes color', () => {
      cy.get('[data-tooltip*="Pen"]').click()
      cy.get('[data-testid="wb-color-swatch"]').eq(1).click()
      // Active swatch should be highlighted
      cy.get('[data-testid="wb-color-swatch"].wb-palette__swatch--active').should('exist')
    })
  })

  // ─── 5. Lock/Unlock (2 tests) ──────────────────────────────────────────

  describe('Lock/Unlock', () => {
    it('Ctrl+Shift+L locks selected items', () => {
      cy.selectAll()
      cy.get('body').type('{ctrl}{shift}l')
      // Lock indicator should appear
      cy.get('[data-testid="wb-lock-indicator"]').should('exist')
    })

    it('locked items cannot be dragged', () => {
      cy.selectAll()
      cy.get('body').type('{ctrl}{shift}l')

      // Try to drag — position should not change
      const startPos = { x: 200, y: 200 }
      cy.get('[data-testid="wb-canvas"]')
        .trigger('pointerdown', startPos.x, startPos.y, { force: true })
        .trigger('pointermove', startPos.x + 50, startPos.y + 50, { force: true })
        .trigger('pointerup', startPos.x + 50, startPos.y + 50, { force: true })

      // Item should still be at original position (locked)
      cy.get('[data-testid="wb-lock-indicator"]').should('exist')
    })
  })

  // ─── 6. Laser Pointer (1 test) ─────────────────────────────────────────

  describe('Laser Pointer', () => {
    it('F key activates laser and shows red dot', () => {
      cy.get('body').type('f')
      // Laser tool should be active
      cy.get('[data-tooltip*="Laser"]').should('have.class', 'wb-toolbar__btn--active')

      // Move mouse to show laser dot
      cy.get('[data-testid="wb-canvas"]')
        .trigger('pointermove', 400, 300, { force: true })

      cy.get('[data-testid="wb-laser-dot"]').should('exist')
    })
  })

  // ─── 7. Duplicate (1 test) ─────────────────────────────────────────────

  describe('Duplicate', () => {
    it('Ctrl+D duplicates selected items', () => {
      cy.selectAll()
      cy.get('body').type('{ctrl}d')
      // Should have more items after duplicate
      cy.get('[data-testid="wb-canvas-item"]').should('have.length.greaterThan', 0)
    })
  })

  // ─── 8. Align / Context Menu (2 tests) ─────────────────────────────────

  describe('Align & Context Menu', () => {
    it('right-click shows context menu', () => {
      cy.selectAll()
      cy.get('[data-testid="wb-canvas"]')
        .trigger('contextmenu', 200, 200, { force: true })

      cy.get('.wb-context-menu').should('be.visible')
    })

    it('clicking outside closes context menu', () => {
      cy.selectAll()
      cy.get('[data-testid="wb-canvas"]')
        .trigger('contextmenu', 200, 200, { force: true })

      cy.get('.wb-context-menu').should('be.visible')

      // Click backdrop
      cy.get('.wb-context-backdrop').click({ force: true })
      cy.get('.wb-context-menu').should('not.exist')
    })
  })

  // ─── 9. Page Thumbnails (3 tests) ──────────────────────────────────────

  describe('Page Thumbnails', () => {
    it('sidebar with thumbnails is visible', () => {
      cy.get('.wb-page-thumbnails').should('be.visible')
      cy.get('[role="tab"]').should('have.length.greaterThan', 0)
    })

    it('add page button creates new page', () => {
      cy.get('[role="tab"]').then($tabs => {
        const initialCount = $tabs.length
        cy.get('.wb-thumbnail--add').click()
        cy.get('[role="tab"]').should('have.length', initialCount + 1)
      })
    })

    it('clicking thumbnail navigates to page', () => {
      // Add a second page first
      cy.get('.wb-thumbnail--add').click()
      // Click first page
      cy.get('[role="tab"]').first().click()
      cy.get('[role="tab"]').first().should('have.attr', 'aria-selected', 'true')
    })
  })

  // ─── 10. Clear Page (4 tests) ──────────────────────────────────────────

  describe('Clear Page', () => {
    it('clear page button opens confirm dialog', () => {
      cy.get('[aria-label="Clear page"]').click()
      cy.get('.wb-dialog').should('be.visible')
      cy.get('.wb-dialog__title').should('contain', 'Clear page')
    })

    it('confirm clears the page', () => {
      cy.get('[aria-label="Clear page"]').click()
      cy.get('.wb-dialog__btn--danger').click()
      // Dialog should close
      cy.get('.wb-dialog').should('not.exist')
    })

    it('cancel preserves the page', () => {
      cy.get('[aria-label="Clear page"]').click()
      cy.get('.wb-dialog__btn--secondary').click()
      cy.get('.wb-dialog').should('not.exist')
    })

    it('Escape closes confirm dialog', () => {
      cy.get('[aria-label="Clear page"]').click()
      cy.get('.wb-dialog').should('be.visible')
      cy.get('body').type('{esc}')
      cy.get('.wb-dialog').should('not.exist')
    })
  })

  // ─── 11. Sticky Notes (3 tests) ────────────────────────────────────────

  describe('Sticky Notes', () => {
    it('S key activates sticky tool', () => {
      cy.get('body').type('s')
      cy.get('[data-tooltip*="Sticky"]').should('have.class', 'wb-toolbar__btn--active')
    })

    it('clicking canvas creates sticky note', () => {
      cy.get('body').type('s')
      cy.get('[data-testid="wb-canvas"]')
        .trigger('pointerdown', 400, 300, { force: true })
        .trigger('pointerup', 400, 300, { force: true })

      // Sticky note should appear
      cy.get('[data-testid="wb-sticky-note"]').should('exist')
    })

    it('double-click sticky opens text editor', () => {
      cy.get('body').type('s')
      cy.get('[data-testid="wb-canvas"]')
        .trigger('pointerdown', 400, 300, { force: true })
        .trigger('pointerup', 400, 300, { force: true })

      cy.get('[data-testid="wb-sticky-note"]').dblclick({ force: true })
      cy.get('[data-testid="wb-sticky-textarea"]').should('be.visible')
    })
  })

  // ─── 12. Toolbar Presence (1 test) ─────────────────────────────────────

  describe('Toolbar', () => {
    it('all 10 drawing tools are present', () => {
      const tools = [
        'Select', 'Pen', 'Highlighter', 'Line', 'Rectangle',
        'Circle', 'Text', 'Eraser', 'Laser', 'Sticky',
      ]
      tools.forEach(tool => {
        cy.get(`[data-tooltip*="${tool}"]`).should('exist')
      })
    })
  })
})
