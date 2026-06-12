/**
 * INV-24 WS-CATCHUP (2026-06-13) — read-side reconciliation після WS (re)subscribe.
 *
 * Контекст (prod-репро classroom/71): live-канал stroke.broadcast — lossy за
 * дизайном → учень після F5/reconnect назавжди втрачав чужі штрихи (дані в БД
 * цілі, розрив лише на канві). catchUp() — санкціонований механізм reconciliation.
 *
 * Інваріанти під тестом (SSOT INV-24):
 *   #1 mode-guard:    SYNC-only ('blocked' у BOOTSTRAP/DESYNC/PAUSED, fetch не летить)
 *   #2 flush-first:   flushAll failure → ABORT, applier не викликаний, ops не втрачені
 *   #3 stale-guard:   body.stale=true → no hydrate, no seq advance
 *   #4 hydrate-gap:   applied ТІЛЬКИ якщо last_seq > localSeq; counters після applyState
 *   #5 coalescing:    конкурентні виклики → один GET, один результат
 *   #7 no-drop:       pendingOps НЕ дропаються (на відміну від resync())
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/utils/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  isCircuitBreakerOpen: vi.fn(() => false),
}))

import apiClient from '@/utils/apiClient'
import { useOpsSyncStore } from '../../stores/opsSyncStore'

const FAKE_SID = '00000000-0000-0000-0000-000000000001'

function _op() {
  return {
    op_id: crypto.randomUUID(),
    op_type: 'stroke_add',
    page_id: 'p1',
    payload: {},
  }
}

/** bootstrap() store до SYNC зі вказаним server last_seq. */
async function _bootstrapped(lastSeq = 5) {
  const store = useOpsSyncStore()
  vi.mocked(apiClient.get).mockResolvedValueOnce({ last_seq: lastSeq, state: {}, stale: false })
  await store.bootstrap(FAKE_SID)
  expect(store.mode).toBe('SYNC')
  expect(store.localSeq).toBe(lastSeq)
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.mocked(apiClient.get).mockReset()
  vi.mocked(apiClient.post).mockReset()
})

describe('INV-24 #1 mode-guard: catchUp SYNC-only', () => {
  it('BOOTSTRAP (до bootstrap()) → blocked, GET /state/ не викликається', async () => {
    const store = useOpsSyncStore()
    const applier = vi.fn()

    const result = await store.catchUp(applier)

    expect(result.status).toBe('blocked')
    expect(applier).not.toHaveBeenCalled()
    expect(apiClient.get).not.toHaveBeenCalled()
  })

  it('DESYNC → blocked (recovery шлях = resync(), не catchUp)', async () => {
    const store = await _bootstrapped()
    store.enterDesync('test-desync')
    const applier = vi.fn()

    const result = await store.catchUp(applier)

    expect(result.status).toBe('blocked')
    expect(applier).not.toHaveBeenCalled()
    // 1 GET = тільки bootstrap; catchUp нічого не фетчив
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })

  it('PAUSED → blocked (backpressure; flushAll кинув би BackpressureError)', async () => {
    const store = await _bootstrapped()
    store.enterPaused('test-backpressure')
    const applier = vi.fn()

    const result = await store.catchUp(applier)

    expect(result.status).toBe('blocked')
    expect(applier).not.toHaveBeenCalled()
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })
})

describe('INV-24 #2 flush-first: failure → ABORT без hydrate', () => {
  it('flushAll кинув (network) → flush-failed, applier не викликаний, ops збережені', async () => {
    const store = await _bootstrapped(5)
    store.record(_op())
    expect(store.pendingOps.length).toBe(1)

    // Generic network error (без response) → _doFlush rethrow, inFlight preserved
    vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('network down'))
    const applier = vi.fn()

    const result = await store.catchUp(applier)

    expect(result.status).toBe('flush-failed')
    expect(applier).not.toHaveBeenCalled()
    expect(store.localSeq).toBe(5) // no advance
    // INV-24 #7: власні ops НЕ втрачені (inFlight preserved за flush-контрактом)
    expect(store.pendingOps.length + store.inFlightOps.length).toBe(1)
    // GET після bootstrap не літав (abort ДО fetch)
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })
})

