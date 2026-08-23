/**
 * Phase ops-only: useReplayRecorder stress scenarios.
 *
 * ПЕРЕПИСАНО 2026-08-24 (DIR-хвости-2 §1). Корінь 8 падінь — ОДИН:
 * тести працювали у ДО-single-writer порядку викликів —
 *   1) не ставили store у SYNC (у проді це робить кімната:
 *      `opsSync.bootstrap(sid)` — WBClassroomRoom.vue:2342,
 *      WBConstructorRoom.vue:416; flush() до того кидає
 *      «flush() called before bootstrap()»);
 *   2) мокали recordOperationsBatch зі СТАРОЮ сигнатурою (sid, batch) —
 *      нинішня (sid, seq, ops) (api/replay.ts:99) і відповідь має нести
 *      {last_seq}, бо store веде serverSeq.
 *
 * ВИДАЛЕНО (властивості, яких у single-writer немає ЗА ПОБУДОВОЮ):
 *   - «retries 409 with jitter» і «gives up after MAX_LOCK_RETRIES»:
 *     retry-цикли на 409 — ЗАБОРОНЕНИЙ патерн (SYSTEM_LAW §12; пам'ять
 *     409-storm). Нинішній 409-контракт — SEQ_MISMATCH → auto-resync
 *     (Def-1) — уже стережеться у invariants/opsSync.spec.ts; дублювати
 *     тут не треба.
 *
 * ЗАЛИШЕНО і переписано під реальний контракт:
 *   TEST 1 (baseline)   — 200 ops rapid-fire, всі доходять, без втрат
 *   TEST 3 (500+recover)— транзієнтний збій: inFlight збережено, safety
 *                         interval (2s) добиває; warn — асерт, не шум
 *   TEST 5 (crash)      — localStorage backup → новий mount → відновлення
 *   ORDER ×2            — FIFO без збою і через 500-retry (inFlight first)
 *   LATENCY             — батчинг: 100 ops → мало запитів
 *   TEST 6              — FE не створює snapshot (робить ops_worker BE)
 *
 * Критичний інваріант незмінний: sent_ops == persisted_ops — немає втрат.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

// ── Mocks (до імпорту recorder/store) ───────────────────────────────────
const recordOperationsBatchMock = vi.fn()
const createSnapshotMock = vi.fn()

vi.mock('../api/replay', () => ({
  recordOperationsBatch: (...args: unknown[]) => recordOperationsBatchMock(...args),
  createSnapshot: (...args: unknown[]) => createSnapshotMock(...args),
  PROTOCOL_VERSION: 'v3',
}))

vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
  isCircuitBreakerOpen: () => false,
}))

vi.mock('@/core/auth/onAuthDeath', () => ({
  registerAuthDeathCleanup: (_cb: () => void) => () => {},
  isAuthDead: () => false,
}))

vi.mock('@/utils/telemetryAgent', () => ({
  trackEvent: vi.fn(),
}))

import { useReplayRecorder } from '../composables/useReplayRecorder'
import { useOpsSyncStore } from '../stores/opsSyncStore'
import type { RecordOperationRequest } from '../types/replay'

// ── Helpers ─────────────────────────────────────────────────────────────
function mkOp(n: number, type = 'stroke_add'): RecordOperationRequest {
  return {
    op_type: type,
    page_id: 'page-1',
    payload: { stroke: { id: `stroke-${n}`, points: [n, n, n + 1, n + 1] } },
  } as RecordOperationRequest
}

/** Прод-прелюд однією функцією: те, що кімната робить через bootstrap(). */
function syncStore(sid: string) {
  const store = useOpsSyncStore()
  store.sessionId = sid
  store.mode = 'SYNC'
  store.serverSeq = 0
  store.localSeq = 0
  return store
}

function mountRecorder(sid: string) {
  syncStore(sid)
  return useReplayRecorder({
    sessionId: ref<string | null>(sid),
    getBoardState: () => ({}),
    enabled: ref(true),
  })
}

/** Сервер завжди приймає; веде власний last_seq (нова сигнатура API). */
function acceptAll(collect?: (ids: string[]) => void) {
  let lastSeq = 0
  recordOperationsBatchMock.mockImplementation(
    async (_sid: string, _seq: number, ops: RecordOperationRequest[]) => {
      lastSeq += ops.length
      collect?.(
        ops.map((op) => (op.payload as { stroke?: { id?: string } })?.stroke?.id ?? ''),
      )
      return { last_seq: lastSeq }
    },
  )
}

