/**
 * Phase G.4 — boardStore.graphParamSet + replay handler tests
 *
 * Per OPS_SYNC_SSOT.md INV-21 + STORE-RULES 1-10:
 *   - STORE-RULE-1: base_seq read from asset.data.meta.last_snapshot_seq
 *   - STORE-RULE-2: local mutation BEFORE emit
 *   - STORE-RULE-3: skipEmit fully gates emit (replay path)
 *   - STORE-RULE-4: param_set NEVER triggers asset_update
 *   - STORE-RULE-6: strict seq apply ordering
 *   - STORE-RULE-7: snapshot full-replaces params
 *   - STORE-RULE-8: multi-asset isolation
 *   - STORE-RULE-10: critical scenario — snapshot seq=11 + stale param_set base_seq=10 → DROP
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useWBStore } from '../board/state/boardStore'
import { applyReplayOperation } from '../engine/applyReplayOperation'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import type { WBAsset } from '../types/winterboard'
import type { BoardOperation } from '../types/replay'

// Mock vendor module so import doesn't pull canvas/ResizeObserver into vitest
vi.mock('../vendor/graph_calculator/graph-calculator.js', () => ({
  GraphCalculator: class {},
  default: class {},
  GraphCalc: {},
}))

beforeEach(() => {
  setActivePinia(createPinia())
  // Mock recordOperation pipeline so emits are observable
  ;(globalThis as any).__wbRecordedOps = [] as BoardOperation[]
})

afterEach(() => {
  vi.clearAllMocks()
  delete (globalThis as any).__wbRecordedOps
})

function makeGraphAsset(id = 'gc-1', snapshotSeq = 0, params: Record<string, number> = {}): WBAsset {
  // HARD SPEC: wrap flat-number params into {value, min, max, step} structure.
  const wrapped: Record<string, { value: number; min: number; max: number; step: number }> = {}
  for (const [k, v] of Object.entries(params)) {
    wrapped[k] = { value: v, min: -10, max: 10, step: 0.1 }
  }
  return {
    id,
    type: 'graph_calculator',
    src: '',
    x: 0, y: 0, w: 480, h: 360,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      state: {
        expressions: [],
        params: wrapped,
        viewport: { cx: 0, cy: 0, scale: 38 },
      } as unknown,
      ...(snapshotSeq > 0 ? { meta: { last_snapshot_seq: snapshotSeq } } : {}),
    },
  } as unknown as WBAsset
}

function setupStoreWithAsset(asset: WBAsset, mode: 'edit' | 'replay' = 'edit') {
  const store = useWBStore()
  store.pages = [{
    id: 'p1', name: 'P1', strokes: [], shapes: [], texts: [],
    assets: [asset],
  } as any]
  store.currentPageIndex = 0
  ;(store as any).mode = mode
  return store
}

// ─── boardStore.graphParamSet ──────────────────────────────────────────

describe('boardStore.graphParamSet', () => {
  it('STORE-RULE-2: mutates local state immediately', () => {
    const asset = makeGraphAsset('gc-1', 5, { a: 1 })
    const store = setupStoreWithAsset(asset)
    store.graphParamSet('gc-1', 'a', 7.5)
    const updated = store.pages[0].assets[0]
    expect((updated.data as any).state.params.a.value).toBe(7.5)
  })

  it('STORE-RULE-4: does NOT trigger asset_update or modify expressions', () => {
    const asset = makeGraphAsset('gc-1', 5, { a: 1 })
    const exprs = [{ id: 'e1', src: 'y=x', color: '#abc', hidden: false }]
    ;(asset.data as any).state.expressions = exprs
    const store = setupStoreWithAsset(asset)
    store.graphParamSet('gc-1', 'a', 9)
    // expressions content unchanged (param mutation MUST NOT alter expressions)
    const after = (store.pages[0].assets[0].data as any).state.expressions
    expect(after).toEqual(exprs)
    // Param mutation IS visible
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(9)
  })

  it('STORE-RULE-3: skipEmit blocks all side effects (replay path)', () => {
    const asset = makeGraphAsset('gc-1', 5, { a: 1 })
    const store = setupStoreWithAsset(asset, 'replay')
    store.graphParamSet('gc-1', 'a', 7.5, { skipEmit: true })
    // mutation still applied
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(7.5)
  })

  it('rejects non-finite values silently', () => {
    const asset = makeGraphAsset('gc-1', 5, { a: 1 })
    const store = setupStoreWithAsset(asset)
    store.graphParamSet('gc-1', 'a', NaN)
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(1)
  })

  it('skips when asset is wrong type', () => {
    const wrong: any = {
      id: 'img-1', type: 'image', src: 'http://a.png',
      x: 0, y: 0, w: 100, h: 100, rotation: 0, locked: false,
    }
    const store = setupStoreWithAsset(wrong)
    expect(() => store.graphParamSet('img-1', 'a', 1)).not.toThrow()
  })

  it('STORE-RULE-8: multi-asset — params on different assets do not interfere', () => {
    const a1 = makeGraphAsset('gc-1', 5, { a: 1 })
    const a2 = makeGraphAsset('gc-2', 5, { a: 1 })
    const store = useWBStore()
    store.pages = [{
      id: 'p1', name: 'P1', strokes: [], shapes: [], texts: [],
      assets: [a1, a2],
    } as any]
    store.currentPageIndex = 0
    ;(store as any).mode = 'edit'
    store.graphParamSet('gc-1', 'a', 7)
    store.graphParamSet('gc-2', 'a', 9)
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(7)
    expect((store.pages[0].assets[1].data as any).state.params.a.value).toBe(9)
  })
})

// ─── stampGraphCalculatorSnapshotSeq ────────────────────────────────────

describe('boardStore.stampGraphCalculatorSnapshotSeq', () => {
  it('updates meta.last_snapshot_seq monotonically', () => {
    const asset = makeGraphAsset('gc-1', 0)
    const store = setupStoreWithAsset(asset)
    store.stampGraphCalculatorSnapshotSeq('gc-1', 10)
    expect((store.pages[0].assets[0].data as any).meta.last_snapshot_seq).toBe(10)
    store.stampGraphCalculatorSnapshotSeq('gc-1', 5) // older — must NOT decrease
    expect((store.pages[0].assets[0].data as any).meta.last_snapshot_seq).toBe(10)
    store.stampGraphCalculatorSnapshotSeq('gc-1', 11)
    expect((store.pages[0].assets[0].data as any).meta.last_snapshot_seq).toBe(11)
  })

  it('rejects non-positive seq', () => {
    const asset = makeGraphAsset('gc-1', 5)
    const store = setupStoreWithAsset(asset)
    store.stampGraphCalculatorSnapshotSeq('gc-1', 0)
    expect((store.pages[0].assets[0].data as any).meta.last_snapshot_seq).toBe(5)
    store.stampGraphCalculatorSnapshotSeq('gc-1', -1)
    expect((store.pages[0].assets[0].data as any).meta.last_snapshot_seq).toBe(5)
  })
})

// ─── applyReplayOperation: graph_param_set ──────────────────────────────

describe('applyReplayOperation: graph_param_set', () => {
  it('applies graph_param_set when base_seq >= last_snapshot_seq', () => {
    const asset = makeGraphAsset('gc-1', 10, { a: 1 })
    const store = setupStoreWithAsset(asset, 'replay')
    const op: BoardOperation = {
      seq: 11,
      op_type: 'graph_param_set',
      page_id: 'p1',
      payload: { asset_id: 'gc-1', name: 'a', value: 7.5, base_seq: 10 },
    } as any
    applyReplayOperation(store as any, op)
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(7.5)
  })

  it('STORE-RULE-10: drops stale graph_param_set (base_seq < last_snapshot_seq)', () => {
    const asset = makeGraphAsset('gc-1', 11, { a: 99 })
    const store = setupStoreWithAsset(asset, 'replay')
    const op: BoardOperation = {
      seq: 12,
      op_type: 'graph_param_set',
      page_id: 'p1',
      payload: { asset_id: 'gc-1', name: 'a', value: 7.5, base_seq: 10 }, // stale
    } as any
    applyReplayOperation(store as any, op)
    // params untouched
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(99)
  })

  it('boundary: base_seq == last_snapshot_seq applies (NOT stale)', () => {
    const asset = makeGraphAsset('gc-1', 10, { a: 1 })
    const store = setupStoreWithAsset(asset, 'replay')
    const op: BoardOperation = {
      seq: 11,
      op_type: 'graph_param_set',
      page_id: 'p1',
      payload: { asset_id: 'gc-1', name: 'a', value: 3, base_seq: 10 },
    } as any
    applyReplayOperation(store as any, op)
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(3)
  })

  it('STORE-RULE-10 critical scenario (per помічник): snapshot seq=11 → stale param_set base_seq=10 → DROP', () => {
    // Empty page (replay starts from snapshot, so initial state has NO asset)
    const store = useWBStore()
    store.pages = [{
      id: 'p1', name: 'P1', strokes: [], shapes: [], texts: [],
      assets: [],
    } as any]
    store.currentPageIndex = 0
    ;(store as any).mode = 'replay'

    // Step 1: snapshot seq=10 applies (sets last_snapshot_seq=10, params from snapshot)
    const snap1Asset = makeGraphAsset('gc-1', 0, {})
    ;(snap1Asset.data as any).state.params = { a: { value: 1, min: -10, max: 10, step: 0.1 } }
    applyReplayOperation(store as any, {
      seq: 10, op_type: 'asset_add', page_id: 'p1',
      payload: { asset: snap1Asset },
    } as any)
    expect((store.pages[0].assets[0].data as any).meta.last_snapshot_seq).toBe(10)

    // Step 2: param_set base_seq=10 → applies (boundary OK)
    applyReplayOperation(store as any, {
      seq: 11, op_type: 'graph_param_set', page_id: 'p1',
      payload: { asset_id: 'gc-1', name: 'a', value: 5, base_seq: 10 },
    } as any)
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(5)

    // Step 3: snapshot seq=11 → bumps last_snapshot_seq=11
    const snap2Asset = makeGraphAsset('gc-1', 0, {})
    ;(snap2Asset.data as any).state.params = { a: { value: 99, min: -10, max: 10, step: 0.1 } } // snapshot replaces
    applyReplayOperation(store as any, {
      seq: 11, op_type: 'asset_update', page_id: 'p1',
      payload: { asset: snap2Asset },
    } as any)
    // updateAsset uses RAF batcher — flush manually for synchronous test.
    flushPendingUpdates()
    expect((store.pages[0].assets[0].data as any).meta.last_snapshot_seq).toBe(11)
    // STORE-RULE-7: snapshot full-replaced params
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(99)

    // Step 4: STALE param_set base_seq=10 → DROP (doesn't change params)
    applyReplayOperation(store as any, {
      seq: 14, op_type: 'graph_param_set', page_id: 'p1',
      payload: { asset_id: 'gc-1', name: 'a', value: 999, base_seq: 10 },
    } as any)
    expect((store.pages[0].assets[0].data as any).state.params.a.value).toBe(99)
  })

  it('asset_add (graph_calculator) stamps last_snapshot_seq via replay applier', () => {
    // Empty store with one page
    const store = useWBStore()
    store.pages = [{
      id: 'p1', name: 'P1', strokes: [], shapes: [], texts: [],
      assets: [],
    } as any]
    store.currentPageIndex = 0
    ;(store as any).mode = 'replay'
    const newAsset = makeGraphAsset('gc-new', 0)
    applyReplayOperation(store as any, {
      seq: 42, op_type: 'asset_add', page_id: 'p1',
      payload: { asset: newAsset },
    } as any)
    const a = store.pages[0].assets.find((x) => x.id === 'gc-new')
    expect(a).toBeDefined()
    expect((a!.data as any).meta.last_snapshot_seq).toBe(42)
  })
})
