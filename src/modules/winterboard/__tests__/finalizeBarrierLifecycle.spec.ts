// INV-22 PR-1b — single-flight + lifecycle integration tests
//
// Per helper review (2026-05-08):
//   2. FE-local single-flight guard — local `_finalizeAttemptInFlight` ref
//      prevents double-fired requests from double-clicks BEFORE BE 429 fires.
//   3. Modal lifecycle cleanup — `onBeforeUnmount` resets state refs and
//      guards in-flight promises from mutating dead refs.
//
// These are tested at HELPER level by simulating the guard pattern that
// the room views (Solo + Classroom) use. Full mount tests are heavy у JSDOM
// because of canvas / pinia / router setup; helper-level tests give us strong
// invariant coverage without the overhead.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

vi.mock('@/utils/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import apiClient from '@/utils/apiClient'
import {
  finalizeWithBarrier,
  FinalizeBarrierContentionError,
} from '../api/replay'

const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

function makeAxiosErrorLike(status: number, data: any) {
  const err = new Error('mock axios error') as any
  err.response = { status, data }
  err.isAxiosError = true
  return err
}

// Reusable single-flight pattern matching room implementation.
// Simulates _attemptFinalizeWithBarrier wrapper logic.
function makeAttemptFn(sid: string) {
  const inFlight = ref(false)
  const isMounted = ref(true)
  const stateChanges: string[] = []
  let resolve: (() => void) | null = null

  async function attempt(seq: number): Promise<unknown> {
    if (inFlight.value) {
      stateChanges.push('skipped:already-in-flight')
      return null
    }
    inFlight.value = true
    try {
      const res = await finalizeWithBarrier(sid, seq)
      if (!isMounted.value) {
        stateChanges.push('skipped:unmounted-after-resolve')
        return null
      }
      stateChanges.push('success')
      return res
    } catch (err) {
      if (!isMounted.value) {
        stateChanges.push('skipped:unmounted-after-reject')
        return null
      }
      if (err instanceof FinalizeBarrierContentionError) {
        stateChanges.push('contention')
        return null
      }
      stateChanges.push('error')
      throw err
    } finally {
      inFlight.value = false
      if (resolve) resolve()
    }
  }

  function unmount() {
    isMounted.value = false
  }
  function waitFinish(): Promise<void> {
    return new Promise((r) => { resolve = r })
  }

  return { attempt, inFlight, isMounted, stateChanges, unmount, waitFinish }
}

describe('INV-22 PR-1b — single-flight + lifecycle invariants', () => {
  beforeEach(() => {
    mockPost.mockReset()
  })

  // ── Single-flight ────────────────────────────────────────────────────

  it('single-flight: second attempt while first in-flight returns immediately (no extra POST)', async () => {
    let resolveFirst: (val: any) => void = () => {}
    const firstPromise = new Promise<any>((res) => { resolveFirst = res })
    mockPost.mockReturnValueOnce(firstPromise)

    const { attempt, stateChanges } = makeAttemptFn('sid-A')
    const p1 = attempt(10)
    // While p1 still pending, fire second — should be skipped.
    const p2 = attempt(10)
    expect(stateChanges).toContain('skipped:already-in-flight')
    // Resolve first attempt.
    resolveFirst({
      status: 'finalized', recording_state: 'finalized',
      recording_stopped_at: '2026-05-08T00:00:00Z',
      recording_stopped_seq: 10, is_replay_frozen: true,
      replay_id: 'r1',
    })
    await Promise.all([p1, p2])
    // Single POST despite 2 attempt() calls.
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(stateChanges).toEqual(['skipped:already-in-flight', 'success'])
  })

  it('single-flight: guard releases on success — next attempt can fire new request', async () => {
    mockPost
      .mockResolvedValueOnce({
        status: 'finalized', recording_state: 'finalized',
        recording_stopped_at: '2026-05-08T00:00:00Z',
        recording_stopped_seq: 10, is_replay_frozen: true,
        replay_id: 'r1',
      })
      .mockResolvedValueOnce({
        status: 'finalized', recording_state: 'finalized',
        recording_stopped_at: '2026-05-08T00:00:00Z',
        recording_stopped_seq: 20, is_replay_frozen: true,
        replay_id: 'r2',
      })

    const { attempt, inFlight, stateChanges } = makeAttemptFn('sid-B')
    await attempt(10)
    expect(inFlight.value).toBe(false)
    await attempt(20)
    expect(mockPost).toHaveBeenCalledTimes(2)
    expect(stateChanges).toEqual(['success', 'success'])
  })

  it('single-flight: guard releases on error path too', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosErrorLike(429, {
      error: 'FINALIZE_ALREADY_PENDING',
      retry_after_ms: 5000,
    }))

    const { attempt, inFlight } = makeAttemptFn('sid-C')
    await attempt(10)
    // Even after contention error, in-flight guard cleared.
    expect(inFlight.value).toBe(false)
  })

  // ── Lifecycle (post-unmount safety) ──────────────────────────────────

  it('lifecycle: state mutation skipped when unmounted before resolve', async () => {
    let resolvePost: (val: any) => void = () => {}
    mockPost.mockReturnValueOnce(new Promise((res) => { resolvePost = res }))

    const { attempt, stateChanges, unmount } = makeAttemptFn('sid-D')
    const p = attempt(10)
    // Simulate user navigating away (route change) while request у flight.
    unmount()
    // Now resolve POST — should NOT cause 'success' state change.
    resolvePost({
      status: 'finalized', recording_state: 'finalized',
      recording_stopped_at: '2026-05-08T00:00:00Z',
      recording_stopped_seq: 10, is_replay_frozen: true,
      replay_id: 'r1',
    })
    await p
    expect(stateChanges).toContain('skipped:unmounted-after-resolve')
    expect(stateChanges).not.toContain('success')
  })

  it('lifecycle: state mutation skipped when unmounted before reject', async () => {
    let rejectPost: (val: any) => void = () => {}
    mockPost.mockReturnValueOnce(new Promise((_res, rej) => { rejectPost = rej }))

    const { attempt, stateChanges, unmount } = makeAttemptFn('sid-E')
    const p = attempt(10)
    unmount()
    rejectPost(makeAxiosErrorLike(504, {
      error: 'APPLY_BACKLOG_TIMEOUT',
      expected_seq: 10, current_seq: 5, waited_ms: 10000,
    }))
    await p
    expect(stateChanges).toContain('skipped:unmounted-after-reject')
    expect(stateChanges).not.toContain('error')
  })
})
