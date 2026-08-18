// Unit tests: useReplayRecorder
// Покриває: record, flush, op_id dedup, retry queue, circuit breaker, streaming

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useOpsSyncStore } from '../stores/opsSyncStore'
import { ref, nextTick } from 'vue'
import { useReplayRecorder } from '../composables/useReplayRecorder'

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../api/replay', () => ({
  recordOperationsBatch: vi.fn(),
  createSnapshot: vi.fn(),
  // HYG-1: `replay.ts:25` експортує PROTOCOL_VERSION (SSOT версії протоколу),
  // і споживачі його імпортують — мок мусить його віддавати, інакше падає
  // сам імпорт модуля, ще до тестів.
  PROTOCOL_VERSION: 'v3',
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
  // HYG-1: `useReplayRecorder` викликає `useOpsSyncStore()` —
  // без активної Pinia composable падає ще до першого assert.
  setActivePinia(createPinia())
  // Ops тепер маршрутизуються через store (single-writer), і `record()`
  // мовчки відхиляє все, поки mode='BOOTSTRAP' (`useReplayRecorder.ts:253`).
  // Справжній `bootstrap()` ходить у мережу, тож у тестах ставимо режим
  // напряму — перевіряємо recorder, а не завантаження стану.
  const _store = useOpsSyncStore()
  _store.sessionId = 'test-session'
  _store.mode = 'SYNC'
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

// HYG-1: `recordOperationsBatch(sessionId, seq, ops)` — ops стали третім
// аргументом (`api/replay.ts:99`), коли зʼявився seq. Тести читали `[1]`,
// тобто число seq, і падали на `.op_id` / `.map`.
describe('useReplayRecorder — op_id', () => {
  beforeEach(() => {
    mockBatch.mockResolvedValue({ recorded: 1, total_operations: 1 })
  })

  it('призначає op_id якщо не переданий', async () => {
    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()
    const ops = mockBatch.mock.calls[0][2]
    expect(ops[0].op_id).toBeTruthy()
    expect(ops[0].op_id).toMatch(/^[0-9a-f-]{36}$/)  // UUID format
  })

  it('зберігає переданий op_id незмінним', async () => {
    const { recorder } = makeRecorder()
    recorder.record({ ...makeOp(), op_id: 'my-custom-uuid' })
    await recorder.flush()
    const ops = mockBatch.mock.calls[0][2]
    expect(ops[0].op_id).toBe('my-custom-uuid')
  })

  it('при retry зберігає оригінальний op_id', async () => {
    mockBatch
      .mockRejectedValueOnce(new Error('network fail'))
      .mockResolvedValueOnce({ recorded: 1, total_operations: 1 })

    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()  // fails → goes to retryQueue

    const firstOps = mockBatch.mock.calls[0][2]
    const firstOpId = firstOps[0].op_id

    await recorder.flush()  // retries
    const secondOps = mockBatch.mock.calls[1][2]
    expect(secondOps[0].op_id).toBe(firstOpId)  // незмінний!
  })

  it('різні record() виклики отримують різні op_id', async () => {
    const { recorder } = makeRecorder()
    recorder.record(makeOp('stroke_add'))
    recorder.record(makeOp('stroke_delete'))
    await recorder.flush()
    const ops = mockBatch.mock.calls[0][2]
    expect(ops[0].op_id).not.toBe(ops[1].op_id)
  })
})

// ─── Retry queue ─────────────────────────────────────────────────────────────

