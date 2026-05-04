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
import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'
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

describe('boardStore.updateAsset — Layer A whitelist filter', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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

    expect(ops.length).toBe(1)
    expect(ops[0].op_type).toBe('asset_update')
    unsub()
  })

  it('2. SKIPS op when identical asset called multiple times (Layer A)', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset()
    store.addAsset(asset, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    // Симулюємо 8 викликів з identical values (типовий drop spam scenario)
    for (let i = 0; i < 8; i++) {
      store.updateAsset({ ...asset }, { skipHistory: true })
    }

    expect(ops.length).toBe(0)  // ВСІ skipped
    unsub()
  })

  it('3. emits 1 op + skips 7 duplicates (mixed scenario)', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset()
    store.addAsset(asset, 'page-1', { skipHistory: true })

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    // 1 real change + 7 duplicates
    store.updateAsset({ ...asset, x: 999 }, { skipHistory: true })  // real op
    for (let i = 0; i < 7; i++) {
      store.updateAsset({ ...asset, x: 999 }, { skipHistory: true })  // duplicates
    }

    expect(ops.length).toBe(1)
    unsub()
  })

  it('4. does NOT push undo command on skip', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset()
    store.addAsset(asset, 'page-1', { skipHistory: true })
    store.undoStack = []

    // Identical update — should be skipped, no undo entry
    store.updateAsset({ ...asset })  // no skipHistory → would push command

    expect(store.undoStack.length).toBe(0)  // skip пройшов до undo push
  })

  it('5. does NOT mark dirty on skip', () => {
    const store = useWBStore()
    seedPage(store)
    const asset = makeAsset()
    store.addAsset(asset, 'page-1', { skipHistory: true })
    store.isDirty = false  // reset after addAsset

    store.updateAsset({ ...asset }, { skipHistory: true })

    expect(store.isDirty).toBe(false)  // not dirty — Layer A skip
  })

  it('6. emits op when DocumentViewer currentPage changes (real op)', () => {
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

    // Only FE-only field changes → Layer A skips
    store.updateAsset({ ...asset, status: 'ready' }, { skipHistory: true })
    store.updateAsset({ ...asset, errorMessage: 'oops' }, { skipHistory: true })

    expect(ops.length).toBe(0)
    unsub()
  })

  it('8. handles non-existent asset id gracefully (early return)', () => {
    const store = useWBStore()
    seedPage(store)

    const ops: RecordOperationRequest[] = []
    const unsub = store.onOperation((op) => ops.push(op))

    store.updateAsset(makeAsset({ id: 'non-existent' }), { skipHistory: true })

    expect(ops.length).toBe(0)  // existing behavior — id not found, return
    unsub()
  })
})
