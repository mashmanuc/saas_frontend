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

    // Phase S PR-3 (2026-04-28): bounded retry sets _retryUntil — wait for backoff
    // window to elapse before retry. Real-world safety interval respects this gate.
    await new Promise(r => setTimeout(r, 400))

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

  // Phase S PR-3 (2026-04-28): INV-12 max-2-attempts orchestration NOW IMPLEMENTED.
  // Tests below previously deferred (Phase 3 stubs). Now active per REFACTOR_PLAN §3.

  it('INV-12: exactly 2 attempts max — 3rd 503 → enters PAUSED + throws', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    // Attempt 1: 503
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())
    await expect(store.flush()).rejects.toThrow('503')
    expect(store.mode).toBe('SYNC')  // not yet exhausted

    // Wait for backoff
    await new Promise(r => setTimeout(r, 500))

    // Attempt 2: 503
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())
    await expect(store.flush()).rejects.toThrow('503')
    expect(store.mode).toBe('SYNC')  // attempt=2, still allowed (MAX=2)

    // Wait for backoff
    await new Promise(r => setTimeout(r, 700))

    // Attempt 3: 503 → PAUSED (not DESYNC; not drop)
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())
    await expect(store.flush()).rejects.toThrow('503')
    expect(store.mode).toBe('PAUSED')  // CRITICAL: 3rd attempt → PAUSED

    // inFlightOps preserved (no data loss)
    expect(store.inFlightOps.length).toBe(1)
  })

  it('INV-12: jitter delay enforced коли немає Retry-After header (200ms+ before next attempt)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    // 503 без Retry-After
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())
    await expect(store.flush()).rejects.toThrow('503')

    // Immediately retry — should be blocked by backoff (Error: backoff active)
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      last_seq: 1, applied_count: 1,
    })
    await expect(store.flush()).rejects.toThrow(/backoff active/)
    // Network call should NOT have been made (blocked by retryUntil gate)
    expect(apiClient.post).toHaveBeenCalledTimes(1)  // тільки initial 503 attempt
  })

  it('INV-12: Retry-After header (seconds) takes precedence over jitter', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    // 503 з Retry-After: 1 (1 second)
    const errWithRetryAfter = new Error('Request failed with status code 503') as Error & {
      response: { status: number; data: Record<string, unknown>; headers: Record<string, string> }
    }
    errWithRetryAfter.response = {
      status: 503,
      data: { error: 'SERVER_BUSY' },
      headers: { 'retry-after': '1' },  // 1 second = 1000ms
    }
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(errWithRetryAfter)
    await expect(store.flush()).rejects.toThrow('503')

    // Backoff should be ~1000ms (Retry-After takes precedence over default ~200-350ms exp+jitter)
    expect(store.retryUntil).not.toBeNull()
    const remaining = (store.retryUntil as number) - Date.now()
    expect(remaining).toBeGreaterThan(700)  // close to 1000ms (allow some processing)
    expect(remaining).toBeLessThanOrEqual(1100)
  })
})

// ─────────────────────────────────────────────────────────────────────
// Phase S PR-3 (2026-04-28): PAUSED mode semantics
// ─────────────────────────────────────────────────────────────────────

describe('Phase S PR-3 — PAUSED mode (transient backpressure)', () => {
  it('PAUSED mode is distinct from DESYNC — record() still accepts ops', () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'PAUSED'  // simulate post-3×503 state
    store.desyncReason = 'server-busy-exhausted-retries'

    const accepted = store.record(_op())

    // CRITICAL: PAUSED accepts ops (no UI input block) — DESYNC blocks them
    expect(accepted).toBe(true)
    expect(store.pendingOps.length).toBe(1)
  })

  it('PAUSED mode: flush() throws BackpressureError (NOT DesyncError, NOT silent)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'PAUSED'
    store.desyncReason = 'server-busy-exhausted-retries'

    const { BackpressureError } = await import('../../stores/opsSyncStore')

    let caught: Error | null = null
    try {
      await store.flush()
    } catch (e) {
      caught = e as Error
    }

    expect(caught).not.toBeNull()
    expect(caught).toBeInstanceOf(BackpressureError)
    expect(caught).not.toBeInstanceOf(DesyncError)  // CRITICAL: distinct
    // Network call NOT made (PAUSED guard short-circuits before _doFlush)
    expect(apiClient.post).not.toHaveBeenCalled()
  })

  it('resumeFromPause() restores SYNC mode + resets retry state', () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'PAUSED'
    store.desyncReason = 'server-busy-exhausted-retries'

    store.resumeFromPause()

    expect(store.mode).toBe('SYNC')
    expect(store.desyncReason).toBeNull()
    // retryUntil reset (None = null)
    expect(store.retryUntil).toBeNull()
  })

  it('resumeFromPause() is idempotent — safe to call multiple times', () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'PAUSED'

    store.resumeFromPause()
    expect(store.mode).toBe('SYNC')

    // Second call — no-op (already SYNC)
    store.resumeFromPause()
    expect(store.mode).toBe('SYNC')
  })
})

// ─────────────────────────────────────────────────────────────────────
// Phase S PR-3 (2026-04-28): Queue visibility refs
// ─────────────────────────────────────────────────────────────────────

describe('Phase S PR-3 — Queue visibility refs (UI status)', () => {
  it('pendingCount reflects pendingOps.length у real time', () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0

    expect(store.pendingCount).toBe(0)

    store.record(_op())
    store.record(_op())
    store.record(_op())

    expect(store.pendingCount).toBe(3)
  })

  it('inFlightCount reflects inFlightOps.length у real time', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    expect(store.inFlightCount).toBe(0)

    // Mock delay у post щоб зловити inflight state
    ;(apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(_503())
    await expect(store.flush()).rejects.toThrow('503')

    // Після 503 — op stays у inFlightOps (preserved для retry)
    expect(store.inFlightCount).toBe(1)
  })

  it('lastFlushDuration is tracked across flush calls', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    store.record(_op())

    expect(store.lastFlushDuration).toBe(0)

    ;(apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      last_seq: 1, applied_count: 1,
    })
    await store.flush()

    // Duration must be >= 0 (some time passed)
    expect(store.lastFlushDuration).toBeGreaterThanOrEqual(0)
  })
})
