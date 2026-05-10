// Phase V Round 2 (2026-05-10) — sampling + X-WB-Write-Path header tests.
//
// Coverage:
//   Task 1 (sampling):
//     - rate=0.1 + Math.random()=0.5 → event NOT emitted (dropped)
//     - rate=0.1 + Math.random()=0.05 → event emitted
//     - rate=1.0 → all events emitted (current behavior preserved)
//     - metadata event `wb_write_path_sample_meta` emitted ~once per 60s з correct counts
//   Task 2 (X-WB-Write-Path consumption):
//     - response header `solo` → telemetry includes write_path: 'solo'
//     - response header `legacy` → telemetry includes write_path: 'legacy'
//     - header absent → telemetry omits write_path field
// Phase V scope reduction (2026-05-10): 'classroom' value removed.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock winterboardApi.ingestTelemetry — observe what gets shipped to BE.
const mockIngest = vi.fn<(events: unknown) => Promise<boolean>>(async () => true)
vi.mock('../api/winterboardApi', () => ({
  winterboardApi: {
    ingestTelemetry: (events: unknown) => mockIngest(events),
  },
}))

import {
  emitWritePathEvent,
  flushWritePathTelemetry,
  _resetWritePathTelemetryForTests,
  _peekBufferForTests,
} from '../telemetry/writePathTelemetry'

const FAKE_SID = '00000000-0000-0000-0000-000000000001'

beforeEach(() => {
  _resetWritePathTelemetryForTests()
  mockIngest.mockClear()
  // Default: rate=1.0 (env override) so unrelated tests get current behavior
  // unless they explicitly stub Math.random/import.meta.env.
  vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '1.0')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  _resetWritePathTelemetryForTests()
})

// ─── Task 1: Sampling ──────────────────────────────────────────────────

