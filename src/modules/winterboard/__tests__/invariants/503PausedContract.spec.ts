/**
 * TLV2-G1 / G1b — контракт 503 → PAUSED (SYSTEM_LAW §5, §12; OPS_SYNC_SSOT INV-12).
 *
 * G1 виміряв стару поведінку на FE `6b3bb204`: PAUSED не показувався, `Retry now` не
 * існувало, таймер переживав DESYNC і вихід, лічильник 503 переходив на іншу дошку.
 * G1b (рішення власника 2026-09-16) — цільовий контракт, який ці тести тримають:
 *
 *  - SYNC: первинна спроба + 2 повтори з backoff; третя 503 поспіль → PAUSED;
 *  - PAUSED: черги з тими самими op_id цілі; звичайні flush() без HTTP;
 *  - спроба відновлення — рівно один HTTP раз на 30 с (один таймер) або «Повторити зараз»;
 *  - 503 / без відповіді → лишаємось у PAUSED і таймер заново; інша відповідь → SYNC;
 *  - без паралельних запитів;
 *  - DESYNC, resync, reset, вихід із кімнати, зміна дошки — таймер і лічильник скинуто;
 *  - черга дошки при виході / зміні дошки йде в backup і повертається без дублів.
 *
 * Спроби виконує справжній `useReplayRecorder` (як у кімнатах). Solo-кімната `start()`
 * не викликає, тому більшість тестів іде без safety interval — так, як у Solo.
 * Годинник і таймери фейкові.
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
// Семплер write-path сам шле POST /telemetry/ingest/ — у тесті рахуємо лише batch.
vi.mock('../../telemetry/writePathTelemetry', () => ({ emitWritePathEvent: vi.fn() }))

import apiClient from '@/utils/apiClient'
import { useOpsSyncStore, BackpressureError } from '../../stores/opsSyncStore'
import { useReplayRecorder } from '../../composables/useReplayRecorder'
import { readBackup, saveBackup } from '../../composables/useOpsBackup'

const SID = '00000000-0000-0000-0000-0000000000a1'
const OTHER_SID = '00000000-0000-0000-0000-0000000000b2'
const post = apiClient.post as ReturnType<typeof vi.fn>
const get = apiClient.get as ReturnType<typeof vi.fn>
const noStore = { onOperation: () => () => {} }

function op(id: string) {
  return { op_id: id, op_type: 'stroke_add', page_id: 'p1', payload: {} }
}

function busy(headers?: Record<string, string>) {
  const err = new Error('Request failed with status code 503') as Error & {
    response: { status: number; data: Record<string, unknown>; headers?: Record<string, string> }
  }
  err.response = { status: 503, data: { error: 'SERVER_BUSY' }, ...(headers ? { headers } : {}) }
  return err
}

function httpError(status: number, data: Record<string, unknown>) {
  const err = new Error(`Request failed with status code ${status}`) as Error & {
    response: { status: number; data: Record<string, unknown> }
  }
  err.response = { status, data }
  return err
}

const ok = (lastSeq: number) => ({ data: { last_seq: lastSeq, applied_count: 1 } })

function deferred() {
  let resolve!: (v: unknown) => void
  const promise = new Promise(res => { resolve = res })
  return { promise, resolve }
}

/** op_id кожного HTTP-виклику batch, у порядку викликів. */
function sentOpIds(): string[][] {
  return post.mock.calls.map(call => (call[1] as { ops: { op_id: string }[] }).ops.map(o => o.op_id))
}

function syncStore(sid = SID) {
  const store = useOpsSyncStore()
  store.sessionId = sid
  store.mode = 'SYNC'
  store.serverSeq = 0
  store.localSeq = 0
  return store
}

function soloRecorder(sid = ref<string | null>(SID)) {
  return useReplayRecorder({ sessionId: sid, getBoardState: () => ({}) })
}

