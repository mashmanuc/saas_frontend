// Unit tests: applyReplayOperation — всі 16 op_types
// REPLAY-INV-5: кожен op_type що emitується boardStore має бути покритий тут
// REPLAY-INV-11: детермінізм — apply(op) має відтворювати точний state

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyReplayOperation, createReplayApplier, type ReplayStoreApi } from '../engine/applyReplayOperation'
import type { MoveAnimator } from '../engine/animation/MoveAnimator'
import type { BoardOperation } from '../types/replay'

// ─── Mock Store ──────────────────────────────────────────────────────────────

function makeStore(): ReplayStoreApi & { _calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {}
  const track = (name: string) => (...args: unknown[]) => {
    calls[name] = calls[name] ?? []
    calls[name].push(args)
  }
  return {
    _calls: calls,
    currentPageIndex: 0,
    pages: [{ id: 'page-1' }, { id: 'page-2' }],
    addStroke: track('addStroke') as ReplayStoreApi['addStroke'],
    updateStroke: track('updateStroke') as ReplayStoreApi['updateStroke'],
    deleteStroke: track('deleteStroke') as ReplayStoreApi['deleteStroke'],
    addAsset: track('addAsset') as ReplayStoreApi['addAsset'],
    updateAsset: track('updateAsset') as ReplayStoreApi['updateAsset'],
    deleteAsset: track('deleteAsset') as ReplayStoreApi['deleteAsset'],
    addPage: track('addPage') as ReplayStoreApi['addPage'],
    goToPage: track('goToPage') as ReplayStoreApi['goToPage'],
    deletePage: track('deletePage') as ReplayStoreApi['deletePage'],
    clearPage: track('clearPage') as ReplayStoreApi['clearPage'],
    setGridSize: track('setGridSize') as ReplayStoreApi['setGridSize'],
    updateCurrentPageGrid: track('updateCurrentPageGrid') as ReplayStoreApi['updateCurrentPageGrid'],
    setBackgroundColor: track('setBackgroundColor') as ReplayStoreApi['setBackgroundColor'],
    createGroup: track('createGroup') as ReplayStoreApi['createGroup'],
    deleteGroup: track('deleteGroup') as ReplayStoreApi['deleteGroup'],
    lockItems: track('lockItems') as ReplayStoreApi['lockItems'],
    unlockItems: track('unlockItems') as ReplayStoreApi['unlockItems'],
    bringForward: track('bringForward') as ReplayStoreApi['bringForward'],
    sendBackward: track('sendBackward') as ReplayStoreApi['sendBackward'],
    bringToFront: track('bringToFront') as ReplayStoreApi['bringToFront'],
    sendToBack: track('sendToBack') as ReplayStoreApi['sendToBack'],
    setObjectText: track('setObjectText') as ReplayStoreApi['setObjectText'],
  }
}

function makeOp(op_type: string, payload: Record<string, unknown> = {}, page_id = 'page-1'): BoardOperation {
  return { id: 1, op_type, page_id, payload, user: 1, created_at: '2026-01-01T00:00:00Z' }
}

// ─── Stroke ops ──────────────────────────────────────────────────────────────

describe('applyReplayOperation — stroke ops', () => {
  it('stroke_add calls addStroke with skipHistory', () => {
    const store = makeStore()
    const stroke = { id: 's1', points: [] }
    applyReplayOperation(store, makeOp('stroke_add', { stroke }))
    expect(store._calls.addStroke?.[0]).toEqual([stroke, { skipHistory: true }])
  })

  it('stroke_update calls updateStroke with skipHistory', () => {
    const store = makeStore()
    const stroke = { id: 's1', points: [1, 2] }
    applyReplayOperation(store, makeOp('stroke_update', { stroke }))
    expect(store._calls.updateStroke?.[0]).toEqual([stroke, { skipHistory: true }])
  })

  it('stroke_delete calls deleteStroke with skipHistory', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('stroke_delete', { stroke_id: 's1' }))
    expect(store._calls.deleteStroke?.[0]).toEqual(['s1', { skipHistory: true }])
  })

  it('stroke_add with missing payload.stroke — no-op, no throw', () => {
    const store = makeStore()
    expect(() => applyReplayOperation(store, makeOp('stroke_add', {}))).not.toThrow()
    expect(store._calls.addStroke).toBeUndefined()
  })
})

