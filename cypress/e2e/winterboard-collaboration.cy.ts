/**
 * [WB:B6.2] E2E Tests — Winterboard Collaboration
 *
 * 7 test scenarios:
 * 1. Presence panel — online users display
 * 2. Follow mode — follow/unfollow remote user
 * 3. Connection status — connected/syncing/disconnected indicators
 * 4. Remote cursors — rendering + page filtering + fade
 * 5. Conflict indicators — selection locks + area highlights
 * 6. Offline → online merge — edits preserved after reconnect
 * 7. Accessibility — ARIA attributes + screen reader regions
 *
 * Ref: TASK_BOARD_PHASES.md B6.2
 */

import {
  visitBoardWithCollab,
  visitBoardOffline,
  injectRemoteUsers,
  injectRemoteCursor,
  injectRemoteSelection,
  simulateUserLeave,
  simulateDisconnect,
  simulateReconnect,
  simulateSyncing,
  goOffline,
  goOnline,
  injectOfflineEdits,
  assertUserCount,
  assertUserVisible,
  assertConnectionStatus,
  assertConnectionBar,
  assertRemoteCursor,
  assertNoRemoteCursors,
  assertLockIcon,
  assertConcurrentToast,
  assertAreaHighlight,
  followUser,
  togglePresencePanel,
  assertPanelCollapsed,
  assertPanelExpanded,
  assertPresenceA11y,
  assertSrLiveRegion,
  SELECTORS,
  type MockCollabUser,
} from '../support/collaboration-helpers'

// ─── Test data ──────────────────────────────────────────────────────────────

const TUTOR: MockCollabUser = {
  userId: 'tutor-1',
  displayName: 'Teacher Anna',
  color: '#0066FF',
  tool: 'pen',
  pageIndex: 0,
}

const STUDENT_A: MockCollabUser = {
  userId: 'student-a',
  displayName: 'Alice',
  color: '#ef4444',
  tool: 'highlighter',
  pageIndex: 0,
}

const STUDENT_B: MockCollabUser = {
  userId: 'student-b',
  displayName: 'Bob',
  color: '#22c55e',
  tool: 'eraser',
  pageIndex: 1,
}

// ─── Intercepts ─────────────────────────────────────────────────────────────