/** Три 503 поспіль напряму через store, з очікуванням backoff між ними. */
async function driveToPaused(store: ReturnType<typeof useOpsSyncStore>) {
  for (let i = 0; i < 3; i++) {
    post.mockRejectedValueOnce(busy())
    await expect(store.flush()).rejects.toThrow('503')
    if (store.retryUntil !== null) await vi.advanceTimersByTimeAsync(store.retryUntil - Date.now())
  }
  expect(store.mode).toBe('PAUSED')
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-16T10:00:00Z'))
  post.mockReset()
  get.mockReset()
  localStorage.clear()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('A1 · до PAUSED — 3 HTTP; у PAUSED — один HTTP раз на 30 с', () => {
  it('Classroom (safety interval): 2/4/6 с → PAUSED; далі 36 с, 66 с по одному запиту; успіх дозливає чергу', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    const t0 = Date.now()
    const attemptsAt: number[] = []
    post.mockImplementation(async () => {
      attemptsAt.push(Date.now() - t0)
      throw busy()
    })
    store.record(op('op-1'))
    recorder.start()

    await vi.advanceTimersByTimeAsync(6_000)
    expect(attemptsAt).toEqual([2000, 4000, 6000])
    expect(store.mode).toBe('PAUSED')

    await vi.advanceTimersByTimeAsync(29_999)
    expect(post).toHaveBeenCalledTimes(3)

    await vi.advanceTimersByTimeAsync(1)
    expect(attemptsAt).toEqual([2000, 4000, 6000, 36_000])
    expect(store.mode).toBe('PAUSED')

    store.record(op('op-2'))  // дія під час PAUSED
    await vi.advanceTimersByTimeAsync(30_000)
    expect(attemptsAt).toEqual([2000, 4000, 6000, 36_000, 66_000])

    post.mockReset()
    post.mockResolvedValueOnce(ok(1)).mockResolvedValueOnce(ok(2))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(store.mode).toBe('SYNC')
    expect(sentOpIds()).toEqual([['op-1'], ['op-2']])
    expect(store.pendingOps).toEqual([])
    expect(store.inFlightOps).toEqual([])
    recorder.destroy()
  })

  it('Solo (без safety interval): спробу виконує рекордер кімнати, а не тік', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)

    await vi.advanceTimersByTimeAsync(29_999)
    expect(post).toHaveBeenCalledTimes(3)
    post.mockResolvedValueOnce(ok(1))
    await vi.advanceTimersByTimeAsync(1)
    expect(post).toHaveBeenCalledTimes(4)
    expect(store.mode).toBe('SYNC')
    recorder.destroy()
  })
})

describe('A2 · backoff: 200·2^(n−1) + floor(random·150); Retry-After (секунди) має пріоритет', () => {
  it('без Retry-After: спроба 1 → 200…349 мс, спроба 2 → 400…549 мс', async () => {
    const store = syncStore()
    store.record(op('op-1'))
    const random = vi.spyOn(Math, 'random')

    random.mockReturnValue(0)  // постійно: Math.random кличуть і поза jitter
    post.mockRejectedValueOnce(busy())
    await expect(store.flush()).rejects.toThrow('503')
    expect((store.retryUntil as number) - Date.now()).toBe(200)

    await expect(store.flush()).rejects.toThrow(/backoff active/)
    expect(post).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(200)
    random.mockReturnValue(0.9999)
    post.mockRejectedValueOnce(busy())
    await expect(store.flush()).rejects.toThrow('503')
    expect((store.retryUntil as number) - Date.now()).toBe(400 + 149)
  })

  it('успіх у SYNC посеред повторів скидає лічильник: наступна серія знову має 3 спроби', async () => {
    const store = syncStore()
    store.record(op('op-1'))
    post.mockRejectedValueOnce(busy())
    await expect(store.flush()).rejects.toThrow('503')
    await vi.advanceTimersByTimeAsync(store.retryUntil! - Date.now())
    post.mockResolvedValueOnce(ok(1))
    await store.flush()
    expect(store.retryUntil).toBeNull()

    store.record(op('op-2'))
    await driveToPaused(store)
    expect(post).toHaveBeenCalledTimes(2 + 3)
  })

  it('Retry-After перекриває формулу; обидва регістри; HTTP-date → формула', async () => {
    const store = syncStore()
    store.record(op('op-1'))
    vi.spyOn(Math, 'random').mockReturnValue(0)

    post.mockRejectedValueOnce(busy({ 'retry-after': '3' }))
    await expect(store.flush()).rejects.toThrow('503')
    expect((store.retryUntil as number) - Date.now()).toBe(3000)

    await vi.advanceTimersByTimeAsync(3000)
    post.mockRejectedValueOnce(busy({ 'Retry-After': '0.5' }))
    await expect(store.flush()).rejects.toThrow('503')
    expect((store.retryUntil as number) - Date.now()).toBe(500)

    await vi.advanceTimersByTimeAsync(500)
    post.mockRejectedValueOnce(busy({ 'retry-after': 'Wed, 16 Sep 2026 10:05:00 GMT' }))
    await expect(store.flush()).rejects.toThrow('503')
    expect(store.mode).toBe('PAUSED')

    store.resumeFromPause()
    post.mockRejectedValueOnce(busy({ 'retry-after': 'Wed, 16 Sep 2026 10:05:00 GMT' }))
    await expect(store.flush()).rejects.toThrow('503')
    expect((store.retryUntil as number) - Date.now()).toBe(200)
  })
})

