// WB: Unit tests for useSessionLifecycle composable (Phase 3: A3.3)
// Tests: lesson start/end, student join/leave, reconnect, tab lock, kick, WS messages

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// ── Mock winterboardApi ─────────────────────────────────────────────────

vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    beaconSave: vi.fn(() => true),
  },
}))

// ── Mock vue lifecycle ──────────────────────────────────────────────────

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...(actual as Record<string, unknown>),
    onBeforeUnmount: vi.fn(),
  }
})

// ── Mock localStorage ───────────────────────────────────────────────────

const localStorageMock: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value }),
  removeItem: vi.fn((key: string) => { delete localStorageMock[key] }),
})

import { useSessionLifecycle } from '../composables/useSessionLifecycle'
import type { WBClassroomRole } from '../api/winterboardApi'

// ── Tests ───────────────────────────────────────────────────────────────

describe('useSessionLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    // Clear localStorage mock
    for (const key of Object.keys(localStorageMock)) {
      delete localStorageMock[key]
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts in idle state', () => {
    const sessionId = ref<string | null>(null)
    const role = ref<WBClassroomRole | null>(null)
    const lifecycle = useSessionLifecycle(sessionId, role)

    expect(lifecycle.state.value).toBe('idle')
    expect(lifecycle.error.value).toBeNull()
  })

  it('onLessonStart transitions to active', () => {
    const sessionId = ref<string | null>('sess-1')
    const role = ref<WBClassroomRole | null>('host')
    const onReady = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onSessionReady: onReady })

    const connectFn = vi.fn().mockResolvedValue(true)
    const getStateFn = vi.fn().mockReturnValue({ pages: [] })

    const result = lifecycle.onLessonStart('sess-1', connectFn, getStateFn)

    expect(result).toBe(true)
    expect(lifecycle.state.value).toBe('active')
    expect(onReady).toHaveBeenCalledWith('sess-1')
  })

  it('onLessonEnd transitions to ended and calls save', async () => {
    const sessionId = ref<string | null>('sess-2')
    const role = ref<WBClassroomRole | null>('host')
    const onEnded = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onSessionEnded: onEnded })

    const saveFn = vi.fn().mockResolvedValue(undefined)

    await lifecycle.onLessonEnd(saveFn)

    expect(lifecycle.state.value).toBe('ended')
    expect(saveFn).toHaveBeenCalled()
    expect(onEnded).toHaveBeenCalled()
  })

  it('onStudentJoin calls callback', () => {
    const sessionId = ref<string | null>('sess-3')
    const role = ref<WBClassroomRole | null>('host')
    const onJoined = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onStudentJoined: onJoined })

    lifecycle.onStudentJoin('student-1')

    expect(onJoined).toHaveBeenCalledWith('student-1')
  })

  it('onStudentLeave calls callback', () => {
    const sessionId = ref<string | null>('sess-4')
    const role = ref<WBClassroomRole | null>('host')
    const onLeft = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onStudentLeft: onLeft })

    lifecycle.onStudentLeave('student-2')

    expect(onLeft).toHaveBeenCalledWith('student-2')
  })

  it('onKicked transitions to ended and calls callback', () => {
    const sessionId = ref<string | null>('sess-5')
    const role = ref<WBClassroomRole | null>('student')
    const onKicked = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onKicked })

    lifecycle.onKicked()

    expect(lifecycle.state.value).toBe('ended')
    expect(lifecycle.error.value).toContain('removed')
    expect(onKicked).toHaveBeenCalled()
  })

  it('onLockChanged calls callback', () => {
    const sessionId = ref<string | null>('sess-6')
    const role = ref<WBClassroomRole | null>('student')
    const onLock = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onLockChanged: onLock })

    lifecycle.onLockChanged(true)

    expect(onLock).toHaveBeenCalledWith(true)
  })

  it('onDisconnect starts reconnect loop', async () => {
    const sessionId = ref<string | null>('sess-7')
    const role = ref<WBClassroomRole | null>('host')
    const onReconnected = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onReconnected })

    const connectFn = vi.fn()
      .mockResolvedValueOnce(false) // first attempt fails
      .mockResolvedValueOnce(true) // second attempt succeeds

    lifecycle.onDisconnect(connectFn)

    expect(lifecycle.state.value).toBe('reconnecting')
    expect(lifecycle.reconnectAttempts.value).toBe(1)

    // First attempt (2000ms delay)
    await vi.advanceTimersByTimeAsync(2000)
    expect(connectFn).toHaveBeenCalledTimes(1)

    // Second attempt (3000ms delay = 2000 * 1.5)
    await vi.advanceTimersByTimeAsync(3000)
    expect(connectFn).toHaveBeenCalledTimes(2)
    expect(lifecycle.state.value).toBe('active')
    expect(lifecycle.reconnectAttempts.value).toBe(0)
    expect(onReconnected).toHaveBeenCalled()
  })

  it('handleSessionMessage dispatches session.lock', () => {
    const sessionId = ref<string | null>('sess-8')
    const role = ref<WBClassroomRole | null>('student')
    const onLock = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onLockChanged: onLock })

    lifecycle.handleSessionMessage({ type: 'session.lock', payload: { locked: true } })

    expect(onLock).toHaveBeenCalledWith(true)
  })

  it('handleSessionMessage dispatches session.end', async () => {
    const sessionId = ref<string | null>('sess-9')
    const role = ref<WBClassroomRole | null>('student')
    const onEnded = vi.fn()
    const lifecycle = useSessionLifecycle(sessionId, role, { onSessionEnded: onEnded })

    lifecycle.handleSessionMessage({ type: 'session.end' })

    // onLessonEnd is async — wait for microtasks
    await vi.advanceTimersByTimeAsync(0)
    expect(lifecycle.state.value).toBe('ended')
  })

  it('reset clears all state', () => {
    const sessionId = ref<string | null>('sess-10')
    const role = ref<WBClassroomRole | null>('host')
    const lifecycle = useSessionLifecycle(sessionId, role)

    lifecycle.onLessonStart('sess-10', vi.fn().mockResolvedValue(true), vi.fn())
    expect(lifecycle.state.value).toBe('active')

    lifecycle.reset()

    expect(lifecycle.state.value).toBe('idle')
    expect(lifecycle.reconnectAttempts.value).toBe(0)
    expect(lifecycle.error.value).toBeNull()
  })

  it('tab lock prevents duplicate sessions', () => {
    const sessionId = ref<string | null>('sess-11')
    const role = ref<WBClassroomRole | null>('host')

    // Simulate another tab holding the lock
    localStorageMock[`wb:classroom:active-tab:sess-11`] = JSON.stringify({
      tabId: 'other-tab',
      ts: Date.now(),
    })

    const lifecycle = useSessionLifecycle(sessionId, role)
    const result = lifecycle.onLessonStart(
      'sess-11',
      vi.fn().mockResolvedValue(true),
      vi.fn(),
    )

    expect(result).toBe(false)
    expect(lifecycle.state.value).toBe('error')
    expect(lifecycle.error.value).toContain('another tab')
  })

  it('expired tab lock allows new session', () => {
    const sessionId = ref<string | null>('sess-12')
    const role = ref<WBClassroomRole | null>('host')

    // Simulate expired lock (>10s old)
    localStorageMock[`wb:classroom:active-tab:sess-12`] = JSON.stringify({
      tabId: 'old-tab',
      ts: Date.now() - 15_000,
    })

    const lifecycle = useSessionLifecycle(sessionId, role)
    const result = lifecycle.onLessonStart(
      'sess-12',
      vi.fn().mockResolvedValue(true),
      vi.fn(),
    )

    expect(result).toBe(true)
    expect(lifecycle.state.value).toBe('active')
  })
})
