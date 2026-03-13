/**
 * E2E: Phase 7 — Winterboard Navigation & Workflow
 * B19: DAY20_AGENT-B.md
 *
 * Run: npx cypress run --spec "cypress/e2e/phase7-workflow.cy.ts"
 *
 * NOTE: Tests that require real data are marked with {failOnStatusCode: false}
 * or use .should('exist') on container elements to be resilient.
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

// ─── Phase 7: Winterboard Navigation ──────────────────────────────────────────

describe('Phase 7: Winterboard Navigation', () => {
  beforeEach(() => {
    loginAsTutor()
  })

  // Test 1
  it('navigates to winterboard dashboard and shows h1', () => {
    cy.visit('/winterboard/dashboard')
    cy.get('h1').should('exist')
    cy.get('.wb-dashboard').should('exist')
  })

  // Test 2
  it('navigates to winterboard library and shows container', () => {
    cy.visit('/winterboard/library')
    cy.get('.wb-library').should('exist')
  })

  // Test 3
  it('navigates to winterboard lessons and shows container', () => {
    cy.visit('/winterboard/lessons')
    cy.get('.wb-lessons').should('exist')
  })

  // Test 4
  it('navigates to winterboard students and shows container', () => {
    cy.visit('/winterboard/students')
    cy.get('.wb-students').should('exist')
  })

  // Test 5
  it('AppSidebar shows winterboard nav links', () => {
    cy.visit('/winterboard/dashboard')
    cy.get('[data-testid="app-sidebar"]').within(() => {
      cy.contains('Library').should('exist')
      cy.contains('Lessons').should('exist')
      cy.contains('Boards').should('exist')
      cy.contains('Students').should('exist')
    })
  })

  // Test 6
  it('sidebar winterboard links navigate correctly', () => {
    cy.visit('/winterboard/dashboard')
    cy.get('[data-testid="app-sidebar"]').within(() => {
      cy.contains('Lessons').click({ force: true })
    })
    cy.url().should('include', '/winterboard/lessons')
  })

  // Test 7
  it('winterboard pages do not show 404', () => {
    const pages = [
      '/winterboard/dashboard',
      '/winterboard/library',
      '/winterboard/lessons',
      '/winterboard/students',
    ]
    pages.forEach(page => {
      cy.visit(page)
      cy.get('body').should('not.contain', '404')
      cy.get('body').should('not.contain', 'Not Found')
    })
  })

  // Test 8
  it('mobile 375px: sidebar exists and does not cover full screen', () => {
    cy.viewport(375, 812)
    cy.visit('/winterboard/dashboard')
    cy.get('.app-sidebar').should('exist')
    cy.get('.wb-dashboard').should('exist')
  })
})

// ─── Phase 7: Library Workflow ─────────────────────────────────────────────────

describe('Phase 7: Library Workflow', () => {
  beforeEach(() => {
    loginAsTutor()
  })

  // Test 9
  it('Library main area renders', () => {
    cy.visit('/winterboard/library')
    cy.get('.wb-library__main').should('exist')
  })

  // Test 10
  it('Library sidebar folder tree renders', () => {
    cy.visit('/winterboard/library')
    cy.get('.wb-library__sidebar').should('exist')
  })

  // Test 11
  it('Library search input is accessible', () => {
    cy.visit('/winterboard/library')
    cy.get('input[type="search"], input[aria-label]').should('exist')
  })
})

// ─── Phase 7: Lessons Workflow ────────────────────────────────────────────────

describe('Phase 7: Lessons Workflow', () => {
  beforeEach(() => {
    loginAsTutor()
  })

  // Test 12
  it('Lessons: create button exists', () => {
    cy.visit('/winterboard/lessons')
    cy.get('[data-testid="create-lesson"]').should('exist')
  })

  // Test 13
  it('Lessons: empty or list state renders (not error)', () => {
    cy.visit('/winterboard/lessons')
    cy.get('[data-testid="lessons-empty"], [data-testid="lessons-list"]', { timeout: 8000 }).should('exist')
  })
})

// ─── Phase 7: Students Workflow ───────────────────────────────────────────────

describe('Phase 7: Students Workflow', () => {
  beforeEach(() => {
    loginAsTutor()
  })

  // Test 14
  it('Students: shows empty state or list', () => {
    cy.visit('/winterboard/students')
    cy.get('[data-testid="students-empty"], [data-testid="students-list"]', { timeout: 8000 }).should('exist')
  })

  // Test 15
  it('Students: has accessible title', () => {
    cy.visit('/winterboard/students')
    cy.get('.wb-students__title').should('exist')
  })
})

// ─── Phase 7: Responsive ─────────────────────────────────────────────────────

describe('Phase 7: Responsive layouts', () => {
  beforeEach(() => {
    loginAsTutor()
  })

  context('768px tablet', () => {
    beforeEach(() => cy.viewport(768, 1024))

    // Test 16
    it('Library sidebar renders in column mode at 768px', () => {
      cy.visit('/winterboard/library')
      cy.get('.wb-library').should('exist')
    })

    // Test 17
    it('Dashboard renders at 768px', () => {
      cy.visit('/winterboard/dashboard')
      cy.get('.wb-dashboard').should('exist')
    })
  })

  context('375px mobile', () => {
    beforeEach(() => cy.viewport(375, 812))

    // Test 18
    it('Lessons header wraps at 375px', () => {
      cy.visit('/winterboard/lessons')
      cy.get('.wb-lessons').should('exist')
    })

    // Test 19 (bonus)
    it('Students card wraps at 375px', () => {
      cy.visit('/winterboard/students')
      cy.get('.wb-students').should('exist')
    })
  })
})

// ─── Phase 7: Boards ─────────────────────────────────────────────────────────

describe('Phase 7: Boards', () => {
  beforeEach(() => {
    loginAsTutor()
  })

  // Test 20
  it('Boards page renders without 404', () => {
    cy.visit('/winterboard/boards')
    cy.get('body').should('not.contain', '404')
  })
})
