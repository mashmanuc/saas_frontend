// Unit tests: useReplayRecorder
// Покриває: record, flush, op_id dedup, retry queue, circuit breaker, streaming

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useReplayRecorder } from '../composables/useReplayRecorder'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../api/replay', () => ({
  recordOperationsBatch: vi.fn(),
  createSnapshot: vi.fn(),
}))

vi.mock('@/utils/apiClient', () => ({
  isCircuitBreakerOpen: vi.fn(() => false),
}))

import { recordOperationsBatch, createSnapshot } from '../api/replay'
import { isCircuitBreakerOpen } from '@/utils/apiClient'

const mockBatch = recordOperationsBatch as ReturnType<typeof vi.fn>
const mockSnapshot = createSnapshot as ReturnType<typeof vi.fn>
const mockGlobalCB = isCircuitBreakerOpen as ReturnType<typeof vi.fn>

// Глобальний beforeEach — очищаємо всі моки між тестами
beforeEach(() => {
  vi.clearAllMocks()
  mockGlobalCB.mockReturnValue(false)
  mockSnapshot.mockResolvedValue(undefined)
})

function makeOp(op_type = 'stroke_add') {
  return { op_type, page_id: 'p1', payload: { stroke: { id: 's1' } } }
}

function makeRecorder(enabled = true) {
  const sessionId = ref<string | null>('session-uuid-123')
  const enabledRef = ref(enabled)
  const recorder = useReplayRecorder({
    sessionId,
    getBoardState: () => ({ pages: [] }),
    enabled: enabledRef,
  })
  return { recorder, sessionId, enabledRef }
}

// ─── op_id деduplication ─────────────────────────────────────────────────────

describe('useReplayRecorder — op_id', () => {
  beforeEach(() => {
    mockBatch.mockResolvedValue({ recorded: 1, total_operations: 1 })
  })

  it('призначає op_id якщо не переданий', async () => {
    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()
    const ops = mockBatch.mock.calls[0][1]
    expect(ops[0].op_id).toBeTruthy()
    expect(ops[0].op_id).toMatch(/^[0-9a-f-]{36}$/)  // UUID format
  })

  it('зберігає переданий op_id незмінним', async () => {
    const { recorder } = makeRecorder()
    recorder.record({ ...makeOp(), op_id: 'my-custom-uuid' })
    await recorder.flush()
    const ops = mockBatch.mock.calls[0][1]
    expect(ops[0].op_id).toBe('my-custom-uuid')
  })

  it('при retry зберігає оригінальний op_id', async () => {
    mockBatch
      .mockRejectedValueOnce(new Error('network fail'))
      .mockResolvedValueOnce({ recorded: 1, total_operations: 1 })

    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()  // fails → goes to retryQueue

    const firstOps = mockBatch.mock.calls[0][1]
    const firstOpId = firstOps[0].op_id

    await recorder.flush()  // retries
    const secondOps = mockBatch.mock.calls[1][1]
    expect(secondOps[0].op_id).toBe(firstOpId)  // незмінний!
  })

  it('різні record() виклики отримують різні op_id', async () => {
    const { recorder } = makeRecorder()
    recorder.record(makeOp('stroke_add'))
    recorder.record(makeOp('stroke_delete'))
    await recorder.flush()
    const ops = mockBatch.mock.calls[0][1]
    expect(ops[0].op_id).not.toBe(ops[1].op_id)
  })
})

// ─── Retry queue ─────────────────────────────────────────────────────────────

describe('useReplayRecorder — retry queue', () => {
  beforeEach(() => {
    // mockGlobalCB вже false із глобального beforeEach
  })

  it('після невдалого flush ops йдуть в retryQueue, не в buffer', async () => {
    mockBatch
      .mockRejectedValueOnce(new Error('server error'))
      .mockResolvedValueOnce({ recorded: 2, total_operations: 3 })

    const { recorder } = makeRecorder()
    recorder.record(makeOp('stroke_add'))   // failed op
    await recorder.flush()  // fails

    recorder.record(makeOp('grid_update'))  // новий op

    await recorder.flush()  // retry + new op

    // Другий виклик має містити і retry і новий op
    const secondCall = mockBatch.mock.calls[1][1]
    const types = secondCall.map((o: { op_type: string }) => o.op_type)
    expect(types).toContain('stroke_add')   // retry
    expect(types).toContain('grid_update')  // новий
  })

  it('retry ops завжди йдуть перед новими ops', async () => {
    mockBatch
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({ recorded: 2, total_operations: 2 })

    const { recorder } = makeRecorder()
    recorder.record({ ...makeOp('stroke_add'), op_id: 'retry-op' })
    await recorder.flush()  // fails → retryQueue

    recorder.record({ ...makeOp('grid_update'), op_id: 'new-op' })
    await recorder.flush()

    const ops = mockBatch.mock.calls[1][1]
    expect(ops[0].op_id).toBe('retry-op')   // retry першим
    expect(ops[1].op_id).toBe('new-op')     // новий другим
  })
})