// ─── Asset ops ───────────────────────────────────────────────────────────────

describe('applyReplayOperation — asset ops', () => {
  it('asset_add calls addAsset з op.page_id (TASK 2 hardening 2026-04-29)', () => {
    const store = makeStore()
    const asset = { id: 'a1', type: 'image', src: 'http://x.png' }
    applyReplayOperation(store, makeOp('asset_add', { asset }, 'page-2'))
    // page_id переданий явно — solid/asset потрапляє на правильну сторінку,
    // не на currentPageIndex (=0 після resetForReplay).
    expect(store._calls.addAsset?.[0]).toEqual([asset, 'page-2', { skipHistory: true }])
  })

  it('asset_add без op.page_id у DEV throws (helper hardening 2026-04-29)', () => {
    const store = makeStore()
    const asset = { id: 'a1', type: 'image', src: 'http://x.png' }
    // У DEV mode (vitest) applier throws на REQUIRES_PAGE_ID op без page_id —
    // catches emit-side bugs якомога раніше. У production — skip+log+counter.
    expect(() => {
      applyReplayOperation(store, {
        id: 1, op_type: 'asset_add', page_id: '',
        payload: { asset }, user: 1, created_at: '2026-01-01T00:00:00Z',
      })
    }).toThrow(/op\.page_id missing/)
    expect(store._calls.addAsset).toBeUndefined()
  })

  it('asset_update calls updateAsset with skipHistory + skipBuffer', () => {
    const store = makeStore()
    const asset = { id: 'a1', x: 100, y: 200 }
    applyReplayOperation(store, makeOp('asset_update', { asset }))
    expect(store._calls.updateAsset?.[0]).toEqual([asset, { skipHistory: true, skipBuffer: true }])
  })

  it('asset_delete calls deleteAsset with skipHistory', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('asset_delete', { asset_id: 'a1' }))
    expect(store._calls.deleteAsset?.[0]).toEqual(['a1', { skipHistory: true }])
  })
})

// ─── Page ops ────────────────────────────────────────────────────────────────

describe('applyReplayOperation — page ops', () => {
  it('page_add calls addPage with correct params', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('page_add', { page: { name: 'Slide 2', background: 'white' } }))
    expect(store._calls.addPage?.[0][0]).toMatchObject({ name: 'Slide 2', background: 'white' })
  })

  it('page_navigate calls goToPage with pageIndex', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('page_navigate', { pageIndex: 1 }))
    expect(store._calls.goToPage?.[0]).toEqual([1])
  })

  it('page_change (legacy alias) calls goToPage', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('page_change', { page_index: 0 }))
    expect(store._calls.goToPage?.[0]).toEqual([0])
  })

  it('page_delete finds page by id and deletes by index', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('page_delete', { page_id: 'page-2' }))
    expect(store._calls.deletePage?.[0]).toEqual([1])  // page-2 is index 1
  })

  it('page_delete with unknown page_id — no-op', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('page_delete', { page_id: 'nonexistent' }))
    expect(store._calls.deletePage).toBeUndefined()
  })

  it('clear_page navigates to page then clears', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('clear_page', {}, 'page-2'))
    expect(store._calls.goToPage?.[0]).toEqual([1])
    expect(store._calls.clearPage).toBeDefined()
  })
})

// ─── Board meta ops (Phase 20+) ──────────────────────────────────────────────