describe('A3 · один таймер; звичайний flush у PAUSED не робить HTTP', () => {
  it('таймер рівно один: після входу, повторного enterPaused і кожної невдалої спроби', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    expect(vi.getTimerCount()).toBe(1)

    store.enterPaused('again')
    expect(vi.getTimerCount()).toBe(1)

    for (let cycle = 0; cycle < 3; cycle++) {
      post.mockRejectedValueOnce(busy())
      await vi.advanceTimersByTimeAsync(30_000)
      expect(store.mode).toBe('PAUSED')
      expect(vi.getTimerCount()).toBe(1)
    }
    expect(post).toHaveBeenCalledTimes(3 + 3)
    recorder.destroy()
  })

  it('flush() у PAUSED без дозволу → BackpressureError без HTTP, скільки б разів не кликали', async () => {
    const store = syncStore()
    store.record(op('op-1'))
    await driveToPaused(store)
    for (let i = 0; i < 5; i++) {
      await expect(store.flush()).rejects.toBeInstanceOf(BackpressureError)
    }
    expect(post).toHaveBeenCalledTimes(3)
  })
})

describe('A4 · «Повторити зараз»: одна спроба, без паралельних запитів', () => {
  it('знімає таймер, робить один HTTP; 503 → PAUSED і новий таймер від моменту натискання', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    await vi.advanceTimersByTimeAsync(20_000)

    post.mockRejectedValueOnce(busy())
    store.retryNow()
    await vi.advanceTimersByTimeAsync(0)
    expect(post).toHaveBeenCalledTimes(4)
    expect(store.mode).toBe('PAUSED')
    expect(vi.getTimerCount()).toBe(1)

    // Старий розклад (через 10 с) не спрацьовує — новий відлік 30 с від натискання.
    await vi.advanceTimersByTimeAsync(29_999)
    expect(post).toHaveBeenCalledTimes(4)
    post.mockResolvedValueOnce(ok(1))
    await vi.advanceTimersByTimeAsync(1)
    expect(post).toHaveBeenCalledTimes(5)
    expect(store.mode).toBe('SYNC')
    expect(vi.getTimerCount()).toBe(0)
    recorder.destroy()
  })

  it('подвійне натискання, натискання під час запиту і спрацювання таймера — один HTTP', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)

    const pending = deferred()
    post.mockImplementationOnce(() => pending.promise)
    store.retryNow()
    store.retryNow()
    expect(store.probeInFlight).toBe(true)
    await vi.advanceTimersByTimeAsync(31_000)
    store.retryNow()
    expect(post).toHaveBeenCalledTimes(4)
    expect(vi.getTimerCount()).toBe(0)

    pending.resolve(ok(1))
    await vi.advanceTimersByTimeAsync(0)
    expect(store.mode).toBe('SYNC')
    expect(store.probeInFlight).toBe(false)
    expect(post).toHaveBeenCalledTimes(4)
    recorder.destroy()
  })

  it('SYNC: одночасні flush() (тік, debounce, кнопка) — один HTTP на batch', async () => {
    const store = syncStore()
    store.record(op('op-1'))
    const pending = deferred()
    post.mockImplementationOnce(() => pending.promise)
    const a = store.flush()
    const b = store.flush()
    const c = store.flush()
    expect(post).toHaveBeenCalledTimes(1)
    pending.resolve(ok(1))
    await Promise.all([a, b, c])
    expect(post).toHaveBeenCalledTimes(1)
  })

  it('retryNow поза PAUSED нічого не робить', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    store.retryNow()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(post).not.toHaveBeenCalled()
    recorder.destroy()
  })
})

