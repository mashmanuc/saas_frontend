/**
 * Б-28 (2026-09-24): дії, відновлені з копії на цьому комп'ютері, — одразу на полотні.
 *
 * Причина дефекту: після запису відновлених дій `localSeq = last_seq`, тож INV-24
 * catchUp відповідав «current», а WS-відлуння відсікав фільтр INV-15 — сервер мав
 * дії, полотно ні, до наступного reload.
 *
 * Контракт звірки (opsSyncStore.reconcileRestored):
 *   звичайний flushAll → свіжий GET /state/ → stale-guard → нова дія? → полотно.
 *   Невдача на будь-якому кроці: копію НЕ знято, полотно НЕ чіпали, проблему видно.
 *   Без повторів (LAW §12). Дублів немає: полотно = канонічний стан, дедуп op_id.
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
import { useOpsSyncStore, SaveBlockedError } from '../../stores/opsSyncStore'
import { useReplayRecorder } from '../../composables/useReplayRecorder'

const SID = '00000000-0000-0000-0000-0000000b0028'
const DEAD_KEY = `wb_ops_backup_v2_${SID}_anon_tab-dead`
const post = apiClient.post as ReturnType<typeof vi.fn>
const get = apiClient.get as ReturnType<typeof vi.fn>

const stroke = (id: string) => ({ op_id: `op-${id}`, op_type: 'stroke_add', page_id: 'p1', payload: { stroke: { id } } })

/** Чесний фейковий сервер: seq до дедупу, дедуп за op_id, стан = застосовані штрихи. */
function fakeServer(preApplied: string[] = []) {
  const server = { seq: preApplied.length, applied: [...preApplied], strokes: preApplied.map(id => id.replace('op-', '')) }
  post.mockImplementation(async (url: string, body: { seq: number; ops: Array<{ op_id: string; payload: { stroke?: { id: string } } }> }) => {
    if (!String(url).includes('/replay/batch/')) throw new Error(`unexpected POST ${url}`)
    if (body.seq !== server.seq) {
      const err = new Error('409') as Error & { response: unknown }
      err.response = { status: 409, data: { error: 'SEQ_MISMATCH', expected_seq: server.seq } }
      throw err
    }
    const fresh = body.ops.filter(o => !server.applied.includes(o.op_id))
    for (const o of fresh) {
      server.applied.push(o.op_id)
      if (o.payload.stroke) server.strokes.push(o.payload.stroke.id)
    }
    server.seq += fresh.length
    return { data: { last_seq: server.seq, applied_count: fresh.length } }
  })
  const state = () => ({ last_seq: server.seq, state: { pages: [{ id: 'p1', strokes: server.strokes.map(id => ({ id })) }] } })
  return { server, state }
}

function writeDeadCopy(ops: ReturnType<typeof stroke>[]) {
  localStorage.setItem(DEAD_KEY, JSON.stringify({ pending: ops, inFlight: [], savedAt: new Date().toISOString() }))
}

/** Полотно кімнати: те, що рекордер отримує в connectToStore (boardStore). */
function canvas() {
  const shown: string[][] = []
  return {
    shown,
    board: {
      onOperation: () => () => {},
      applyCatchUpState: vi.fn((state: Record<string, unknown>) => {
        const pages = (state as { pages: Array<{ strokes: Array<{ id: string }> }> }).pages
        shown.push(pages[0].strokes.map(s => s.id))
      }),
    },
  }
}