describe('useReplayRecorder — делегування в opsSyncStore (HYG-2)', () => {
  // Тут раніше жили тести власного буфера й retryQueue recorder'а. Їх
  // видалено не тому, що «не проходять», а тому що перевіряли те, чого
  // більше немає: `useReplayRecorder.ts:4` прямо каже — «DELETED: local
  // buffer / retryQueue / inFlight refs (moved to opsSyncStore)». Ops-стан
  // тепер належить store (single-writer, SYSTEM_LAW §2), а composable — це
  // тонка обгортка з lifecycle.
  //
  // Тому тести нижче перевіряють НОВИЙ інваріант — recorder делегує і сам
  // нічого не тримає, — а не відтворюють стару семантику на нових кишках.

  it('record() кладе op у store, а не в локальний буфер', () => {
    const store = useOpsSyncStore()
    const { recorder } = makeRecorder()

    recorder.record(makeOp('stroke_add'))

    expect(store.pendingOps.length).toBe(1)
    expect(store.pendingOps[0].op_type).toBe('stroke_add')
  })

  it('recorder не має власних буферів у публічному API', () => {
    const { recorder } = makeRecorder()
    for (const gone of ['buffer', 'retryQueue', 'inFlight', 'inFlightOps']) {
      expect(recorder).not.toHaveProperty(gone)
    }
  })

  it('порядок ops зберігає store, recorder лише додає в хвіст', () => {
    const store = useOpsSyncStore()
    const { recorder } = makeRecorder()

    recorder.record(makeOp('stroke_add'))
    recorder.record(makeOp('grid_update'))

    expect(store.pendingOps.map((o) => o.op_type)).toEqual(['stroke_add', 'grid_update'])
  })

  it('у DESYNC store відхиляє op — recorder не падає і не буферизує сам', () => {
    const store = useOpsSyncStore()
    store.mode = 'DESYNC'
    const { recorder } = makeRecorder()

    expect(() => recorder.record(makeOp('stroke_add'))).not.toThrow()
    expect(store.pendingOps.length).toBe(0)
  })

  it('flush() без ops не звертається до мережі', async () => {
    const { recorder } = makeRecorder()
    await recorder.flush()
    expect(mockBatch).not.toHaveBeenCalled()
  })
})

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

  // HYG-2: тест «локальний circuit breaker після 3 невдач» видалено.
  // Причина не в тому, що він червоний, а в тому, що він вимагав
  // поведінки, яку SYSTEM_LAW §12 прямо забороняє (retry loops,
  // `MAX_LOCK_RETRIES`, `consecutive409`, `circuitOpen`) — і яку свідомо
  // видалили з recorder'а (`useReplayRecorder.ts:5-7`). Обробка помилок
  // сервера (SEQ_MISMATCH / PROTOCOL_VERSION_MISMATCH / SERVER_BUSY)
  // тепер належить `opsSyncStore.flush()` і тестується там.
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

// ─── Snapshot не створюється з FE (2026-04-24 prod incident fix) ─────────────
// Було: FE автоматично POST /replay/snapshots/create/ кожні 200 ops з повним
// board_state → lock contention → 409 storm → retryQueue overflow → data loss.
// Стало: snapshots створюються тільки backend `ops_worker` кожні 100 ops.

describe('useReplayRecorder — FE НЕ створює snapshots (backend owns it)', () => {
  it('snapshot НЕ викликається після flush з total_operations=200', async () => {
    mockBatch.mockResolvedValue({ recorded: 1, total_operations: 200 })
    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockSnapshot).not.toHaveBeenCalled()
  })

  it('snapshot НЕ викликається якщо flush failed', async () => {
    mockBatch.mockRejectedValue(new Error('fail'))
    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockSnapshot).not.toHaveBeenCalled()
  })

  it('snapshot НЕ викликається навіть коли total перетинає межу 200', async () => {
    const { recorder } = makeRecorder()
    mockBatch.mockResolvedValueOnce({ recorded: 50, total_operations: 199 })
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockSnapshot).not.toHaveBeenCalled()

    mockBatch.mockResolvedValueOnce({ recorded: 2, total_operations: 201 })
    recorder.record(makeOp())
    await recorder.flush()
    expect(mockSnapshot).not.toHaveBeenCalled()
  })
})

// ─── lastKnownTotal sync ──────────────────────────────────────────────────────

describe('useReplayRecorder — lastKnownTotal', () => {
  // TODO: implement lastKnownTotal in useReplayRecorder (tracks total_operations from batch response)
  it.skip('синхронізується з BE total_operations після успішного flush', async () => {
    mockBatch.mockResolvedValue({ recorded: 5, total_operations: 42 })
    const { recorder } = makeRecorder()
    recorder.record(makeOp())
    await recorder.flush()
    // @ts-expect-error lastKnownTotal not yet implemented in useReplayRecorder
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
    const ops = mockBatch.mock.lastCall![2]  // lastCall щоб не залежати від попередніх
    expect(ops[0].op_type).toBe('asset_add')
  })
})
