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
    expect(readBlocked(SID, null).records).toHaveLength(1)
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
    expect(readBlocked(SID, null).records).toHaveLength(0)
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
    expect(readBlocked(SID, null).records).toHaveLength(0)
    expect(readBackup(SID)).toBeNull()
  })
})

describe('Рев’ю P0 2026-09-24 · дірки відновлення', () => {
  it('№1 · після «Перевірити й надіслати» сховище відмовило → аварійний запис лишається', async () => {
    const store = syncStore()
    for (let i = 0; i < 60; i++) store.record(op(`o${i}`))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.inFlightOps).toHaveLength(50)
    expect(store.pendingOps).toHaveLength(10)

    post.mockResolvedValueOnce({ saved: [], missing: store.inFlightOps.map(o => o.op_id) })
    get.mockResolvedValueOnce({ last_seq: 0 })
    post.mockResolvedValueOnce(ok(1))
    const real = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k.startsWith('wb_ops_backup_')) throw new DOMException('quota', 'QuotaExceededError')
      real(k, v)
    })
    expect(await store.retryBlocked()).toBe('sent')
    spy.mockRestore()
    expect(store.pendingOps).toHaveLength(10)
    expect(readBackup(SID)).toBeNull()
    // решта 10 змін не втрачається при закритті вкладки: аварійний запис живий
    const left = readBlocked(SID, null).records
    expect(left).toHaveLength(1)
    expect(left[0].record.pending.map(o => o.op_id)).toContain('o59')
  })

  it('№1 · backup ліг і перевірений → аварійний запис знято', async () => {
    const store = syncStore()
    for (let i = 0; i < 60; i++) store.record(op(`o${i}`))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: [], missing: store.inFlightOps.map(o => o.op_id) })
    get.mockResolvedValueOnce({ last_seq: 0 })
    post.mockResolvedValueOnce(ok(1))
    expect(await store.retryBlocked()).toBe('sent')
    expect(readBackup(SID)?.pending).toHaveLength(10)
    expect(readBlocked(SID, null).records).toHaveLength(0)
  })

  it('№1 · пакет повтору завис → аварійний запис ще на місці (закрили вкладку — не втрачено)', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })
    get.mockResolvedValueOnce({ last_seq: 0 })
    post.mockImplementationOnce(() => new Promise(() => {}))
    void store.retryBlocked()
    await vi.advanceTimersByTimeAsync(0)
    expect(post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))).toHaveLength(2)
    expect(readBlocked(SID, null).records).toHaveLength(1)
  })

  it('№2 · пошкоджений аварійний запис → storage_unreadable, 0 HTTP, сирі дані в експорті, discard знімає ключ', async () => {
    const badKey = `wb_ops_blocked_v2_${SID}_anon_oldtab`
    localStorage.setItem(badKey, '{"v":1,"sessionId":"' + SID + '","pending":[{"op_id":"x"')
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 4 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.kind).toBe('storage_unreadable')
    expect(store.canRetryBlocked).toBe(false)
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(post).not.toHaveBeenCalled()
    const exported = store.exportBlocked() as { unreadable_records?: Array<{ key: string; raw: string }> }
    expect(exported.unreadable_records?.[0].key).toBe(badKey)
    expect(exported.unreadable_records?.[0].raw).toContain('"op_id":"x"')

    get.mockResolvedValueOnce({ last_seq: 4 })
    await store.discardBlocked()
    expect(store.mode).toBe('SYNC')
    expect(localStorage.getItem(badKey)).toBeNull()
  })

  it('№2 · невідома версія формату — теж нечитабельна, не «нічого немає»', async () => {
    localStorage.setItem(`wb_ops_blocked_v2_${SID}_anon_t2`, JSON.stringify({ v: 2, sessionId: SID, pending: [], inFlight: [] }))
    const r = readBlocked(SID, null)
    expect(r.records).toHaveLength(0)
    expect(r.unreadable).toHaveLength(1)
  })

  it('№2 · сховище кинуло помилку на читанні → storage_unreadable', async () => {
    localStorage.setItem('unrelated', '1')  // щоб цикл читання взагалі стартував
    const store = useOpsSyncStore()
    const spy = vi.spyOn(localStorage, 'key').mockImplementation(() => { throw new DOMException('denied', 'SecurityError') })
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    spy.mockRestore()
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.kind).toBe('storage_unreadable')
    expect(store.saveBlock?.reason).toBe('storage_read_failed')
  })

  it('№3 · «Відкинути» при недоступному стані сервера → нічого не стерто', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(403))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    get.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.discardBlocked()).rejects.toThrow()
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['a'])
    expect(readBlocked(SID, null).records).toHaveLength(1)
    expect(store.blockResolving).toBe(false)
  })

  it('№4 · 429 Retry-After: кнопка активна; зарано → too-early без HTTP; після строку → надсилає', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(httpError(429, { error: 'throttled' }, { 'retry-after': '5' }))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(store.canRetryBlocked).toBe(true)
    expect(await store.retryBlocked()).toBe('too-early')
    expect(post).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + 5_001)
    expect(store.canRetryBlocked).toBe(true)
    // 429 = сервер пакет точно не застосував → без звірки check-ops
    get.mockResolvedValueOnce({ last_seq: 0 })
    post.mockResolvedValueOnce(ok(1))
    expect(await store.retryBlocked()).toBe('sent')
    expect(store.mode).toBe('SYNC')
  })
})

