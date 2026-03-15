// Phase 10 Day 5: Unit tests for useReplayRecorder composable
// Ref: DAY4_AGENT_A.md — A.T1

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useReplayRecorder } from '@/modules/winterboard/composables/useReplayRecorder'
import type { RecordOperationRequest } from '@/modules/winterboard/types/replay'

// ─── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/modules/winterboard/api/replay', () => ({
  recordOperationsBatch: vi.fn().mockResolvedValue({ recorded: 0 }),
  createSnapshot: vi.fn().mockResolvedValue(undefined),
}))

import { recordOperationsBatch, createSnapshot } from '@/modules/winterboard/api/replay'

const mockBatch = vi.mocked(recordOperationsBatch)
const mockSnapshot = vi.mocked(createSnapshot)

function makeOp(opType = 'stroke_add'): RecordOperationRequest {
  return {
    op_type: opType,
    page_id: 'page-1',
    payload: { stroke: { id: `s-${Math.random()}` } },
  }
}

describe('useReplayRecorder', () => {
  let sessionId: import('vue').Ref<string | null>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    sessionId = ref('test-session-123') as import('vue').Ref<string | null>
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createRecorder() {
    return useReplayRecorder({
      sessionId,
      getBoardState: () => ({ pages: [], assets: [] }),
    })
  }

  // ─── record() ──────────────────────────────────────────────────────

  it('record() increments opCount', () => {
    const recorder = createRecorder()
    expect(recorder.opCount.value).toBe(0)
    recorder.record(makeOp())
    expect(recorder.opCount.value).toBe(1)
    recorder.record(makeOp())
    expect(recorder.opCount.value).toBe(2)
    recorder.destroy()
  })

  it('auto-flushes when buffer reaches BATCH_SIZE (50)', async () => {
    const recorder = createRecorder()
    recorder.start()

    for (let i = 0; i < 50; i++) {
      recorder.record(makeOp())
    }

    // Let the flush promise resolve
    await vi.runAllTimersAsync()

    expect(mockBatch).toHaveBeenCalledTimes(1)
    expect(mockBatch).toHaveBeenCalledWith('test-session-123', expect.any(Array))
    expect(mockBatch.mock.calls[0][1]).toHaveLength(50)

    recorder.destroy()
  })

  it('does NOT flush when buffer < BATCH_SIZE', () => {
    const recorder = createRecorder()
    recorder.start()

    for (let i = 0; i < 10; i++) {
      recorder.record(makeOp())
    }

    expect(mockBatch).not.toHaveBeenCalled()
    recorder.destroy()
  })

  // ─── flush() ───────────────────────────────────────────────────────

  it('flush() sends buffer to API and drains it', async () => {
    const recorder = createRecorder()
    recorder.record(makeOp())
    recorder.record(makeOp())

    await recorder.flush()

    expect(mockBatch).toHaveBeenCalledTimes(1)
    expect(mockBatch).toHaveBeenCalledWith('test-session-123', expect.any(Array))
    expect(mockBatch.mock.calls[0][1]).toHaveLength(2)
  })

  it('flush() skips when sessionId is null', async () => {
    sessionId.value = null
    const recorder = createRecorder()
    recorder.record(makeOp())

    await recorder.flush()

    expect(mockBatch).not.toHaveBeenCalled()
  })

  it('flush() skips when buffer is empty', async () => {
    const recorder = createRecorder()

    await recorder.flush()

    expect(mockBatch).not.toHaveBeenCalled()
  })

  it('flush() re-queues ops on failure', async () => {
    mockBatch.mockRejectedValueOnce(new Error('Network error'))

    const recorder = createRecorder()
    recorder.record(makeOp())
    recorder.record(makeOp())

    await recorder.flush()

    // Ops re-queued — second flush should send them again
    mockBatch.mockResolvedValueOnce({ recorded: 2 })
    await recorder.flush()

    expect(mockBatch).toHaveBeenCalledTimes(2)
    expect(mockBatch.mock.calls[1][1]).toHaveLength(2)

    recorder.destroy()
  })

  // ─── snapshot ──────────────────────────────────────────────────────

  it('creates snapshot every 200 ops', async () => {
    const recorder = createRecorder()
    recorder.start()

    for (let i = 0; i < 200; i++) {
      recorder.record(makeOp())
    }

    // Let flush promises resolve
    await vi.runAllTimersAsync()

    expect(mockSnapshot).toHaveBeenCalledTimes(1)
    expect(mockSnapshot).toHaveBeenCalledWith(
      'test-session-123',
      200,
      { pages: [], assets: [] },
    )

    recorder.destroy()
  })

  it('does NOT create snapshot before 200 ops', () => {
    const recorder = createRecorder()

    for (let i = 0; i < 199; i++) {
      recorder.record(makeOp())
    }

    expect(mockSnapshot).not.toHaveBeenCalled()
    recorder.destroy()
  })

  // ─── start() / stop() / destroy() ─────────────────────────────────

  it('start() enables periodic flush', async () => {
    const recorder = createRecorder()
    recorder.start()

    recorder.record(makeOp())

    // Advance by flush interval (5000ms)
    await vi.advanceTimersByTimeAsync(5000)

    expect(mockBatch).toHaveBeenCalledTimes(1)

    recorder.destroy()
  })

  it('stop() does a final flush', async () => {
    const recorder = createRecorder()
    recorder.start()
    recorder.record(makeOp())
    recorder.record(makeOp())

    recorder.stop()
    await vi.runAllTimersAsync()

    expect(mockBatch).toHaveBeenCalledTimes(1)
  })

  it('destroy() resets opCount to 0', () => {
    const recorder = createRecorder()
    recorder.record(makeOp())
    recorder.record(makeOp())
    expect(recorder.opCount.value).toBe(2)

    recorder.destroy()
    expect(recorder.opCount.value).toBe(0)
  })

  it('start() is idempotent — calling twice does not create two timers', async () => {
    const recorder = createRecorder()
    recorder.start()
    recorder.start() // second call should be no-op

    recorder.record(makeOp())
    await vi.advanceTimersByTimeAsync(5000)

    // Should only have one flush, not two
    expect(mockBatch).toHaveBeenCalledTimes(1)

    recorder.destroy()
  })
})