describe('Phase V Round 2 — sampling', () => {
  it('rate=0.1 + Math.random()=0.5 → event NOT emitted', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '0.1')
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    emitWritePathEvent(FAKE_SID, {
      seq: 1,
      ops_count: 3,
      roundtrip_ms: 12.5,
      status: 201,
    })

    const buf = _peekBufferForTests()
    // No data event in buffer (dropped). Meta event also не emitted yet
    // (window not elapsed на першому event).
    expect(buf.length).toBe(0)
  })

  it('rate=0.1 + Math.random()=0.05 → event emitted', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '0.1')
    vi.spyOn(Math, 'random').mockReturnValue(0.05)

    emitWritePathEvent(FAKE_SID, {
      seq: 1,
      ops_count: 3,
      roundtrip_ms: 12.5,
      status: 201,
    })

    const buf = _peekBufferForTests()
    expect(buf.length).toBe(1)
    expect(buf[0]).toMatchObject({
      event_type: 'wb_write_path',
      session_id: FAKE_SID,
      payload: { seq: 1, ops_count: 3, roundtrip_ms: 12.5, status: 201 },
    })
  })

  it('rate=1.0 → all events emitted (current behavior preserved)', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '1.0')
    // Math.random не повинен впливати при rate=1.0.
    vi.spyOn(Math, 'random').mockReturnValue(0.99)

    for (let i = 0; i < 5; i += 1) {
      emitWritePathEvent(FAKE_SID, {
        seq: i,
        ops_count: 1,
        roundtrip_ms: 5,
        status: 201,
      })
    }

    const buf = _peekBufferForTests()
    expect(buf.length).toBe(5)
  })

  it('rate=0 → no events emitted', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '0')
    vi.spyOn(Math, 'random').mockReturnValue(0)

    emitWritePathEvent(FAKE_SID, { seq: 1, ops_count: 1, roundtrip_ms: 5, status: 201 })

    expect(_peekBufferForTests().length).toBe(0)
  })

  it('invalid env (NaN) → falls back to default 0.1', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', 'not-a-number')
    // 0.05 < 0.1 → emitted
    vi.spyOn(Math, 'random').mockReturnValue(0.05)
    emitWritePathEvent(FAKE_SID, { seq: 1, ops_count: 1, roundtrip_ms: 5, status: 201 })
    expect(_peekBufferForTests().length).toBe(1)

    _resetWritePathTelemetryForTests()
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', 'not-a-number')
    // 0.5 >= 0.1 → dropped
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    emitWritePathEvent(FAKE_SID, { seq: 1, ops_count: 1, roundtrip_ms: 5, status: 201 })
    expect(_peekBufferForTests().length).toBe(0)
  })

  it('out-of-range env clamps to [0, 1]', () => {
    // > 1 → clamp to 1.0 → always emit
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '5.0')
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    emitWritePathEvent(FAKE_SID, { seq: 1, ops_count: 1, roundtrip_ms: 5, status: 201 })
    expect(_peekBufferForTests().length).toBe(1)

    _resetWritePathTelemetryForTests()
    // < 0 → clamp to 0 → never emit
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '-1')
    emitWritePathEvent(FAKE_SID, { seq: 1, ops_count: 1, roundtrip_ms: 5, status: 201 })
    expect(_peekBufferForTests().length).toBe(0)
  })

  it('emits wb_write_path_sample_meta after ~60s з sampled+dropped counts', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '0.5')
    vi.useFakeTimers()
    const baseTime = new Date('2026-05-10T00:00:00.000Z').getTime()
    vi.setSystemTime(baseTime)

    // Alternate: emit, drop, emit, drop, ...
    const randomSeq = [0.25, 0.75, 0.25, 0.75, 0.25, 0.75]
    let idx = 0
    vi.spyOn(Math, 'random').mockImplementation(() => randomSeq[idx++ % randomSeq.length])

    // First event: window starts (no meta emitted yet).
    emitWritePathEvent(FAKE_SID, { seq: 1, ops_count: 1, roundtrip_ms: 5, status: 201 })
    expect(_peekBufferForTests().length).toBe(1) // sampled

    // Within window — no meta event yet.
    emitWritePathEvent(FAKE_SID, { seq: 2, ops_count: 1, roundtrip_ms: 5, status: 201 })
    emitWritePathEvent(FAKE_SID, { seq: 3, ops_count: 1, roundtrip_ms: 5, status: 201 })
    emitWritePathEvent(FAKE_SID, { seq: 4, ops_count: 1, roundtrip_ms: 5, status: 201 })
    // Sampled: events at idx 0, 2 → 2 events. Dropped: idx 1, 3 → 2.
    // Buffer count = 2 sampled. Meta still not yet emitted.
    expect(_peekBufferForTests().filter(e => !('_meta_event' in (e.payload ?? {}))).length).toBe(2)
    expect(_peekBufferForTests().filter(e => '_meta_event' in (e.payload ?? {})).length).toBe(0)

    // Advance time past 60s window.
    vi.setSystemTime(baseTime + 61_000)

    // Next event triggers meta emit.
    emitWritePathEvent(FAKE_SID, { seq: 5, ops_count: 1, roundtrip_ms: 5, status: 201 })

    const metaEvents = _peekBufferForTests().filter(
      e => '_meta_event' in (e.payload ?? {}),
    )
    expect(metaEvents.length).toBe(1)
    expect(metaEvents[0].payload).toMatchObject({
      _meta_event: 'wb_write_path_sample_meta',
      rate: 0.5,
      // 5 events total before meta emit (window check happens AFTER the 5th
      // event's counter increment): idx 0,2,4 sampled (3) + idx 1,3 dropped (2)
      sampled_count: 3,
      dropped_count: 2,
    })

    vi.useRealTimers()
  })

  it('metadata event NOT subject to sampling (always emitted when window elapsed)', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '0.0')
    vi.useFakeTimers()
    const baseTime = new Date('2026-05-10T00:00:00.000Z').getTime()
    vi.setSystemTime(baseTime)

    // All events dropped (rate=0).
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    emitWritePathEvent(FAKE_SID, { seq: 1, ops_count: 1, roundtrip_ms: 5, status: 201 })
    emitWritePathEvent(FAKE_SID, { seq: 2, ops_count: 1, roundtrip_ms: 5, status: 201 })

    expect(_peekBufferForTests().length).toBe(0)

    vi.setSystemTime(baseTime + 61_000)
    emitWritePathEvent(FAKE_SID, { seq: 3, ops_count: 1, roundtrip_ms: 5, status: 201 })

    // Meta event MUST be present even при rate=0 (sampled=0, dropped=3).
    const metaEvents = _peekBufferForTests().filter(
      e => '_meta_event' in (e.payload ?? {}),
    )
    expect(metaEvents.length).toBe(1)
    expect(metaEvents[0].payload).toMatchObject({
      rate: 0,
      sampled_count: 0,
      dropped_count: 3,
    })

    vi.useRealTimers()
  })
})

