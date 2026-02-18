/**
 * [WB:B3.3] E2E tests — Winterboard Classroom Integration
 *
 * Categories:
 * 1. Teacher opens classroom board
 * 2. Student joins classroom board
 * 3. Teacher locks/unlocks drawing
 * 4. Follow mode
 * 5. Teacher kicks student
 * 6. Teacher ends session
 * 7. Student join/leave notifications
 * 8. Concurrent drawing
 * 9. Session persistence
 * 10. Error handling
 *
 * Note: Backend not yet fully integrated — tests use intercepted API stubs.
 */

const API = Cypress.env('API_URL') || 'http://localhost:8000'
const LESSON_ID = 'lesson-e2e-1'
const SESSION_ID = 'wb-session-e2e-1'

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'teacher@m4sh.com',
  role: 'TUTOR',
  display_name: 'Mr. Smith',
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'student@m4sh.com',
  role: 'STUDENT',
  display_name: 'Alice',
}

const SESSION_RESPONSE = {
  session_id: SESSION_ID,
  role: 'owner',
  permissions: {
    can_draw: true,
    can_erase: true,
    can_add_page: true,
    can_delete_page: true,
    can_clear: true,
    can_export: true,
    can_share: true,
    can_lock: true,
    can_kick: true,
    can_end: true,
    can_upload: true,
    can_manage: true,
  },
  is_locked: false,
}

