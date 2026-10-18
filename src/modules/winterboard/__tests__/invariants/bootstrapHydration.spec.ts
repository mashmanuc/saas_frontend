/** INV-18.1: стан і seq при початковому відкритті підтверджуються разом. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
import apiClient from '@/utils/apiClient'
import { useOpsSyncStore } from '../../stores/opsSyncStore'
import { useWBStore, _resetOperationListeners } from '../../board/state/boardStore'
import { cancelPendingUpdates, flushPendingUpdates } from '../../board/state/assetUpdateBatcher'
import type { WBAsset } from '../../types/winterboard'

vi.mock('@/utils/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  isCircuitBreakerOpen: vi.fn(() => false),
}))

const sid = '00000000-0000-0000-0000-000000000018'
function state(show: boolean) {
  return { pages: [{ id: 'p1', name: 'Сторінка', strokes: [], assets: [{
    id: 'task', type: 'nmt_task', src: '', x: 60, y: 60, w: 640, h: show ? 1020 : 708,
    rotation: 0, data: { version: 1, taskType: 'open_answer', question: '$x+1=2$',
      solution: '$x=1$.', showSolution: show, showAnswer: false },
  }] }], activePageId: 'p1' }
}

beforeEach(() => {
  cancelPendingUpdates()
  _resetOperationListeners()
  setActivePinia(createPinia())
  vi.clearAllMocks()
})
afterEach(() => {
  useOpsSyncStore().reset()
  cancelPendingUpdates()
  _resetOperationListeners()
})

describe('початкова гідрація — стан до seq і SYNC', () => {
  it('застосовує свіжий стан до підтвердження seq', async () => {
    const sync = useOpsSyncStore()
    const fresh = state(true)
    vi.mocked(apiClient.get).mockResolvedValueOnce({ state: fresh, last_seq: 12, stale: false })
    const apply = vi.fn((snapshot) => {
      expect(snapshot).toEqual(fresh)
      expect(sync.mode).toBe('BOOTSTRAP')
      expect(sync.localSeq).toBe(0)
      expect(sync.serverSeq).toBe(0)
    })
    await sync.bootstrap(sid, apply)
    expect(apply).toHaveBeenCalledTimes(1)
    expect(sync.mode).toBe('SYNC')
    expect(sync.localSeq).toBe(12)
    expect(sync.serverSeq).toBe(12)
  })

  it('старий detail не повертається в журнал під виглядом авто-висоти', async () => {
    const sync = useOpsSyncStore()
    const board = useWBStore()
    board.applyCatchUpState(state(false))
    const emitted: unknown[] = []
    board.onOperation(op => emitted.push(op))
    vi.mocked(apiClient.get).mockResolvedValueOnce({ state: state(true), last_seq: 12, stale: false })
    await sync.bootstrap(sid, snapshot => board.applyCatchUpState(snapshot))
    expect(emitted).toHaveLength(0)
    const card = board.currentAssets[0]
    expect(card.data).toMatchObject({ showSolution: true })
    board.updateAsset({ ...card, h: 1010, data: { ...card.data, autoFitH: 1010 } } as unknown as WBAsset)
    flushPendingUpdates()
    expect(board.currentAssets[0].data).toMatchObject({ showSolution: true })
    expect(emitted).toMatchObject([{ op_type: 'asset_update', payload: {
      asset: { data: { showSolution: true } },
    } }])
  })

  it.each([undefined, null, [], 'не стан'])('не підтверджує невалідний стан %j', async invalid => {
    const sync = useOpsSyncStore()
    const apply = vi.fn()
    vi.mocked(apiClient.get).mockResolvedValueOnce({ state: invalid, last_seq: 12, stale: false })
    await expect(sync.bootstrap(sid, apply)).rejects.toThrow()
    expect(apply).not.toHaveBeenCalled()
    expect(sync.mode).toBe('BOOTSTRAP')
    expect(sync.localSeq).toBe(0)
    expect(sync.bootstrapFailed).toBe(true)
  })

  it('stale не гідрує і не просуває лічильників', async () => {
    const sync = useOpsSyncStore()
    const apply = vi.fn()
    vi.mocked(apiClient.get).mockResolvedValueOnce({ state: state(false), last_seq: 12, stale: true })
    await expect(sync.bootstrap(sid, apply)).rejects.toThrow()
    expect(apply).not.toHaveBeenCalled()
    expect(sync.localSeq).toBe(0)
    expect(sync.mode).toBe('BOOTSTRAP')
    expect(sync.bootstrapFailed).toBe(true)
  })

  it('помилка застосування не маскується новим seq чи SYNC', async () => {
    const sync = useOpsSyncStore()
    vi.mocked(apiClient.get).mockResolvedValueOnce({ state: state(true), last_seq: 12, stale: false })
    await expect(sync.bootstrap(sid, () => { throw new Error('hydrate failed') })).rejects.toThrow('hydrate failed')
    expect(sync.localSeq).toBe(0)
    expect(sync.serverSeq).toBe(0)
    expect(sync.mode).toBe('BOOTSTRAP')
  })

  it('Solo передає початковий applier, а не тільки бере seq', () => {
    const source = readFileSync('src/modules/winterboard/views/WBSoloRoom.vue', 'utf8')
    expect(source).toMatch(/opsSync\.bootstrap\(id,\s*(?:\(\s*)?snapshot(?:\s*\))?\s*=>\s*store\.applyCatchUpState\(snapshot\)\)/)
  })
})