// ─── Task 2: X-WB-Write-Path header consumption ────────────────────────

describe('Phase V Round 2 — write_path field plumbing', () => {
  it('event includes write_path="solo" when caller passes it', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '1.0')

    emitWritePathEvent(FAKE_SID, {
      seq: 1,
      ops_count: 1,
      roundtrip_ms: 5,
      status: 201,
      write_path: 'solo',
    })

    const buf = _peekBufferForTests()
    expect(buf.length).toBe(1)
    expect(buf[0].payload).toMatchObject({ write_path: 'solo' })
  })

  it('event includes write_path="legacy" when caller passes it', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '1.0')

    emitWritePathEvent(FAKE_SID, {
      seq: 1,
      ops_count: 1,
      roundtrip_ms: 5,
      status: 201,
      write_path: 'legacy',
    })

    const buf = _peekBufferForTests()
    expect(buf[0].payload).toMatchObject({ write_path: 'legacy' })
  })

  it('event omits write_path field when caller does not pass it', () => {
    vi.stubEnv('VITE_WB_TELEMETRY_SAMPLE_RATE', '1.0')

    emitWritePathEvent(FAKE_SID, {
      seq: 1,
      ops_count: 1,
      roundtrip_ms: 5,
      status: 201,
    })

    const buf = _peekBufferForTests()
    expect(buf.length).toBe(1)
    expect('write_path' in (buf[0].payload as Record<string, unknown>)).toBe(false)
  })
})

// ─── recordOperationsBatch header extraction ────────────────────────────

vi.mock('@/utils/apiClient', () => {
  const post = vi.fn()
  return {
    default: { post, get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
    isCircuitBreakerOpen: vi.fn(() => false),
  }
})

import apiClient from '@/utils/apiClient'
import { recordOperationsBatch } from '../api/replay'

const mockApiPost = (apiClient as unknown as { post: ReturnType<typeof vi.fn> }).post

describe('Phase V Round 2 — recordOperationsBatch reads X-WB-Write-Path', () => {
  beforeEach(() => {
    mockApiPost.mockReset()
  })

  it('extracts X-WB-Write-Path: solo into _writePath', async () => {
    mockApiPost.mockResolvedValueOnce({
      data: { last_seq: 5, applied_count: 3 },
      headers: { 'x-wb-write-path': 'solo' },
    })

    const result = await recordOperationsBatch('sid-1', 0, [])
    expect(result).toMatchObject({
      last_seq: 5,
      applied_count: 3,
      _writePath: 'solo',
    })
    // Verify fullResponse meta was passed.
    const callConfig = mockApiPost.mock.calls[0][2]
    expect(callConfig?.meta?.fullResponse).toBe(true)
  })

  it('extracts X-WB-Write-Path: legacy into _writePath', async () => {
    mockApiPost.mockResolvedValueOnce({
      data: { last_seq: 5, applied_count: 3 },
      headers: { 'x-wb-write-path': 'legacy' },
    })

    const result = await recordOperationsBatch('sid-1', 0, [])
    expect(result._writePath).toBe('legacy')
  })

  it('returns body without _writePath when header absent', async () => {
    mockApiPost.mockResolvedValueOnce({
      data: { last_seq: 5, applied_count: 3 },
      headers: {},
    })

    const result = await recordOperationsBatch('sid-1', 0, [])
    expect(result).toEqual({ last_seq: 5, applied_count: 3 })
    expect('_writePath' in result).toBe(false)
  })

  it('handles uppercase header name (axios usually lowercases, but defensive)', async () => {
    mockApiPost.mockResolvedValueOnce({
      data: { last_seq: 5, applied_count: 3 },
      headers: { 'X-WB-Write-Path': 'legacy' },
    })

    const result = await recordOperationsBatch('sid-1', 0, [])
    expect(result._writePath).toBe('legacy')
  })

  it('treats empty-string header value as absent', async () => {
    mockApiPost.mockResolvedValueOnce({
      data: { last_seq: 5, applied_count: 3 },
      headers: { 'x-wb-write-path': '' },
    })

    const result = await recordOperationsBatch('sid-1', 0, [])
    expect('_writePath' in result).toBe(false)
  })
})
