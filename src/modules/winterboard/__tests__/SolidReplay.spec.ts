/**
 * Phase O PR-O5 — Solid asset replay verification suite.
 *
 * Verifies that геометричні solid assets коректно відтворюються через replay
 * pipeline. Жодних змін у engine — лише verification поверх existing
 * `applyReplayOperation` factory.
 *
 * Refs:
 *   - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O5
 *   - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1
 *   - frontend/src/modules/winterboard/engine/applyReplayOperation.ts
 *
 * Coverage matrix (per PR-O5 spec):
 *   1. Round-trip — asset_add → asset_update sequence reproduces final state.
 *   2. Seek determinism — re-applying ops [0..N) yields identical state.
 *   3. Edge cases — seek before add, after delete, rapid updates.
 *   4. Determinism — same ops applied N times → identical final state.
 *
 * Implementation note:
 *   Tests use a minimal Pinia-mock store implementing ReplayStoreApi.
 *   addAsset/updateAsset/deleteAsset mutate an internal `assets` map keyed
 *   by id; toolbar state lives у `asset.data.state` per SSOT §3.7.1.
 *   Цей mock дзеркалить behaviour boardStore (single source of truth).
 *
 *   ✅ NO replay engine changes. Tests treat applyReplayOperation as black-box.
 *   ✅ NO timing/playback assertions — pure ops semantics.
 */
import { describe, expect, it } from 'vitest'
import {
  createReplayApplier,
  type ReplayStoreApi,
} from '../engine/applyReplayOperation'
import type { BoardOperation } from '../types/replay'
import type { SolidAsset, SolidAssetState, WBAsset } from '../types/winterboard'

// ─── Defaults (mirror constants/solidDefaults.ts) ───────────────────────────

const DEFAULT_STATE: SolidAssetState = {
  showFaces: true,
  showEdges: true,
  showVertices: false,
  transparent: false,
  showNet: false,
  showCut: false,
  cutHeight: 0.5,
  autoRotate: true,
}

function makeSolidAsset(
  id: string,
  overrides: Partial<Omit<SolidAsset, 'data'>> = {},
  stateOverrides: Partial<SolidAssetState> = {},
): SolidAsset {
  return {
    id,
    type: 'geometry_solid',
    src: 'cube',
    x: 100,
    y: 100,
    w: 280,
    h: 280,
    rotation: 0,
    data: {
      version: 1,
      state: { ...DEFAULT_STATE, ...stateOverrides },
    },
    ...overrides,
  } as SolidAsset
}

// ─── Mock store (minimal ReplayStoreApi) ────────────────────────────────────

interface MockStore extends ReplayStoreApi {
  /** Лічильники для assert'ів і регресій. */
  _calls: Record<string, number>
  /** Map<id, WBAsset> для page[0] (тести використовують single-page replay). */
  _assets: Map<string, WBAsset>
}

function makeMockStore(initialAssets: WBAsset[] = []): MockStore {
  const calls: Record<string, number> = {}
  const assets = new Map<string, WBAsset>()
  for (const a of initialAssets) assets.set(a.id, a)

  const bump = (k: string): void => {
    calls[k] = (calls[k] ?? 0) + 1
  }

  // pages array — applier використовує `store.pages[currentPageIndex]` для
  // batch ops. Reference на assets array тримаємо синхронним з Map.
  const pageAssetsRef: WBAsset[] = Array.from(assets.values())
  const pages: Array<{ id: string; assets: WBAsset[] }> = [
    { id: 'page-1', assets: pageAssetsRef },
  ]

  // Helper щоб синхронізувати pageAssetsRef після Map mutations.
  const syncPageAssets = (): void => {
    pageAssetsRef.length = 0
    for (const a of assets.values()) pageAssetsRef.push(a)
  }
  syncPageAssets()

  const store: MockStore = {
    _calls: calls,
    _assets: assets,
    currentPageIndex: 0,
    pages,
    addStroke: () => bump('addStroke'),
    updateStroke: () => bump('updateStroke'),
    deleteStroke: () => bump('deleteStroke'),
    addAsset: (a: WBAsset) => {
      bump('addAsset')
      assets.set(a.id, a)
      syncPageAssets()
    },
    updateAsset: (a: WBAsset) => {
      bump('updateAsset')
      // Mirror boardStore: full replace by id (не merge на цьому рівні —
      // applier передає вже повний asset object).
      assets.set(a.id, a)
      syncPageAssets()
    },
    deleteAsset: (id: string) => {
      bump('deleteAsset')
      assets.delete(id)
      syncPageAssets()
    },
    addPage: () => bump('addPage'),
    goToPage: () => bump('goToPage'),
    deletePage: () => bump('deletePage'),
    clearPage: () => {
      bump('clearPage')
      assets.clear()
      syncPageAssets()
    },
    setGridSize: () => bump('setGridSize'),
    updateCurrentPageGrid: () => bump('updateCurrentPageGrid'),
    setBackgroundColor: () => bump('setBackgroundColor'),
    createGroup: () => {
      bump('createGroup')
      return undefined
    },
    deleteGroup: () => bump('deleteGroup'),
    lockItems: () => bump('lockItems'),
    unlockItems: () => bump('unlockItems'),
    bringForward: () => bump('bringForward'),
    sendBackward: () => bump('sendBackward'),
    bringToFront: () => bump('bringToFront'),
    sendToBack: () => bump('sendToBack'),
    setObjectText: () => bump('setObjectText'),
  }
  return store
}