describe('applyReplayOperation — grid_update', () => {
  it('gridSize variant calls setGridSize', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('grid_update', { gridSize: 40 }))
    expect(store._calls.setGridSize?.[0]).toEqual([40])
  })

  it('grid object variant calls updateCurrentPageGrid', () => {
    const store = makeStore()
    const grid = { enabled: true, size: 20, style: 'dots', color: '#ccc' }
    applyReplayOperation(store, makeOp('grid_update', { grid }))
    expect(store._calls.updateCurrentPageGrid?.[0]).toEqual([grid])
  })

  it('empty payload — no-op, no throw', () => {
    const store = makeStore()
    expect(() => applyReplayOperation(store, makeOp('grid_update', {}))).not.toThrow()
  })
})

describe('applyReplayOperation — background_update', () => {
  it('calls setBackgroundColor with color and op.page_id (Fix 2026-04-29)', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('background_update', { color: '#ff0000' }))
    // Fix 2026-04-29: applier passes op.page_id ('page-1' default у makeOp)
    // so target page resolves correctly during replay seek (not currentPageIndex).
    expect(store._calls.setBackgroundColor?.[0]).toEqual(['#ff0000', 'page-1'])
  })

  it('missing color — no-op', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('background_update', {}))
    expect(store._calls.setBackgroundColor).toBeUndefined()
  })
})

describe('applyReplayOperation — group ops', () => {
  it('group_create calls createGroup with itemIds', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('group_create', { group_id: 'g1', itemIds: ['s1', 's2'] }))
    expect(store._calls.createGroup?.[0]).toEqual([['s1', 's2']])
  })

  it('group_create with empty itemIds — no-op', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('group_create', { itemIds: [] }))
    expect(store._calls.createGroup).toBeUndefined()
  })

  it('group_delete calls deleteGroup with group_id', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('group_delete', { group_id: 'g1' }))
    expect(store._calls.deleteGroup?.[0]).toEqual(['g1'])
  })
})

describe('applyReplayOperation — lock_update', () => {
  it('locked=true calls lockItems', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('lock_update', { ids: ['s1', 's2'], locked: true }))
    expect(store._calls.lockItems?.[0]).toEqual([['s1', 's2']])
    expect(store._calls.unlockItems).toBeUndefined()
  })

  it('locked=false calls unlockItems', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('lock_update', { ids: ['s1'], locked: false }))
    expect(store._calls.unlockItems?.[0]).toEqual([['s1']])
    expect(store._calls.lockItems).toBeUndefined()
  })

  it('missing ids — no-op', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('lock_update', { locked: true }))
    expect(store._calls.lockItems).toBeUndefined()
  })
})

describe('applyReplayOperation — z_order', () => {
  it('bringForward action', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('z_order', { object_id: 'obj1', action: 'bringForward' }))
    expect(store._calls.bringForward?.[0]).toEqual(['obj1'])
  })

  it('sendBackward action', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('z_order', { object_id: 'obj1', action: 'sendBackward' }))
    expect(store._calls.sendBackward?.[0]).toEqual(['obj1'])
  })

  it('bringToFront action', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('z_order', { object_id: 'obj1', action: 'bringToFront' }))
    expect(store._calls.bringToFront?.[0]).toEqual(['obj1'])
  })

  it('sendToBack action', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('z_order', { object_id: 'obj1', action: 'sendToBack' }))
    expect(store._calls.sendToBack?.[0]).toEqual(['obj1'])
  })

  it('missing object_id — no-op', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('z_order', { action: 'bringForward' }))
    expect(store._calls.bringForward).toBeUndefined()
  })

  it('unknown action — no-op, no throw', () => {
    const store = makeStore()
    expect(() =>
      applyReplayOperation(store, makeOp('z_order', { object_id: 'obj1', action: 'unknown' }))
    ).not.toThrow()
  })
})

