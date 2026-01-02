/**
 * E2E tests for Availability Editor v0.55.7
 * Reference: backend/docs/plan/v0.55.7/frontend_task.md
 */

describe('Availability Editor', () => {
  beforeEach(() => {
    cy.login('tutor@example.com', 'password')
    cy.visit('/calendar')
    cy.intercept('GET', '/api/v1/calendar/week/**').as('getWeek')
    cy.wait('@getWeek')
  })

  describe('Enter availability mode', () => {
    it('should enter availability mode when clicking "Mark Free Time" button', () => {
      cy.contains('button', 'Mark Free Time').click()
      
      cy.get('[data-testid="availability-toolbar"]').should('be.visible')
      cy.get('[data-testid="availability-toolbar"]').should('contain', 'Внесіть вільні години')
    })

    it('should show workload progress', () => {
      cy.contains('button', 'Mark Free Time').click()
      
      cy.get('[data-testid="workload-section"]').should('be.visible')
      cy.get('[data-testid="progress-bar"]').should('exist')
      cy.get('[data-testid="workload-hours"]').should('contain', 'год')
    })

    it('should activate interaction layer', () => {
      cy.contains('button', 'Mark Free Time').click()
      
      cy.get('.interaction-layer.availability-mode').should('exist')
    })
  })

  describe('Add slots', () => {
    beforeEach(() => {
      cy.contains('button', 'Mark Free Time').click()
    })

    it('should add slot on cell click', () => {
      cy.intercept('POST', '/api/v1/calendar/availability/draft/').as('createDraft')
      
      // Click on empty cell
      cy.get('.calendar-grid-container').click(200, 300)
      
      cy.get('[data-testid="changes-summary"]').should('be.visible')
      cy.get('[data-testid="added-count"]').should('contain', '1')
    })

    it('should show hover indicator on empty cells', () => {
      cy.get('.calendar-grid-container').trigger('mousemove', { clientX: 200, clientY: 300 })
      
      cy.get('.availability-hover-indicator.can-add').should('be.visible')
      cy.get('.hover-icon').should('contain', '+')
    })

    it('should add multiple slots', () => {
      // Add 3 slots
      cy.get('.calendar-grid-container').click(200, 300)
      cy.get('.calendar-grid-container').click(200, 400)
      cy.get('.calendar-grid-container').click(200, 500)
      
      cy.get('[data-testid="added-count"]').should('contain', '3')
      cy.get('[data-testid="hours-delta"]').should('contain', '+3')
    })
  })

  describe('Remove slots', () => {
    beforeEach(() => {
      cy.contains('button', 'Mark Free Time').click()
    })

    it('should remove existing slot on click', () => {
      // Click on existing available slot
      cy.get('[data-testid="accessible-slot"]').first().click()
      
      cy.get('[data-testid="removed-count"]').should('contain', '1')
    })

    it('should show remove indicator on existing slots', () => {
      cy.get('[data-testid="accessible-slot"]').first().trigger('mousemove')
      
      cy.get('.availability-hover-indicator.can-remove').should('be.visible')
      cy.get('.hover-icon').should('contain', '×')
    })
  })

  describe('Save changes', () => {
    beforeEach(() => {
      cy.contains('button', 'Mark Free Time').click()
      cy.intercept('POST', '/api/v1/calendar/availability/draft/').as('createDraft')
      cy.intercept('POST', '/api/v1/calendar/availability/draft/*/apply').as('applyDraft')
    })

    it('should save changes successfully', () => {
      // Add slots
      cy.get('.calendar-grid-container').click(200, 300)
      cy.get('.calendar-grid-container').click(200, 400)
      cy.get('.calendar-grid-container').click(200, 500)
      
      // Mock successful apply
      cy.intercept('POST', '/api/v1/calendar/availability/draft/*/apply', {
        statusCode: 200,
        body: {
          status: 'applied',
          appliedAt: new Date().toISOString(),
          workloadProgress: {
            currentHours: 16,
            targetHours: 16,
            minHours: 10,
            status: 'ok',
          },
        },
      }).as('applySuccess')
      
      cy.contains('button', 'Зберегти').click()
      cy.wait('@applySuccess')
      
      // Should show success message
      cy.contains('Зміни збережено').should('be.visible')
      
      // Should exit availability mode
      cy.get('[data-testid="availability-toolbar"]').should('not.exist')
    })

    it('should disable save button when no changes', () => {
      cy.contains('button', 'Зберегти').should('be.disabled')
    })

    it('should enable save button when changes exist', () => {
      cy.get('.calendar-grid-container').click(200, 300)
      
      cy.contains('button', 'Зберегти').should('not.be.disabled')
    })
  })

  describe('Conflict detection', () => {
    beforeEach(() => {
      cy.contains('button', 'Mark Free Time').click()
    })

    it('should show conflicts drawer when conflicts detected', () => {
      cy.intercept('POST', '/api/v1/calendar/availability/draft/*/apply', {
        statusCode: 409,
        body: {
          status: 'conflicts',
          conflicts: [
            {
              type: 'event_overlap',
              slot: { start: '2025-01-29T17:00:00Z', end: '2025-01-29T18:00:00Z' },
              event: {
                id: 10,
                studentName: 'John Doe',
                start: '2025-01-29T17:00:00Z',
                end: '2025-01-29T18:00:00Z',
              },
            },
          ],
        },
      }).as('applyConflict')
      
      cy.get('.calendar-grid-container').click(200, 300)
      cy.contains('button', 'Зберегти').click()
      cy.wait('@applyConflict')
      
      cy.get('[data-testid="conflicts-drawer"]').should('be.visible')
      cy.contains('Виявлено конфлікти').should('be.visible')
      cy.contains('John Doe').should('be.visible')
    })

    it('should not allow adding slots over events', () => {
      // Try to click on event
      cy.get('[data-testid="calendar-event"]').first().click()
      
      // Should not add slot
      cy.get('[data-testid="changes-summary"]').should('not.exist')
    })
  })

  describe('Undo/Redo', () => {
    beforeEach(() => {
      cy.contains('button', 'Mark Free Time').click()
    })

    it('should undo last action', () => {
      cy.get('.calendar-grid-container').click(200, 300)
      cy.get('[data-testid="added-count"]').should('contain', '1')
      
      cy.contains('button', 'Скасувати').click()
      
      cy.get('[data-testid="changes-summary"]').should('not.exist')
    })

    it('should redo action', () => {
      cy.get('.calendar-grid-container').click(200, 300)
      cy.contains('button', 'Скасувати').click()
      
      cy.contains('button', 'Повторити').click()
      
      cy.get('[data-testid="added-count"]').should('contain', '1')
    })

    it('should support keyboard shortcuts', () => {
      cy.get('.calendar-grid-container').click(200, 300)
      
      // Ctrl+Z to undo
      cy.get('body').type('{ctrl}z')
      cy.get('[data-testid="changes-summary"]').should('not.exist')
      
      // Ctrl+Shift+Z to redo
      cy.get('body').type('{ctrl}{shift}z')
      cy.get('[data-testid="added-count"]').should('contain', '1')
    })
  })

  describe('Cancel and exit', () => {
    beforeEach(() => {
      cy.contains('button', 'Mark Free Time').click()
    })

    it('should cancel changes and exit', () => {
      cy.get('.calendar-grid-container').click(200, 300)
      cy.get('[data-testid="added-count"]').should('contain', '1')
      
      cy.contains('button', 'Скасувати').click()
      
      cy.get('[data-testid="availability-toolbar"]').should('not.exist')
    })

    it('should exit mode with Escape key', () => {
      cy.get('body').type('{esc}')
      
      cy.get('[data-testid="availability-toolbar"]').should('not.exist')
    })
  })

  describe('Legend', () => {
    beforeEach(() => {
      cy.contains('button', 'Mark Free Time').click()
    })

    it('should show legend when clicking legend button', () => {
      cy.contains('button', 'Показати легенду').click()
      
      cy.get('[data-testid="availability-legend"]').should('be.visible')
      cy.contains('Що означають кольори?').should('be.visible')
    })

    it('should display all legend items', () => {
      cy.contains('button', 'Показати легенду').click()
      
      cy.contains('Доступний слот').should('be.visible')
      cy.contains('Новий слот (чернетка)').should('be.visible')
      cy.contains('Заплановані уроки').should('be.visible')
      cy.contains('Заблокований час').should('be.visible')
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      cy.contains('button', 'Mark Free Time').click()
    })

    it('should have proper ARIA labels', () => {
      cy.get('[role="toolbar"]').should('have.attr', 'aria-label')
      cy.get('[role="grid"]').should('have.attr', 'aria-label')
      cy.get('[role="progressbar"]').should('exist')
    })

    it('should support keyboard navigation', () => {
      cy.get('.interaction-layer').focus()
      cy.get('.interaction-layer').type('{enter}')
      
      // Should trigger cell click
      cy.get('[data-testid="changes-summary"]').should('be.visible')
    })
  })

  describe('Responsive behavior', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x')
      cy.contains('button', 'Mark Free Time').click()
      
      cy.get('[data-testid="availability-toolbar"]').should('be.visible')
      cy.get('.calendar-grid-container').should('be.visible')
    })

    it('should work on tablet viewport', () => {
      cy.viewport('ipad-2')
      cy.contains('button', 'Mark Free Time').click()
      
      cy.get('[data-testid="availability-toolbar"]').should('be.visible')
    })
  })
})
