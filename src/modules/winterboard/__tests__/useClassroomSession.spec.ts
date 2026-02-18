// WB: Unit tests for useClassroomSession + useClassroomRole (Phase 3: A3.1)
// Tests: session init, role resolution, permissions, lock, error states

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// ── Mock winterboardApi ─────────────────────────────────────────────────

const mockGetClassroomSession = vi.fn()
const mockCreateClassroomSession = vi.fn()
const mockGetSessionRole = vi.fn()
const mockGetConnectedUsers = vi.fn()
const mockLockSession = vi.fn()
const mockKickStudent = vi.fn()
const mockEndSession = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    getClassroomSession: (...args: unknown[]) => mockGetClassroomSession(...args),
    createClassroomSession: (...args: unknown[]) => mockCreateClassroomSession(...args),
    getSessionRole: (...args: unknown[]) => mockGetSessionRole(...args),
    getConnectedUsers: (...args: unknown[]) => mockGetConnectedUsers(...args),
    lockSession: (...args: unknown[]) => mockLockSession(...args),
    kickStudent: (...args: unknown[]) => mockKickStudent(...args),
    endSession: (...args: unknown[]) => mockEndSession(...args),
  },
}))

import { useClassroomSession } from '../composables/useClassroomSession'
import { useClassroomRole, DEFAULT_PERMISSIONS, OWNER_PERMISSIONS } from '../composables/useClassroomRole'

// ── Fixtures ────────────────────────────────────────────────────────────

const TEACHER_PERMISSIONS = {
  can_draw: true, can_erase: true, can_add_page: true,
  can_delete_page: true, can_clear: true, can_export: true,
  can_share: true, can_lock: true, can_kick: true,
  can_end: true, can_upload: true, can_manage: true,
}

const STUDENT_PERMISSIONS = {
  can_draw: true, can_erase: true, can_add_page: false,
  can_delete_page: false, can_clear: false, can_export: false,
  can_share: false, can_lock: false, can_kick: false,
  can_end: false, can_upload: true, can_manage: false,
}

const VIEWER_PERMISSIONS = {
  can_draw: false, can_erase: false, can_add_page: false,
  can_delete_page: false, can_clear: false, can_export: true,
  can_share: false, can_lock: false, can_kick: false,
  can_end: false, can_upload: false, can_manage: false,
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('useClassroomSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes session from existing classroom session', async () => {
    mockGetClassroomSession.mockResolvedValue({
      session_id: 'sess-1',
      role: 'host',
      permissions: TEACHER_PERMISSIONS,
      is_locked: false,
      locked_by: null,
    })

    const session = useClassroomSession()
    const result = await session.initClassroomSession('lesson-1')

    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe('sess-1')
    expect(result!.role).toBe('host')
    expect(result!.permissions.can_lock).toBe(true)
    expect(result!.isLocked).toBe(false)
    expect(session.state.value).toBe('ready')
    expect(session.sessionId.value).toBe('sess-1')
  })

  it('auto-creates session when 404 (teacher)', async () => {
    mockGetClassroomSession.mockRejectedValue(
      Object.assign(new Error('Not Found'), { response: { status: 404 } }),
    )
    mockCreateClassroomSession.mockResolvedValue({
      session_id: 'sess-new',
      role: 'host',
      permissions: TEACHER_PERMISSIONS,
      is_locked: false,
      locked_by: null,
    })

    const session = useClassroomSession()
    const result = await session.initClassroomSession('lesson-2')

    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe('sess-new')
    expect(mockCreateClassroomSession).toHaveBeenCalledWith('lesson-2')
  })

  it('returns null with error when student tries to create (403)', async () => {
    mockGetClassroomSession.mockRejectedValue(
      Object.assign(new Error('Not Found'), { response: { status: 404 } }),
    )
    mockCreateClassroomSession.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
    )

    const session = useClassroomSession()
    const result = await session.initClassroomSession('lesson-3')

    expect(result).toBeNull()
    expect(session.state.value).toBe('error')
    expect(session.error.value).toContain('Waiting for teacher')
  })

  it('handles 403 access denied', async () => {
    mockGetClassroomSession.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
    )

    const session = useClassroomSession()
    const result = await session.initClassroomSession('lesson-4')

    expect(result).toBeNull()
    expect(session.state.value).toBe('no_access')
  })

  it('tracks locked state', async () => {
    mockGetClassroomSession.mockResolvedValue({
      session_id: 'sess-5',
      role: 'student',
      permissions: STUDENT_PERMISSIONS,
      is_locked: true,
      locked_by: 'teacher-1',
    })

    const session = useClassroomSession()
    await session.initClassroomSession('lesson-5')

    expect(session.isLocked.value).toBe(true)

    session.setLocked(false)
    expect(session.isLocked.value).toBe(false)
  })

  it('reset clears all state', async () => {
    mockGetClassroomSession.mockResolvedValue({
      session_id: 'sess-6',
      role: 'host',
      permissions: TEACHER_PERMISSIONS,
      is_locked: false,
      locked_by: null,
    })

    const session = useClassroomSession()
    await session.initClassroomSession('lesson-6')

    session.reset()

    expect(session.state.value).toBe('idle')
    expect(session.sessionId.value).toBeNull()
    expect(session.role.value).toBeNull()
  })
})