// ─── objects_move (Phase 1 animation) ────────────────────────────────────────
//
// The applier routes `objects_move` through MoveAnimator when guards pass,
// else falls back to synchronous per-asset updateAsset calls. Tests below
// inject a fake animator to verify the routing decision deterministically
// (no rAF timing).
//
// Invariants under test:
//  - items.length > 20 → instant path, animator NOT called
//  - items.length <= 20 → animator called, final commit queued
//  - reduced motion preference → instant path
//  - reset() cancels any in-flight animation via animator.cancel()
//  - store without applyTransientPositions → instant path (backwards compat)

function makeMoveStore(
  assets: Array<{ id: string; x: number; y: number }>,
  opts?: { withBatch?: boolean },
) {
  const base = makeStore() as ReplayStoreApi & {
    _calls: Record<string, unknown[][]>
    applyTransientPositions?: (items: Array<{ id: string; x: number; y: number }>) => void
  }
  // Override pages with live assets array so handler can find them.
  ;(base as unknown as { pages: Array<{ id: string; assets: unknown[] }> }).pages = [
    { id: 'page-1', assets: assets.map((a) => ({ ...a })) },
  ]
  if (opts?.withBatch !== false) {
    base.applyTransientPositions = (items) => {
      base._calls.applyTransientPositions = base._calls.applyTransientPositions ?? []
      base._calls.applyTransientPositions.push([items])
    }
  }
  return base
}

function makeFakeAnimator(): MoveAnimator & {
  _animateCalls: unknown[][]
  _cancelCount: number
  _pending: Array<() => void>
} {
  const anim: MoveAnimator & {
    _animateCalls: unknown[][]
    _cancelCount: number
    _pending: Array<() => void>
  } = {
    _animateCalls: [],
    _cancelCount: 0,
    _pending: [],
    animate(items, ctx) {
      anim._animateCalls.push([items, ctx])
      return new Promise<void>((resolve) => {
        anim._pending.push(resolve)
      })
    },
    cancel() {
      anim._cancelCount += 1
    },
  }
  return anim
}