describe('INV-24 #3 stale-guard', () => {
  it('body.stale=true → no hydrate, no seq advance', async () => {
    const store = await _bootstrapped(5)
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      last_seq: 9,
      state: { pages: [{ id: 'p1', strokes: [], assets: [] }] },
      stale: true,
    })
    const applier = vi.fn()

    const result = await store.catchUp(applier)

    expect(result.status).toBe('stale')
    expect(applier).not.toHaveBeenCalled()
    expect(store.localSeq).toBe(5)
    expect(store.serverSeq).toBe(5)
  })

  it('gap без state payload (contract guard) → stale, no advance', async () => {
    const store = await _bootstrapped(5)
    vi.mocked(apiClient.get).mockResolvedValueOnce({ last_seq: 9, stale: false })
    const applier = vi.fn()

    const result = await store.catchUp(applier)

    expect(result.status).toBe('stale')
    expect(applier).not.toHaveBeenCalled()
    expect(store.localSeq).toBe(5)
  })
})

describe('INV-24 #4 hydrate-gap semantics', () => {
  it('last_seq == localSeq → current, no hydrate', async () => {
    const store = await _bootstrapped(5)
    vi.mocked(apiClient.get).mockResolvedValueOnce({ last_seq: 5, state: {}, stale: false })
    const applier = vi.fn()

    const result = await store.catchUp(applier)

    expect(result.status).toBe('current')
    expect(result.lastSeq).toBe(5)
    expect(applier).not.toHaveBeenCalled()
    expect(store.localSeq).toBe(5)
  })

  it('last_seq < localSeq (stale-ish counter) → current, serverSeq не регресує', async () => {
    const store = await _bootstrapped(5)
    vi.mocked(apiClient.get).mockResolvedValueOnce({ last_seq: 3, state: {}, stale: false })

    const result = await store.catchUp(vi.fn())

    expect(result.status).toBe('current')
    expect(store.serverSeq).toBe(5)
    expect(store.localSeq).toBe(5)
  })

  it('last_seq > localSeq → applied: applier(state) + counters advance ПІСЛЯ applyState', async () => {
    const store = await _bootstrapped(5)
    const serverState = { pages: [{ id: 'p1', strokes: [{ id: 's1' }], assets: [] }] }
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      last_seq: 9,
      state: serverState,
      stale: false,
    })

    let seqAtApplyTime = -1
    const applier = vi.fn(() => {
      // INV-24 #8: на момент applyState counters ЩЕ старі (advance атомарно після)
      seqAtApplyTime = store.localSeq
    })

    const result = await store.catchUp(applier)

    expect(result.status).toBe('applied')
    expect(result.lastSeq).toBe(9)
    expect(applier).toHaveBeenCalledOnce()
    expect(applier).toHaveBeenCalledWith(serverState)
    expect(seqAtApplyTime).toBe(5)
    expect(store.localSeq).toBe(9)
    expect(store.serverSeq).toBe(9)
  })
})

describe('INV-24 #5 coalescing (single-flight)', () => {
  it('2 конкурентні catchUp → 1 GET, обидва отримують той самий результат', async () => {
    const store = await _bootstrapped(5)

    let resolveFetch!: (v: unknown) => void
    vi.mocked(apiClient.get).mockReturnValueOnce(
      new Promise((resolve) => { resolveFetch = resolve }) as never,
    )
    const applier = vi.fn()

    const p1 = store.catchUp(applier)
    const p2 = store.catchUp(applier)

    resolveFetch({ last_seq: 9, state: { pages: [] }, stale: false })
    const [r1, r2] = await Promise.all([p1, p2])

    expect(r1.status).toBe('applied')
    expect(r2.status).toBe('applied')
    expect(applier).toHaveBeenCalledOnce()
    // bootstrap GET + рівно один catch-up GET
    expect(apiClient.get).toHaveBeenCalledTimes(2)
  })

  it('після завершення mutex відпущений — наступний catchUp фетчить знову', async () => {
    const store = await _bootstrapped(5)
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ last_seq: 5, state: {}, stale: false })
      .mockResolvedValueOnce({ last_seq: 5, state: {}, stale: false })

    await store.catchUp(vi.fn())
    await store.catchUp(vi.fn())

    expect(apiClient.get).toHaveBeenCalledTimes(3) // bootstrap + 2 catch-up
  })
})
