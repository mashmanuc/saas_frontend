// 2026-05-08 hotfix: opsSyncStore.flushAll() drain helper
//
// Bug: PR-1b finalize flow used `await opsSync.flush()` once. With FLUSH_BATCH_SIZE=50
// any session з > 50 ops left ops 51+ у pendingOps after a single flush() call.
// Finalize barrier saw stale serverSeq → BE materialized Replay з truncated tail.
//
// Tests:
//  1. flushAll drains > FLUSH_BATCH_SIZE ops via multiple batches.
//  2. flushAll throws on DESYNC (propagates errors from underlying flush()).
//  3. flushAll bounded by maxIterations.
//  4. flushAll returns immediately if both queues empty.
//  5. flushAll preserves seq monotonicity (response.last_seq advances each batch).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

vi.mock('@/utils/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  isCircuitBreakerOpen: vi.fn(() => false),
}))

vi.mock('../api/replay', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    recordOperationsBatch: vi.fn(),
  }
})

import { recordOperationsBatch } from '../api/replay'
import { useOpsSyncStore, DesyncError, SeqResyncError } from '../stores/opsSyncStore'

const mockBatch = recordOperationsBatch as unknown as ReturnType<typeof vi.fn>
const FAKE_SID = '00000000-0000-0000-0000-000000000001'

function _op(overrides: Record<string, unknown> = {}) {
  return {
    op_id: crypto.randomUUID(),
    op_type: 'stroke_add',
    page_id: 'p1',
    payload: {},
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('flushAll() — drain helper (2026-05-08 hotfix)', () => {
  it('drains > FLUSH_BATCH_SIZE ops via multiple batches (real bug repro)', async () => {
    // Repro the prod scenario: 250 strokes ≈ 1500 ops, FLUSH_BATCH_SIZE=50.
    // Single flush() leaves 1450 у pendingOps. flushAll() drains all.
    //
    // Use 200 ops (4 batches of 50) — small enough для тест speed, big enough
    // to confirm multi-batch behavior.
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0

    // Queue 200 ops.
    for (let i = 0; i < 200; i++) {
      store.record(_op())
    }
    expect(store.pendingCount).toBe(200)

    // Mock recordOperationsBatch to advance last_seq by batch size each call.
    let callCount = 0
    let lastSeq = 0
    mockBatch.mockImplementation(async (_sid, _seq, ops) => {
      callCount += 1
      lastSeq += ops.length
      return { last_seq: lastSeq, applied_count: ops.length }
    })

    await store.flushAll()

    expect(store.pendingCount).toBe(0)
    expect(store.inFlightCount).toBe(0)
    expect(callCount).toBeGreaterThanOrEqual(4)  // 200 ops / 50 batch = 4 batches min
    expect(callCount).toBeLessThanOrEqual(5)      // tolerance for boundary cases
    expect(store.serverSeq).toBe(200)             // all ops accepted
  })

  it('returns immediately if both queues empty', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0

    await store.flushAll()
    expect(mockBatch).not.toHaveBeenCalled()
  })

  // ⚠️ Контракт 409 SEQ_MISMATCH СВІДОМО змінено: це більше не жорсткий
  // DESYNC, а self-healing resync (`SeqResyncError`, док у opsSyncStore:1026:
  // «MUST NOT be confused with DesyncError — this is self-healing, not a hard
  // lock»). Тест перевіряє НОВИЙ задокументований контракт, а не те, що
  // випадково робить код: помилка ПРОПАГУЄ (не ковтається), операції
  // ЗБЕРІГАЮТЬСЯ під наступний flush, серверний seq виправляється з відповіді.
  it('propagates SeqResyncError on 409 and keeps ops for the next flush', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 5
    store.localSeq = 5
    for (let i = 0; i < 100; i++) store.record(_op())

    // BE returns 409 SEQ_MISMATCH on first batch → DESYNC.
    const err409 = Object.assign(new Error('seq mismatch'), {
      response: { status: 409, data: { error: 'SEQ_MISMATCH', expected_seq: 12 } },
    })
    mockBatch.mockRejectedValueOnce(err409)

    await expect(store.flushAll()).rejects.toBeInstanceOf(SeqResyncError)

    // Self-healing, не блокування: режим лишається робочим, невідправлені
    // операції чекають наступного flush, seq підтягнуто з `expected_seq`.
    expect(store.mode).toBe('SYNC')
    expect(store.pendingCount).toBeGreaterThan(0)
    expect(store.inFlightCount).toBe(0)
    expect(store.serverSeq).toBe(12)
  })

  it('throws on PROTOCOL_VERSION_MISMATCH (propagates DesyncError)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0
    for (let i = 0; i < 100; i++) store.record(_op())

    const err400 = Object.assign(new Error('protocol mismatch'), {
      response: {
        status: 400,
        data: { error: 'PROTOCOL_VERSION_MISMATCH', server_version: 'v4', client_version: 'v3' },
      },
    })
    mockBatch.mockRejectedValueOnce(err400)

    await expect(store.flushAll()).rejects.toBeInstanceOf(DesyncError)
    expect(store.mode).toBe('DESYNC')
  })

  it('bounded by maxIterations (throws if drain incomplete)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0

    // Queue 500 ops — needs 10 batches at FLUSH_BATCH_SIZE=50.
    for (let i = 0; i < 500; i++) store.record(_op())

    let lastSeq = 0
    mockBatch.mockImplementation(async (_sid, _seq, ops) => {
      lastSeq += ops.length
      return { last_seq: lastSeq, applied_count: ops.length }
    })

    // maxIterations=3 → can drain only 150 ops → throws.
    await expect(
      store.flushAll({ maxIterations: 3 }),
    ).rejects.toThrow(/drain incomplete after 3 iterations/)

    // Some ops drained (3 batches × 50 = 150).
    expect(store.pendingCount).toBe(350)
  })

  it('preserves seq monotonicity across batches (last_seq advances each call)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0

    for (let i = 0; i < 150; i++) store.record(_op())

    let lastSeq = 0
    const observedSeqs: number[] = []
    mockBatch.mockImplementation(async (_sid, _seq, ops) => {
      lastSeq += ops.length
      observedSeqs.push(lastSeq)
      return { last_seq: lastSeq, applied_count: ops.length }
    })

    await store.flushAll()

    expect(observedSeqs.length).toBeGreaterThanOrEqual(3)
    // Strictly increasing.
    for (let i = 1; i < observedSeqs.length; i++) {
      expect(observedSeqs[i]).toBeGreaterThan(observedSeqs[i - 1])
    }
    expect(store.serverSeq).toBe(150)
  })
})
