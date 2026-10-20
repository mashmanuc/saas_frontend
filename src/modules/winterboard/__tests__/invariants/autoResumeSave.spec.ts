/**
 * LAW §4/§5 v1.39 — дошка сама знімає зупинку збереження після обриву зв'язку (власник 2026-10-20).
 *
 * Уроки 20.10: о 17:12 і 19:16 сервер не відповів на пакет → SAVE_BLOCKED `unconfirmed` → дошка чекала кнопки
 * «Перевірити й надіслати» 45 хв. Власник: «Має бути все автоматично… він тільки повинен бачити, що зв'язок
 * обірвався». Тепер: та сама дія (`retryBlocked`: звірка за op_id → один пакет) запускається сама — за 10 с, далі
 * не частіше, ніж раз на 30 с; «знову в мережі» — одразу; `rate_limited` — не раніше Retry-After; `unproven` —
 * автоспроби зупинено; інші причини — без автоспроб.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'

vi.mock('@/utils/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  isCircuitBreakerOpen: vi.fn(() => false),
}))
vi.mock('@/utils/telemetryAgent', () => ({ trackEvent: vi.fn() }))
vi.mock('@/utils/notify', () => ({ notifyWarning: vi.fn(), notifyError: vi.fn() }))
vi.mock('@/core/auth/onAuthDeath', () => ({
  registerAuthDeathCleanup: vi.fn(() => () => {}),
  isAuthDead: vi.fn(() => false),
}))
vi.mock('../../telemetry/writePathTelemetry', () => ({ emitWritePathEvent: vi.fn() }))

import apiClient from '@/utils/apiClient'
import { trackEvent } from '@/utils/telemetryAgent'
import {
  useOpsSyncStore,
  SaveBlockedError,
  SeqResyncError,
  LifecycleStateError,
  DesyncError,
} from '../../stores/opsSyncStore'
import { useReplayRecorder } from '../../composables/useReplayRecorder'
import { readAllBackups, readBackup, saveBackup } from '../../composables/useOpsBackup'
import { readBlocked } from '../../composables/useBlockedOps'
import { tryCoalesceStrokeAppend } from '../../services/opsCoalescer'
import { serverPayloadBytes } from '../../services/opsPayloadSize'

const SID = '00000000-0000-0000-0000-00000000c0de'
const post = apiClient.post as ReturnType<typeof vi.fn>
const get = apiClient.get as ReturnType<typeof vi.fn>

function op(id: string, type = 'stroke_add', extra: Record<string, unknown> = {}) {
  return { op_id: id, op_type: type, page_id: 'p1', payload: extra }
}

function httpError(status: number, data: Record<string, unknown> = {}, headers?: Record<string, string>) {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    response: { status: number; data: Record<string, unknown>; headers?: Record<string, string> }
  }
  err.response = { status, data, ...(headers ? { headers } : {}) }
  return err
}

const ok = (lastSeq: number) => ({ data: { last_seq: lastSeq, applied_count: 1 } })

function syncStore() {
  const store = useOpsSyncStore()
  store.sessionId = SID
  store.mode = 'SYNC'
  store.serverSeq = 0
  store.localSeq = 0
  return store
}

function recorder() {
  return useReplayRecorder({ sessionId: ref<string | null>(SID), getBoardState: () => ({}) })
}

/** 400 validation_failed, що вказує на 2-й op пакета [a, bad, c]. */
function rejectSecond() {
  return httpError(400, {
    error: 'validation_failed', invalid_op_index: 1, invalid_op_id: 'bad', reason: 'payload_schema_invalid',
  })
}

/**
 * Web Locks у jsdom немає. Фейк: жива лише вкладка поточного store + ті, що в
 * `liveTabs` (тест задає явно). Решта — мертві (закрита / перезавантажена вкладка).
 */
let liveTabs: string[] = []
function installLocks() {
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    locks: {
      request: () => new Promise(() => {}),
      query: async () => ({
        held: [useOpsSyncStore().tabId, ...liveTabs].map(t => ({ name: `wb-tab:${t}` })),
      }),
    },
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  liveTabs = []
  installLocks()
  useOpsSyncStore().setBlockedOwner(null)  // власник — рівня модуля, не переносити між тестами
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-23T20:00:00Z'))
  post.mockReset()
  get.mockReset()
  ;(trackEvent as ReturnType<typeof vi.fn>).mockClear()
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})


const batches = () => post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))
const checks = () => post.mock.calls.filter(c => String(c[0]).includes('/replay/check-ops/'))

async function blockedByNetwork() {
  const store = syncStore()
  store.record(op('a'))
  post.mockRejectedValueOnce(new Error('Network Error'))
  await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
  expect(store.saveBlock?.kind).toBe('unconfirmed')
  return store
}

