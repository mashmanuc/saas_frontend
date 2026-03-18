import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// Mock the API module before importing the composable
vi.mock('@/modules/winterboard/api/replay', () => ({
  recordOperationsBatch: vi.fn().mockResolvedValue({}),
  createSnapshot: vi.fn().mockResolvedValue({}),
  fetchReplayTimeline: vi.fn(),
  fetchNearestSnapshot: vi.fn(),
  fetchLessonMarkers: vi.fn(),
}))

import { useReplayRecorder } from '@/modules/winterboard/composables/useReplayRecorder'
import { recordOperationsBatch, createSnapshot } from '@/modules/winterboard/api/replay'

const mockRecordBatch = recordOperationsBatch as ReturnType<typeof vi.fn>
const mockCreateSnapshot = createSnapshot as ReturnType<typeof vi.fn>

function createRecorder() {
  const sessionId = ref<string | null>('session-1')
  const getBoardState = vi.fn().mockReturnValue({ pages: [], currentPageIndex: 0 })
  const recorder = useReplayRecorder({ sessionId, getBoardState })
  return { recorder, sessionId, getBoardState }
}

function makeOp(overrides: Record<string, unknown> = {}) {
  return {
    op_type: 'stroke_add',
    page_id: 'page-1',
    payload: { stroke: { id: 's1', points: [] } },
    ...overrides,
  }
}

describe('useReplayRecorder — R4 hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('payload size validation', () => {
    it('accepts normal-size payloads', () => {
      const { recorder } = createRecorder()
      recorder.record(makeOp())
      expect(recorder.opCount.value).toBe(1)
    })

    it('rejects payloads exceeding 64KB', () => {
      const { recorder } = createRecorder()
      const bigPayload = { data: 'x'.repeat(70_000) }
      recorder.record(makeOp({ payload: bigPayload }))
      expect(recorder.opCount.value).toBe(0) // rejected, not recorded
    })

    it('accepts payloads just under 64KB', () => {
      const { recorder } = createRecorder()
      // ~63KB payload — should pass
      const payload = { data: 'a'.repeat(60_000) }
      recorder.record(makeOp({ payload }))
      expect(recorder.opCount.value).toBe(1)
    })

    it('rejects operations with non-serializable payload', () => {
      const { recorder } = createRecorder()
      const circular: Record<string, unknown> = {}
      circular.self = circular
      recorder.record(makeOp({ payload: circular }))
      expect(recorder.opCount.value).toBe(0) // rejected
    })
  })

  describe('snapshot retry', () => {
    it('creates snapshot at SNAPSHOT_EVERY interval', async () => {
      const { recorder } = createRecorder()
      mockCreateSnapshot.mockResolvedValue({})

      // Record 200 ops to trigger snapshot
      for (let i = 0; i < 200; i++) {
        recorder.record(makeOp())
      }

      // Flush pending promises
      await vi.runAllTimersAsync()

      expect(mockCreateSnapshot).toHaveBeenCalledTimes(1)
    })

    it('retries snapshot once on failure', async () => {
      const { recorder } = createRecorder()
      mockCreateSnapshot
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValueOnce({})

      // Record 200 ops to trigger snapshot
      for (let i = 0; i < 200; i++) {
        recorder.record(makeOp())
      }

      // First call happens immediately
      await vi.advanceTimersByTimeAsync(0)
      expect(mockCreateSnapshot).toHaveBeenCalledTimes(1)

      // Retry happens after 2s
      await vi.advanceTimersByTimeAsync(2000)
      expect(mockCreateSnapshot).toHaveBeenCalledTimes(2)
    })
  })

  describe('flush', () => {
    it('flushes buffer at BATCH_SIZE', async () => {
      const { recorder } = createRecorder()
      mockRecordBatch.mockResolvedValue({})

      // Record 50 ops (= BATCH_SIZE)
      for (let i = 0; i < 50; i++) {
        recorder.record(makeOp())
      }

      await vi.runAllTimersAsync()
      expect(mockRecordBatch).toHaveBeenCalledTimes(1)
      expect(mockRecordBatch).toHaveBeenCalledWith('session-1', expect.any(Array))
    })

    it('re-queues on flush failure', async () => {
      const { recorder } = createRecorder()
      mockRecordBatch.mockRejectedValueOnce(new Error('network'))

      for (let i = 0; i < 50; i++) {
        recorder.record(makeOp())
      }

      await vi.runAllTimersAsync()

      // opCount should still be 50 (ops were re-queued, not lost)
      expect(recorder.opCount.value).toBe(50)
    })

    it('skips flush when sessionId is null', async () => {
      const sessionId = ref<string | null>(null)
      const recorder = useReplayRecorder({
        sessionId,
        getBoardState: () => ({}),
      })

      for (let i = 0; i < 50; i++) {
        recorder.record(makeOp())
      }

      await vi.runAllTimersAsync()
      expect(mockRecordBatch).not.toHaveBeenCalled()
    })
  })
})
