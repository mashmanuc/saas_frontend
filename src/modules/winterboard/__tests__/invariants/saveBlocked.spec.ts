/**
 * SAVE_BLOCKED — остаточні відмови сервера (SYSTEM_LAW §4–§5, §12; P0 ТЗ
 * `TZ_BOARD_SAVE_REJECTION_RECOVERY_2026-09-23.md` §8).
 *
 * Раніше будь-яка «інша» помилка лишала пакет у inFlight, і рекордер слав його
 * знову кожні 2 с, а після reload — з backup; усе пізніше стояло за ним мовчки.
 * Тепер:
 *  - 400 / 403 / 404 / 413 / 415 / 429 / 5xx≠503 / мережа → SAVE_BLOCKED одразу;
 *  - жоден наступний flush() (таймер, debounce, flushAll) не робить HTTP;
 *  - черга ціла, аварійний запис перевіряється; після reload — знову SAVE_BLOCKED;
 *  - 409 / lifecycle-409 / 503 / protocol-mismatch — як і раніше;
 *  - вихід лише дією вчителя: звірка check-ops + одна спроба, або відкидання.
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
import { readBackup, saveBackup } from '../../composables/useOpsBackup'
import { readBlocked } from '../../composables/useBlockedOps'

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

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-23T20:00:00Z'))
  post.mockReset()
  get.mockReset()
  ;(trackEvent as ReturnType<typeof vi.fn>).mockClear()
  localStorage.clear()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('§8.1/§5.1 · 400 validation_failed → SAVE_BLOCKED без повторів', () => {
  it('відхилений пакет: нуль змін у seq, черга ціла, далі жоден виклик не робить HTTP', async () => {
    const store = syncStore()
    const rec = recorder()
    store.record(op('a'))
    store.record(op('bad', 'asset_add'))
    store.record(op('c'))
    post.mockRejectedValueOnce(rejectSecond())

    await rec.flush()
    expect(post).toHaveBeenCalledTimes(1)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.kind).toBe('rejected')
    expect(store.saveBlock?.invalidOpId).toBe('bad')
    expect(store.saveBlock?.invalidOpType).toBe('asset_add')
    expect(store.serverSeq).toBe(0)
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['a', 'bad', 'c'])

    // safety interval, debounce після record(), flushAll — жодного нового HTTP
    rec.start()
    store.record(op('d'))
    await vi.advanceTimersByTimeAsync(60_000)
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    await expect(store.flushAll()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(post).toHaveBeenCalledTimes(1)
    expect(store.pendingOps.map(o => o.op_id)).toEqual(['d'])
    rec.stop?.()
  })

  it('телеметрія — одна подія на перехід, без payload', async () => {
    const store = syncStore()
    const rec = recorder()
    store.record(op('a'))
    store.record(op('bad', 'asset_add', { secret: 'текст учителя' }))
    post.mockRejectedValueOnce(rejectSecond())
    await rec.flush()
    rec.start()
    await vi.advanceTimersByTimeAsync(20_000)
    const calls = (trackEvent as ReturnType<typeof vi.fn>).mock.calls.filter(c => c[0] === 'wb.ops.save_blocked')
    expect(calls).toHaveLength(1)
    expect(JSON.stringify(calls[0][1])).not.toContain('текст учителя')
    rec.stop?.()
  })
})

describe('§8.5 · індекс/ID не збігаються з пакетом → request_rejected, без розбору', () => {
  it.each([
    [{ error: 'validation_failed', invalid_op_index: 7, reason: 'x' }],
    [{ error: 'validation_failed', invalid_op_index: 1, invalid_op_id: 'чужий', reason: 'x' }],
    [{ error: 'validation_failed', reason: 'ops_must_be_list' }],
    [{ error: 'something_else' }],
  ])('%j', async (data) => {
    const store = syncStore()
    store.record(op('a'))
    store.record(op('bad'))
    post.mockRejectedValueOnce(httpError(400, data))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.saveBlock?.kind).toBe('request_rejected')
    expect(store.saveBlock?.invalidOpId).toBeNull()
    expect(store.inFlightOps).toHaveLength(2)
  })
})

describe('§4.3/§8.8 · інші відповіді', () => {
  it.each([
    [403, 'forbidden'],
    [404, 'not_found'],
    [413, 'too_large'],
    [415, 'request_rejected'],
    [500, 'unconfirmed'],
    [502, 'unconfirmed'],
  ])('%i → SAVE_BLOCKED %s, без повтору', async (status, kind) => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(status as number))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.saveBlock?.kind).toBe(kind)
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('немає HTTP-відповіді → unconfirmed, не «відхилено»', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.saveBlock?.kind).toBe('unconfirmed')
    expect(store.saveBlock?.httpStatus).toBe(0)
    expect(store.inFlightOps).toHaveLength(1)
  })

  it('429 → rate_limited: жодного автоматичного таймера навіть з Retry-After', async () => {
    const store = syncStore()
    const rec = recorder()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(429, { error: 'throttled' }, { 'retry-after': '5' }))
    await rec.flush()
    rec.start()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(store.saveBlock?.kind).toBe('rate_limited')
    expect(post).toHaveBeenCalledTimes(1)
    rec.stop?.()
  })

  it('401 → не SAVE_BLOCKED (штатний auth flow)', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(401))
    await expect(store.flush()).rejects.toThrow('401')
    expect(store.mode).toBe('SYNC')
  })

  it('409 SEQ_MISMATCH / lifecycle-409 / protocol-mismatch — чинна семантика', async () => {
    let store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(409, { error: 'SEQ_MISMATCH', expected_seq: 4 }))
    await expect(store.flush()).rejects.toBeInstanceOf(SeqResyncError)
    expect(store.mode).toBe('SYNC')

    setActivePinia(createPinia())
    store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(409, { error: 'SESSION_ARCHIVED' }))
    await expect(store.flush()).rejects.toBeInstanceOf(LifecycleStateError)
    expect(store.mode).toBe('SYNC')

    setActivePinia(createPinia())
    store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(400, { error: 'PROTOCOL_VERSION_MISMATCH' }))
    await expect(store.flush()).rejects.toBeInstanceOf(DesyncError)
    expect(store.mode).toBe('DESYNC')
  })
})

describe('§5.3/§7/§8.6-7 · аварійний запис, reload, сховище', () => {
  it('запис лягає й перевіряється; звичайний backup знято; reload → знову SAVE_BLOCKED без HTTP', async () => {
    let store = syncStore()
    saveBackup(SID, [op('a'), op('bad')], [])
    store.record(op('a'))
    store.record(op('bad'))
    post.mockRejectedValueOnce(rejectSecond())
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.saveBlock?.storageOk).toBe(true)
    expect(readBlocked(SID, null)).toHaveLength(1)
    expect(readBackup(SID)).toBeNull()

    // «reload»: новий store, bootstrap з сервера — черга НЕ йде у звичайну відправку
    setActivePinia(createPinia())
    store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.restored).toBe(true)
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['a', 'bad'])
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('сховище відмовило → storageOk=false, введення заблоковано, черга не зникла', async () => {
    const store = syncStore()
    store.record(op('a'))
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    post.mockRejectedValueOnce(httpError(500))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    spy.mockRestore()
    expect(store.saveBlock?.storageOk).toBe(false)
    expect(store.inputLocked).toBe(true)
    expect(store.inFlightOps).toHaveLength(1)
  })

  it('стеля черги: record() відмовляє видимо (лічильник), не тихо', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(500))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    for (let i = 1; i < store.MAX_BLOCKED_QUEUE_OPS; i++) store.record(op(`p${i}`))
    expect(store.inputLocked).toBe(true)
    expect(store.record(op('over'))).toBe(false)
    expect(store.droppedWhileBlocked).toBe(1)
  })

  it('resync не знімає зупинку й не скидає черги', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(500))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    await expect(store.resync(SID)).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.inFlightOps).toHaveLength(1)
  })

  it('SAVE_BLOCKED не розсилається іншим вкладкам', async () => {
    const posted: unknown[] = []
    class FakeChannel {
      onmessage: unknown = null
      postMessage(m: unknown) { posted.push(m) }
      close() {}
    }
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(500))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(posted).toHaveLength(0)
    vi.unstubAllGlobals()
  })
})

describe('§4.3 · «Перевірити й надіслати» — лише дія вчителя, одна спроба', () => {
  it('unconfirmed + сервер уже має всі op_id → черга знята без повторної відправки', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: ['a'], missing: [] })  // check-ops
    get.mockResolvedValueOnce({ last_seq: 5 })
    expect(await store.retryBlocked()).toBe('already-saved')
    expect(store.mode).toBe('SYNC')
    expect(store.serverSeq).toBe(5)
    expect(store.inFlightOps).toHaveLength(0)
    expect(readBlocked(SID, null)).toHaveLength(0)
    const batchCalls = post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))
    expect(batchCalls).toHaveLength(1)
  })

  it('unconfirmed + нічого не збережено → свіжий seq і рівно один пакет', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })
    get.mockResolvedValueOnce({ last_seq: 3 })
    post.mockResolvedValueOnce(ok(4))
    expect(await store.retryBlocked()).toBe('sent')
    const batchCalls = post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))
    expect(batchCalls).toHaveLength(2)
    expect((batchCalls[1][1] as { seq: number }).seq).toBe(3)
    expect(store.serverSeq).toBe(4)
    expect(store.mode).toBe('SYNC')
  })

  it('частково збережено → «не можу довести», черга лишається', async () => {
    const store = syncStore()
    store.record(op('a'))
    store.record(op('b'))
    post.mockRejectedValueOnce(httpError(502))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: ['a'], missing: ['b'] })
    expect(await store.retryBlocked()).toBe('unproven')
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.inFlightOps).toHaveLength(2)
  })

  it('rejected тією самою збіркою клієнта — повтор заборонено', async () => {
    const store = syncStore()
    store.record(op('a'))
    store.record(op('bad'))
    post.mockRejectedValueOnce(rejectSecond())
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.canRetryBlocked).toBe(false)
    expect(await store.retryBlocked()).toBe('not-allowed')
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('відкинути: черга, аварійний запис і backup зняті, стан із сервера', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(403))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    get.mockResolvedValueOnce({ last_seq: 9 })
    await store.discardBlocked()
    expect(store.mode).toBe('SYNC')
    expect(store.inFlightOps).toHaveLength(0)
    expect(store.serverSeq).toBe(9)
    expect(readBlocked(SID, null)).toHaveLength(0)
    expect(readBackup(SID)).toBeNull()
  })
})