describe('Рев’ю P0 2026-09-24 (2) · ручний повтор і власник запису', () => {
  async function blockedUnconfirmed() {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })  // check-ops
    get.mockResolvedValueOnce({ last_seq: 3 })
    return store
  }
  const batches = () => post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))

  it('поки пакет ручного повтору в мережі — режим лишається SAVE_BLOCKED', async () => {
    const store = await blockedUnconfirmed()
    post.mockImplementationOnce(() => new Promise(() => {}))
    void store.retryBlocked()
    await vi.advanceTimersByTimeAsync(0)
    expect(batches()).toHaveLength(2)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.isSaveBlocked).toBe(true)
  })

  it('503 на ручному повторі → SAVE_BLOCKED, без автоматичних повторів, черга ціла', async () => {
    const store = await blockedUnconfirmed()
    const rec = recorder()
    post.mockRejectedValueOnce(httpError(503, { error: 'SERVER_BUSY' }, { 'retry-after': '1' }))
    expect(await store.retryBlocked()).toBe('blocked')
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.kind).toBe('unconfirmed')
    expect(store.canRetryBlocked).toBe(true)
    rec.start()
    await vi.advanceTimersByTimeAsync(120_000)
    rec.stop?.()
    expect(batches()).toHaveLength(2)
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['a'])
    expect(readBlocked(SID, null).records).toHaveLength(1)
  })

  it('409 SEQ_MISMATCH на ручному повторі → inFlight НЕ скинуто, SAVE_BLOCKED, наступна спроба лише кнопкою', async () => {
    const store = await blockedUnconfirmed()
    post.mockRejectedValueOnce(httpError(409, { error: 'SEQ_MISMATCH', expected_seq: 7 }))
    expect(await store.retryBlocked()).toBe('blocked')
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.kind).toBe('unconfirmed')
    expect(store.saveBlock?.reason).toBe('seq_mismatch')
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['a'])
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(batches()).toHaveLength(2)
    // друга дія вчителя: звірка → свіжий seq → успіх
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })
    get.mockResolvedValueOnce({ last_seq: 7 })
    post.mockResolvedValueOnce(ok(8))
    expect(await store.retryBlocked()).toBe('sent')
    expect((batches()[2][1] as { seq: number }).seq).toBe(7)
    expect(store.mode).toBe('SYNC')
  })

  it('чужий запис невідомої версії (ключ іншого акаунта) → не видно, не експортується, не стирається', async () => {
    const foreign = `wb_ops_blocked_v2_${SID}_u7_tabA`
    localStorage.setItem(foreign, JSON.stringify({ v: 9, userId: '7', secret: 'A' }))
    const store = useOpsSyncStore()
    store.setBlockedOwner('8')
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SYNC')
    expect(JSON.stringify(store.exportBlocked())).not.toContain('secret')
    expect(localStorage.getItem(foreign)).not.toBeNull()
  })

  it('А бачить свій пошкоджений запис; Б на тому ж комп’ютері — ні, і «Відкинути» Б його не стирає', async () => {
    const aKey = `wb_ops_blocked_v2_${SID}_u7_tabA`
    const aRaw = '{"v":1,"pending":[{"op_id":"x-of-A"'
    localStorage.setItem(aKey, aRaw)
    // Б: є власна зупинка → «Відкинути»
    let store = syncStore()
    store.setBlockedOwner('8')
    store.record(op('b'))
    post.mockRejectedValueOnce(httpError(403))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(JSON.stringify(store.exportBlocked())).not.toContain('x-of-A')
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.discardBlocked()
    expect(localStorage.getItem(aKey)).toBe(aRaw)
    // А: той самий запис → storage_unreadable, сирий рядок у копії
    setActivePinia(createPinia())
    store = useOpsSyncStore()
    store.setBlockedOwner('7')
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.saveBlock?.kind).toBe('storage_unreadable')
    const exp = store.exportBlocked() as { unreadable_records?: Array<{ key: string; raw: string }> }
    expect(exp.unreadable_records?.[0].key).toBe(aKey)
    expect(exp.unreadable_records?.[0].raw).toBe(aRaw)
  })

  it('запис v1 з невстановленим власником → не віддаємо, не стираємо, не блокуємо', async () => {
    const legacy = `wb_ops_blocked_v1_${SID}_tab-old`
    localStorage.setItem(legacy, '{"v":1,"userId":"7","pend')
    const store = useOpsSyncStore()
    store.setBlockedOwner('8')
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SYNC')
    expect(localStorage.getItem(legacy)).not.toBeNull()
  })

  it('запис v1 чужого акаунта невідомої версії → пропущено', () => {
    localStorage.setItem(`wb_ops_blocked_v1_${SID}_tab-old`, JSON.stringify({ v: 5, userId: '7' }))
    const r = readBlocked(SID, '8')
    expect(r.records).toHaveLength(0)
    expect(r.unreadable).toHaveLength(0)
  })

  it('запис v1 свого акаунта, що читається → підхоплено і знято після вирішення', async () => {
    const legacy = `wb_ops_blocked_v1_${SID}_tab-old`
    localStorage.setItem(legacy, JSON.stringify({
      v: 1, sessionId: SID, tabId: 'tab-old', userId: '7', savedAt: '2026-09-23T10:00:00Z',
      info: { kind: 'unconfirmed', httpStatus: 0 }, inFlight: [op('L')], pending: [],
    }))
    const store = useOpsSyncStore()
    store.setBlockedOwner('7')
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['L'])
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.discardBlocked()
    expect(localStorage.getItem(legacy)).toBeNull()
  })

  it('зіпсований savedAt поруч зі справним записом → без падіння, storage_unreadable', async () => {
    const good = {
      v: 1, sessionId: SID, tabId: 't1', userId: null, savedAt: '2026-09-23T10:00:00Z',
      info: { kind: 'unconfirmed', httpStatus: 0 }, inFlight: [op('g')], pending: [],
    }
    localStorage.setItem(`wb_ops_blocked_v2_${SID}_anon_t1`, JSON.stringify(good))
    localStorage.setItem(`wb_ops_blocked_v2_${SID}_anon_t2`, JSON.stringify({ ...good, tabId: 't2', savedAt: 12345 }))
    expect(() => readBlocked(SID, null)).not.toThrow()
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.kind).toBe('storage_unreadable')
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['g'])
  })
})