function sentOpsCount(): number {
  return recordOperationsBatchMock.mock.calls.reduce(
    (acc, call) => acc + (call[2] as RecordOperationRequest[]).length,
    0,
  )
}

async function waitUntil(predicate: () => boolean, timeoutMs = 5_000, intervalMs = 25): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`waitUntil: timeout after ${timeoutMs}ms`)
}

function make500() {
  return Object.assign(new Error('server error'), {
    response: { status: 500, data: {} },
  })
}

// ── Setup ───────────────────────────────────────────────────────────────
beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  recordOperationsBatchMock.mockReset()
  createSnapshotMock.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ── TEST 1 — BASELINE LOAD ──────────────────────────────────────────────
describe('TEST 1 — baseline load (200 ops rapid-fire)', () => {
  it('all ops reach server, no data loss', async () => {
    acceptAll()
    const recorder = mountRecorder('sess-1')

    for (let i = 0; i < 200; i++) recorder.record(mkOp(i))
    // Дренаж публічним flush() — не чекаємо 2s safety-тіків (див. TEST 6).
    for (let guard = 0; guard < 10 && sentOpsCount() < 200; guard++) {
      await recorder.flush()
    }

    expect(sentOpsCount()).toBe(200)
    const store = useOpsSyncStore()
    expect(store.pendingOps.length + store.inFlightOps.length).toBe(0)
    recorder.destroy()
  }, 10_000)
})

// ── TEST 3 — TRANSIENT 500 + RECOVERY ───────────────────────────────────
describe('TEST 3 — transient 500 + recovery', () => {
  it('500 keeps inFlight; safety interval retries; all persisted', async () => {
    // Один warn від рекордера на збій — це КОНТРАКТ («will retry on next
    // tick»), тому він асертиться, а не шумить у лозі (хвости-2 §2 клас).
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let failuresLeft = 1
    let lastSeq = 0
    recordOperationsBatchMock.mockImplementation(
      async (_sid: string, _seq: number, ops: RecordOperationRequest[]) => {
        if (failuresLeft > 0) {
          failuresLeft--
          throw make500()
        }
        lastSeq += ops.length
        return { last_seq: lastSeq }
      },
    )

    const recorder = mountRecorder('sess-500')
    for (let i = 0; i < 10; i++) recorder.record(mkOp(i))

    // Перший flush падає → inFlight збережено → safety interval (2s) добиває.
    await waitUntil(() => lastSeq === 10, 6_000)

    expect(lastSeq).toBe(10)
    expect(warnSpy).toHaveBeenCalled()          // збій був і був залогований
    const store = useOpsSyncStore()
    expect(store.mode).toBe('SYNC')             // 500 ≠ DESYNC
    recorder.destroy()
  }, 10_000)
})

// ── TEST 5 — CRASH / RELOAD (localStorage restore) ──────────────────────
describe('TEST 5 — crash/reload (localStorage restore)', () => {
  it('restores ops from backup on next mount and clears it after ACK', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Step 1: перший рекордер не може відправити (crash до ACK)
    recordOperationsBatchMock.mockImplementation(async () => {
      throw make500()
    })
    const recorder1 = mountRecorder('sess-crash')
    for (let i = 0; i < 5; i++) recorder1.record(mkOp(i))
    await waitUntil(() => recordOperationsBatchMock.mock.calls.length >= 1, 3_000)
    recorder1.destroy()                          // destroy → persist backup

    const raw = localStorage.getItem('wb_ops_backup_sess-crash')
    expect(raw).not.toBeNull()
    expect(warnSpy).toHaveBeenCalled()

    // Step 2: «нова вкладка» — свіжа Pinia, порожній store
    setActivePinia(createPinia())
    let persisted = 0
    recordOperationsBatchMock.mockReset()
    recordOperationsBatchMock.mockImplementation(
      async (_sid: string, _seq: number, ops: RecordOperationRequest[]) => {
        persisted += ops.length
        return { last_seq: persisted }
      },
    )

    const recorder2 = mountRecorder('sess-crash')
    await recorder2.flush()

    expect(persisted).toBeGreaterThanOrEqual(5)  // відновлено і доставлено
    expect(infoSpy.mock.calls.some((c) => String(c[0]).includes('Restored'))).toBe(true)
    // ACK повного буфера чистить backup — «сміття» не переживає успіх.
    expect(localStorage.getItem('wb_ops_backup_sess-crash')).toBeNull()
    recorder2.destroy()
  }, 10_000)
})

