/**
 * [WB:B6.2] Cypress Collaboration Helpers
 *
 * Utilities for E2E testing of Winterboard collaboration features.
 * Simulates multi-user scenarios via Yjs awareness mocking,
 * WebSocket state injection, and DOM assertions.
 *
 * Ref: TASK_BOARD_PHASES.md B6.2
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MockCollabUser {
  userId: string
  displayName: string
  color: string
  tool?: string
  pageIndex?: number
}

export interface MockCursorPosition {
  x: number
  y: number
  pageIndex: number
  tool: string
}

export interface MockSelectionState {
  strokeIds: string[]
}

// ─── Constants ──────────────────────────────────────────────────────────────

const WB_ROUTE = '/winterboard'
const BOARD_SELECTOR = '[data-testid="wb-board"]'
const PRESENCE_PANEL = '.wb-presence-panel'
const PRESENCE_USER = '.wb-presence-panel__user'
const PRESENCE_TOGGLE = '.wb-presence-panel__toggle'
const PRESENCE_FOLLOW_BTN = '.wb-presence-panel__follow-btn'
const PRESENCE_STATUS_DOT = '.wb-presence-panel__status-dot'
const PRESENCE_CONNECTION_BAR = '.wb-presence-panel__connection'
const CONFLICT_LOCK = '.wb-conflict-indicators__lock'
const CONFLICT_AREA = '.wb-conflict-indicators__area'
const CONFLICT_TOAST = '.wb-conflict-indicators__toast'
const REMOTE_CURSOR = '.wb-remote-cursors__cursor'
const REMOTE_CURSOR_FADED = '.wb-remote-cursors__cursor--faded'
const REMOTE_CURSOR_LABEL = '.wb-remote-cursors__label'

// ─── Navigation ─────────────────────────────────────────────────────────────

/**
 * Visit winterboard with collaboration enabled.
 * Sets VITE_WB_USE_YJS=true via window override before app loads.
 */
export function visitBoardWithCollab(sessionId = 'test-session-1'): void {
  cy.visit(`${WB_ROUTE}/${sessionId}`, {
    onBeforeLoad(win: Window) {
      ;(win as unknown as Record<string, unknown>).__WB_USE_YJS = true
    },
  })
  cy.get(BOARD_SELECTOR, { timeout: 10_000 }).should('exist')
}

/**
 * Visit winterboard with collaboration disabled (offline mode).
 */
export function visitBoardOffline(sessionId = 'test-session-1'): void {
  cy.visit(`${WB_ROUTE}/${sessionId}`, {
    onBeforeLoad(win: Window) {
      ;(win as unknown as Record<string, unknown>).__WB_USE_YJS = false
    },
  })
  cy.get(BOARD_SELECTOR, { timeout: 10_000 }).should('exist')
}

// ─── Awareness Simulation ───────────────────────────────────────────────────

/**
 * Inject mock remote users into the Yjs awareness state.
 * This simulates other users joining the session.
 */
export function injectRemoteUsers(users: MockCollabUser[]): void {
  cy.window().then((win: Window) => {
    const states = new Map<number, Record<string, unknown>>()

    users.forEach((user, idx) => {
      const clientId = 1000 + idx
      states.set(clientId, {
        user: {
          id: user.userId,
          name: user.displayName,
          color: user.color,
        },
        cursor: user.tool
          ? {
              x: 100 + idx * 50,
              y: 100 + idx * 50,
              pageIndex: user.pageIndex ?? 0,
              tool: user.tool,
              timestamp: Date.now(),
            }
          : null,
        selection: { strokeIds: [] },
      })
    })

    ;(win as unknown as Record<string, unknown>).__WB_MOCK_AWARENESS_STATES = states
    win.dispatchEvent(new CustomEvent('wb:awareness-mock-update'))
  })
}

/**
 * Inject a remote cursor position for a specific user.
 */