describe('Рев’ю P0 2026-09-24 (3) · перехід між дошками і дії під час ручного пакета', () => {
  const SID_B = '00000000-0000-0000-0000-0000000000bb'
  const batches = () => post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))

  async function blockA() {
    const store = syncStore()
    store.record(op('a1'))
    post.mockRejectedValueOnce(httpError(403))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(readBlocked(SID, null).records).toHaveLength(1)
    return store
  }

  it('А заблокована → відкрити Б → збій запису Б → копія А ціла', async () => {
    const store = await blockA()
    const aBefore = readBlocked(SID, null).records[0]
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID_B)
    expect(store.mode).toBe('SYNC')
    expect(store.saveBlock).toBeNull()
    store.record(op('b1'))
    const real = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k.includes(SID_B)) throw new DOMException('quota', 'QuotaExceededError')
      real(k, v)
    })
    post.mockRejectedValueOnce(httpError(403))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    spy.mockRestore()
    expect(store.saveBlock?.storageOk).toBe(false)
    const aAfter = readBlocked(SID, null).records
    expect(aAfter).toHaveLength(1)
    expect(aAfter[0].key).toBe(aBefore.key)
    expect(aAfter[0].record.inFlight.map(o => o.op_id)).toEqual(['a1'])
  })

  it('А заблокована → Б заблокована й відкинута → копія А ціла; повернення на А знову показує зупинку', async () => {
    const store = await blockA()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID_B)
    store.record(op('b1'))
    post.mockRejectedValueOnce(httpError(403))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.discardBlocked()
    expect(readBlocked(SID_B, null).records).toHaveLength(0)
    expect(readBlocked(SID, null).records).toHaveLength(1)
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['a1'])
  })

  it('нова дія під час ручного пакета + успіх + backup відмовив → аварійна копія містить нову дію', async () => {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })  // check-ops
    get.mockResolvedValueOnce({ last_seq: 0 })
    let resolveBatch: (v: unknown) => void = () => {}
    post.mockImplementationOnce(() => new Promise(r => { resolveBatch = r }))
    const pending = store.retryBlocked()
    await vi.advanceTimersByTimeAsync(0)
    expect(batches()).toHaveLength(2)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.record(op('during'))).toBe(true)  // вчитель малює, поки пакет у мережі

    const real = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k.startsWith('wb_ops_backup_')) throw new DOMException('quota', 'QuotaExceededError')
      real(k, v)
    })
    resolveBatch(ok(1))
    expect(await pending).toBe('sent')
    spy.mockRestore()
    expect(store.mode).toBe('SYNC')
    expect(readBackup(SID)).toBeNull()
    const left = readBlocked(SID, null).records
    expect(left).toHaveLength(1)
    expect(left[0].record.pending.map(o => o.op_id)).toEqual(['during'])
    expect(left[0].record.inFlight).toHaveLength(0)  // 'a' уже на сервері — не повертаємо
  })
})

