/**
 * [WB:B2.3] E2E tests — Winterboard Export Dialog
 *
 * Categories:
 * 1. Dialog open/close
 * 2. Format selection
 * 3. Format-specific options
 * 4. Export flow (start → processing → ready → download)
 * 5. Error handling & retry
 * 6. Accessibility
 *
 * Note: Backend (A2.2, C2.3) stubbed via cy.intercept.
 */

const API = Cypress.env('API_URL') || 'http://localhost:8000'
const SESSION_ID = 'test-session-export'

describe('[WB:B2.3] Winterboard Export Dialog', () => {
  beforeEach(() => {
    // Stub auth
    cy.intercept('GET', `${API}/api/v1/auth/me/`, {
      statusCode: 200,
      body: { id: 'user-1', email: 'test@m4sh.com', role: 'TUTOR', display_name: 'Test' },
    }).as('authMe')

    // Stub session load
    cy.intercept('GET', `${API}/api/v1/winterboard/sessions/${SESSION_ID}/`, {
      statusCode: 200,
      body: {
        id: SESSION_ID,
        name: 'Export Test Board',
        owner_id: 'user-1',
        state: {
          pages: [
            { id: 'p1', name: 'Page 1', strokes: [], assets: [], background: 'white' },
            { id: 'p2', name: 'Page 2', strokes: [], assets: [], background: 'grid' },
          ],
          currentPageIndex: 0,
        },
        page_count: 2,
        thumbnail_url: null,
        rev: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    }).as('loadSession')

    // Stub save
    cy.intercept('PATCH', `${API}/api/v1/winterboard/sessions/${SESSION_ID}/`, {
      statusCode: 200,
      body: { rev: 2 },
    }).as('saveSession')
  })

  // ── Helper: open export dialog ──────────────────────────────────────

  function openExportDialog() {
    cy.visit(`/winterboard/${SESSION_ID}`)
    cy.wait('@loadSession')
    // Click the export button in the header (if exists) or trigger via keyboard
    cy.get('[data-testid="wb-export-btn"], .wb-header__export-btn, button').contains(/export/i).first().click({ force: true })
  }

  // ── 1. Dialog open/close ────────────────────────────────────────────

  describe('Dialog Open/Close', () => {
    it('opens export dialog with title and format options', () => {
      // Stub export create for safety
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'processing', file_url: null, error: null },
      }).as('createExport')

      openExportDialog()
      cy.get('.wb-export-dialog').should('be.visible')
      cy.get('.wb-export-dialog__title').should('exist')
      cy.get('.wb-export-format').should('have.length', 3)
    })

    it('closes dialog on overlay click', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'processing', file_url: null, error: null },
      })

      openExportDialog()
      cy.get('.wb-export-dialog').should('be.visible')
      cy.get('.wb-export-overlay').click('topLeft')
      cy.get('.wb-export-dialog').should('not.exist')
    })

    it('closes dialog on Escape key', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'processing', file_url: null, error: null },
      })

      openExportDialog()
      cy.get('.wb-export-dialog').should('be.visible')
      cy.get('.wb-export-dialog').trigger('keydown', { key: 'Escape' })
      cy.get('.wb-export-dialog').should('not.exist')
    })
  })

  // ── 2. Format selection ─────────────────────────────────────────────

  describe('Format Selection', () => {
    it('defaults to PNG format', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.png', error: null },
      })

      openExportDialog()
      cy.get('.wb-export-format--selected').should('have.length', 1)
      cy.get('input[name="wb-export-format"][value="png"]').should('be.checked')
    })

    it('can switch to PDF format', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.pdf', error: null },
      })

      openExportDialog()
      cy.get('input[name="wb-export-format"][value="pdf"]').check({ force: true })
      cy.get('input[name="wb-export-format"][value="pdf"]').should('be.checked')
    })

    it('can switch to JSON format', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.json', error: null },
      })

      openExportDialog()
      cy.get('input[name="wb-export-format"][value="json"]').check({ force: true })
      cy.get('input[name="wb-export-format"][value="json"]').should('be.checked')
    })
  })

  // ── 3. Format-specific options ──────────────────────────────────────

  describe('Format Options', () => {
    it('shows PNG quality and background options when PNG selected', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.png', error: null },
      })

      openExportDialog()
      cy.get('.wb-export-select').should('have.length.gte', 2) // quality + background
    })

    it('shows PDF page size and orientation when PDF selected', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.pdf', error: null },
      })

      openExportDialog()
      cy.get('input[name="wb-export-format"][value="pdf"]').check({ force: true })
      cy.get('.wb-export-select').should('have.length.gte', 2) // page size + orientation
    })

    it('shows JSON pretty print checkbox when JSON selected', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.json', error: null },
      })

      openExportDialog()
      cy.get('input[name="wb-export-format"][value="json"]').check({ force: true })
      cy.get('.wb-export-option input[type="checkbox"]').should('exist')
    })

    it('shows page selection (current/all) for all formats', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.png', error: null },
      })

      openExportDialog()
      cy.get('input[name="wb-page-scope"]').should('have.length', 2)
      cy.get('input[name="wb-page-scope"][value="all"]').should('be.checked')
    })
  })

  // ── 4. Export flow ──────────────────────────────────────────────────

  describe('Export Flow', () => {
    it('shows processing state after clicking export', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'processing', file_url: null, error: null },
      }).as('createExport')

      // Stub poll — still processing
      cy.intercept('GET', `${API}/api/v1/winterboard/exports/exp-1/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'processing', file_url: null, error: null },
      }).as('pollExport')

      openExportDialog()
      cy.get('.wb-export-dialog__action-btn').click()
      cy.wait('@createExport')
      cy.get('.wb-export-dialog__spinner').should('be.visible')
    })

    it('shows ready state with download button when export completes', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-2', status: 'done', file_url: 'https://cdn.example.com/board.png', error: null },
      }).as('createExport')

      openExportDialog()
      cy.get('.wb-export-dialog__action-btn').click()
      cy.wait('@createExport')
      cy.get('.wb-export-dialog__ready').should('be.visible')
      cy.get('.wb-export-dialog__action-btn').should('contain.text', /download/i)
    })
  })

  // ── 5. Error handling & retry ───────────────────────────────────────

  describe('Error Handling', () => {
    it('shows error state on API failure', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 500,
        body: { detail: 'Internal server error' },
      }).as('createExportFail')

      openExportDialog()
      cy.get('.wb-export-dialog__action-btn').click()
      cy.wait('@createExportFail')
      cy.get('.wb-export-dialog__error').should('be.visible')
    })

    it('retry button returns to format selection', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 500,
        body: { detail: 'Internal server error' },
      }).as('createExportFail')

      openExportDialog()
      cy.get('.wb-export-dialog__action-btn').click()
      cy.wait('@createExportFail')
      cy.get('.wb-export-dialog__error').should('be.visible')

      // Click retry
      cy.get('.wb-export-dialog__action-btn').click()
      cy.get('.wb-export-format').should('have.length', 3)
    })
  })

  // ── 6. Accessibility ────────────────────────────────────────────────

  describe('Accessibility', () => {
    it('dialog has role="dialog" and aria-modal', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.png', error: null },
      })

      openExportDialog()
      cy.get('[role="dialog"]')
        .should('have.attr', 'aria-modal', 'true')
        .and('have.attr', 'aria-label')
    })

    it('close button has aria-label', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'done', file_url: 'https://cdn.example.com/export.png', error: null },
      })

      openExportDialog()
      cy.get('.wb-export-dialog__close').should('have.attr', 'aria-label')
    })

    it('processing state has role="status" and aria-live', () => {
      cy.intercept('POST', `${API}/api/v1/winterboard/exports/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'processing', file_url: null, error: null },
      }).as('createExport')

      cy.intercept('GET', `${API}/api/v1/winterboard/exports/exp-1/`, {
        statusCode: 200,
        body: { id: 'exp-1', status: 'processing', file_url: null, error: null },
      })

      openExportDialog()
      cy.get('.wb-export-dialog__action-btn').click()
      cy.wait('@createExport')
      cy.get('[role="status"]').should('have.attr', 'aria-live', 'polite')
    })
  })
})
