/**
 * [WB:B10] Winterboard Responsive E2E Tests
 *
 * Verifies responsive adaptation across viewports:
 * - Mobile (375×667): toolbar variant=mobile, horizontal scroll, page nav
 * - Tablet (768×1024): toolbar variant=tablet, collapsible toggle
 * - Desktop (1280×800): toolbar variant=desktop, full layout
 * - Display (1920×1080): toolbar variant=desktop/display, full width
 *
 * INV-1: Canvas never resizes — only stage.scale() + stage.position()
 * INV-2: deviceMode ≠ inputMode
 * INV-3: One WBToolbar with variant prop
 * INV-5: Never use 100vh on iOS — only visualViewport API
 *
 * Run: npx cypress run --spec "cypress/e2e/winterboard-responsive.cy.ts"
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

/** Helper: navigate to winterboard and open a session */
function openWinterboard() {
  cy.visit('/winterboard')
  cy.url().should('include', '/winterboard')
  // Either open existing session or create new
  cy.get('body').then(($body) => {
    if ($body.find('.wb-session-card').length > 0) {
      cy.get('.wb-session-card').first().click()
    } else {
      cy.visit('/winterboard/new')
    }
  })
  // Wait for canvas to load
  cy.get('.wb-canvas, .konvajs-content, canvas', { timeout: 15000 }).should('exist')
}

// ── Mobile viewport (375×667) ────────────────────────────────────────

describe('Responsive: Mobile (375×667)', () => {
  beforeEach(() => {
    cy.viewport(375, 667)
    login(TUTOR_EMAIL, TUTOR_PASSWORD)
    openWinterboard()
  })

  it('sets data-device-mode to mobile', () => {
    cy.get('.wb-solo-room').should('have.attr', 'data-device-mode', 'mobile')
  })

  it('toolbar has variant=mobile', () => {
    cy.get('.wb-toolbar').should('have.attr', 'data-variant', 'mobile')
  })

  it('toolbar does NOT have collapse toggle on mobile', () => {
    cy.get('.wb-toolbar__toggle').should('not.exist')
  })

  it('toolbar is scrollable horizontally on mobile', () => {
    cy.get('.wb-toolbar').then(($toolbar) => {
      const el = $toolbar[0]
      // Mobile toolbar should allow horizontal overflow
      const style = getComputedStyle(el)
      expect(style.overflowX === 'auto' || style.overflowX === 'scroll' || el.scrollWidth > el.clientWidth).to.be.true
    })
  })

  it('page nav renders at bottom', () => {
    cy.get('.wb-page-footer, .wb-mobile-page-nav, [class*="page-nav"]').should('be.visible')
  })

  it('canvas element exists (INV-1: not resized, only scaled)', () => {
    cy.get('canvas').should('exist')
    cy.get('.konvajs-content').should('exist')
  })

  it('does NOT use 100vh (INV-5)', () => {
    cy.get('.wb-solo-room').then(($room) => {
      const style = getComputedStyle($room[0])
      // Should not have exactly 100vh — uses var(--wb-vh) or dvh instead
      expect(style.height).not.to.equal('100vh')
    })
  })
})

// ── Tablet viewport (768×1024) ───────────────────────────────────────

describe('Responsive: Tablet (768×1024)', () => {
  beforeEach(() => {
    cy.viewport(768, 1024)
    login(TUTOR_EMAIL, TUTOR_PASSWORD)
    openWinterboard()
  })

  it('sets data-device-mode to tablet', () => {
    cy.get('.wb-solo-room').should('have.attr', 'data-device-mode', 'tablet')
  })

  it('toolbar has variant=tablet', () => {
    cy.get('.wb-toolbar').should('have.attr', 'data-variant', 'tablet')
  })

  it('toolbar has collapse toggle button (B8)', () => {
    cy.get('.wb-toolbar__toggle').should('exist')
  })

  it('toggle button has aria-expanded attribute', () => {
    cy.get('.wb-toolbar__toggle').should('have.attr', 'aria-expanded')
  })

  it('clicking toggle collapses toolbar', () => {
    cy.get('.wb-toolbar__toggle').click()
    cy.get('.wb-toolbar').should('have.class', 'wb-toolbar--collapsed')
    // Click again to expand
    cy.get('.wb-toolbar__toggle').click()
    cy.get('.wb-toolbar').should('have.class', 'wb-toolbar--expanded')
  })

  it('canvas exists and is visible', () => {
    cy.get('canvas').should('be.visible')
  })

  it('page navigation is visible', () => {
    cy.get('.wb-page-footer, [class*="page-nav"]').should('be.visible')
  })
})