async function openBoard(serverSeq: number) {
  const store = useOpsSyncStore()
  store.setBlockedOwner(null)
  get.mockResolvedValueOnce({ last_seq: serverSeq })
  await store.bootstrap(SID)
  const rec = useReplayRecorder({ sessionId: ref<string | null>(SID), getBoardState: () => ({}) })
  return { store, rec }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  post.mockReset()
  get.mockReset()
  localStorage.clear()
  // Web Locks: жива лише поточна вкладка; tab-dead — закрита.
  vi.stubGlobal('navigator', {
    ...globalThis.navigator,
    locks: {
      request: () => new Promise(() => {}),
      query: async () => ({ held: [{ name: `wb-tab:${useOpsSyncStore().tabId}` }] }),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Б-28 · відновлені дії — одразу на полотні', () => {
  it('дія з копії видна одразу після відкриття: запис → свіжий стан → полотно; копію знято', async () => {
    const { server, state } = fakeServer(['op-old'])
    writeDeadCopy([stroke('fromCopy')])
    const { store, rec } = await openBoard(server.seq)
    const { board, shown } = canvas()
    get.mockImplementationOnce(async () => state())
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(server.applied).toEqual(['op-old', 'op-fromCopy'])
    expect(shown).toEqual([['old', 'fromCopy']])          // полотно = стан сервера, з дією з копії
    expect(store.restoring).toBe(false)
    expect(store.restoredPending).toBe(false)
    expect(store.restoreProblem).toBeNull()
    expect(localStorage.getItem(DEAD_KEY)).toBeNull()      // копію знято лише після звірки
  })

  it('копія з уже записаною дією не дає дубля ні на сервері, ні на полотні', async () => {
    const { server, state } = fakeServer(['op-dup'])      // дія вже на сервері
    writeDeadCopy([stroke('dup')])
    const { rec } = await openBoard(server.seq)
    const { board, shown } = canvas()
    get.mockImplementationOnce(async () => state())
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(server.applied).toEqual(['op-dup'])             // сервер відсіяв за op_id
    expect(shown).toEqual([['dup']])                       // на полотні один раз
    expect(localStorage.getItem(DEAD_KEY)).toBeNull()
  })

  it('читання стану не вдалося → копія ціла, полотно не чіпали, проблему видно, без повторів', async () => {
    const { server } = fakeServer()
    writeDeadCopy([stroke('x')])
    const { store, rec } = await openBoard(server.seq)
    const { board } = canvas()
    get.mockRejectedValueOnce(new Error('Network Error'))
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(server.applied).toEqual(['op-x'])               // запис пройшов
    expect(board.applyCatchUpState).not.toHaveBeenCalled()
    expect(store.restoreProblem).toBe('fetch')
    expect(store.restoredPending).toBe(true)
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()  // копія лишилась
    expect(get).toHaveBeenCalledTimes(2)                   // bootstrap + одна спроба, без повторів
    expect(store.inputLocked).toBe(false)                  // малювання повернулось
  })

  it('стан позначено stale → копія ціла, полотно не чіпали', async () => {
    const { server } = fakeServer()
    writeDeadCopy([stroke('x')])
    const { store, rec } = await openBoard(server.seq)
    const { board } = canvas()
    get.mockResolvedValueOnce({ last_seq: 1, stale: true, state: { pages: [] } })
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(board.applyCatchUpState).not.toHaveBeenCalled()
    expect(store.restoreProblem).toBe('stale')
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
  })

  it('запис не вдався → SAVE_BLOCKED (свій банер), копія ціла; після «Перевірити й надіслати» — полотно оновлено', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('x')])
    const { store, rec } = await openBoard(server.seq)
    const { board, shown } = canvas()
    post.mockImplementationOnce(async () => { throw new Error('Network Error') })
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(board.applyCatchUpState).not.toHaveBeenCalled()
    expect(store.restoreProblem).toBeNull()                // не дублюємо банер SAVE_BLOCKED
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
    // дія вчителя: звірка check-ops (нічого не записано) → одна спроба → полотно
    const realPost = post.getMockImplementation()!
    post.mockImplementationOnce(async () => ({ saved: [], missing: ['op-x'] }))
    post.mockImplementation(realPost)
    get.mockResolvedValueOnce({ last_seq: server.seq })    // retryBlocked бере свіжий seq
    get.mockImplementationOnce(async () => state())         // звірка відновлення
    expect(await store.retryBlocked()).toBe('sent')
    expect(await store.reconcileRestored()).toBe('applied') // те, що робить банер після успіху
    expect(shown).toEqual([['x']])
    expect(localStorage.getItem(DEAD_KEY)).toBeNull()
  })

  it('нова дія під час відновлення не зникає: полотно не перезаписано, дія лишається; наступна відправка звіряє', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('fromCopy')])
    const { store, rec } = await openBoard(server.seq)
    const { board, shown } = canvas()
    let resolveState: (v: unknown) => void = () => {}
    get.mockImplementationOnce(() => new Promise(r => { resolveState = r }))
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.restoring).toBe(true)
    expect(store.inputLocked).toBe(true)                   // малювання стоїть
    store.record(stroke('during'))                          // дія, що прослизнула (не малювання)
    const staleForDuring = state()                          // стан сервера БЕЗ нової дії
    get.mockImplementationOnce(async () => state())         // для звірки після наступної відправки
    resolveState(staleForDuring)
    await vi.advanceTimersByTimeAsync(0)
    // Звірка побачила нову дію в черзі → полотно НЕ оновлено станом без неї ('busy');
    // звичайна відправка доставила її, успіх запустив звірку — тепер обидві на полотні.
    expect(server.applied).toEqual(['op-fromCopy', 'op-during'])
    expect(shown).toEqual([['fromCopy', 'during']])        // жодного разу без нової дії
    expect(store.pendingOps).toHaveLength(0)
    expect(store.restoreProblem).toBeNull()
    expect(localStorage.getItem(DEAD_KEY)).toBeNull()      // копію знято лише після звірки
  })

  it('start() і connectToStore() разом — дії з копії підхоплено один раз', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('once')])
    const { rec } = await openBoard(server.seq)
    const { board } = canvas()
    get.mockImplementation(async () => state())
    rec.connectToStore(board)
    rec.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(server.applied).toEqual(['op-once'])
    const batches = post.mock.calls.filter(c => String(c[0]).includes('/replay/batch/'))
    expect(batches.flatMap(c => (c[1] as { ops: Array<{ op_id: string }> }).ops.map(o => o.op_id))).toEqual(['op-once'])
    rec.stop?.()
  })

  it('start() раніше connectToStore(): дії підхоплено без полотна — звірка, щойно полотно зареєстроване', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('early')])
    const { store, rec } = await openBoard(server.seq)
    rec.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(store.restoredPending).toBe(true)
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()   // без полотна копію не знято
    const { board, shown } = canvas()
    get.mockImplementationOnce(async () => state())
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(server.applied).toEqual(['op-early'])
    expect(shown).toEqual([['early']])
    expect(localStorage.getItem(DEAD_KEY)).toBeNull()
    rec.stop?.()
  })

  it('без копії — звірки немає, полотно не чіпаємо', async () => {
    const { server } = fakeServer()
    const { store, rec } = await openBoard(server.seq)
    const { board } = canvas()
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(board.applyCatchUpState).not.toHaveBeenCalled()
    expect(store.restoredPending).toBe(false)
    expect(get).toHaveBeenCalledTimes(1)
  })
})