describe('applyReplayOperation — objects_move (Phase 1)', () => {
  beforeEach(() => {
    // Ensure reduced-motion is disabled for animated-path tests
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }) as MediaQueryList,
    } as unknown as Window & typeof globalThis)
  })

  it('instant path when items.length > 20 (guard: MOVE_ANIMATION_MAX_ITEMS)', () => {
    const assets = Array.from({ length: 25 }, (_, i) => ({ id: `a${i}`, x: 0, y: 0 }))
    const store = makeMoveStore(assets)
    const animator = makeFakeAnimator()
    const applier = createReplayApplier({ animator })

    const items = assets.map((a) => ({ id: a.id, x: 100, y: 50 }))
    applier.apply(store, {
      id: 1,
      op_type: 'objects_move',
      page_id: 'page-1',
      payload: { items },
      user: 1,
      created_at: '2026-01-01T00:00:00Z',
    })

    // Animator NOT called; each asset updated synchronously.
    expect(animator._animateCalls).toHaveLength(0)
    expect(store._calls.updateAsset?.length).toBe(25)
  })

  it('animated path when items.length <= 20', () => {
    const assets = Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, x: 0, y: 0 }))
    const store = makeMoveStore(assets)
    const animator = makeFakeAnimator()
    const applier = createReplayApplier({ animator })

    const items = assets.map((a) => ({ id: a.id, x: 100, y: 50 }))
    applier.apply(store, {
      id: 1,
      op_type: 'objects_move',
      page_id: 'page-1',
      payload: { items },
      user: 1,
      created_at: '2026-01-01T00:00:00Z',
    })

    // Animator called with asset-kind items; instant updates NOT called yet.
    expect(animator._animateCalls).toHaveLength(1)
    const passedItems = animator._animateCalls[0][0] as Array<{ kind: string }>
    expect(passedItems).toHaveLength(10)
    expect(passedItems.every((it) => it.kind === 'asset')).toBe(true)
    // No instant updateAsset during animation.
    expect(store._calls.updateAsset).toBeUndefined()
  })

  it('final commit runs after animator resolves (idempotent)', async () => {
    const store = makeMoveStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = makeFakeAnimator()
    const applier = createReplayApplier({ animator })

    applier.apply(store, {
      id: 1,
      op_type: 'objects_move',
      page_id: 'page-1',
      payload: { items: [{ id: 'a1', x: 100, y: 200 }] },
      user: 1,
      created_at: '2026-01-01T00:00:00Z',
    })

    expect(store._calls.updateAsset).toBeUndefined()
    // Resolve animator — final commit should fire.
    animator._pending[0]()
    await Promise.resolve()
    await Promise.resolve()

    expect(store._calls.updateAsset?.length).toBe(1)
    const [asset, opts] = (store._calls.updateAsset as unknown[][])[0]
    expect(asset).toMatchObject({ id: 'a1', x: 100, y: 200 })
    expect(opts).toEqual({ skipHistory: true, skipBuffer: true })
  })

  it('reduced-motion preference → instant path', () => {
    vi.stubGlobal('window', {
      matchMedia: (q: string) =>
        ({ matches: q === '(prefers-reduced-motion: reduce)' }) as MediaQueryList,
    } as unknown as Window & typeof globalThis)

    const store = makeMoveStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = makeFakeAnimator()
    const applier = createReplayApplier({ animator })

    applier.apply(store, {
      id: 1,
      op_type: 'objects_move',
      page_id: 'page-1',
      payload: { items: [{ id: 'a1', x: 100, y: 50 }] },
      user: 1,
      created_at: '2026-01-01T00:00:00Z',
    })

    expect(animator._animateCalls).toHaveLength(0)
    expect(store._calls.updateAsset?.length).toBe(1)
  })

  it('reset() cancels in-flight animation', () => {
    const store = makeMoveStore([{ id: 'a1', x: 0, y: 0 }])
    const animator = makeFakeAnimator()
    const applier = createReplayApplier({ animator })

    applier.apply(store, {
      id: 1,
      op_type: 'objects_move',
      page_id: 'page-1',
      payload: { items: [{ id: 'a1', x: 100, y: 50 }] },
      user: 1,
      created_at: '2026-01-01T00:00:00Z',
    })
    expect(animator._cancelCount).toBe(0)
    applier.reset()
    expect(animator._cancelCount).toBe(1)
  })

  it('store without applyTransientPositions → instant path (backwards compat)', () => {
    // Legacy ReplayStoreApi callers may not have the batch method.
    const store = makeMoveStore([{ id: 'a1', x: 0, y: 0 }], { withBatch: false })
    // NO injected animator — applier would lazy-init, but guard prevents it.
    const applier = createReplayApplier()

    applier.apply(store, {
      id: 1,
      op_type: 'objects_move',
      page_id: 'page-1',
      payload: { items: [{ id: 'a1', x: 100, y: 50 }] },
      user: 1,
      created_at: '2026-01-01T00:00:00Z',
    })

    expect(store._calls.updateAsset?.length).toBe(1)
  })
})

// ─── Unknown op_type ─────────────────────────────────────────────────────────

describe('applyReplayOperation — unknown op_type', () => {
  // Helper hardening 2026-04-29 round 2: unknown op у DEV → throw (catches
  // FE/BE drift коли новий op_type emit'ують але applier не оновлений).
  // Production: console.warn + skip — replay не блокується.
  it('unknown op_type у DEV throws (KNOWN_OPS guard)', () => {
    const store = makeStore()
    expect(() =>
      applyReplayOperation(store, makeOp('future_op', { data: 'x' }))
    ).toThrow(/unknown op_type='future_op'/)
  })

  it('unknown op_type calls no store methods (DEV throws перед switch)', () => {
    const store = makeStore()
    try {
      applyReplayOperation(store, makeOp('future_op', {}))
    } catch (_e) {
      // expected DEV throw
    }
    expect(Object.keys(store._calls)).toHaveLength(0)
  })
})