// ─── Op factory ────────────────────────────────────────────────────────────

let _opIdCounter = 1
function makeOp(
  op_type: string,
  payload: Record<string, unknown>,
  page_id = 'page-1',
): BoardOperation {
  return {
    id: _opIdCounter++,
    op_type,
    page_id,
    payload,
    user: 1,
    created_at: '2026-01-01T00:00:00Z',
  }
}

// Helper — apply ops sequence через свіжий applier (instance-scoped).
function applyOps(ops: BoardOperation[], store: ReplayStoreApi): void {
  const applier = createReplayApplier()
  for (const op of ops) applier.apply(store, op)
}

// Snapshot helper — deep clone state subset для equality assertions.
// Pages у store mutates по reference; treba зробити structuredClone щоб
// snapshot не мутував разом з подальшими ops.
function snapshotAssets(store: MockStore): Map<string, WBAsset> {
  const snap = new Map<string, WBAsset>()
  for (const [id, asset] of store._assets) {
    snap.set(id, structuredClone(asset))
  }
  return snap
}

// ─── 1. Round-trip ─────────────────────────────────────────────────────────

describe('Phase O PR-O5 — Round-trip (record → replay → match)', () => {
  it('asset_add + 4 asset_update → final state matches all updates', () => {
    const store = makeMockStore()
    const a1Initial = makeSolidAsset('a1')

    const a1Move = makeSolidAsset('a1', { x: 300, y: 200 })
    const a1Resize = makeSolidAsset('a1', { x: 300, y: 200, w: 400, h: 400 })
    const a1Edges = makeSolidAsset(
      'a1',
      { x: 300, y: 200, w: 400, h: 400 },
      { showEdges: false },
    )
    const a1Cut = makeSolidAsset(
      'a1',
      { x: 300, y: 200, w: 400, h: 400 },
      { showEdges: false, cutHeight: 0.7 },
    )

    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: a1Initial }),
      makeOp('asset_update', { asset: a1Move }),
      makeOp('asset_update', { asset: a1Resize }),
      makeOp('asset_update', { asset: a1Edges }),
      makeOp('asset_update', { asset: a1Cut }),
    ]

    applyOps(ops, store)

    // 1 add + 4 updates expected.
    expect(store._calls.addAsset).toBe(1)
    expect(store._calls.updateAsset).toBe(4)

    const final = store._assets.get('a1') as SolidAsset
    expect(final).toBeDefined()
    expect(final.x).toBe(300)
    expect(final.y).toBe(200)
    expect(final.w).toBe(400)
    expect(final.h).toBe(400)
    expect(final.data.state.showEdges).toBe(false)
    expect(final.data.state.cutHeight).toBe(0.7)
    // Untouched fields preserved.
    expect(final.data.state.showFaces).toBe(true)
    expect(final.data.state.autoRotate).toBe(true)
  })

  it('round-trip preserves all SolidAssetState boolean fields', () => {
    const store = makeMockStore()
    // Toggle every boolean field by sequential asset_updates.
    const fields: Array<keyof SolidAssetState> = [
      'showFaces',
      'showEdges',
      'showVertices',
      'transparent',
      'autoRotate',
    ]
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1') }),
    ]
    let prevState: SolidAssetState = { ...DEFAULT_STATE }
    for (const f of fields) {
      const nextState: SolidAssetState = { ...prevState, [f]: !prevState[f] }
      ops.push(makeOp('asset_update', { asset: makeSolidAsset('a1', {}, nextState) }))
      prevState = nextState
    }

    applyOps(ops, store)

    const final = store._assets.get('a1') as SolidAsset
    expect(final.data.state.showFaces).toBe(false)
    expect(final.data.state.showEdges).toBe(false)
    expect(final.data.state.showVertices).toBe(true)
    expect(final.data.state.transparent).toBe(true)
    expect(final.data.state.autoRotate).toBe(false)
  })

  it('mutex enforcement у ops sequence — showNet → showCut transition', () => {
    // Не engine enforces mutex (BE/FE toolbar це робить), але replay має
    // вірно відтворити sequence де showNet вмикається, потім вимикається +
    // showCut вмикається у одному asset_update (atomic toggle from FE).
    const store = makeMockStore()
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1') }),
      makeOp('asset_update', {
        asset: makeSolidAsset('a1', {}, { showNet: true, showCut: false }),
      }),
      makeOp('asset_update', {
        asset: makeSolidAsset('a1', {}, { showNet: false, showCut: true }),
      }),
    ]
    applyOps(ops, store)

    const final = store._assets.get('a1') as SolidAsset
    expect(final.data.state.showNet).toBe(false)
    expect(final.data.state.showCut).toBe(true)
  })
})