export function injectRemoteCursor(
  userId: string,
  position: MockCursorPosition,
): void {
  cy.window().then((win: Window) => {
    const event = new CustomEvent('wb:remote-cursor-update', {
      detail: { userId, ...position, timestamp: Date.now() },
    })
    win.dispatchEvent(event)
  })
}

/**
 * Inject a remote selection (locked strokes) for a specific user.
 */
export function injectRemoteSelection(
  userId: string,
  selection: MockSelectionState,
): void {
  cy.window().then((win: Window) => {
    const event = new CustomEvent('wb:remote-selection-update', {
      detail: { userId, ...selection },
    })
    win.dispatchEvent(event)
  })
}

/**
 * Simulate a user leaving the session.
 */
export function simulateUserLeave(userId: string): void {
  cy.window().then((win: Window) => {
    const event = new CustomEvent('wb:user-leave', { detail: { userId } })
    win.dispatchEvent(event)
  })
}

// ─── Connection Simulation ──────────────────────────────────────────────────

/**
 * Simulate WebSocket disconnection.
 */
export function simulateDisconnect(): void {
  cy.window().then((win: Window) => {
    ;(win as unknown as Record<string, unknown>).__WB_MOCK_WS_STATUS = 'disconnected'
    win.dispatchEvent(new CustomEvent('wb:connection-status-change', {
      detail: { status: 'disconnected' },
    }))
  })
}

/**
 * Simulate WebSocket reconnection.
 */
export function simulateReconnect(): void {
  cy.window().then((win: Window) => {
    ;(win as unknown as Record<string, unknown>).__WB_MOCK_WS_STATUS = 'connected'
    win.dispatchEvent(new CustomEvent('wb:connection-status-change', {
      detail: { status: 'connected' },
    }))
  })
}

/**
 * Simulate syncing state (connected but not yet synced).
 */
export function simulateSyncing(): void {
  cy.window().then((win: Window) => {
    ;(win as unknown as Record<string, unknown>).__WB_MOCK_WS_STATUS = 'syncing'
    win.dispatchEvent(new CustomEvent('wb:connection-status-change', {
      detail: { status: 'syncing' },
    }))
  })
}

// ─── Offline / Merge Simulation ─────────────────────────────────────────────

/**
 * Simulate going offline (disconnect + IndexedDB persistence).
 */
export function goOffline(): void {
  cy.window().then((win: Window) => {
    ;(win as unknown as Record<string, unknown>).__WB_MOCK_OFFLINE = true
    simulateDisconnect()
  })
}

/**
 * Simulate coming back online and triggering merge.
 */
export function goOnline(): void {
  cy.window().then((win: Window) => {
    ;(win as unknown as Record<string, unknown>).__WB_MOCK_OFFLINE = false
    simulateReconnect()
    // Trigger merge event
    win.dispatchEvent(new CustomEvent('wb:offline-merge-complete'))
  })
}

/**
 * Simulate offline edits by another user (will be merged on reconnect).
 */
export function injectOfflineEdits(edits: {
  strokes?: Array<{ id: string; points: number[] }>
  deletedStrokeIds?: string[]
}): void {
  cy.window().then((win: Window) => {
    ;(win as unknown as Record<string, unknown>).__WB_PENDING_REMOTE_EDITS = edits
  })
}

// ─── DOM Assertions ─────────────────────────────────────────────────────────

/**
 * Assert presence panel shows N users.
 */
export function assertUserCount(count: number): void {
  cy.get(PRESENCE_USER).should('have.length', count)
}

/**
 * Assert a specific user is visible in the presence panel.
 */
export function assertUserVisible(displayName: string): void {
  cy.get(PRESENCE_USER).contains(displayName).should('be.visible')
}

/**
 * Assert connection status dot color.
 */
export function assertConnectionStatus(status: 'connected' | 'syncing' | 'disconnected'): void {
  cy.get(PRESENCE_STATUS_DOT).should('have.class', `wb-presence-panel__status-dot--${status}`)
}

