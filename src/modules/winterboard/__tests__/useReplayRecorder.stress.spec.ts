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
 *   TEST 3 (500+recover)— 2026-09-23 (LAW §5, SAVE_BLOCKED): 500 → черга стоїть,
 *                         safety interval НЕ повторює; «Перевірити й надіслати»
 *                         (звірка check-ops) доставляє все рівно раз
 *   TEST 5 (crash)      — запит завис (вкладку закрили до відповіді) → localStorage
 *                         backup → новий mount → відновлення
 *   ORDER ×2            — FIFO без збою і через 500 + дію вчителя (inFlight first)
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

const checkOpsMock = vi.fn()

vi.mock('../api/replay', () => ({
  recordOperationsBatch: (...args: unknown[]) => recordOperationsBatchMock(...args),
  createSnapshot: (...args: unknown[]) => createSnapshotMock(...args),
  checkOps: (...args: unknown[]) => checkOpsMock(...args),
  PROTOCOL_VERSION: 'v3',
}))

vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn(async () => ({ last_seq: 0 })), post: vi.fn() },
  isCircuitBreakerOpen: () => false,
}))

vi.mock('@/core/auth/onAuthDeath', () => ({
  registerAuthDeathCleanup: (_cb: () => void) => () => {},
  isAuthDead: () => false,
}))

vi.mock('@/utils/telemetryAgent', () => ({
  trackEvent: vi.fn(),
}))

import apiClient from '@/utils/apiClient'
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
  // Сервер не має жодного з наших op_id — «Перевірити й надіслати» шле пакет.
  checkOpsMock.mockReset()
  checkOpsMock.mockImplementation(async (_sid: string, ids: string[]) => ({ saved: [], missing: ids }))
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
  it('500 → SAVE_BLOCKED: safety interval не повторює; дія вчителя доставляє все рівно раз', async () => {
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
    const store = useOpsSyncStore()

    // Перший flush падає → SAVE_BLOCKED `unconfirmed` (невідомо, чи застосовано).
    await waitUntil(() => store.mode === 'SAVE_BLOCKED', 3_000)
    expect(store.saveBlock?.kind).toBe('unconfirmed')
    const callsAfterFail = recordOperationsBatchMock.mock.calls.length

    // Safety interval (2 с) більше НЕ шле той самий пакет по колу (LAW §12).
    await new Promise((r) => setTimeout(r, 2_500))
    expect(recordOperationsBatchMock.mock.calls.length).toBe(callsAfterFail)
    expect(lastSeq).toBe(0)

    // «Перевірити й надіслати»: check-ops каже «нічого немає» → одна спроба.
    expect(await store.retryBlocked()).toBe('sent')
    for (let guard = 0; guard < 5 && lastSeq < 10; guard++) await recorder.flush()
    expect(lastSeq).toBe(10)
    expect(store.mode).toBe('SYNC')             // 500 ≠ DESYNC
    recorder.destroy()
  }, 10_000)
})

// ── TEST 5 — CRASH / RELOAD (localStorage restore) ──────────────────────
describe('TEST 5 — crash/reload (localStorage restore)', () => {
  it('restores ops from backup on next mount and clears it after ACK', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})

    // Step 1: запит завис — вкладку закрили до відповіді (crash до ACK). Відмова
    // сервера (500) тепер — SAVE_BLOCKED зі своїм аварійним записом (saveBlocked.spec),
    // тож звичайний backup перевіряємо на справжньому «не встигло».
    recordOperationsBatchMock.mockImplementation(() => new Promise(() => {}))
    const recorder1 = mountRecorder('sess-crash')
    for (let i = 0; i < 5; i++) recorder1.record(mkOp(i))
    await waitUntil(() => recordOperationsBatchMock.mock.calls.length >= 1, 3_000)
    recorder1.destroy()                          // destroy → persist backup

    // ключ = дошка + акаунт + вкладка; нова вкладка підхоплює копії всіх своїх вкладок
    const backupKeys = () => Object.keys(localStorage).filter(k => k.startsWith('wb_ops_backup_v2_sess-crash_anon_'))
    expect(backupKeys()).toHaveLength(1)
    warnSpy.mockRestore()

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

    // Вкладка 1 «впала» → її Web Lock знято: у живих лише нова вкладка.
    vi.stubGlobal('navigator', { ...globalThis.navigator, locks: {
      request: () => new Promise(() => {}),
      query: async () => ({ held: [] }),
    } })
    // Б-28: після запису відновлених дій — свіжий стан сервера на полотно; копію
    // знімає лише успішна звірка.
    const getMock = apiClient.get as unknown as ReturnType<typeof vi.fn>
    getMock.mockImplementation(async () => ({ last_seq: persisted, state: { pages: [{ id: 'page-1', strokes: Array.from({ length: 5 }, (_, i) => ({ id: `stroke-${i}` })) }] } }))
    const applyCatchUpState = vi.fn()
    const recorder2 = mountRecorder('sess-crash')
    recorder2.connectToStore({ onOperation: () => () => {}, applyCatchUpState })
    await waitUntil(() => applyCatchUpState.mock.calls.length > 0, 3_000)
    await recorder2.flush()

    expect(persisted).toBeGreaterThanOrEqual(5)  // відновлено і доставлено
    expect(infoSpy.mock.calls.some((c) => String(c[0]).includes('Restored'))).toBe(true)
    // ACK повного буфера чистить backup — «сміття» не переживає успіх.
    expect(backupKeys()).toHaveLength(0)
    recorder2.destroy()
    getMock.mockImplementation(async () => ({ last_seq: 0 }))
    vi.unstubAllGlobals()
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

  it('порядок стабільний через 500 + «Перевірити й надіслати» (inFlight FIRST)', async () => {
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
    const store = useOpsSyncStore()
    await waitUntil(() => store.mode === 'SAVE_BLOCKED', 3_000)
    expect(await store.retryBlocked()).toBe('sent')
    for (let guard = 0; guard < 5 && receivedOrder.length < 30; guard++) await recorder.flush()

    const expected = Array.from({ length: 30 }, (_, i) => `stroke-${i}`)
    expect(receivedOrder).toEqual(expected)
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