describe('LAW v1.39 · обрив зв’язку — дошка зберігає сама', () => {
  it('за 10 с — звірка за op_id і рівно один пакет; зупинка знята без жодного натискання', async () => {
    const store = await blockedByNetwork()
    expect(store.autoResuming).toBe(true)
    await vi.advanceTimersByTimeAsync(9_000)
    expect(checks()).toHaveLength(0)
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })   // check-ops
    get.mockResolvedValueOnce({ last_seq: 3 })                  // state
    post.mockResolvedValueOnce(ok(4))                           // batch
    await vi.advanceTimersByTimeAsync(1_000)
    expect(checks()).toHaveLength(1)
    expect(batches()).toHaveLength(2)
    expect((batches()[1][1] as { seq: number }).seq).toBe(3)
    expect(store.mode).toBe('SYNC')
    expect(store.autoResuming).toBe(false)
  })

  it('сервер уже мав зміни — нічого не відправляє вдруге', async () => {
    const store = await blockedByNetwork()
    post.mockResolvedValueOnce({ saved: ['a'], missing: [] })
    get.mockResolvedValueOnce({ last_seq: 5 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(batches()).toHaveLength(1)
    expect(store.mode).toBe('SYNC')
    expect(store.serverSeq).toBe(5)
  })

  it('зв’язку ще немає — наступна спроба не раніше, ніж за 30 с; по одній', async () => {
    const store = await blockedByNetwork()
    post.mockRejectedValueOnce(new Error('Network Error'))     // check-ops не відповів
    await vi.advanceTimersByTimeAsync(10_000)
    expect(checks()).toHaveLength(1)
    expect(store.mode).toBe('SAVE_BLOCKED')
    await vi.advanceTimersByTimeAsync(29_000)
    expect(checks()).toHaveLength(1)
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })
    get.mockResolvedValueOnce({ last_seq: 0 })
    post.mockResolvedValueOnce(ok(1))
    await vi.advanceTimersByTimeAsync(1_000)
    expect(checks()).toHaveLength(2)
    expect(store.mode).toBe('SYNC')
  })

  it('браузер «знову в мережі» — одразу, не чекаючи таймера', async () => {
    const store = await blockedByNetwork()
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })
    get.mockResolvedValueOnce({ last_seq: 0 })
    post.mockResolvedValueOnce(ok(1))
    store.resumeOnOnline()
    await vi.advanceTimersByTimeAsync(0)
    expect(checks()).toHaveLength(1)
    expect(store.mode).toBe('SYNC')
  })

  it('частково збережено (не можу довести) — автоспроби зупинено, черга ціла', async () => {
    const store = syncStore()
    store.record(op('a'))
    store.record(op('b'))
    post.mockRejectedValueOnce(httpError(502))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: ['a'], missing: ['b'] })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(store.blockedAutoStopped).toBe(true)
    expect(store.autoResuming).toBe(false)
    await vi.advanceTimersByTimeAsync(300_000)
    expect(checks()).toHaveLength(1)
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['a', 'b'])
  })

  it('вчитель сам натиснув і не вдалося (503) — дошка пробує далі сама', async () => {
    const store = await blockedByNetwork()
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })
    get.mockResolvedValueOnce({ last_seq: 3 })
    post.mockRejectedValueOnce(httpError(503, { error: 'SERVER_BUSY' }, { 'retry-after': '1' }))
    expect(await store.retryBlocked()).toBe('blocked')
    expect(store.autoResuming).toBe(true)
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })
    get.mockResolvedValueOnce({ last_seq: 3 })
    post.mockResolvedValueOnce(ok(4))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(store.mode).toBe('SYNC')
  })

  it('після перезавантаження сторінки — теж сама', async () => {
    const before = await blockedByNetwork()
    before.reset()  // стара сторінка зникла разом зі своїм таймером (аварійний запис лишився у сховищі)
    setActivePinia(createPinia())
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.autoResuming).toBe(true)
    post.mockResolvedValueOnce({ saved: ['a'], missing: [] })
    get.mockResolvedValueOnce({ last_seq: 1 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(store.mode).toBe('SYNC')
  })

  it('«забагато запитів» — одна спроба не раніше, ніж дозволив сервер', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(429, { error: 'throttled' }, { 'retry-after': '20' }))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.saveBlock?.kind).toBe('rate_limited')
    await vi.advanceTimersByTimeAsync(19_000)
    expect(post).toHaveBeenCalledTimes(1)
    get.mockResolvedValueOnce({ last_seq: 0 })
    post.mockResolvedValueOnce(ok(1))
    await vi.advanceTimersByTimeAsync(1_500)
    expect(batches()).toHaveLength(2)
    expect(store.mode).toBe('SYNC')
  })

  it('інші причини (сервер відхилив зміну) — жодних автоспроб', async () => {
    const store = syncStore()
    store.record(op('a'))
    store.record(op('bad', 'asset_add'))
    post.mockRejectedValueOnce(rejectSecond())
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.saveBlock?.kind).toBe('rejected')
    expect(store.autoResuming).toBe(false)
    store.resumeOnOnline()
    await vi.advanceTimersByTimeAsync(300_000)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('вийшли з кімнати — таймер знято, на стару дошку нічого не летить', async () => {
    const store = await blockedByNetwork()
    store.reset()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(checks()).toHaveLength(0)
  })
})