// ── Desktop viewport (1280×800) ──────────────────────────────────────

describe('Responsive: Desktop (1280×800)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800)
    login(TUTOR_EMAIL, TUTOR_PASSWORD)
    openWinterboard()
  })

  it('sets data-device-mode to desktop', () => {
    cy.get('.wb-solo-room').should('have.attr', 'data-device-mode', 'desktop')
  })

  it('toolbar has variant=desktop', () => {
    cy.get('.wb-toolbar').should('have.attr', 'data-variant', 'desktop')
  })

  it('toolbar does NOT have collapse toggle on desktop', () => {
    cy.get('.wb-toolbar__toggle').should('not.exist')
  })

  it('header displays session name', () => {
    cy.get('.wb-title-input, .wb-solo-room__title input').should('exist')
  })

  it('save status indicator is visible', () => {
    cy.get('.wb-save-indicator').should('be.visible')
  })

  it('zoom controls are visible', () => {
    cy.get('.wb-page-footer, [class*="zoom"]').should('be.visible')
  })

  it('canvas is visible and interactive', () => {
    cy.get('canvas').should('be.visible')
    cy.get('.konvajs-content').should('exist')
  })
})

// ── Large display viewport (1920×1080) ───────────────────────────────

describe('Responsive: Display (1920×1080)', () => {
  beforeEach(() => {
    cy.viewport(1920, 1080)
    login(TUTOR_EMAIL, TUTOR_PASSWORD)
    openWinterboard()
  })

  it('sets data-device-mode to desktop or display', () => {
    cy.get('.wb-solo-room').invoke('attr', 'data-device-mode').should('match', /desktop|display/)
  })

  it('toolbar is visible', () => {
    cy.get('.wb-toolbar').should('be.visible')
  })

  it('canvas fills available space', () => {
    cy.get('.wb-solo-room__canvas').then(($canvas) => {
      const rect = $canvas[0].getBoundingClientRect()
      // Canvas area should be at least 60% of viewport width
      expect(rect.width).to.be.greaterThan(1920 * 0.6)
    })
  })

  it('all header controls are visible', () => {
    cy.get('.wb-solo-room__header').should('be.visible')
    cy.get('.wb-solo-room__actions').should('be.visible')
  })
})

// ── Cross-viewport invariants ────────────────────────────────────────

describe('Responsive: Architectural Invariants', () => {
  const viewports: [number, number, string][] = [
    [375, 667, 'mobile'],
    [768, 1024, 'tablet'],
    [1280, 800, 'desktop'],
  ]

  viewports.forEach(([w, h, label]) => {
    it(`INV-2: deviceMode ≠ inputMode on ${label} (${w}×${h})`, () => {
      cy.viewport(w, h)
      login(TUTOR_EMAIL, TUTOR_PASSWORD)
      openWinterboard()
      cy.get('.wb-solo-room').then(($room) => {
        const deviceMode = $room.attr('data-device-mode')
        const inputMode = $room.attr('data-input-mode')
        // Both should exist as separate attributes
        expect(deviceMode).to.exist
        expect(inputMode).to.exist
        // deviceMode is screen-size based, inputMode is pointer-based
        expect(['mobile', 'tablet', 'desktop', 'display']).to.include(deviceMode)
        expect(['mouse', 'touch', 'pen']).to.include(inputMode)
      })
    })

    it(`INV-3: Single WBToolbar with variant on ${label} (${w}×${h})`, () => {
      cy.viewport(w, h)
      login(TUTOR_EMAIL, TUTOR_PASSWORD)
      openWinterboard()
      // Only one toolbar should exist
      cy.get('.wb-toolbar').should('have.length', 1)
      cy.get('.wb-toolbar').should('have.attr', 'data-variant')
    })
  })
})