// ── ORDER CONSISTENCY ───────────────────────────────────────────────────
describe('ORDER CONSISTENCY — ops зберігають порядок запису', () => {
  it('ops reach backend у порядку запису (no reorder)', async () => {
    const receivedOrder: string[] = []
    acceptAll((ids) => receivedOrder.push(...ids))
    const recorder = mountRecorder('sess-order')

    const expected = Array.from({ length: 100 }, (_, i) => `stroke-${i}`)
    for (let i = 0; i < 100; i++) recorder.record(mkOp(i))
    await waitUntil(() => receivedOrder.length >= 100, 8_000)

    expect(receivedOrder).toEqual(expected)
    recorder.destroy()
  }, 10_000)

  it('порядок стабільний через 500-retry (inFlight retried FIRST)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let callCount = 0
    let lastSeq = 0
    const receivedOrder: string[] = []
    recordOperationsBatchMock.mockImplementation(
      async (_sid: string, _seq: number, ops: RecordOperationRequest[]) => {
        callCount++
        if (callCount === 1) throw make500()     // перший batch падає
        lastSeq += ops.length
        receivedOrder.push(
          ...ops.map((op) => (op.payload as { stroke?: { id?: string } })?.stroke?.id ?? ''),
        )
        return { last_seq: lastSeq }
      },
    )

    const recorder = mountRecorder('sess-order-retry')
    for (let i = 0; i < 30; i++) recorder.record(mkOp(i))
    await waitUntil(() => receivedOrder.length >= 30, 8_000)

    const expected = Array.from({ length: 30 }, (_, i) => `stroke-${i}`)
    expect(receivedOrder).toEqual(expected)
    expect(warnSpy).toHaveBeenCalled()
    recorder.destroy()
  }, 10_000)
})

// ── LATENCY / BATCHING ──────────────────────────────────────────────────
describe('LATENCY — batching агрегує ops, не спамить', () => {
  it('100 ops з latency 200ms → мало запитів (debounce + batch + mutex)', async () => {
    let lastSeq = 0
    recordOperationsBatchMock.mockImplementation(
      async (_sid: string, _seq: number, ops: RecordOperationRequest[]) => {
        await new Promise((r) => setTimeout(r, 200))
        lastSeq += ops.length
        return { last_seq: lastSeq }
      },
    )
    const recorder = mountRecorder('sess-latency')

    for (let i = 0; i < 100; i++) recorder.record(mkOp(i))
    await waitUntil(() => lastSeq === 100, 10_000)

    // 100 ops / FLUSH_BATCH_SIZE(50) = 2 мінімум; mutex + debounce тримають
    // стелю. 20 — safety-межа проти спаму, як у старому тесті.
    expect(lastSeq).toBe(100)
    expect(recordOperationsBatchMock.mock.calls.length).toBeLessThan(20)
    recorder.destroy()
  }, 15_000)
})

// ── TEST 6 — NO FE SNAPSHOTS ────────────────────────────────────────────
describe('TEST 6 — long session (FE не створює snapshot)', () => {
  it('210 ops → 0 FE-initiated snapshots (робить ops_worker BE)', async () => {
    acceptAll()
    const recorder = mountRecorder('sess-long')

    for (let i = 0; i < 210; i++) recorder.record(mkOp(i))
    // Дренаж через ПУБЛІЧНИЙ flush() (батч = 50/виклик), без очікування
    // 2s safety-тіків: пейсинг тут не міряється — міряється відсутність
    // FE-snapshot'ів. Wall-clock пейсинг стереже LATENCY-тест.
    for (let guard = 0; guard < 10 && sentOpsCount() < 210; guard++) {
      await recorder.flush()
    }

    expect(sentOpsCount()).toBe(210)
    expect(createSnapshotMock).not.toHaveBeenCalled()
    recorder.destroy()
  }, 10_000)
})
