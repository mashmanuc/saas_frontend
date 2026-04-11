// Unit tests: applyReplayOperation — всі 16 op_types
// REPLAY-INV-5: кожен op_type що emitується boardStore має бути покритий тут
// REPLAY-INV-11: детермінізм — apply(op) має відтворювати точний state

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyReplayOperation, type ReplayStoreApi } from '../engine/applyReplayOperation'
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
  it('asset_add calls addAsset with skipHistory', () => {
    const store = makeStore()
    const asset = { id: 'a1', type: 'image', src: 'http://x.png' }
    applyReplayOperation(store, makeOp('asset_add', { asset }))
    expect(store._calls.addAsset?.[0]).toEqual([asset, { skipHistory: true }])
  })

  it('asset_update calls updateAsset with skipHistory', () => {
    const store = makeStore()
    const asset = { id: 'a1', x: 100, y: 200 }
    applyReplayOperation(store, makeOp('asset_update', { asset }))
    expect(store._calls.updateAsset?.[0]).toEqual([asset, { skipHistory: true }])
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
  it('calls setBackgroundColor with color', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('background_update', { color: '#ff0000' }))
    expect(store._calls.setBackgroundColor?.[0]).toEqual(['#ff0000'])
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

// ─── Unknown op_type ─────────────────────────────────────────────────────────

describe('applyReplayOperation — unknown op_type', () => {
  it('unknown op_type does not throw', () => {
    const store = makeStore()
    expect(() =>
      applyReplayOperation(store, makeOp('future_op', { data: 'x' }))
    ).not.toThrow()
  })

  it('unknown op_type calls no store methods', () => {
    const store = makeStore()
    applyReplayOperation(store, makeOp('future_op', {}))
    expect(Object.keys(store._calls)).toHaveLength(0)
  })
})
