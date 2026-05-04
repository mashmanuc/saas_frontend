/**
 * Phase 1A (Plan v1.1): Integration tests для Layer A filter у boardStore.updateAsset.
 *
 * Plan ref: saas_docs/plans/classroom/CORE_UPDATEASSET_STABILIZATION_PLAN_2026-05-04.md §6
 *
 * Verifies:
 *   - identical updateAsset calls → 0 ops emitted (Layer A skip)
 *   - changed asset → 1 op emitted
 *   - history (undoStack) НЕ pushes на skip (no-op = no history)
 *   - markDirty НЕ called на skip (no state mutation)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
import { cancelPendingUpdates } from '../board/state/assetUpdateBatcher'
import type { WBAsset } from '../types/winterboard'
import type { RecordOperationRequest } from '../types/replay'

function makeAsset(overrides: Partial<WBAsset> = {}): WBAsset {
  return {
    id: 'asset-1',
    type: 'image',
    src: 'test.png',
    x: 100, y: 100, w: 200, h: 150,
    rotation: 0,
    locked: false,
    ...overrides,
  }
}

function seedPage(store: ReturnType<typeof useWBStore>) {
  store.pages = [{ id: 'page-1', name: 'Page 1', strokes: [], assets: [] }]
  store.currentPageIndex = 0
}

describe('boardStore.updateAsset — Layer A whitelist filter + Layer B RAF batch', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    cancelPendingUpdates()  // Phase 1B: clean batcher state
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(performance.now()), 16) as unknown as number
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
    })
  })

  afterEach(() => {
    cancelPendingUpdates()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('1. emits op when asset changes (sanity check)', () => {
    const store = useWBStore()
    seedPage(store)
    const initial = makeAsset({ x: 100 })
    store.addAsset(initial, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    const updated = { ...initial, x: 200 }  // changed x
    store.updateAsset(updated, { skipHistory: true })
    vi.advanceTimersByTime(16)  // Phase 1B: RAF flush

    expect(ops.length).toBe(1)
    expect(ops[0].op_type).toBe('asset_update')
    unsub()
  })

  it('2. SKIPS op when identical asset called multiple times (Layer A immediate skip)', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset()
    store.addAsset(asset, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    // 8 identical → Layer A skip (immediate, не доходить до Layer B)
    for (let i = 0; i < 8; i++) {
      store.updateAsset({ ...asset }, { skipHistory: true })
    }
    vi.advanceTimersByTime(16)

    expect(ops.length).toBe(0)  // ВСІ skipped Layer A'ом
    unsub()
  })

  it('3. emits 1 op + skips 7 duplicates (mixed: 1 real + 7 identical)', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset()
    store.addAsset(asset, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    // 1 real change → batcher schedule. 7 identical → Layer A skip.
    store.updateAsset({ ...asset, x: 999 }, { skipHistory: true })
    for (let i = 0; i < 7; i++) {
      store.updateAsset({ ...asset, x: 999 }, { skipHistory: true })  // identical to current... wait
    }
    // Wait — after batcher schedule, current не змінився, тож наступні { x: 999 } теж identical?
    // НІ — буфер містить asset з x=999, але pages[i].assets[idx] ще має x=0 (бо apply не виконано).
    // Тому Layer A check проти CURRENT (з store.pages), не buffer. Усі 7 наступних теж потрапляють у batcher.
    // Buffer.set 8 разів з тим же asset → 1 entry → 1 flush → 1 op.
    vi.advanceTimersByTime(16)

    expect(ops.length).toBe(1)
    unsub()
  })

  it('4. does NOT push undo command on Layer A skip (immediate skip)', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset()
    store.addAsset(asset, 'page-1', { skipHistory: true })
    store.undoStack = []

    // Identical update — Layer A skip ДО batcher, ДО history push
    store.updateAsset({ ...asset })  // no skipHistory → would push command if reach _applyAssetUpdate
    vi.advanceTimersByTime(16)

    expect(store.undoStack.length).toBe(0)  // Layer A skipped before history push
  })

  it('5. does NOT mark dirty on Layer A skip', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset()
    store.addAsset(asset, 'page-1', { skipHistory: true })
    store.isDirty = false

    store.updateAsset({ ...asset }, { skipHistory: true })
    vi.advanceTimersByTime(16)

    expect(store.isDirty).toBe(false)  // not dirty — Layer A immediate skip
  })

  it('6. emits op when DocumentViewer currentPage changes (real op via batch)', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset({
      type: 'document_viewer',
      content_ref: { content_id: 1, content_type: 'pdf' },
      currentPage: 0,
      totalPages: 100,
    })
    store.addAsset(asset, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    store.updateAsset({ ...asset, currentPage: 5 }, { skipHistory: true })
    vi.advanceTimersByTime(16)

    expect(ops.length).toBe(1)
    unsub()
  })

  it('7. SKIPS op when only FE-only fields change (status, errorMessage)', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset({ status: 'uploading' })
    store.addAsset(asset, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    // Only FE-only field changes → Layer A skips immediately
    store.updateAsset({ ...asset, status: 'ready' }, { skipHistory: true })
    store.updateAsset({ ...asset, errorMessage: 'oops' }, { skipHistory: true })
    vi.advanceTimersByTime(16)

    expect(ops.length).toBe(0)
    unsub()
  })

  it('8. handles non-existent asset id gracefully (early return)', () => {
    const store = useWBStore()
    seedPage(store)

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    store.updateAsset(makeAsset({ id: 'non-existent' }), { skipHistory: true })
    vi.advanceTimersByTime(16)

    expect(ops.length).toBe(0)
    unsub()
  })

  // ─── Phase 1B specific: RAF batching ──────────────────────────────────────

  it('9. Phase 1B — drag pattern (5 updates у 1 frame) → 1 op з final position', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset({ x: 0, y: 0 })
    store.addAsset(asset, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    // Симуляція drag — 5 pointermoves + drag-end у one frame
    store.updateAsset({ ...asset, x: 10 }, { skipHistory: true })
    store.updateAsset({ ...asset, x: 20 }, { skipHistory: true })
    store.updateAsset({ ...asset, x: 30 }, { skipHistory: true })
    store.updateAsset({ ...asset, x: 40 }, { skipHistory: true })
    store.updateAsset({ ...asset, x: 99 }, { skipHistory: true })  // drag-end
    expect(ops.length).toBe(0)  // нічого не applied поки RAF не fired

    vi.advanceTimersByTime(16)

    expect(ops.length).toBe(1)  // 1 op коаlесcs всі 5 викликів
    const finalAsset = (ops[0].payload as { asset: WBAsset }).asset
    expect(finalAsset.x).toBe(99)  // final value (drag-end)
    unsub()
  })

  it('10. Phase 1B — 2 окремих asset_id у 1 frame → 2 ops (separate lanes)', () => {
    const store = useWBStore()
    seedPage(store)
    const a = makeAsset({ id: 'asset-a', x: 0 })
    const b = makeAsset({ id: 'asset-b', x: 0 })
    store.addAsset(a, 'page-1', { skipHistory: true })
    store.addAsset(b, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    store.updateAsset({ ...a, x: 100 }, { skipHistory: true })
    store.updateAsset({ ...b, x: 200 }, { skipHistory: true })
    vi.advanceTimersByTime(16)

    expect(ops.length).toBe(2)
    unsub()
  })

  it('11. Phase 1B — sequential frames (post-flush new update) → 2 ops', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset({ x: 0 })
    store.addAsset(asset, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    store.updateAsset({ ...asset, x: 100 }, { skipHistory: true })
    vi.advanceTimersByTime(16)  // flush #1

    store.updateAsset({ ...asset, x: 200 }, { skipHistory: true })
    vi.advanceTimersByTime(16)  // flush #2

    expect(ops.length).toBe(2)  // 2 separate frames → 2 ops
    unsub()
  })
})
