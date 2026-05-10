// Phase V WS3 (2026-05-10) — write-path telemetry unit tests.
//
// Покриває:
//  1. Ops recorder emits telemetry event з seq/ops_count/roundtrip_ms/status=201
//     при успішному /replay/batch/ POST.
//  2. На HTTP error (4xx/5xx) telemetry emits з status кодом помилки;
//     ops recorder behavior unchanged.
//  3. Telemetry emitter failure (throw) НЕ corrupts /replay/batch/ flow:
//     recorder завершує success path normally.
//
// Контекст: Variant D split solo/classroom write paths; FE telemetry дозволяє lead
// distinguish patterns по roundtrip_ms distribution per session.

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

// Per-test mock спостерігає за emit + дозволяє throw branch.
const mockEmit = vi.fn()
vi.mock('../telemetry/writePathTelemetry', () => ({
  emitWritePathEvent: (...args: unknown[]) => mockEmit(...args),
  flushWritePathTelemetry: vi.fn(),
  _resetWritePathTelemetryForTests: vi.fn(),
  _peekBufferForTests: vi.fn(() => []),
}))

import { recordOperationsBatch } from '../api/replay'
import { useOpsSyncStore } from '../stores/opsSyncStore'

const mockBatch = recordOperationsBatch as unknown as ReturnType<typeof vi.fn>
const FAKE_SID = '00000000-0000-0000-0000-000000000001'

function _op(overrides: Record<string, unknown> = {}) {
  return {
    op_id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `op-${Math.random().toString(36).slice(2)}`,
    op_type: 'stroke_add',
    page_id: 'p1',
    payload: {},
    ...overrides,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  mockEmit.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Phase V WS3 — write-path telemetry', () => {
  it('emits wb_write_path event з status=201 на successful /replay/batch/ POST', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 7
    store.localSeq = 7

    store.record(_op())
    store.record(_op())
    store.record(_op())
    expect(store.pendingCount).toBe(3)

    mockBatch.mockResolvedValueOnce({ last_seq: 10, applied_count: 3 })

    await store.flush()

    // Точно один emit per /replay/batch/ POST.
    expect(mockEmit).toHaveBeenCalledTimes(1)
    const [emittedSid, payload] = mockEmit.mock.calls[0]
    expect(emittedSid).toBe(FAKE_SID)
    expect(payload).toMatchObject({
      seq: 7, // value of serverSeq на момент start (sent у request body)
      ops_count: 3,
      status: 201,
    })
    // roundtrip_ms — non-negative number (performance.now monotonic).
    expect(typeof payload.roundtrip_ms).toBe('number')
    expect(payload.roundtrip_ms).toBeGreaterThanOrEqual(0)
    // Recorder side-effects intact:
    expect(store.serverSeq).toBe(10)
    expect(store.inFlightCount).toBe(0)
  })

  it('emits wb_write_path event з HTTP error status (на non-2xx response)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0

    store.record(_op())
    expect(store.pendingCount).toBe(1)

    // Симулюємо 503 SERVER_BUSY (не lifecycle, не protocol mismatch).
    const err: any = new Error('SERVER_BUSY')
    err.response = { status: 503, data: { error: 'SERVER_BUSY' }, headers: {} }
    mockBatch.mockRejectedValueOnce(err)

    // 503 → throw із збереженням inFlightOps. Не cause DESYNC.
    await expect(store.flush()).rejects.toThrow()

    expect(mockEmit).toHaveBeenCalledTimes(1)
    const [, payload] = mockEmit.mock.calls[0]
    expect(payload).toMatchObject({
      seq: 0,
      ops_count: 1,
      status: 503,
    })
    // Recorder зберіг inFlightOps для retry — error handling untouched.
    expect(store.inFlightCount).toBe(1)
  })

  it('emits status=0 на network-level failure (no response)', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0

    store.record(_op())

    const err: any = new Error('Network Error')
    // Без `response` → axios network-level failure shape.
    mockBatch.mockRejectedValueOnce(err)

    await expect(store.flush()).rejects.toThrow()

    expect(mockEmit).toHaveBeenCalledTimes(1)
    const [, payload] = mockEmit.mock.calls[0]
    expect(payload.status).toBe(0)
    expect(payload.ops_count).toBe(1)
  })

  it('telemetry emitter throw НЕ блокує /replay/batch/ success path', async () => {
    const store = useOpsSyncStore()
    store.sessionId = FAKE_SID
    store.mode = 'SYNC'
    store.serverSeq = 0
    store.localSeq = 0

    store.record(_op())
    store.record(_op())

    // Telemetry crashes (e.g. внутрішня bug у buffer push).
    mockEmit.mockImplementation(() => {
      throw new Error('telemetry pipeline broken')
    })
    mockBatch.mockResolvedValueOnce({ last_seq: 2, applied_count: 2 })

    // Recorder MUST complete normally — no throw.
    await expect(store.flush()).resolves.toBeUndefined()

    expect(store.serverSeq).toBe(2)
    expect(store.inFlightCount).toBe(0)
    expect(store.pendingCount).toBe(0)
  })
})