// ─── 2. Seek forward/backward determinism ──────────────────────────────────

describe('Phase O PR-O5 — Seek determinism', () => {
  it('apply [0..3) twice → identical final state (deterministic re-apply)', () => {
    const initialAsset = makeSolidAsset('a1')
    const u1 = makeSolidAsset('a1', { x: 200 })
    const u2 = makeSolidAsset('a1', { x: 200, y: 300 })
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: initialAsset }),
      makeOp('asset_update', { asset: u1 }),
      makeOp('asset_update', { asset: u2 }),
    ]

    const storeA = makeMockStore()
    applyOps(ops, storeA)
    const snapA = snapshotAssets(storeA)

    const storeB = makeMockStore()
    applyOps(ops, storeB)
    const snapB = snapshotAssets(storeB)

    expect(snapA.size).toBe(snapB.size)
    expect(snapA.size).toBe(1)
    expect(snapA.get('a1')).toEqual(snapB.get('a1'))
  })

  it('seek backward — apply [0..3) then [0..1) on fresh store yields earlier state', () => {
    // Симулюємо seek backward: replay engine скидає store та re-applies
    // ops [0..N). Тести ensure що результат для prefix [0..1) той самий що
    // якби ми застосували тільки [0..1) спочатку.
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1') }),
      makeOp('asset_update', { asset: makeSolidAsset('a1', { x: 500 }) }),
      makeOp('asset_update', {
        asset: makeSolidAsset('a1', { x: 500 }, { showFaces: false }),
      }),
    ]

    // Forward to seq 3.
    const storeForward = makeMockStore()
    applyOps(ops, storeForward)
    expect((storeForward._assets.get('a1') as SolidAsset).data.state.showFaces).toBe(false)
    expect((storeForward._assets.get('a1') as SolidAsset).x).toBe(500)

    // Seek backward — re-apply only [0..1) на свіжому store.
    const storeSeekBack = makeMockStore()
    applyOps(ops.slice(0, 1), storeSeekBack)
    const seekBackAsset = storeSeekBack._assets.get('a1') as SolidAsset
    expect(seekBackAsset.x).toBe(100) // initial position
    expect(seekBackAsset.data.state.showFaces).toBe(true) // initial

    // Re-seek forward [0..3) — has identical result to first forward run.
    const storeSeekForward = makeMockStore()
    applyOps(ops, storeSeekForward)
    expect(snapshotAssets(storeSeekForward)).toEqual(snapshotAssets(storeForward))
  })

  it('seek forward then forward again — A === A (no drift across re-runs)', () => {
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1') }),
      makeOp('asset_update', { asset: makeSolidAsset('a1', { w: 350 }) }),
      makeOp('asset_update', {
        asset: makeSolidAsset('a1', { w: 350 }, { cutHeight: 0.42 }),
      }),
    ]

    const snapshots: Array<Map<string, WBAsset>> = []
    for (let i = 0; i < 3; i++) {
      const store = makeMockStore()
      applyOps(ops, store)
      snapshots.push(snapshotAssets(store))
    }

    // Усі snapshot'и мають бути ідентичними — детермінізм.
    expect(snapshots[0]).toEqual(snapshots[1])
    expect(snapshots[1]).toEqual(snapshots[2])
  })
})

// ─── 3. Edge cases ─────────────────────────────────────────────────────────

