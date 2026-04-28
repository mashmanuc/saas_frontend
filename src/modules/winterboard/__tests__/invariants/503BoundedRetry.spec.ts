/**
 * Phase 2 Section F (2026-04-27) — INV-12 503 BOUNDED RETRY semantics.
 *
 * Each test maps до specific behavior + catches production failure mode.
 *
 * Invariants covered (current Phase 2 scope):
 *   INV-12 partial — 503 SERVER_BUSY does NOT enter DESYNC (transient backpressure)
 *                  — inFlightOps preserved для next flush attempt (no data loss)
 *                  — flush() throws to caller (NOT silent — caller decides)
 *
 * GAP: "max 2 attempts + jitter 100-500ms OR Retry-After" orchestration не yet
 * implemented at apiClient level. Per audit Section §10.B4: deferred. Current
 * behavior: store keeps inFlightOps, safety interval (2s у useReplayRecorder)
 * makes ANOTHER flush call which retries SAME inFlightOps. INDEFINITE retry
 * via timer — NOT bounded. Tests below verify CURRENT correct behavior + mark
 * "max-2 enforcement" as Phase 3 scope.
 *
 * Production failure prevented (current scope):
 *   - 503 dropping ops silently (caller would lose data)
 *   - 503 entering DESYNC unnecessarily (transient backpressure ≠ contract drift)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/utils/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  isCircuitBreakerOpen: vi.fn(() => false),
}))

import apiClient from '@/utils/apiClient'
import { useOpsSyncStore, DesyncError } from '../../stores/opsSyncStore'

const FAKE_SID = '00000000-0000-0000-0000-000000000001'

function _op() {
  return {
    op_id: crypto.randomUUID(),
    op_type: 'stroke_add',
    page_id: 'p1',
    payload: {},
  }
}

function _503(extra: Record<string, unknown> = {}) {
  const err = new Error('Request failed with status code 503') as Error & {
    response: { status: number; data: Record<string, unknown>; headers?: Record<string, string> }
  }
  err.response = {
    status: 503,
    data: { error: 'SERVER_BUSY', ...extra },
  }
  return err
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('INV-12 503 SERVER_BUSY — transient backpressure semantics', () => {
  it('503 does NOT enter DESYNC (mode stays SYNC — transient ≠ contract drift)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())

    await expect(store.flush()).rejects.toThrow('503')

    expect(store.mode).toBe('SYNC')  // CRITICAL: 503 ≠ DESYNC
    expect(store.desyncReason).toBeNull()
  })

  it('503 preserves inFlightOps for retry (no silent data loss)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    const op = _op()
    store.record(op)

    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())
    await expect(store.flush()).rejects.toThrow('503')

    // inFlightOps кept (safety interval / next flush-trigger retries SAME batch)
    expect(store.inFlightOps.length).toBe(1)
    expect(store.inFlightOps[0]?.op_id).toBe(op.op_id)
  })

  it('next flush() after 503 retries SAME inFlight batch (op_id stable for INV-14 dedup)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    const op = _op()
    store.record(op)

    // First attempt: 503
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())
    await expect(store.flush()).rejects.toThrow('503')
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    const firstCallBody = ((apiClient.post as ReturnType<typeof vi.fn>).mock.calls[0][1]) as { ops: { op_id: string }[] }
    expect(firstCallBody.ops).toHaveLength(1)
    expect(firstCallBody.ops[0].op_id).toBe(op.op_id)

    // Second attempt: success
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      last_seq: 1, applied_count: 1,
    })
    await store.flush()
    expect(apiClient.post).toHaveBeenCalledTimes(2)
    const secondCallBody = ((apiClient.post as ReturnType<typeof vi.fn>).mock.calls[1][1]) as { ops: { op_id: string }[] }
    // CRITICAL: same op_id retried (BE INV-14 dedup) — NOT new uuid generated
    expect(secondCallBody.ops).toHaveLength(1)
    expect(secondCallBody.ops[0].op_id).toBe(op.op_id)

    // Success: inFlight cleared
    expect(store.inFlightOps.length).toBe(0)
    expect(store.serverSeq).toBe(1)
    expect(store.localSeq).toBe(1)
  })

  it('503 → throws (NOT silent) so caller (useReplayRecorder) can emit telemetry / status', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())

    let caught: Error | null = null
    try {
      await store.flush()
    } catch (e) {
      caught = e as Error
    }

    expect(caught).not.toBeNull()
    expect(caught).not.toBeInstanceOf(DesyncError)  // 503 ≠ DESYNC
    // Caller отримує оригінальну error (with status 503) щоб decide retry / drop
    expect((caught as Error & { response?: { status?: number } })?.response?.status).toBe(503)
  })

  // GAP: INV-12 max-2-attempts orchestration deferred to Phase 3 (audit §10.B4).
  // Current behavior: indefinite retry via useReplayRecorder safety-interval (2s).
  // Stub tests preserved with explicit Phase 3 deferral marker per LAW §13.
  it.skip('Phase 3 (INV-12 full): exactly 2 attempts max — 3rd throws + drop batch', () => {})
  it.skip('Phase 3 (INV-12 full): jitter delay ∈ [100, 500]ms коли немає Retry-After', () => {})
  it.skip('Phase 3 (INV-12 full): Retry-After header takes precedence over jitter', () => {})
})