describe('Рев’ю P0 2026-09-24 (4) · нові дії під час повтору, коли сховище відмовило повністю', () => {
  const batches = () => post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))

  async function retryWithActionDuring(breakStorage: (k: string) => boolean) {
    const store = syncStore()
    store.record(op('a'))
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    post.mockResolvedValueOnce({ saved: [], missing: ['a'] })  // check-ops
    get.mockResolvedValueOnce({ last_seq: 0 })
    let resolveBatch: (v: unknown) => void = () => {}
    post.mockImplementationOnce(() => new Promise(r => { resolveBatch = r }))
    const pending = store.retryBlocked()
    await vi.advanceTimersByTimeAsync(0)
    expect(store.record(op('during'))).toBe(true)
    const real = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (breakStorage(k)) throw new DOMException('quota', 'QuotaExceededError')
      real(k, v)
    })
    resolveBatch(ok(1))
    const result = await pending
    return { store, result, spy }
  }

  it('обидві копії відмовили → зупинка НЕ знімається, введення заблоковано, вихід під охороною', async () => {
    const { store, result, spy } = await retryWithActionDuring(k => k.startsWith('wb_ops_'))
    expect(result).toBe('sent-held')
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.storageOk).toBe(false)
    expect(store.inputLocked).toBe(true)
    expect(store.hasUnsecuredQueue).toBe(true)
    expect(store.pendingOps.map(o => o.op_id)).toEqual(['during'])
    expect(store.inFlightOps).toHaveLength(0)
    // рекордер нічого не шле сам
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    expect(batches()).toHaveLength(2)
    // сховище ожило → наступна дія вчителя надсилає нові дії
    spy.mockRestore()
    expect(store.canRetryBlocked).toBe(true)
    get.mockResolvedValueOnce({ last_seq: 1 })
    post.mockResolvedValueOnce(ok(2))
    expect(await store.retryBlocked()).toBe('sent')
    expect((batches()[2][1] as { ops: Array<{ op_id: string }> }).ops.map(o => o.op_id)).toEqual(['during'])
    expect(store.mode).toBe('SYNC')
    expect(store.hasUnsecuredQueue).toBe(false)
  })

  it('аварійний запис відмовив, звичайний backup ліг → зупинку знято, нові дії в backup', async () => {
    const { store, result, spy } = await retryWithActionDuring(k => k.startsWith('wb_ops_blocked_'))
    spy.mockRestore()
    expect(result).toBe('sent')
    expect(store.mode).toBe('SYNC')
    expect(readBackup(SID)?.pending.map((o: { op_id: string }) => o.op_id)).toEqual(['during'])
    expect(readBlocked(SID, null).records).toHaveLength(0)
  })
})