describe('A5 · результат спроби з PAUSED', () => {
  it('без HTTP-відповіді (мережа) → лишаємось у PAUSED, черга ціла, таймер заново', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    post.mockRejectedValueOnce(new Error('Network Error'))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(store.mode).toBe('PAUSED')
    expect(store.inFlightOps.map(o => o.op_id)).toEqual(['op-1'])
    expect(vi.getTimerCount()).toBe(1)
    recorder.destroy()
  })

  it('інша відповідь сервера (409 SEQ_MISMATCH) → вихід у SYNC, далі звичайна обробка', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    post.mockRejectedValueOnce(httpError(409, { error: 'SEQ_MISMATCH', expected_seq: 7 }))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(store.mode).toBe('SYNC')
    expect(store.serverSeq).toBe(7)
    expect(vi.getTimerCount()).toBe(0)
    recorder.destroy()
  })

  it('успіх → SYNC, лічильник з нуля: наступна серія знову 3 спроби', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    post.mockResolvedValueOnce(ok(1))
    await vi.advanceTimersByTimeAsync(30_000)
    expect(store.mode).toBe('SYNC')
    expect(store.retryUntil).toBeNull()

    store.record(op('op-2'))
    await driveToPaused(store)
    expect(post).toHaveBeenCalledTimes(3 + 1 + 3)
    recorder.destroy()
  })

  it('PAUSED із порожньою чергою → через 30 с SYNC без HTTP', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.enterPaused('manual')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(store.mode).toBe('SYNC')
    expect(post).not.toHaveBeenCalled()
    recorder.destroy()
  })
})

describe('A6 · скидання: DESYNC, resync, reset', () => {
  it('DESYNC знімає таймер; через 60 с жодного HTTP', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    store.enterDesync('test-desync')
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(store.mode).toBe('DESYNC')
    expect(post).toHaveBeenCalledTimes(3)
    recorder.destroy()
  })

  it('DESYNC з іншої вкладки (INV-19) теж знімає таймер PAUSED', async () => {
    const channels: { onmessage: ((e: { data: unknown }) => void) | null }[] = []
    vi.stubGlobal('BroadcastChannel', class {
      onmessage: ((e: { data: unknown }) => void) | null = null
      constructor() { channels.push(this) }
      postMessage() {}
      close() {}
    })
    const store = useOpsSyncStore()
    get.mockResolvedValueOnce({ last_seq: 0, state: {} })
    await store.bootstrap(SID)
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    expect(vi.getTimerCount()).toBe(1)

    channels[0]!.onmessage!({ data: { type: 'mode_change', mode: 'DESYNC', origin: 'tab-other', ts: 0 } })
    expect(store.mode).toBe('DESYNC')
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(post).toHaveBeenCalledTimes(3)
    recorder.destroy()
    vi.unstubAllGlobals()
  })

  it('DESYNC → resync() → знову первинна спроба + 2 повтори', async () => {
    const store = syncStore()
    store.record(op('op-1'))
    await driveToPaused(store)
    store.enterDesync('test-desync')
    get.mockResolvedValueOnce({ last_seq: 0, state: {} })
    await store.resync(SID)
    expect(store.mode).toBe('SYNC')
    expect(vi.getTimerCount()).toBe(0)

    store.record(op('op-2'))
    await driveToPaused(store)
    expect(post).toHaveBeenCalledTimes(3 + 3)
  })

  it('reset(): таймерів 0', async () => {
    const store = syncStore()
    store.record(op('op-1'))
    await driveToPaused(store)
    store.reset()
    expect(vi.getTimerCount()).toBe(0)
    expect(store.mode).toBe('BOOTSTRAP')
  })
})