// SaveBlockedError імпортовано, щоб тип існував для рекордера в цьому модулі.
void SaveBlockedError

describe('Б-28 · «Відкинути» відновленої зупинки', () => {
  it('знімає й копію мертвої вкладки, з якої підхоплено відхилену дію — зупинка не повертається після reload', async () => {
    const { server } = fakeServer()
    writeDeadCopy([stroke('bad')])
    const { store, rec } = await openBoard(server.seq)
    const { board } = canvas()
    post.mockImplementationOnce(async () => {
      const err = new Error('400') as Error & { response: unknown }
      err.response = { status: 400, data: { error: 'validation_failed', invalid_op_index: 0, invalid_op_id: 'op-bad', reason: 'unknown_op_type' } }
      throw err
    })
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.mode).toBe('SAVE_BLOCKED')
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
    get.mockResolvedValueOnce({ last_seq: server.seq })
    await store.discardBlocked()
    expect(store.mode).toBe('SYNC')
    expect(localStorage.getItem(DEAD_KEY)).toBeNull()
    expect(Object.keys(localStorage).filter(k => k.startsWith('wb_ops_'))).toEqual([])
    expect(store.restoredPending).toBe(false)
  })
})

describe('Б-28 · відновлена зупинка + звичайна копія мертвої вкладки', () => {
  it('reload при аварійному записі: звичайну копію теж підхоплено, «Відкинути» знімає обидві — зупинка не повертається', async () => {
    const { server } = fakeServer()
    writeDeadCopy([stroke('fromNormalCopy')])
    // аварійний запис попереднього завантаження (мертва вкладка)
    localStorage.setItem(`wb_ops_blocked_v2_${SID}_anon_tab-deadblk`, JSON.stringify({
      v: 1, sessionId: SID, tabId: 'tab-deadblk', userId: null, savedAt: new Date().toISOString(),
      info: { kind: 'rejected', httpStatus: 400, reason: 'unknown_op_type', invalidOpIndex: 0, invalidOpId: 'op-bad', invalidOpType: 'no_such_op', retryNotBefore: null, at: 0, feBuild: 'x', storageOk: true, restored: false },
      inFlight: [{ op_id: 'op-bad', op_type: 'no_such_op', page_id: 'p1', payload: {} }], pending: [],
    }))
    const { store, rec } = await openBoard(server.seq)
    expect(store.mode).toBe('SAVE_BLOCKED')
    const { board } = canvas()
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.pendingOps.map(o => o.op_id)).toContain('op-fromNormalCopy')
    get.mockResolvedValueOnce({ last_seq: server.seq })
    await store.discardBlocked()
    expect(Object.keys(localStorage).filter(k => k.startsWith('wb_ops_'))).toEqual([])
    expect(post).not.toHaveBeenCalled()
  })
})