// ─── Enabled guard ───────────────────────────────────────────────────────────

describe('useReplayRecorder — enabled guard', () => {
  it('disabled recorder ігнорує record()', async () => {
    mockBatch.mockResolvedValue({ recorded: 0, total_operations: 0 })
    const { recorder } = makeRecorder(false)
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockBatch).not.toHaveBeenCalled()
  })

  it('enabled recorder записує ops', async () => {
    mockBatch.mockResolvedValue({ recorded: 1, total_operations: 1 })
    const { recorder } = makeRecorder(true)
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockBatch).toHaveBeenCalledOnce()
  })
})

// ─── Circuit breaker ─────────────────────────────────────────────────────────

describe('useReplayRecorder — circuit breaker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGlobalCB.mockReturnValue(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('після 3 невдалих спроб відкривається локальний circuit breaker', async () => {
    mockBatch.mockRejectedValue(new Error('server down'))
    const { recorder } = makeRecorder()

    recorder.record(makeOp())
    await recorder.flush()  // fail 1
    await recorder.flush()  // fail 2
    await recorder.flush()  // fail 3 → circuit OPEN

    mockBatch.mockClear()
    await recorder.flush()  // має бути заблокований
    expect(mockBatch).not.toHaveBeenCalled()
  })

  it('після 30 сек circuit закривається і flush відновлюється', async () => {
    mockBatch
      .mockRejectedValue(new Error('fail'))

    const { recorder } = makeRecorder()
    recorder.record(makeOp())

    for (let i = 0; i < 3; i++) {
      await recorder.flush()
    }

    mockBatch.mockResolvedValue({ recorded: 1, total_operations: 1 })
    vi.advanceTimersByTime(30_001)  // circuit closes

    await recorder.flush()
    expect(mockBatch).toHaveBeenCalled()
  })
})

// ─── Snapshot після flush (race condition fix) ────────────────────────────────

describe('useReplayRecorder — snapshot тільки після commit', () => {
  it('snapshot НЕ створюється при record() — тільки після flush', async () => {
    mockBatch.mockResolvedValue({ recorded: 1, total_operations: 200 })
    const { recorder } = makeRecorder()

    // Записуємо 1 op (не 200 — мало для snapshot при record())
    recorder.record(makeOp())
    expect(mockSnapshot).not.toHaveBeenCalled()  // ще не flush

    await recorder.flush()
    // total_operations=200 → crossed boundary at 200 → snapshot має бути
    expect(mockSnapshot).toHaveBeenCalledOnce()
  })

  it('snapshot НЕ створюється якщо flush failed', async () => {
    mockBatch.mockRejectedValue(new Error('fail'))
    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockSnapshot).not.toHaveBeenCalled()
  })

  it('snapshot створюється коли total перетинає межу 200', async () => {
    const { recorder } = makeRecorder()

    // Перший flush: total=199 → no snapshot
    mockBatch.mockResolvedValueOnce({ recorded: 50, total_operations: 199 })
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockSnapshot).not.toHaveBeenCalled()

    // Другий flush: total=201 → snapshot!
    mockBatch.mockResolvedValueOnce({ recorded: 2, total_operations: 201 })
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockSnapshot).toHaveBeenCalledOnce()
  })
})

// ─── lastKnownTotal sync ──────────────────────────────────────────────────────

describe('useReplayRecorder — lastKnownTotal', () => {
  it('синхронізується з BE total_operations після успішного flush', async () => {
    mockBatch.mockResolvedValue({ recorded: 5, total_operations: 42 })
    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()
    expect(recorder.lastKnownTotal.value).toBe(42)
  })
})

// ─── connectToStore ───────────────────────────────────────────────────────────

describe('useReplayRecorder — connectToStore', () => {
  it('auto-records ops емітованих store', async () => {
    mockBatch.mockResolvedValue({ recorded: 1, total_operations: 1 })

    const { recorder } = makeRecorder()
    const listeners: ((op: { op_type: string }) => void)[] = []
    const fakeStore = {
      onOperation: (cb: (op: { op_type: string }) => void) => {
        listeners.push(cb)
        return () => {}
      }
    }

    recorder.connectToStore(fakeStore)
    listeners.forEach(l => l(makeOp('asset_add')))

    await recorder.flush()
    expect(mockBatch).toHaveBeenCalledOnce()
    const ops = mockBatch.mock.lastCall![1]  // lastCall щоб не залежати від попередніх
    expect(ops[0].op_type).toBe('asset_add')
  })
})