describe('Рев’ю P0 2026-09-24 (5) · PAUSED, звичайна копія, розмір пакета', () => {
  const batches = () => post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))

  function pausedStore() {
    const store = syncStore()
    store.mode = 'PAUSED'
    return store
  }

  it('PAUSED: стеля черги як у SAVE_BLOCKED — відмова видима, введення заблоковано', () => {
    const store = pausedStore()
    for (let i = 0; i < store.MAX_BLOCKED_QUEUE_OPS; i++) store.pendingOps.push(op(`q${i}`))
    expect(store.record(op('over'))).toBe(false)
    expect(store.droppedWhileBlocked).toBe(1)
    expect(store.inputLocked).toBe(true)
  })

  it('PAUSED: звичайна копія не лягла → введення заблоковано й «черга без копії»; копія лягла → знято', () => {
    const store = pausedStore()
    store.record(op('p1'))
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(store.persistQueue()).toBe(false)
    expect(store.inputLocked).toBe(true)
    expect(store.pausedUnsecured).toBe(true)
    expect(store.hasUnsecuredQueue).toBe(true)
    spy.mockRestore()
    expect(store.persistQueue()).toBe(true)
    expect(store.inputLocked).toBe(false)
    expect(store.hasUnsecuredQueue).toBe(false)
  })

  it('SYNC: невдала копія не блокує малювання (черга піде за ~2 с), але вихід охороняється', () => {
    const store = syncStore()
    store.record(op('s1'))
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(store.persistQueue()).toBe(false)
    spy.mockRestore()
    expect(store.inputLocked).toBe(false)
    expect(store.hasUnsecuredQueue).toBe(true)
  })

  it('рекордер: невдалий запис копії доходить до store, а не лише console.warn', async () => {
    const store = syncStore()
    const rec = recorder()
    store.mode = 'PAUSED'
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    rec.record({ op_type: 'stroke_add', page_id: 'p1', payload: { stroke: { id: 's' } } } as never)
    await vi.advanceTimersByTimeAsync(1_100)
    spy.mockRestore()
    expect(store.backupFailed).toBe(true)
    expect(store.inputLocked).toBe(true)
    rec.stop?.()
  })

  it('пошкоджена звичайна копія своєї дошки → storage_unreadable, сирі дані в експорті, не стерто до «Відкинути»', async () => {
    const key = `wb_ops_backup_v2_${SID}_anon_tab-old`
    localStorage.setItem(key, '{"pending":[{"op_id":"lost-1"')
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.saveBlock?.kind).toBe('storage_unreadable')
    expect(localStorage.getItem(key)).not.toBeNull()
    const exp = store.exportBlocked() as { unreadable_records?: Array<{ key: string; raw: string }> }
    expect(exp.unreadable_records?.[0].raw).toContain('lost-1')
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.discardBlocked()
    expect(localStorage.getItem(key)).toBeNull()
  })

  it('звичайна копія іншого акаунта на тій самій дошці не читається', () => {
    const store = syncStore()
    store.setBlockedOwner('7')
    store.record(op('of-7'))
    expect(store.persistQueue()).toBe(true)
    store.setBlockedOwner('8')
    expect(readBackup(SID)).toBeNull()
    store.setBlockedOwner('7')
    expect(readBackup<{ op_id: string }>(SID)?.pending.map(o => o.op_id)).toEqual(['of-7'])
  })

  it('пакет обмежено сумарним розміром, не лише 50 діями', async () => {
    const store = syncStore()
    const big = 'x'.repeat(50 * 1024)
    for (let i = 0; i < 4; i++) store.record(op(`b${i}`, 'stroke_add', { blob: big }))
    post.mockResolvedValueOnce(ok(2))
    await store.flush()
    const sent = (batches()[0][1] as { ops: unknown[] }).ops
    expect(sent).toHaveLength(2)
    expect(new TextEncoder().encode(JSON.stringify(sent)).byteLength).toBeLessThanOrEqual(store.MAX_BATCH_BYTES)
    expect(store.pendingOps).toHaveLength(2)
  })

  it('злиття штрихів не перевищує 64 KB — інакше частина йде окремим op', () => {
    const LIMIT = 64 * 1024
    const pts = Array.from({ length: 2500 }, (_, i) => [i, i, 0.5])  // ~40 KB кожна частина
    const last = op('a1', 'stroke_append', { stroke_id: 'S', points: [...pts] })
    const incoming = op('a2', 'stroke_append', { stroke_id: 'S', points: [...pts] })
    expect(tryCoalesceStrokeAppend(last, incoming, LIMIT)).toBe(false)
    expect((last.payload as { points: unknown[] }).points).toHaveLength(2500)  // не змінено
    const small1 = op('b1', 'stroke_append', { stroke_id: 'T', points: [[1, 1, 0.5]] })
    const small2 = op('b2', 'stroke_append', { stroke_id: 'T', points: [[2, 2, 0.5]] })
    expect(tryCoalesceStrokeAppend(small1, small2, LIMIT)).toBe(true)
    expect((small1.payload as { points: unknown[] }).points).toHaveLength(2)
  })

  it('рекордер передає ліміт у злиття: під навантаженням великі частини не зливаються', () => {
    const store = syncStore()
    store.mode = 'PAUSED'  // flush не дозливає чергу — поріг злиття лишається досягнутим
    const rec = recorder()
    for (let i = 0; i < 60; i++) store.pendingOps.push(op(`f${i}`))
    const pts = Array.from({ length: 2500 }, (_, i) => [i, i, 0.5])
    rec.record({ op_id: 'a1', op_type: 'stroke_append', page_id: 'p1', payload: { stroke_id: 'S', points: pts } } as never)
    rec.record({ op_id: 'a2', op_type: 'stroke_append', page_id: 'p1', payload: { stroke_id: 'S', points: pts } } as never)
    const appends = store.pendingOps.filter(o => o.op_type === 'stroke_append')
    expect(appends).toHaveLength(2)
    for (const a of appends) {
      expect(new TextEncoder().encode(JSON.stringify(a.payload)).byteLength).toBeLessThanOrEqual(64 * 1024)
    }
    rec.stop?.()
  })
})