describe('Б-28 · рев’ю: гонки звірки', () => {
  it('дія записалась і черга знову порожня, поки читали стан → полотно НЕ оновлено старим станом (busy)', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('fromCopy')])
    const { store, rec } = await openBoard(server.seq)
    const { board, shown } = canvas()
    let resolveState: (v: unknown) => void = () => {}
    get.mockImplementationOnce(() => new Promise(r => { resolveState = r }))
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    const oldState = state()                          // стан ДО нової дії
    store.record(stroke('moved'))
    await store.flush()                                // записано, черга порожня
    expect(store.pendingOps.length + store.inFlightOps.length).toBe(0)
    resolveState(oldState)
    await vi.advanceTimersByTimeAsync(0)
    expect(shown.some(ids => !ids.includes('moved'))).toBe(false)  // жодного разу без нової дії
    expect(store.restoreProblem).toBe('busy')
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
  })

  it('чужа дія через WS під час читання стану → busy', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('fromCopy')])
    const { store, rec } = await openBoard(server.seq)
    const { board } = canvas()
    let resolveState: (v: unknown) => void = () => {}
    get.mockImplementationOnce(() => new Promise(r => { resolveState = r }))
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    const before = state()
    expect(store.applyServerOp({ seq: store.localSeq + 1 })).toBe(true)  // учень намалював
    resolveState(before)
    await vi.advanceTimersByTimeAsync(0)
    expect(board.applyCatchUpState).not.toHaveBeenCalled()
    expect(store.restoreProblem).toBe('busy')
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
  })

  it('два catchUp() під час звірки — лише один додатковий GET', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('fromCopy')])
    const { store, rec } = await openBoard(server.seq)
    const { board } = canvas()
    let resolveState: (v: unknown) => void = () => {}
    get.mockImplementationOnce(() => new Promise(r => { resolveState = r }))
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    get.mockImplementation(async () => state())
    const a = store.catchUp(board.applyCatchUpState)
    const b = store.catchUp(board.applyCatchUpState)
    resolveState(state())
    await Promise.all([a, b])
    expect(get).toHaveBeenCalledTimes(3)              // bootstrap + звірка + один catchUp
  })

  it('Classroom: полотно ще не гідратоване — звірка чекає markCanvasReady()', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('early')])
    const { store, rec } = await openBoard(server.seq)
    const { board, shown } = canvas()
    rec.connectToStore(board, { canvasReady: false })
    await vi.advanceTimersByTimeAsync(0)
    expect(board.applyCatchUpState).not.toHaveBeenCalled()
    expect(store.restoredPending).toBe(true)
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
    get.mockImplementationOnce(async () => state())
    rec.markCanvasReady()
    await vi.advanceTimersByTimeAsync(0)
    expect(shown).toEqual([['early']])
    expect(localStorage.getItem(DEAD_KEY)).toBeNull()
  })

  it('вийшли з кімнати посеред звірки → стан не застосовано до чужого полотна, копія ціла', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('x')])
    const { store, rec } = await openBoard(server.seq)
    const { board } = canvas()
    let resolveState: (v: unknown) => void = () => {}
    get.mockImplementationOnce(() => new Promise(r => { resolveState = r }))
    const unsubscribe = rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    unsubscribe()
    resolveState(state())
    await vi.advanceTimersByTimeAsync(0)
    expect(board.applyCatchUpState).not.toHaveBeenCalled()
    expect(store.restoredPending).toBe(true)
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
  })

  it('полотно кинуло виняток → проблема видима, копія ціла, автоповтору немає', async () => {
    const { server, state } = fakeServer()
    writeDeadCopy([stroke('x')])
    const { store, rec } = await openBoard(server.seq)
    const board = { onOperation: () => () => {}, applyCatchUpState: vi.fn(() => { throw new Error('render') }) }
    get.mockImplementation(async () => state())
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.restoreProblem).toBe('apply')
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
    store.record(stroke('next'))
    await rec.flush()
    await vi.advanceTimersByTimeAsync(0)
    expect(board.applyCatchUpState).toHaveBeenCalledTimes(1)
  })

  it('resync() скидає чергу з діями з копії → пам’ять про відновлення теж; копію НЕ стерто', async () => {
    const { server } = fakeServer()
    writeDeadCopy([stroke('x')])
    const { store, rec } = await openBoard(server.seq)
    const { board } = canvas()
    get.mockRejectedValueOnce(new Error('Network Error'))
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.restoredPending).toBe(true)
    get.mockResolvedValueOnce({ last_seq: server.seq })
    await store.resync(SID)
    expect(store.restoredPending).toBe(false)
    expect(store.restoreProblem).toBeNull()
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
  })

  it('store прийняв лише частину копії → прийняте звіряється, копію НЕ знято', async () => {
    const { server, state } = fakeServer()
    const store0 = useOpsSyncStore()
    const many = Array.from({ length: store0.MAX_BLOCKED_QUEUE_OPS + 5 }, (_, i) => stroke(`m${i}`))
    writeDeadCopy(many)
    const { store, rec } = await openBoard(server.seq)
    store.mode = 'PAUSED'                                // стеля 3000 діє в PAUSED
    const { board } = canvas()
    rec.connectToStore(board)
    await vi.advanceTimersByTimeAsync(0)
    expect(store.pendingOps.length).toBe(store.MAX_BLOCKED_QUEUE_OPS)
    expect(store.restoredPending).toBe(true)
    expect(localStorage.getItem(DEAD_KEY)).not.toBeNull()
    void state
  })
})
