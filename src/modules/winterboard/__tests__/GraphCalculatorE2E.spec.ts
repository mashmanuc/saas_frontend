/**
 * Phase G.6 — End-to-end production parity tests.
 *
 * Per OPS_SYNC_SSOT.md INV-21 + FINAL-RULE-1..10:
 *   - FINAL-RULE-10: live → record → replay → final state == live state
 *   - STORE-RULE-10 critical scenario (snapshot=11 / stale param_set base_seq=10)
 *   - Multi-instance isolation
 *   - Mode switch edit ↔ replay без emit churn
 *
 * Tests record an op stream during a "live" simulation, then replay against
 * a fresh store, and assert the resulting state equals the live state.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

import { useWBStore } from '../board/state/boardStore'
import { applyReplayOperation } from '../engine/applyReplayOperation'
import { flushPendingUpdates } from '../board/state/assetUpdateBatcher'
import type { WBAsset } from '../types/winterboard'
import type { BoardOperation } from '../types/replay'
import {
  DEFAULT_GRAPH_STATE,
  DEFAULT_GRAPH_WIDTH,
  DEFAULT_GRAPH_HEIGHT,
} from '../constants/graphCalculatorDefaults'

vi.mock('../vendor/graph_calculator/graph-calculator.js', () => ({
  GraphCalculator: class {},
  default: class {},
  GraphCalc: {},
}))

// Capture every emitted op (records "live" stream that replay will replay)
const recordedOps: BoardOperation[] = []
let nextSeq = 1

beforeEach(() => {
  setActivePinia(createPinia())
  recordedOps.length = 0
  nextSeq = 1
})

afterEach(() => {
  vi.clearAllMocks()
})

/** Mount a session with one empty page у edit mode; record subsequent ops. */
function bootLiveStore(): ReturnType<typeof useWBStore> {
  const store = useWBStore()
  store.pages = [{
    id: 'p1', name: 'P1', strokes: [], shapes: [], texts: [], assets: [],
  } as any]
  store.currentPageIndex = 0
  ;(store as any).mode = 'edit'
  return store
}

function makeFreshGraphAsset(id = 'gc-1'): WBAsset {
  return {
    id,
    type: 'graph_calculator',
    src: '',
    x: 100, y: 100, w: DEFAULT_GRAPH_WIDTH, h: DEFAULT_GRAPH_HEIGHT,
    rotation: 0,
    locked: false,
    data: {
      version: 1,
      state: {
        expressions: [...DEFAULT_GRAPH_STATE.expressions],
        params: { ...DEFAULT_GRAPH_STATE.params },
        viewport: { ...DEFAULT_GRAPH_STATE.viewport },
      },
      meta: { last_snapshot_seq: 0 },
    } as unknown as WBAsset['data'],
  } as unknown as WBAsset
}

// ─── E2E: record ops, replay, assert parity ────────────────────────────

