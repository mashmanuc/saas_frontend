// WB: Unit tests for useTeacherControls composable (Phase 3: A3.2)
// Tests: lock toggle, kick, end session, page sync, WS broadcast, error handling

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// ── Mock winterboardApi ─────────────────────────────────────────────────

const mockLockSession = vi.fn()
const mockKickStudent = vi.fn()
const mockEndSession = vi.fn()

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    lockSession: (...args: unknown[]) => mockLockSession(...args),
    kickStudent: (...args: unknown[]) => mockKickStudent(...args),
    endSession: (...args: unknown[]) => mockEndSession(...args),
  },
}))

import { useTeacherControls } from '../composables/useTeacherControls'
import type { WBSessionMessage } from '../composables/useTeacherControls'

// ── Tests ───────────────────────────────────────────────────────────────

describe('useTeacherControls', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── lockDrawing ─────────────────────────────────────────────────────

  describe('lockDrawing', () => {
    it('locks session and broadcasts WS message', async () => {
      mockLockSession.mockResolvedValue({
        locked: true,
        locked_by: 'teacher-1',
        locked_at: '2026-02-18T10:00:00Z',
      })

      const wsSend = vi.fn()
      const sessionId = ref<string | null>('sess-1')
      const controls = useTeacherControls(sessionId, wsSend)

      const result = await controls.lockDrawing(true)

      expect(result).toBe(true)
      expect(controls.isLocked.value).toBe(true)
      expect(mockLockSession).toHaveBeenCalledWith('sess-1', true)
      expect(wsSend).toHaveBeenCalledWith({
        type: 'session.lock',
        payload: { locked: true, locked_by: 'teacher-1' },
      })
    })

    it('unlocks session and broadcasts', async () => {
      mockLockSession.mockResolvedValue({
        locked: false,
        locked_by: null,
        locked_at: null,
      })

      const wsSend = vi.fn()
      const sessionId = ref<string | null>('sess-2')
      const controls = useTeacherControls(sessionId, wsSend)

      const result = await controls.lockDrawing(false)

      expect(result).toBe(true)
      expect(controls.isLocked.value).toBe(false)
      expect(wsSend).toHaveBeenCalledWith({
        type: 'session.lock',
        payload: { locked: false, locked_by: null },
      })
    })

    it('handles API error gracefully', async () => {
      mockLockSession.mockRejectedValue(new Error('Network error'))

      const sessionId = ref<string | null>('sess-3')
      const controls = useTeacherControls(sessionId)

      const result = await controls.lockDrawing(true)

      expect(result).toBe(false)
      expect(controls.lastError.value).toContain('lock')
    })

    it('returns false when no sessionId', async () => {
      const sessionId = ref<string | null>(null)
      const controls = useTeacherControls(sessionId)

      const result = await controls.lockDrawing(true)

      expect(result).toBe(false)
      expect(mockLockSession).not.toHaveBeenCalled()
    })
  })

  // ── setActivePage ───────────────────────────────────────────────────

  describe('setActivePage', () => {
    it('broadcasts page change via WS', () => {
      const wsSend = vi.fn()
      const sessionId = ref<string | null>('sess-4')
      const controls = useTeacherControls(sessionId, wsSend)

      controls.setActivePage(3)

      expect(controls.activePage.value).toBe(3)
      expect(wsSend).toHaveBeenCalledWith({
        type: 'session.page',
        payload: { pageIndex: 3 },
      })
    })

    it('works without WS (no crash)', () => {
      const sessionId = ref<string | null>('sess-5')
      const controls = useTeacherControls(sessionId)

      controls.setActivePage(1)

      expect(controls.activePage.value).toBe(1)
    })
  })

  // ── kickStudent ─────────────────────────────────────────────────────

  describe('kickStudent', () => {
    it('kicks student and broadcasts WS message', async () => {
      mockKickStudent.mockResolvedValue(undefined)

      const wsSend = vi.fn()
      const sessionId = ref<string | null>('sess-6')
      const controls = useTeacherControls(sessionId, wsSend)

      const result = await controls.kickStudent('student-1')

      expect(result).toBe(true)
      expect(mockKickStudent).toHaveBeenCalledWith('sess-6', 'student-1')
      expect(wsSend).toHaveBeenCalledWith({
        type: 'session.kick',
        payload: { userId: 'student-1' },
      })
    })

    it('handles kick API error', async () => {
      mockKickStudent.mockRejectedValue(new Error('Forbidden'))

      const sessionId = ref<string | null>('sess-7')
      const controls = useTeacherControls(sessionId)

      const result = await controls.kickStudent('student-2')

      expect(result).toBe(false)
      expect(controls.lastError.value).toContain('kick')
    })
  })

  // ── endSession ──────────────────────────────────────────────────────

  describe('endSession', () => {
    it('ends session and broadcasts WS message', async () => {
      mockEndSession.mockResolvedValue(undefined)

      const wsSend = vi.fn()
      const sessionId = ref<string | null>('sess-8')
      const controls = useTeacherControls(sessionId, wsSend)

      const result = await controls.endSession()

      expect(result).toBe(true)
      expect(mockEndSession).toHaveBeenCalledWith('sess-8')
      expect(wsSend).toHaveBeenCalledWith({
        type: 'session.end',
        payload: { sessionId: 'sess-8' },
      })
    })

    it('handles end session API error', async () => {
      mockEndSession.mockRejectedValue(new Error('Server error'))

      const sessionId = ref<string | null>('sess-9')
      const controls = useTeacherControls(sessionId)

      const result = await controls.endSession()

      expect(result).toBe(false)
      expect(controls.lastError.value).toContain('end')
    })
  })

  // ── State management ────────────────────────────────────────────────

  describe('state management', () => {
    it('setInitialState applies lock and page', () => {
      const sessionId = ref<string | null>('sess-10')
      const controls = useTeacherControls(sessionId)

      controls.setInitialState(true, 5)

      expect(controls.isLocked.value).toBe(true)
      expect(controls.activePage.value).toBe(5)
    })

    it('reset clears all state', async () => {
      mockLockSession.mockResolvedValue({ locked: true, locked_by: 't1', locked_at: 'now' })

      const sessionId = ref<string | null>('sess-11')
      const controls = useTeacherControls(sessionId)

      await controls.lockDrawing(true)
      controls.setActivePage(3)

      controls.reset()

      expect(controls.isLocked.value).toBe(false)
      expect(controls.activePage.value).toBe(0)
      expect(controls.lastError.value).toBeNull()
    })
  })
})