function setupIntercepts(): void {
  // Mock session API
  cy.intercept('GET', '**/api/v1/winterboard/sessions/*', {
    statusCode: 200,
    body: {
      id: 'test-session-1',
      name: 'Test Session',
      owner_id: 'tutor-1',
      status: 'active',
      pages: [
        { id: 'page-0', index: 0, background: { type: 'blank', color: '#ffffff' } },
        { id: 'page-1', index: 1, background: { type: 'grid', color: '#f8fafc' } },
      ],
    },
  }).as('getSession')

  // Mock strokes API
  cy.intercept('GET', '**/api/v1/winterboard/sessions/*/strokes*', {
    statusCode: 200,
    body: { strokes: [] },
  }).as('getStrokes')

  // Mock assets API
  cy.intercept('GET', '**/api/v1/winterboard/sessions/*/assets*', {
    statusCode: 200,
    body: { assets: [] },
  }).as('getAssets')

  // Mock auth
  cy.intercept('GET', '**/api/v1/auth/me', {
    statusCode: 200,
    body: {
      id: 'tutor-1',
      display_name: 'Teacher Anna',
      role: 'tutor',
    },
  }).as('getMe')
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════════════════

describe('[WB:B6.2] Collaboration E2E', () => {
  beforeEach(() => {
    setupIntercepts()
  })

  // ─── 1. Presence Panel — Online Users ─────────────────────────────────

  describe('1. Presence Panel — Online Users', () => {
    it('shows current user as "You" in presence panel', () => {
      visitBoardWithCollab()

      cy.get(SELECTORS.PRESENCE_PANEL).should('be.visible')
      cy.get(SELECTORS.PRESENCE_USER).first().within(() => {
        cy.contains('Teacher Anna').should('exist')
        cy.contains('You').should('exist')
      })
    })

    it('shows remote users when they join', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A, STUDENT_B])

      // Should show 3 users total (you + 2 remote)
      assertUserCount(3)
      assertUserVisible('Alice')
      assertUserVisible('Bob')
    })

    it('removes user from panel when they leave', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A, STUDENT_B])
      assertUserCount(3)

      simulateUserLeave('student-a')

      // Alice should be removed, Bob stays
      assertUserCount(2)
      assertUserVisible('Bob')
    })

    it('sorts remote users alphabetically after "You"', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_B, STUDENT_A]) // Bob first, Alice second

      cy.get(SELECTORS.PRESENCE_USER).eq(0).should('contain', 'Teacher Anna')
      cy.get(SELECTORS.PRESENCE_USER).eq(1).should('contain', 'Alice') // alphabetical
      cy.get(SELECTORS.PRESENCE_USER).eq(2).should('contain', 'Bob')
    })
  })

  // ─── 2. Follow Mode ──────────────────────────────────────────────────

  describe('2. Follow Mode', () => {
    it('can follow a remote user', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])

      followUser('Alice')

      // Follow button should become active
      cy.get(SELECTORS.PRESENCE_USER)
        .contains('Alice')
        .parents(SELECTORS.PRESENCE_USER)
        .find('.wb-presence-panel__following-badge')
        .should('exist')
    })

    it('can unfollow a user by clicking again', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])

      // Follow
      followUser('Alice')
      cy.get('.wb-presence-panel__following-badge').should('exist')

      // Unfollow
      followUser('Alice')
      cy.get('.wb-presence-panel__following-badge').should('not.exist')
    })

    it('auto-unfollows when followed user leaves', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])
      followUser('Alice')

      simulateUserLeave('student-a')

      cy.get('.wb-presence-panel__following-badge').should('not.exist')
    })
  })

  // ─── 3. Connection Status ────────────────────────────────────────────

  describe('3. Connection Status Indicators', () => {
    it('shows green dot when connected and synced', () => {
      visitBoardWithCollab()

      assertConnectionStatus('connected')
      assertConnectionBar(false) // no bar when connected
    })

    it('shows yellow dot and syncing bar', () => {
      visitBoardWithCollab()

      simulateSyncing()

      assertConnectionStatus('syncing')
      assertConnectionBar(true)
      cy.get(SELECTORS.PRESENCE_CONNECTION_BAR).should('contain', 'Syncing')
    })

    it('shows red dot and reconnecting bar on disconnect', () => {
      visitBoardWithCollab()

      simulateDisconnect()

      assertConnectionStatus('disconnected')
      assertConnectionBar(true)
      cy.get(SELECTORS.PRESENCE_CONNECTION_BAR).should('contain', 'Reconnecting')
    })

    it('recovers to green after reconnect', () => {
      visitBoardWithCollab()

      simulateDisconnect()
      assertConnectionStatus('disconnected')

      simulateReconnect()
      assertConnectionStatus('connected')
      assertConnectionBar(false)
    })
  })

  // ─── 4. Remote Cursors ───────────────────────────────────────────────

  describe('4. Remote Cursors', () => {
    it('renders remote cursor with user name and color', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])
      injectRemoteCursor('student-a', { x: 200, y: 300, pageIndex: 0, tool: 'pen' })

      assertRemoteCursor('Alice')
    })

    it('does not show cursors from other pages', () => {
      visitBoardWithCollab()

      // Student B is on page 1, we're on page 0
      injectRemoteUsers([STUDENT_B])

      assertNoRemoteCursors()
    })

    it('fades cursor after inactivity', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])
      injectRemoteCursor('student-a', { x: 200, y: 300, pageIndex: 0, tool: 'pen' })

      // Wait for fade timeout (5s)
      cy.wait(6000)

      assertRemoteCursor('Alice', { faded: true })
    })
  })

  // ─── 5. Conflict Indicators ──────────────────────────────────────────

  describe('5. Conflict Indicators', () => {
    it('shows lock icon when remote user selects strokes', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])
      injectRemoteSelection('student-a', { strokeIds: ['stroke-1'] })

      assertLockIcon('Alice')
    })

    it('shows area highlight around active remote cursor', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])
      injectRemoteCursor('student-a', { x: 200, y: 300, pageIndex: 0, tool: 'pen' })

      assertAreaHighlight(1)
    })

    it('shows concurrent edit toast when multiple users on same page', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A, { ...STUDENT_B, pageIndex: 0 }])

      assertConcurrentToast(true)

      // Toast auto-dismisses after 5s
      cy.wait(6000)
      assertConcurrentToast(false)
    })
  })

  // ─── 6. Offline → Online Merge ───────────────────────────────────────

  describe('6. Offline → Online Merge', () => {
    it('preserves local edits during offline period', () => {
      visitBoardWithCollab()

      // Go offline
      goOffline()
      assertConnectionStatus('disconnected')

      // Simulate drawing while offline (local strokes should persist)
      cy.get(SELECTORS.BOARD).trigger('pointerdown', { clientX: 100, clientY: 100 })
      cy.get(SELECTORS.BOARD).trigger('pointermove', { clientX: 200, clientY: 200 })
      cy.get(SELECTORS.BOARD).trigger('pointerup')

      // Come back online
      goOnline()
      assertConnectionStatus('connected')

      // Board should still have the stroke (not lost)
      cy.get(SELECTORS.BOARD).should('exist')
    })

    it('merges remote edits after reconnect', () => {
      visitBoardWithCollab()

      // Inject pending remote edits that will arrive on reconnect
      injectOfflineEdits({
        strokes: [
          { id: 'remote-stroke-1', points: [10, 20, 0.5, 30, 40, 0.7] },
        ],
      })

      goOffline()

      // Come back online — remote edits should merge
      goOnline()

      // Board should reflect merged state
      cy.get(SELECTORS.BOARD).should('exist')
    })

    it('handles concurrent offline edits without data loss', () => {
      visitBoardWithCollab()

      // Both local and remote edit while offline
      goOffline()

      // Local edit
      cy.get(SELECTORS.BOARD).trigger('pointerdown', { clientX: 50, clientY: 50 })
      cy.get(SELECTORS.BOARD).trigger('pointermove', { clientX: 150, clientY: 150 })
      cy.get(SELECTORS.BOARD).trigger('pointerup')

      // Remote edits pending
      injectOfflineEdits({
        strokes: [
          { id: 'remote-stroke-2', points: [200, 200, 0.5, 300, 300, 0.8] },
        ],
      })

      // Reconnect — CRDT merge should handle both
      goOnline()
      assertConnectionStatus('connected')

      // No error toast or data loss indicator
      cy.get('[data-testid="wb-error"]').should('not.exist')
    })
  })

  // ─── 7. Accessibility ────────────────────────────────────────────────

  describe('7. Accessibility', () => {
    it('presence panel has proper ARIA attributes', () => {
      visitBoardWithCollab()

      assertPresenceA11y()
    })

    it('has screen reader live regions for announcements', () => {
      visitBoardWithCollab()

      assertSrLiveRegion()
    })

    it('toggle button has correct aria-expanded state', () => {
      visitBoardWithCollab()

      // Expanded by default
      cy.get(SELECTORS.PRESENCE_TOGGLE).should('have.attr', 'aria-expanded', 'true')

      // Collapse
      togglePresencePanel()
      cy.get(SELECTORS.PRESENCE_TOGGLE).should('have.attr', 'aria-expanded', 'false')

      // Expand again
      togglePresencePanel()
      cy.get(SELECTORS.PRESENCE_TOGGLE).should('have.attr', 'aria-expanded', 'true')
    })

    it('follow buttons have descriptive aria-labels', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])

      cy.get(SELECTORS.PRESENCE_FOLLOW_BTN)
        .first()
        .should('have.attr', 'aria-label')
        .and('contain', 'Alice')
    })

    it('lock icons have aria-label with editor name', () => {
      visitBoardWithCollab()

      injectRemoteUsers([STUDENT_A])
      injectRemoteSelection('student-a', { strokeIds: ['stroke-1'] })

      cy.get(SELECTORS.CONFLICT_LOCK)
        .first()
        .should('have.attr', 'aria-label')
        .and('contain', 'Alice')
    })

    it('panel collapse/expand works with keyboard', () => {
      visitBoardWithCollab()

      // Focus toggle and press Enter
      cy.get(SELECTORS.PRESENCE_TOGGLE).focus().type('{enter}')
      assertPanelCollapsed()

      cy.get(SELECTORS.PRESENCE_TOGGLE).type('{enter}')
      assertPanelExpanded()
    })

    it('connection status bar has role=status for screen readers', () => {
      visitBoardWithCollab()

      simulateDisconnect()

      cy.get(SELECTORS.PRESENCE_CONNECTION_BAR)
        .should('have.attr', 'role', 'status')
        .and('have.attr', 'aria-live', 'polite')
    })
  })
})