/**
 * Assert connection bar message is visible.
 */
export function assertConnectionBar(visible: boolean): void {
  if (visible) {
    cy.get(PRESENCE_CONNECTION_BAR).should('be.visible')
  } else {
    cy.get(PRESENCE_CONNECTION_BAR).should('not.exist')
  }
}

/**
 * Assert remote cursor is visible for a user.
 */
export function assertRemoteCursor(displayName: string, options?: { faded?: boolean }): void {
  if (options?.faded) {
    cy.get(REMOTE_CURSOR_FADED).contains(displayName).should('exist')
  } else {
    cy.get(REMOTE_CURSOR).contains(displayName).should('be.visible')
  }
}

/**
 * Assert no remote cursors are visible.
 */
export function assertNoRemoteCursors(): void {
  cy.get(REMOTE_CURSOR).should('not.exist')
}

/**
 * Assert lock icon is visible on a stroke.
 */
export function assertLockIcon(displayName: string): void {
  cy.get(CONFLICT_LOCK)
    .filter(`[title*="${displayName}"]`)
    .should('exist')
}

/**
 * Assert concurrent edit toast is visible.
 */
export function assertConcurrentToast(visible: boolean): void {
  if (visible) {
    cy.get(CONFLICT_TOAST).should('be.visible')
  } else {
    cy.get(CONFLICT_TOAST).should('not.exist')
  }
}

/**
 * Assert area highlight is visible.
 */
export function assertAreaHighlight(count: number): void {
  cy.get(CONFLICT_AREA).should('have.length', count)
}

/**
 * Click follow button for a specific user.
 */
export function followUser(displayName: string): void {
  cy.get(PRESENCE_USER)
    .contains(displayName)
    .parents(PRESENCE_USER)
    .find(PRESENCE_FOLLOW_BTN)
    .click()
}

/**
 * Toggle presence panel collapse/expand.
 */
export function togglePresencePanel(): void {
  cy.get(PRESENCE_TOGGLE).click()
}

/**
 * Assert presence panel is collapsed.
 */
export function assertPanelCollapsed(): void {
  cy.get(PRESENCE_PANEL).should('have.class', 'wb-presence-panel--collapsed')
}

/**
 * Assert presence panel is expanded.
 */
export function assertPanelExpanded(): void {
  cy.get(PRESENCE_PANEL).should('not.have.class', 'wb-presence-panel--collapsed')
}

// ─── Accessibility Assertions ───────────────────────────────────────────────

/**
 * Assert presence panel has proper ARIA attributes.
 */
export function assertPresenceA11y(): void {
  cy.get(PRESENCE_PANEL).should('have.attr', 'role', 'region')
  cy.get(PRESENCE_PANEL).should('have.attr', 'aria-label')
  cy.get(PRESENCE_TOGGLE).should('have.attr', 'aria-expanded')
  cy.get(PRESENCE_TOGGLE).should('have.attr', 'aria-label')
}

/**
 * Assert screen reader live region exists.
 */
export function assertSrLiveRegion(): void {
  cy.get('[aria-live="assertive"]').should('exist')
  cy.get('[aria-live="polite"]').should('exist')
}

// ─── Selectors (exported for custom assertions) ─────────────────────────────

export const SELECTORS = {
  BOARD: BOARD_SELECTOR,
  PRESENCE_PANEL,
  PRESENCE_USER,
  PRESENCE_TOGGLE,
  PRESENCE_FOLLOW_BTN,
  PRESENCE_STATUS_DOT,
  PRESENCE_CONNECTION_BAR,
  CONFLICT_LOCK,
  CONFLICT_AREA,
  CONFLICT_TOAST,
  REMOTE_CURSOR,
  REMOTE_CURSOR_FADED,
  REMOTE_CURSOR_LABEL,
} as const