describe('A7 · вихід і зміна дошки: таймер скинуто, черга з тими самими op_id не губиться', () => {
  it('вихід (destroy) у PAUSED: таймера немає, HTTP немає, черга — у backup дошки', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    store.record(op('op-2'))

    recorder.destroy()
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(post).toHaveBeenCalledTimes(3)

    const backup = readBackup<{ op_id: string }>(SID)
    expect(backup?.inFlight.map(o => o.op_id)).toEqual(['op-1'])
    expect(backup?.pending.map(o => o.op_id)).toEqual(['op-2'])
  })

  it('зміна дошки: таймер знято одразу, ще до відповіді /state/ нової дошки', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    get.mockImplementationOnce(() => new Promise(() => {}))
    void store.bootstrap(OTHER_SID)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(post).toHaveBeenCalledTimes(3)
    recorder.destroy()
  })

  it('інша дошка: свіжі 3 спроби; повернення на першу — ті самі op_id з backup, без дублів', async () => {
    const store = syncStore()
    const recorderA = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    store.record(op('op-2'))
    recorderA.destroy()

    get.mockResolvedValueOnce({ last_seq: 0, state: {} })
    await store.bootstrap(OTHER_SID)
    const recorderB = soloRecorder(ref(OTHER_SID))
    recorderB.connectToStore(noStore)
    expect(store.mode).toBe('SYNC')
    expect(vi.getTimerCount()).toBe(0)
    store.record(op('op-B'))
    post.mockRejectedValueOnce(busy())
    await expect(store.flush()).rejects.toThrow('503')
    expect(store.mode).toBe('SYNC')  // перша 503 на новій дошці — лише спроба 1
    recorderB.destroy()

    post.mockReset()
    post.mockResolvedValueOnce(ok(1))
    get.mockResolvedValueOnce({ last_seq: 0, state: {} })
    await store.bootstrap(SID)
    const recorderA2 = soloRecorder()
    recorderA2.connectToStore(noStore)
    await vi.advanceTimersByTimeAsync(0)
    expect(sentOpIds()[0]).toEqual(['op-1', 'op-2'])
    recorderA2.destroy()
  })

  it('повернення на ту саму дошку, коли черга ще в пам\'яті: backup не дублює op_id', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    await driveToPaused(store)
    store.record(op('op-2'))
    recorder.destroy()

    get.mockResolvedValueOnce({ last_seq: 0, state: {} })
    await store.bootstrap(SID)
    post.mockReset()
    post.mockResolvedValue(ok(2))
    const again = soloRecorder()
    again.connectToStore(noStore)
    const ids = [...store.inFlightOps, ...store.pendingOps].map(o => o.op_id)
    expect(new Set(ids).size).toBe(ids.length)
    await vi.advanceTimersByTimeAsync(0)
    expect(sentOpIds().flat().filter(id => id === 'op-1')).toHaveLength(1)
    again.destroy()
  })

  it('зміна дошки в тій самій кімнаті: черга попередньої дошки йде в її backup, не в нову', async () => {
    const store = syncStore()
    const sid = ref<string | null>(SID)
    const recorder = soloRecorder(sid)
    store.record(op('op-1'))
    await driveToPaused(store)
    recorder.record(op('op-2') as never)  // через рекордер: throttle backup ще не спрацював

    sid.value = OTHER_SID
    get.mockResolvedValueOnce({ last_seq: 0, state: {} })
    await store.bootstrap(OTHER_SID)
    await vi.advanceTimersByTimeAsync(5_000)

    const backupA = readBackup<{ op_id: string }>(SID)
    expect([...(backupA?.inFlight ?? []), ...(backupA?.pending ?? [])].map(o => o.op_id))
      .toEqual(['op-1', 'op-2'])
    expect(readBackup(OTHER_SID)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    recorder.destroy()
  })

  it('чужа дошка: її backup не підмішується в store, а черга store не пишеться в її backup', async () => {
    const store = syncStore()
    saveBackup(OTHER_SID, [op('foreign')], [])
    const recorder = soloRecorder(ref(OTHER_SID))
    recorder.connectToStore(noStore)
    expect(store.pendingOps).toEqual([])

    store.record(op('op-1'))
    post.mockRejectedValueOnce(busy())
    await recorder.flush()  // помилка → рекордер пише backup, але черга належить SID
    recorder.destroy()
    expect(readBackup<{ op_id: string }>(OTHER_SID)?.pending.map(o => o.op_id)).toEqual(['foreign'])
  })
})

describe('A8 · ті самі op_id без дублів; дії під час PAUSED ідуть після batch, у порядку', () => {
  it('усі спроби несуть той самий batch; op-3 з PAUSED — окремим batch після відновлення', async () => {
    const store = syncStore()
    const recorder = soloRecorder()
    store.record(op('op-1'))
    store.record(op('op-2'))
    await driveToPaused(store)
    expect(store.record(op('op-3'))).toBe(true)

    post.mockRejectedValueOnce(busy())
    await vi.advanceTimersByTimeAsync(30_000)
    post.mockResolvedValueOnce(ok(2)).mockResolvedValueOnce(ok(3))
    store.retryNow()
    await vi.advanceTimersByTimeAsync(0)

    expect(sentOpIds()).toEqual([
      ['op-1', 'op-2'], ['op-1', 'op-2'], ['op-1', 'op-2'],
      ['op-1', 'op-2'],
      ['op-1', 'op-2'],
      ['op-3'],
    ])
    expect(store.pendingOps).toEqual([])
    expect(store.inFlightOps).toEqual([])
    expect(store.localSeq).toBe(3)
    recorder.destroy()
  })
})