describe('useClassroomRole', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts with default (no permissions)', () => {
    const sessionId = ref<string | null>(null)
    const role = useClassroomRole(sessionId)

    expect(role.role.value).toBeNull()
    expect(role.canDraw.value).toBe(false)
    expect(role.isTeacher.value).toBe(false)
    expect(role.isStudent.value).toBe(false)
  })

  it('setRole applies teacher permissions', () => {
    const sessionId = ref<string | null>('sess-1')
    const role = useClassroomRole(sessionId)

    role.setRole('host', TEACHER_PERMISSIONS)

    expect(role.role.value).toBe('host')
    expect(role.isTeacher.value).toBe(true)
    expect(role.isStudent.value).toBe(false)
    expect(role.canDraw.value).toBe(true)
    expect(role.canLock.value).toBe(true)
    expect(role.canKick.value).toBe(true)
    expect(role.canEnd.value).toBe(true)
    expect(role.canAddPage.value).toBe(true)
    expect(role.canExport.value).toBe(true)
  })

  it('setRole applies student permissions', () => {
    const sessionId = ref<string | null>('sess-2')
    const role = useClassroomRole(sessionId)

    role.setRole('student', STUDENT_PERMISSIONS)

    expect(role.role.value).toBe('student')
    expect(role.isTeacher.value).toBe(false)
    expect(role.isStudent.value).toBe(true)
    expect(role.canDraw.value).toBe(true)
    expect(role.canLock.value).toBe(false)
    expect(role.canKick.value).toBe(false)
    expect(role.canEnd.value).toBe(false)
    expect(role.canAddPage.value).toBe(false)
    expect(role.canClear.value).toBe(false)
  })

  it('setRole applies viewer permissions', () => {
    const sessionId = ref<string | null>('sess-3')
    const role = useClassroomRole(sessionId)

    role.setRole('viewer', VIEWER_PERMISSIONS)

    expect(role.role.value).toBe('viewer')
    expect(role.isViewer.value).toBe(true)
    expect(role.canDraw.value).toBe(false)
    expect(role.canExport.value).toBe(true)
  })

  it('setRole without permissions defaults to full for owner', () => {
    const sessionId = ref<string | null>('sess-4')
    const role = useClassroomRole(sessionId)

    role.setRole('owner')

    expect(role.isOwner.value).toBe(true)
    expect(role.isTeacher.value).toBe(true)
    expect(role.canDraw.value).toBe(true)
    expect(role.canManage.value).toBe(true)
  })

  it('fetchRole calls API and applies result', async () => {
    mockGetSessionRole.mockResolvedValue({
      role: 'student',
      permissions: STUDENT_PERMISSIONS,
    })

    const sessionId = ref<string | null>('sess-5')
    const role = useClassroomRole(sessionId)

    await role.fetchRole()

    expect(mockGetSessionRole).toHaveBeenCalledWith('sess-5')
    expect(role.role.value).toBe('student')
    expect(role.canDraw.value).toBe(true)
    expect(role.canLock.value).toBe(false)
  })

  it('fetchRole handles 403 gracefully', async () => {
    mockGetSessionRole.mockRejectedValue(
      Object.assign(new Error('Forbidden'), { response: { status: 403 } }),
    )

    const sessionId = ref<string | null>('sess-6')
    const role = useClassroomRole(sessionId)

    await role.fetchRole()

    expect(role.role.value).toBeNull()
    expect(role.error.value).toBe('Access denied')
    expect(role.canDraw.value).toBe(false)
  })

  it('reset clears role and permissions', () => {
    const sessionId = ref<string | null>('sess-7')
    const role = useClassroomRole(sessionId)

    role.setRole('host', TEACHER_PERMISSIONS)
    expect(role.canDraw.value).toBe(true)

    role.reset()

    expect(role.role.value).toBeNull()
    expect(role.canDraw.value).toBe(false)
  })
})