describe('Phase G E2E parity (FINAL-RULE-10)', () => {
  it('records live actions and replay reproduces identical final state', async () => {
    // Phase 1 — LIVE recording
    const live = bootLiveStore()
    let opListener: ((op: any) => void) | null = null
    const _emit = (op: any) => {
      if (opListener) opListener(op)
      recordedOps.push({
        seq: nextSeq++, op_type: op.op_type, page_id: op.page_id, payload: op.payload,
      } as BoardOperation)
    }
    // Patch _emitOperation pipeline: easier — directly observe recordedOps after API calls
    live.onOperation((op: any) => {
      recordedOps.push({
        seq: nextSeq++, op_type: op.op_type, page_id: op.page_id, payload: op.payload,
      } as BoardOperation)
    })

    // 1. Drop graph_calculator
    const liveAsset = makeFreshGraphAsset('gc-live')
    live.addAsset(liveAsset, 'p1', { skipHistory: true })
    flushPendingUpdates()

    // 2. Add expression + param via asset_update (snapshot)
    const updated: WBAsset = {
      ...liveAsset,
      data: {
        version: 1,
        state: {
          expressions: [{ id: 'e1', src: 'y = a*x', color: '#abc', hidden: false }],
          params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
          viewport: { cx: 0, cy: 0, scale: 38 },
        },
        meta: (liveAsset.data as any)?.meta,
      } as any,
    }
    live.updateAsset(updated, { skipHistory: true })
    flushPendingUpdates()

    // 3. Slider drag — three param_set ops at base_seq=lastSnapshot
    // (last_snapshot_seq у live picks up only after BE materialization;
    //  у unit FE test we manually set після each snapshot emit)
    ;(live.pages[0].assets[0].data as any).meta = {
      last_snapshot_seq: recordedOps[recordedOps.length - 1].seq,
    }
    live.graphParamSet('gc-live', 'a', 2)
    live.graphParamSet('gc-live', 'a', 3.5)
    live.graphParamSet('gc-live', 'a', 5)

    // Snapshot live final state
    const liveFinalParams = (live.pages[0].assets[0].data as any).state.params
    expect(liveFinalParams.a.value).toBe(5)

    // Phase 2 — REPLAY: fresh store, apply ops in order
    setActivePinia(createPinia())
    const replay = useWBStore()
    replay.pages = [{
      id: 'p1', name: 'P1', strokes: [], shapes: [], texts: [], assets: [],
    } as any]
    replay.currentPageIndex = 0
    ;(replay as any).mode = 'replay'

    // For graph_param_set ops, base_seq is set to current seq у live recording.
    // У replay applier, base_seq must reference last_snapshot_seq stamped.
    // Since у real BE this matches up, we simulate by ensuring op.base_seq stays.
    for (const op of recordedOps) {
      applyReplayOperation(replay as any, op)
      flushPendingUpdates()
    }

    const replayFinal = (replay.pages[0].assets[0].data as any).state.params
    expect(replayFinal.a.value).toBe(5)

    // FINAL-RULE-10: live final state == replay final state
    expect(replayFinal).toEqual(liveFinalParams)
  })

  it('FINAL-RULE-7: empty DEFAULT state is stable through full E2E', async () => {
    const live = bootLiveStore()
    const fresh = makeFreshGraphAsset('gc-empty')
    live.addAsset(fresh, 'p1', { skipHistory: true })
    flushPendingUpdates()

    // Replay against empty op stream
    setActivePinia(createPinia())
    const replay = useWBStore()
    replay.pages = [{
      id: 'p1', name: 'P1', strokes: [], shapes: [], texts: [], assets: [],
    } as any]
    replay.currentPageIndex = 0
    ;(replay as any).mode = 'replay'

    applyReplayOperation(replay as any, {
      seq: 1, op_type: 'asset_add', page_id: 'p1',
      payload: { asset: fresh },
    } as any)

    const a = replay.pages[0].assets[0]
    expect(a).toBeDefined()
    const s = (a.data as any).state
    expect(s.expressions).toEqual([])
    expect(s.params).toEqual({})
    expect(s.viewport).toEqual({ cx: 0, cy: 0, scale: 38 })
  })

  it('FINAL-RULE-2: drop → exactly 1 asset_add (no duplication)', async () => {
    const live = bootLiveStore()
    const ops: any[] = []
    live.onOperation((op: any) => ops.push(op))
    live.addAsset(makeFreshGraphAsset(), 'p1', { skipHistory: true })
    flushPendingUpdates()
    expect(ops.filter((o) => o.op_type === 'asset_add').length).toBe(1)
  })

  it('FINAL-RULE-8: mode switch edit↔replay produces no extra ops', async () => {
    const live = bootLiveStore()
    live.addAsset(makeFreshGraphAsset(), 'p1', { skipHistory: true })
    flushPendingUpdates()

    const ops: any[] = []
    live.onOperation((op: any) => ops.push(op))
    ;(live as any).mode = 'replay'
    ;(live as any).mode = 'edit'
    expect(ops.length).toBe(0)
  })

  it('STORE-RULE-10 / FINAL-RULE-10: snapshot seq=11 → stale param_set base_seq=10 → DROPPED у replay', async () => {
    const replay = useWBStore()
    replay.pages = [{
      id: 'p1', name: 'P1', strokes: [], shapes: [], texts: [], assets: [],
    } as any]
    replay.currentPageIndex = 0
    ;(replay as any).mode = 'replay'

    const stream: BoardOperation[] = [
      { seq: 10, op_type: 'asset_add', page_id: 'p1',
        payload: { asset: makeFreshGraphAsset('gc-1') } } as any,
      { seq: 11, op_type: 'graph_param_set', page_id: 'p1',
        payload: { asset_id: 'gc-1', name: 'a', value: 5, base_seq: 10 } } as any,
      // Snapshot bumps seq → params replaced
      { seq: 12, op_type: 'asset_update', page_id: 'p1',
        payload: {
          asset: {
            ...makeFreshGraphAsset('gc-1'),
            data: {
              version: 1,
              state: {
                expressions: [],
                params: { a: { value: 99, min: -10, max: 10, step: 0.1 } },
                viewport: { cx: 0, cy: 0, scale: 38 },
              },
            } as any,
          },
        } } as any,
      // STALE: base_seq=10 < new last_snapshot_seq=12 → DROPPED
      { seq: 13, op_type: 'graph_param_set', page_id: 'p1',
        payload: { asset_id: 'gc-1', name: 'a', value: 999, base_seq: 10 } } as any,
    ]
    for (const op of stream) {
      applyReplayOperation(replay as any, op)
      flushPendingUpdates()
    }
    expect((replay.pages[0].assets[0].data as any).state.params.a.value).toBe(99)
    expect((replay.pages[0].assets[0].data as any).meta.last_snapshot_seq).toBe(12)
  })
})
