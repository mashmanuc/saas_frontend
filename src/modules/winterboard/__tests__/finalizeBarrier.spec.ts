// INV-22 PR-1b — finalizeWithBarrier helper tests
//
// Per FIRST_FIX_SPRINT_PROPOSAL §1 + OPS_SYNC_SSOT.md INV-22 §22.7-22.8:
//   5 required FE tests:
//     1. no DESYNC on 429
//     2. no DESYNC on 504
//     3. no auto retry
//     4. double-click finalize (single API call per attempt)
//     5. finalize success path
//
// HARD invariant: 429 / 504 from finalize endpoint MUST NOT trigger DESYNC
// (per §22.7). Operational state ≠ consistency corruption.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock apiClient BEFORE importing replay.ts (vi hoists vi.mock).
vi.mock('@/utils/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}))

import apiClient from '@/utils/apiClient'
import {
  finalizeWithBarrier,
  FinalizeBarrierTimeoutError,
  FinalizeBarrierContentionError,
  FinalizeBarrierContractError,
} from '../api/replay'

const mockPost = apiClient.post as unknown as ReturnType<typeof vi.fn>

function makeAxiosErrorLike(status: number, data: any) {
  const err = new Error('mock axios error') as any
  err.response = { status, data }
  err.isAxiosError = true
  return err
}

describe('INV-22 PR-1b — finalizeWithBarrier', () => {
  const SID = 'test-session-uuid'

  beforeEach(() => {
    mockPost.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── Test 5: success path (positive baseline) ───────────────────────────

  it('test_finalize_success_path — 200 returns FinalizeRecordingResult', async () => {
    const expected = {
      status: 'finalized' as const,
      recording_state: 'finalized' as const,
      recording_stopped_at: '2026-05-08T00:00:00Z',
      recording_stopped_seq: 100,
      is_replay_frozen: true,
      replay_id: 'replay-uuid',
    }
    mockPost.mockResolvedValueOnce(expected)

    const result = await finalizeWithBarrier(SID, 100)

    expect(result).toEqual(expected)
    expect(mockPost).toHaveBeenCalledTimes(1)
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining(`/sessions/${SID}/finalize-recording/`),
      { flushed_last_seq: 100 },
      expect.objectContaining({ _finalizeBarrierToastSuppressed: true }),
    )
  })

  // ── Test 1: no DESYNC on 429 ──────────────────────────────────────────

  it('test_no_desync_on_429 — 429 throws FinalizeBarrierContentionError, NOT DesyncError', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosErrorLike(429, {
      error: 'FINALIZE_ALREADY_PENDING',
      retry_after_ms: 8000,
    }))

    try {
      await finalizeWithBarrier(SID, 100)
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(FinalizeBarrierContentionError)
      // INV-22 §22.7 hard rule: 429 must NOT route to DESYNC. The thrown
      // error class must NOT extend DesyncError у any way.
      expect((err as Error).constructor.name).toBe('FinalizeBarrierContentionError')
      expect((err as Error).constructor.name).not.toBe('DesyncError')
      expect((err as FinalizeBarrierContentionError).retry_after_ms).toBe(8000)
    }
    // Single attempt — no auto retry (LAW §12 + INV-22 §22.7).
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  // ── Test 2: no DESYNC on 504 ──────────────────────────────────────────

  it('test_no_desync_on_504 — 504 throws FinalizeBarrierTimeoutError, NOT DesyncError', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosErrorLike(504, {
      error: 'APPLY_BACKLOG_TIMEOUT',
      expected_seq: 100,
      current_seq: 87,
      waited_ms: 10000,
    }))

    try {
      await finalizeWithBarrier(SID, 100)
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(FinalizeBarrierTimeoutError)
      expect((err as Error).constructor.name).toBe('FinalizeBarrierTimeoutError')
      expect((err as Error).constructor.name).not.toBe('DesyncError')
      const e = err as FinalizeBarrierTimeoutError
      expect(e.expected_seq).toBe(100)
      expect(e.current_seq).toBe(87)
      expect(e.waited_ms).toBe(10000)
    }
  })

  it('test_no_desync_on_504 — apiClient gets _finalizeBarrierToastSuppressed=true', async () => {
    // Suppress generic 5xx toast: caller has its own blocking modal UX.
    mockPost.mockRejectedValueOnce(makeAxiosErrorLike(504, {
      error: 'APPLY_BACKLOG_TIMEOUT',
      expected_seq: 50, current_seq: 40, waited_ms: 10000,
    }))
    await finalizeWithBarrier(SID, 50).catch(() => {})

    expect(mockPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ _finalizeBarrierToastSuppressed: true }),
    )
  })

  // ── Test 3: no auto retry ──────────────────────────────────────────────

  it('test_no_auto_retry — 504 fires EXACTLY ONE apiClient.post call (no internal retry)', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosErrorLike(504, {
      error: 'APPLY_BACKLOG_TIMEOUT',
      expected_seq: 10, current_seq: 5, waited_ms: 10000,
    }))

    await finalizeWithBarrier(SID, 10).catch(() => {})

    // LAW §12 + INV-22 §22.7: helper must NOT auto-retry on 504. User-driven
    // retry only (caller decides via UI action).
    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  it('test_no_auto_retry — 429 fires EXACTLY ONE apiClient.post call', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosErrorLike(429, {
      error: 'FINALIZE_ALREADY_PENDING',
      retry_after_ms: 5000,
    }))

    await finalizeWithBarrier(SID, 10).catch(() => {})

    expect(mockPost).toHaveBeenCalledTimes(1)
  })

  // ── Test 4: double-click finalize (concurrent calls) ──────────────────

  it('test_double_click_finalize — two simultaneous calls each fire single POST', async () => {
    // Simulate user double-clicking. BE will return 429 to one of them
    // (server SETNX guard); helper does NOT coalesce client-side. Each call
    // gets its own POST + its own response. UI layer (room view) is the one
    // that prevents double-clicks via isRecordingLoading guard.
    mockPost
      .mockResolvedValueOnce({
        status: 'finalized', recording_state: 'finalized',
        recording_stopped_at: '2026-05-08T00:00:00Z',
        recording_stopped_seq: 50, is_replay_frozen: true,
        replay_id: 'replay-1',
      })
      .mockRejectedValueOnce(makeAxiosErrorLike(429, {
        error: 'FINALIZE_ALREADY_PENDING',
        retry_after_ms: 12000,
      }))

    const [r1, r2] = await Promise.allSettled([
      finalizeWithBarrier(SID, 50),
      finalizeWithBarrier(SID, 50),
    ])

    expect(r1.status).toBe('fulfilled')
    expect(r2.status).toBe('rejected')
    if (r2.status === 'rejected') {
      expect(r2.reason).toBeInstanceOf(FinalizeBarrierContentionError)
    }
    expect(mockPost).toHaveBeenCalledTimes(2)
  })

  // ── Bonus: contract error (programmer mistake / FE-BE drift) ─────────

  it('rejects negative flushed_last_seq locally (no API call)', async () => {
    await expect(finalizeWithBarrier(SID, -1)).rejects.toBeInstanceOf(FinalizeBarrierContractError)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('rejects non-integer flushed_last_seq locally (no API call)', async () => {
    await expect(finalizeWithBarrier(SID, 1.5 as any)).rejects.toBeInstanceOf(FinalizeBarrierContractError)
    expect(mockPost).not.toHaveBeenCalled()
  })

  it('translates 400 FLUSHED_SEQ_REQUIRED into FinalizeBarrierContractError', async () => {
    mockPost.mockRejectedValueOnce(makeAxiosErrorLike(400, {
      error: 'FLUSHED_SEQ_REQUIRED',
      detail: 'flushed_last_seq integer is required',
    }))
    await expect(finalizeWithBarrier(SID, 0)).rejects.toBeInstanceOf(FinalizeBarrierContractError)
  })

  it('passes through unrelated errors (e.g. network 500) without translation', async () => {
    const networkErr = makeAxiosErrorLike(500, { error: 'INTERNAL' })
    mockPost.mockRejectedValueOnce(networkErr)
    try {
      await finalizeWithBarrier(SID, 0)
      throw new Error('expected throw')
    } catch (err) {
      // Should not become any of the typed barrier errors — caller handles
      // via legacy fallback (network/auth/500).
      expect(err).not.toBeInstanceOf(FinalizeBarrierTimeoutError)
      expect(err).not.toBeInstanceOf(FinalizeBarrierContentionError)
      expect(err).not.toBeInstanceOf(FinalizeBarrierContractError)
      expect(err).toBe(networkErr)
    }
  })
})