describe('Рев’ю P0 2026-09-24 (6) · дві вкладки, розмір як на сервері, старі копії', () => {
  it('розмір рахується як на сервері: реальні UTF-8 байти, дроби — як Python', () => {
    expect(serverPayloadBytes({ text: 'І'.repeat(11_000) })).toBe(22_011)
    expect(serverPayloadBytes({ e: '😀' })).toBe('{"e":""}'.length + 4)
    // JS 1e-7 → Python 1e-07: на байт довше на кожному такому числі
    expect(serverPayloadBytes({ p: [1e-7] })).toBe('{"p":[1e-07]}'.length)
  })

  it('картка з довгим українським текстом: у межах — іде, понад 64 KB — не зупиняє пакет', async () => {
    const store = syncStore()
    const rec = recorder()
    rec.record({ op_id: 'ok1', op_type: 'stroke_add', page_id: 'p1', payload: { stroke: { id: 's' } } } as never)
    rec.record({ op_id: 'mid', op_type: 'asset_update', page_id: 'p1', payload: { text: 'І'.repeat(11_000) } } as never)
    rec.record({ op_id: 'big', op_type: 'asset_update', page_id: 'p1', payload: { text: 'І'.repeat(33_000) } } as never)
    // 11 000 «І» = 22 KB — сервер приймає, отже й фронт; 33 000 = 66 011 > 64 KB — ні
    expect(store.pendingOps.map(o => o.op_id)).toEqual(['ok1', 'mid'])
    expect(trackEvent).toHaveBeenCalledWith('wb.ops.payload_oversized', expect.objectContaining({ bytes: 66_011 }))
    rec.stop?.()
  })

  it('злиття штрихів рахує розмір як сервер', () => {
    const LIMIT = 64 * 1024
    const last = op('a1', 'stroke_append', { stroke_id: 'S', points: [[1, 1, 0.5]] })
    const incoming = op('a2', 'stroke_append', { stroke_id: 'S', points: [[2, 2, 0.5]] })
    expect(tryCoalesceStrokeAppend(last, incoming, LIMIT)).toBe(true)
    // Малі дроби: JS пише 1e-7, Python — 1e-07 (+1 байт на число). Рахунок
    // JSON.stringify пропустив би злиття, сервер — ні.
    const pts = (n: number) => Array.from({ length: n }, () => [1e-7, 2e-7, 0.5])
    const big = op('b1', 'stroke_append', { stroke_id: 'T', points: pts(2900) })
    const more = op('b2', 'stroke_append', { stroke_id: 'T', points: pts(1000) })
    const merged = { stroke_id: 'T', points: pts(3900) }
    expect(serverPayloadBytes(merged)).toBeGreaterThan(LIMIT)
    expect(new TextEncoder().encode(JSON.stringify(merged)).byteLength).toBeLessThan(LIMIT)  // UTF-8 пропустив би
    expect(tryCoalesceStrokeAppend(big, more, LIMIT)).toBe(false)  // сервер: > 64 KB
  })

  it('дві вкладки одного вчителя: порожня вкладка не стирає копію іншої; нова вкладка підхоплює й лише потім знімає', async () => {
    // вкладка A: є незбережена дія
    const a = syncStore()
    a.setBlockedOwner('7')
    a.record(op('fromA'))
    expect(a.persistQueue()).toBe(true)
    const aKey = Object.keys(localStorage).find(k => k.startsWith(`wb_ops_backup_v2_${SID}_u7_`))!
    // вкладка B: свіжий store (інша вкладка), порожня черга пише «копію»
    setActivePinia(createPinia())
    const b = syncStore()
    b.setBlockedOwner('7')
    expect(b.persistQueue()).toBe(true)
    expect(localStorage.getItem(aKey)).not.toBeNull()
    // B відкриває дошку з рекордером → підхоплює дію A, пише свою копію, знімає копію A
    const rec = recorder()
    rec.start?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.pendingOps.map(o => o.op_id)).toContain('fromA')
    const keys = Object.keys(localStorage).filter(k => k.startsWith(`wb_ops_backup_v2_${SID}_u7_`))
    expect(keys).toHaveLength(1)
    expect(keys[0]).not.toBe(aKey)
    rec.stop?.()
  })

  it('нова вкладка не змогла записати свою копію → копію іншої вкладки НЕ знято', async () => {
    const a = syncStore()
    a.record(op('fromA'))
    a.persistQueue()
    const aKey = Object.keys(localStorage).find(k => k.startsWith(`wb_ops_backup_v2_${SID}_anon_`))!
    setActivePinia(createPinia())
    const b = syncStore()
    const real = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k.startsWith('wb_ops_backup_v2_') && k !== aKey) throw new DOMException('quota', 'QuotaExceededError')
      real(k, v)
    })
    const rec = recorder()
    rec.start?.()
    await vi.advanceTimersByTimeAsync(0)
    spy.mockRestore()
    expect(b.pendingOps.map(o => o.op_id)).toContain('fromA')
    expect(localStorage.getItem(aKey)).not.toBeNull()
    rec.stop?.()
  })

  it('стара копія без власника: не відновлюється й не надсилається, але видима для завантаження й прибирання', async () => {
    const legacyKey = `wb_ops_backup_${SID}`
    localStorage.setItem(legacyKey, JSON.stringify({ pending: [op('old-1')], inFlight: [], savedAt: new Date().toISOString() }))
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    const rec = recorder()
    rec.start?.()
    expect(store.mode).toBe('SYNC')
    expect(store.pendingOps.map(o => o.op_id)).not.toContain('old-1')
    expect(store.legacyCopies.map(c => c.key)).toEqual([legacyKey])
    const exp = store.exportLegacyCopies() as { records: Array<{ raw: string }> }
    expect(exp.records[0].raw).toContain('old-1')
    store.dismissLegacyCopies()
    expect(localStorage.getItem(legacyKey)).toBeNull()
    expect(store.legacyCopies).toHaveLength(0)
    rec.stop?.()
  })
})