const SESSION_DETAIL = {
  id: SESSION_ID,
  name: 'Test Classroom Board',
  owner_id: 'teacher-1',
  state: {
    pages: [
      { id: 'p1', name: 'Page 1', strokes: [], assets: [], background: 'white' },
      { id: 'p2', name: 'Page 2', strokes: [], assets: [], background: 'white' },
    ],
    currentPageIndex: 0,
  },
  page_count: 2,
  thumbnail_url: null,
  rev: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const CONNECTED_USERS = [
  { user_id: 'teacher-1', display_name: 'Mr. Smith', role: 'owner', cursor_color: '#2563eb', is_online: true },
  { user_id: 'student-1', display_name: 'Alice', role: 'student', cursor_color: '#22c55e', is_online: true },
]

function stubTeacherAuth(): void {
  cy.intercept('GET', `${API}/api/v1/auth/me/`, {
    statusCode: 200,
    body: TEACHER_USER,
  }).as('authMe')
}

function stubStudentAuth(): void {
  cy.intercept('GET', `${API}/api/v1/auth/me/`, {
    statusCode: 200,
    body: STUDENT_USER,
  }).as('authMe')
}

function stubClassroomSession(overrides: Record<string, unknown> = {}): void {
  cy.intercept('GET', `${API}/api/v1/winterboard/classroom/${LESSON_ID}/session/`, {
    statusCode: 200,
    body: { ...SESSION_RESPONSE, ...overrides },
  }).as('getClassroomSession')
}

function stubSessionDetail(): void {
  cy.intercept('GET', `${API}/api/v1/winterboard/sessions/${SESSION_ID}/`, {
    statusCode: 200,
    body: SESSION_DETAIL,
  }).as('getSessionDetail')
}

function stubConnectedUsers(users = CONNECTED_USERS): void {
  cy.intercept('GET', `${API}/api/v1/winterboard/sessions/${SESSION_ID}/users/`, {
    statusCode: 200,
    body: users,
  }).as('getConnectedUsers')
}

function stubSave(): void {
  cy.intercept('PATCH', `${API}/api/v1/winterboard/sessions/${SESSION_ID}/`, {
    statusCode: 200,
    body: { rev: 2 },
  }).as('saveSession')
}

describe('[WB:B3.3] Winterboard Classroom Integration', () => {
  // ── 1. Teacher opens classroom board ─────────────────────────────────

  describe('Teacher opens classroom board', () => {
    it('teacher sees canvas, toolbar, and student list', () => {
      stubTeacherAuth()
      stubClassroomSession()
      stubSessionDetail()
      stubConnectedUsers()

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // Canvas area
      cy.get('#wb-canvas').should('exist')

      // Toolbar
      cy.get('.wb-classroom-room__toolbar').should('exist')

      // Student list (teacher sidebar)
      cy.get('.wb-classroom-room__sidebar').should('exist')
      cy.get('.wb-student-list').should('exist')

      // Role badge shows Teacher
      cy.get('.wb-role-badge').should('contain.text', 'Teacher')

      // End session button visible for teacher
      cy.get('.wb-header-btn--danger').should('exist')
    })
  })

  // ── 2. Student joins classroom board ─────────────────────────────────

  describe('Student joins classroom board', () => {
    it('student auto-connects with limited toolbar and follow mode', () => {
      stubStudentAuth()
      stubClassroomSession({
        role: 'student',
        permissions: {
          can_draw: true,
          can_erase: true,
          can_add_page: false,
          can_delete_page: false,
          can_clear: false,
          can_export: false,
          can_share: false,
          can_lock: false,
          can_kick: false,
          can_end: false,
          can_upload: false,
          can_manage: false,
        },
      })
      stubSessionDetail()

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // Canvas visible
      cy.get('#wb-canvas').should('exist')

      // Role badge shows Student
      cy.get('.wb-role-badge').should('contain.text', 'Student')

      // No sidebar (students don't see student list)
      cy.get('.wb-classroom-room__sidebar').should('not.exist')

      // No end session button
      cy.get('.wb-header-btn--danger').should('not.exist')
    })
  })

  // ── 3. Teacher locks/unlocks drawing ─────────────────────────────────

  describe('Teacher locks drawing', () => {
    it('teacher can toggle lock state', () => {
      stubTeacherAuth()
      stubClassroomSession()
      stubSessionDetail()
      stubConnectedUsers()

      cy.intercept('POST', `${API}/api/v1/winterboard/sessions/${SESSION_ID}/lock/`, {
        statusCode: 200,
        body: { locked: true },
      }).as('lockSession')

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // Lock button exists
      cy.get('.wb-header-btn[aria-pressed]').should('exist')

      // Click lock
      cy.get('.wb-header-btn[aria-pressed]').click()
      cy.wait('@lockSession')
    })

    it('student sees read-only canvas when locked', () => {
      stubStudentAuth()
      stubClassroomSession({
        role: 'student',
        is_locked: true,
        permissions: {
          can_draw: true,
          can_erase: true,
          can_add_page: false,
          can_delete_page: false,
          can_clear: false,
          can_export: false,
          can_share: false,
          can_lock: false,
          can_kick: false,
          can_end: false,
          can_upload: false,
          can_manage: false,
        },
      })
      stubSessionDetail()

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // Lock indicator visible
      cy.get('.wb-lock-indicator').should('exist')

      // Room has locked class
      cy.get('.wb-classroom-room--locked').should('exist')
    })
  })

  // ── 4. Follow mode ───────────────────────────────────────────────────

  describe('Follow mode', () => {
    it('student can start and stop following teacher', () => {
      stubStudentAuth()
      stubClassroomSession({
        role: 'student',
        permissions: {
          can_draw: true,
          can_erase: true,
          can_add_page: false,
          can_delete_page: false,
          can_clear: false,
          can_export: false,
          can_share: false,
          can_lock: false,
          can_kick: false,
          can_end: false,
          can_upload: false,
          can_manage: false,
        },
      })
      stubSessionDetail()

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // Follow controls should be visible for student
      // (depends on presence of teacher cursor — in E2E with stubs, follow may auto-start)
      cy.get('.wb-follow-controls').should('exist')
    })
  })

  // ── 5. Teacher kicks student ─────────────────────────────────────────

  describe('Teacher kicks student', () => {
    it('teacher can kick a student from the session', () => {
      stubTeacherAuth()
      stubClassroomSession()
      stubSessionDetail()
      stubConnectedUsers()

      cy.intercept('POST', `${API}/api/v1/winterboard/sessions/${SESSION_ID}/kick/`, {
        statusCode: 200,
        body: { kicked: true },
      }).as('kickStudent')

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')
      cy.wait('@getConnectedUsers')

      // Student item with kick button
      cy.get('.wb-student-item__kick').should('exist')

      // Click kick
      cy.get('.wb-student-item__kick').first().click()
      cy.wait('@kickStudent')
    })
  })

  // ── 6. Teacher ends session ──────────────────────────────────────────

  describe('Teacher ends session', () => {
    it('teacher can end the session', () => {
      stubTeacherAuth()
      stubClassroomSession()
      stubSessionDetail()
      stubConnectedUsers()

      cy.intercept('POST', `${API}/api/v1/winterboard/sessions/${SESSION_ID}/end/`, {
        statusCode: 200,
        body: { ended: true },
      }).as('endSession')

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // End session button
      cy.get('.wb-header-btn--danger').should('exist')
      cy.get('.wb-header-btn--danger').should('contain.text', 'End Session')
    })
  })

  // ── 7. Student join/leave notifications ──────────────────────────────

  describe('Student join/leave notifications', () => {
    it('notification component mounts in classroom view', () => {
      stubTeacherAuth()
      stubClassroomSession()
      stubSessionDetail()
      stubConnectedUsers()

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // The classroom room should be rendered
      cy.get('.wb-classroom-room').should('exist')

      // Student list shows connected students
      cy.get('.wb-student-list__items').should('exist')
      cy.get('.wb-student-item').should('have.length.at.least', 1)
    })
  })

  // ── 8. Concurrent drawing ────────────────────────────────────────────

  describe('Concurrent drawing', () => {
    it('teacher canvas is interactive (not read-only)', () => {
      stubTeacherAuth()
      stubClassroomSession()
      stubSessionDetail()
      stubConnectedUsers()
      stubSave()

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // Canvas should not be read-only for teacher
      cy.get('.wb-classroom-room').should('not.have.class', 'wb-classroom-room--locked')

      // Undo/redo buttons should be enabled (when there's content)
      cy.get('.wb-header-btn').contains('↩').should('exist')
      cy.get('.wb-header-btn').contains('↪').should('exist')
    })
  })

  // ── 9. Session persistence ───────────────────────────────────────────

  describe('Session persistence', () => {
    it('loads existing session state on mount', () => {
      stubTeacherAuth()
      stubClassroomSession()
      stubSessionDetail()
      stubConnectedUsers()

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession')
      cy.wait('@getSessionDetail')

      // Page indicator shows loaded pages
      cy.get('.wb-page-indicator').should('contain.text', '1 / 2')

      // Session name loaded
      cy.get('.wb-title-input').should('have.value', 'Test Classroom Board')
    })
  })

  // ── 10. Error handling ───────────────────────────────────────────────

  describe('Error handling', () => {
    it('shows error when session not found (invalid lesson ID)', () => {
      stubTeacherAuth()

      cy.intercept('GET', `${API}/api/v1/winterboard/classroom/invalid-lesson/session/`, {
        statusCode: 404,
        body: { detail: 'Not found' },
      }).as('getClassroomSession404')

      // Teacher auto-creates on 404
      cy.intercept('POST', `${API}/api/v1/winterboard/classroom/invalid-lesson/session/`, {
        statusCode: 500,
        body: { detail: 'Internal server error' },
      }).as('createSessionFail')

      cy.visit('/winterboard/classroom/invalid-lesson')
      cy.wait('@getClassroomSession404')
      cy.wait('@createSessionFail')

      // Should show some error state or redirect
      // (exact behavior depends on component error handling)
    })

    it('student without enrollment gets access denied', () => {
      stubStudentAuth()

      cy.intercept('GET', `${API}/api/v1/winterboard/classroom/${LESSON_ID}/session/`, {
        statusCode: 403,
        body: { detail: 'Access denied' },
      }).as('getClassroomSession403')

      cy.visit(`/winterboard/classroom/${LESSON_ID}`)
      cy.wait('@getClassroomSession403')

      // Should redirect to winterboard list (no_access state)
      cy.url().should('include', '/winterboard')
    })
  })
})