describe('Phase O PR-O5 — Edge cases', () => {
  it('seek before asset_add (apply 0 ops) → store has no asset з given id', () => {
    const store = makeMockStore()
    applyOps([], store)
    expect(store._assets.has('a1')).toBe(false)
    expect(store._calls.addAsset).toBeUndefined()
  })

  it('seek after asset_delete → asset removed from store', () => {
    const store = makeMockStore()
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1') }),
      makeOp('asset_update', { asset: makeSolidAsset('a1', { x: 250 }) }),
      makeOp('asset_delete', { asset_id: 'a1' }),
    ]
    applyOps(ops, store)
    expect(store._assets.has('a1')).toBe(false)
    expect(store._calls.deleteAsset).toBe(1)
  })

  it('rapid asset_update (10 sequential ops) → final state stable, no drift', () => {
    const store = makeMockStore()
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1') }),
    ]
    // 10 cutHeight updates у різних positions — emulates slider drag.
    for (let i = 0; i < 10; i++) {
      const cut = 0.1 * (i + 1) // 0.1, 0.2, ..., 1.0
      ops.push(
        makeOp('asset_update', {
          asset: makeSolidAsset('a1', {}, { cutHeight: cut }),
        }),
      )
    }
    applyOps(ops, store)

    // Final cutHeight = 0.1 * 10 = 1.0 (з floating point precision).
    const final = store._assets.get('a1') as SolidAsset
    expect(final.data.state.cutHeight).toBeCloseTo(1.0, 5)
    expect(store._calls.updateAsset).toBe(10)
  })

  it('asset_update without preceding asset_add — applier still calls updateAsset (engine no-op у store)', () => {
    // Цей edge case відображає реальний replay scenario де op_log truncated:
    // engine не throws, але store може silently drop update якщо asset не існує.
    // Mock store зробить set() у Map — це тести що applier НЕ throws на edge.
    const store = makeMockStore()
    const ops: BoardOperation[] = [
      makeOp('asset_update', { asset: makeSolidAsset('a1', { x: 999 }) }),
    ]
    expect(() => applyOps(ops, store)).not.toThrow()
    // Engine форвардить op до store; mock store зробить set() — асет з'явиться.
    // Реальний boardStore міг би drop'нути — тут перевіряємо лише no-throw.
    expect(store._calls.updateAsset).toBe(1)
  })

  it('multiple solids у одному replay — independent state', () => {
    const store = makeMockStore()
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1', {}, { autoRotate: true }) }),
      makeOp('asset_add', {
        asset: makeSolidAsset('a2', { src: 'sphere' }, { autoRotate: false }),
      }),
      makeOp('asset_update', {
        asset: makeSolidAsset('a1', {}, { autoRotate: false }),
      }),
    ]
    applyOps(ops, store)
    const a1 = store._assets.get('a1') as SolidAsset
    const a2 = store._assets.get('a2') as SolidAsset
    expect(a1.data.state.autoRotate).toBe(false)
    expect(a2.data.state.autoRotate).toBe(false)
    expect(a2.src).toBe('sphere')
  })
})

// ─── 4. Determinism — same ops applied N times ─────────────────────────────

describe('Phase O PR-O5 — Determinism', () => {
  it('same ops sequence applied 5 times → identical final state', () => {
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1') }),
      makeOp('asset_update', { asset: makeSolidAsset('a1', { x: 300 }) }),
      makeOp('asset_update', {
        asset: makeSolidAsset('a1', { x: 300 }, { showCut: true, cutHeight: 0.6 }),
      }),
      makeOp('asset_add', {
        asset: makeSolidAsset('a2', { src: 'pyramid4' }),
      }),
      makeOp('asset_update', {
        asset: makeSolidAsset('a1', { x: 300 }, { showCut: true, cutHeight: 0.6, autoRotate: false }),
      }),
    ]

    const snapshots: Array<Map<string, WBAsset>> = []
    for (let i = 0; i < 5; i++) {
      const store = makeMockStore()
      applyOps(ops, store)
      snapshots.push(snapshotAssets(store))
    }

    // All 5 runs мають identical state (no Math.random, no Date.now leakage).
    for (let i = 1; i < 5; i++) {
      expect(snapshots[i]).toEqual(snapshots[0])
    }
    // Sanity check — snapshot has exactly 2 assets з expected final state.
    const a1 = snapshots[0].get('a1') as SolidAsset
    expect(a1.data.state.autoRotate).toBe(false)
    expect(a1.data.state.cutHeight).toBe(0.6)
    expect(snapshots[0].has('a2')).toBe(true)
  })

  it('createReplayApplier instances are isolated — no shared state leak', () => {
    // INV: kожен applier instance має власний ensuredPageIds + pageIdMap.
    // Якщо state leakується між instances → second applier не бачить page-1
    // як ensured → addPage call → spurious behaviour.
    const ops: BoardOperation[] = [
      makeOp('asset_add', { asset: makeSolidAsset('a1') }),
    ]
    const storeA = makeMockStore()
    const applierA = createReplayApplier()
    for (const op of ops) applierA.apply(storeA, op)

    const storeB = makeMockStore()
    const applierB = createReplayApplier()
    for (const op of ops) applierB.apply(storeB, op)

    // Обидва applier'и зробили однакову роботу — без cross-contamination.
    expect(storeA._calls.addAsset).toBe(1)
    expect(storeB._calls.addAsset).toBe(1)
    expect(snapshotAssets(storeA)).toEqual(snapshotAssets(storeB))
  })
})