describe('Рев’ю P0 2026-09-24 (7) · копії живих вкладок не чіпаємо', () => {
  it('копію ЖИВОЇ вкладки A нова вкладка не підхоплює й не стирає — дія A, дописана пізніше, не зникає', async () => {
    const a = syncStore()
    a.record(op('a1'))
    a.persistQueue()
    const aTab = a.tabId
    const aKey = Object.keys(localStorage).find(k => k.startsWith(`wb_ops_backup_v2_${SID}_anon_`))!
    setActivePinia(createPinia())
    liveTabs = [aTab]  // A відкрита
    const b = syncStore()
    const rec = recorder()
    rec.start?.()
    // A дописує дію, поки B відновлюється
    localStorage.setItem(aKey, JSON.stringify({ pending: [op('a1'), op('a2')], inFlight: [], savedAt: new Date().toISOString() }))
    await vi.advanceTimersByTimeAsync(0)
    expect(b.pendingOps.map(o => o.op_id)).not.toContain('a1')
    expect(JSON.parse(localStorage.getItem(aKey)!).pending.map((o: { op_id: string }) => o.op_id)).toEqual(['a1', 'a2'])
    rec.stop?.()
  })

  it('аварійний запис ЖИВОЇ вкладки не підхоплюється і не стирається «Відкинути» іншої', async () => {
    const a = syncStore()
    a.record(op('a1'))
    post.mockRejectedValueOnce(httpError(403))
    await expect(a.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    const aTab = a.tabId
    const aKey = readBlocked(SID, null).records[0].key
    setActivePinia(createPinia())
    liveTabs = [aTab]
    const b = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await b.bootstrap(SID)
    expect(b.mode).toBe('SYNC')
    expect(b.pendingOps).toHaveLength(0)
    expect(localStorage.getItem(aKey)).not.toBeNull()
  })

  it('Web Locks немає (живість невідома) → чужу копію підхоплюємо, але НЕ стираємо', async () => {
    const a = syncStore()
    a.record(op('a1'))
    a.persistQueue()
    const aKey = Object.keys(localStorage).find(k => k.startsWith(`wb_ops_backup_v2_${SID}_anon_`))!
    setActivePinia(createPinia())
    vi.stubGlobal('navigator', { ...globalThis.navigator, locks: undefined })
    const b = syncStore()
    const rec = recorder()
    rec.start?.()
    await vi.advanceTimersByTimeAsync(0)
    expect(b.pendingOps.map(o => o.op_id)).toContain('a1')
    expect(localStorage.getItem(aKey)).not.toBeNull()
    rec.stop?.()
  })
})

describe('Рев’ю P0 2026-09-24 (8) · власник після виходу, злиття вкладок, повтор без копії', () => {
  it('вихід / смерть сесії (user → null) не переносить запис на `anon`; після входу він видимий', async () => {
    const store = syncStore()
    store.setBlockedOwner('7')
    store.record(op('mine'))
    post.mockRejectedValueOnce(httpError(403))
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    store.setBlockedOwner(null)          // authStore.user = null
    store.record(op('after-logout'))
    store.persistQueue()                  // destroy() рекордера на смерті сесії
    expect(Object.keys(localStorage).some(k => k.includes('_anon_'))).toBe(false)
    const rec = readBlocked(SID, '7').records
    expect(rec).toHaveLength(1)
    expect([...rec[0].record.inFlight, ...rec[0].record.pending].map(o => o.op_id)).toEqual(['mine', 'after-logout'])
  })

  it('інший акаунт у тій самій вкладці: черга попереднього — у ЙОГО копію, з пам’яті геть', () => {
    const store = syncStore()
    store.setBlockedOwner('7')
    store.record(op('of-7'))
    store.setBlockedOwner('8')
    expect(store.pendingOps).toHaveLength(0)
    store.setBlockedOwner('7')
    // копія 7-го лишилась під його ключем
    expect(Object.keys(localStorage).some(k => k.startsWith(`wb_ops_backup_v2_${SID}_u7_`))).toBe(true)
  })

  it('аварійні записи трьох мертвих вкладок по 50 → у мережі не більше одного пакета, решта у pending', async () => {
    for (const t of ['t1', 't2', 't3']) {
      localStorage.setItem(`wb_ops_blocked_v2_${SID}_anon_${t}`, JSON.stringify({
        v: 1, sessionId: SID, tabId: t, userId: null, savedAt: `2026-09-23T10:0${t.slice(1)}:00Z`,
        info: { kind: 'unconfirmed', httpStatus: 0 }, inFlight: Array.from({ length: 50 }, (_, i) => op(`${t}-${i}`)), pending: [],
      }))
    }
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(store.inFlightOps).toHaveLength(50)
    expect(store.inFlightOps[0].op_id).toBe('t1-0')
    expect(store.pendingOps).toHaveLength(100)
    expect(store.pendingOps[0].op_id).toBe('t2-0')
  })

  it('повтор успішний, звичайна копія не лягла → лишений запис має «не підтверджено», не старе `rejected`', async () => {
    const store = syncStore()
    store.record(op('a'))
    store.record(op('bad'))
    post.mockRejectedValueOnce(rejectSecond())
    await expect(store.flush()).rejects.toBeInstanceOf(SaveBlockedError)
    // «нова збірка клієнта»: дозволяємо повтор rejected
    store.saveBlock = { ...store.saveBlock!, feBuild: 'older-build' }
    // rejected: сервер точно не застосував — без звірки check-ops
    get.mockResolvedValueOnce({ last_seq: 0 })
    let resolveBatch: (v: unknown) => void = () => {}
    post.mockImplementationOnce(() => new Promise(r => { resolveBatch = r }))
    const pending = store.retryBlocked()
    await vi.advanceTimersByTimeAsync(0)
    store.record(op('during'))
    const real = localStorage.setItem.bind(localStorage)
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((k: string, v: string) => {
      if (k.startsWith('wb_ops_backup_')) throw new DOMException('quota', 'QuotaExceededError')
      real(k, v)
    })
    resolveBatch(ok(2))
    expect(await pending).toBe('sent')
    spy.mockRestore()
    const kept = readBlocked(SID, null).records
    expect(kept).toHaveLength(1)
    expect(kept[0].record.info.kind).toBe('unconfirmed')
    expect(kept[0].record.pending.map(o => o.op_id)).toEqual(['during'])
  })

  it('копія із зіпсованою датою — нечитабельна (у банер і експорт), а не «прострочена й стерта»', async () => {
    const key = `wb_ops_backup_v2_${SID}_anon_tab-old`
    localStorage.setItem(key, JSON.stringify({ pending: [op('x')], inFlight: [], savedAt: 'not-a-date' }))
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.saveBlock?.kind).toBe('storage_unreadable')
    expect(localStorage.getItem(key)).not.toBeNull()
  })
})

describe('Рев’ю P0 2026-09-24 (9) · дошку не підключено до збереження', () => {
  it('стан при відкритті не отримано → не мовчки: bootstrapFailed, малювання заблоковано; успіх знімає', async () => {
    const store = useOpsSyncStore()
    get.mockRejectedValueOnce(new Error('Network Error'))
    await expect(store.bootstrap(SID)).rejects.toThrow('Network Error')
    expect(store.mode).toBe('BOOTSTRAP')
    expect(store.bootstrapFailed).toBe(true)
    expect(store.inputLocked).toBe(true)
    expect(store.record(op('lost'))).toBe(false)
    get.mockResolvedValueOnce({ last_seq: 0 })
    await store.bootstrap(SID)
    expect(store.bootstrapFailed).toBe(false)
    expect(store.inputLocked).toBe(false)
  })
})
