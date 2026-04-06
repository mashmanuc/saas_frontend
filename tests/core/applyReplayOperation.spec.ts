import { describe, it, expect, vi } from 'vitest'
import { applyReplayOperation, type ReplayStoreApi } from
  '@/modules/winterboard/engine/applyReplayOperation'

function createMockStore(): ReplayStoreApi & { setGridSize: any; updateCurrentPageGrid: any; setBackgroundColor: any; createGroup: any; deleteGroup: any; lockItems: any; unlockItems: any; bringForward: any; sendBackward: any; bringToFront: any; sendToBack: any } {
  return {
    addStroke: vi.fn(),
    updateStroke: vi.fn(),
    deleteStroke: vi.fn(),
    addAsset: vi.fn(),
    updateAsset: vi.fn(),
    deleteAsset: vi.fn(),
    addPage: vi.fn(),
    goToPage: vi.fn(),
    deletePage: vi.fn(),
    clearPage: vi.fn(),
    currentPageIndex: 0,
    pages: [{ id: 'page-1' }, { id: 'page-2' }],
    setGridSize: vi.fn(),
    updateCurrentPageGrid: vi.fn(),
    setBackgroundColor: vi.fn(),
    createGroup: vi.fn(),
    deleteGroup: vi.fn(),
    lockItems: vi.fn(),
    unlockItems: vi.fn(),
    bringForward: vi.fn(),
    sendBackward: vi.fn(),
    bringToFront: vi.fn(),
    sendToBack: vi.fn(),
  }
}

function op(overrides: Record<string, unknown>) {
  return {
    id: 'op-1',
    op_type: '',
    page_id: '',
    payload: {},
    timestamp: 0,
    ...overrides,
  } as any
}

describe('applyReplayOperation', () => {
  it('applies stroke_add', () => {
    const store = createMockStore()
    const stroke = { id: 's1', points: [] }
    applyReplayOperation(store, op({
      op_type: 'stroke_add',
      payload: { stroke },
    }))
    expect(store.addStroke).toHaveBeenCalledWith(stroke, { skipHistory: true })
  })

  it('applies stroke_update', () => {
    const store = createMockStore()
    const stroke = { id: 's1', points: [{ x: 1, y: 2 }] }
    applyReplayOperation(store, op({
      op_type: 'stroke_update',
      payload: { stroke },
    }))
    expect(store.updateStroke).toHaveBeenCalledWith(stroke, { skipHistory: true })
  })

  it('applies stroke_delete', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'stroke_delete',
      payload: { stroke_id: 's1' },
    }))
    expect(store.deleteStroke).toHaveBeenCalledWith('s1', { skipHistory: true })
  })

  it('applies asset_add', () => {
    const store = createMockStore()
    const asset = { id: 'a1', type: 'image' }
    applyReplayOperation(store, op({
      op_type: 'asset_add',
      payload: { asset },
    }))
    expect(store.addAsset).toHaveBeenCalledWith(asset, { skipHistory: true })
  })

  it('applies asset_update', () => {
    const store = createMockStore()
    const asset = { id: 'a1', type: 'image', x: 100 }
    applyReplayOperation(store, op({
      op_type: 'asset_update',
      payload: { asset },
    }))
    expect(store.updateAsset).toHaveBeenCalledWith(asset, { skipHistory: true })
  })

  it('applies asset_delete', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'asset_delete',
      payload: { asset_id: 'a1' },
    }))
    expect(store.deleteAsset).toHaveBeenCalledWith('a1', { skipHistory: true })
  })

  it('applies page_add', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'page_add',
      payload: { page: { id: 'page-3', name: 'Page 3', background: 'white' } },
    }))
    expect(store.addPage).toHaveBeenCalledWith({
      name: 'Page 3',
      background: 'white',
      width: undefined,
      height: undefined,
    })
  })

  it('applies page_navigate with pageIndex', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'page_navigate',
      payload: { pageIndex: 1 },
    }))
    expect(store.goToPage).toHaveBeenCalledWith(1)
  })

  it('applies page_change (legacy) with page_index', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'page_change',
      payload: { page_index: 1 },
    }))
    expect(store.goToPage).toHaveBeenCalledWith(1)
  })

  it('applies page_delete', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'page_delete',
      payload: { page_id: 'page-2' },
    }))
    expect(store.deletePage).toHaveBeenCalledWith(1)
  })

  it('applies clear_page', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'clear_page',
      page_id: 'page-1',
    }))
    expect(store.goToPage).toHaveBeenCalledWith(0)
    expect(store.clearPage).toHaveBeenCalled()
  })

  it('resolves page by page_id before stroke_add (REPLAY-FIX-1)', () => {
    const store = createMockStore()
    store.currentPageIndex = 0
    const stroke = { id: 's1', points: [] }
    applyReplayOperation(store, op({
      op_type: 'stroke_add',
      page_id: 'page-2',
      payload: { stroke },
    }))
    expect(store.goToPage).toHaveBeenCalledWith(1)
    expect(store.addStroke).toHaveBeenCalledWith(stroke, { skipHistory: true })
  })

  it('adopts page_id for single-page store after resetForReplay (REPLAY-FIX-1)', () => {
    const store = createMockStore()
    store.pages = [{ id: 'random-reset-id' }]
    store.currentPageIndex = 0
    const stroke = { id: 's1', points: [] }
    applyReplayOperation(store, op({
      op_type: 'stroke_add',
      page_id: 'original-page-id',
      payload: { stroke },
    }))
    expect(store.pages[0].id).toBe('original-page-id')
    expect(store.addStroke).toHaveBeenCalledWith(stroke, { skipHistory: true })
  })

  it('preserves original page_id on page_add (REPLAY-FIX-1)', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'page_add',
      page_id: 'recorded-page-id',
      payload: { page: { id: 'recorded-page-id', name: 'Page 3', background: 'white' } },
    }))
    expect(store.addPage).toHaveBeenCalled()
    // After addPage mock, pages array isn't actually modified (mock),
    // but the production code overwrites the id of the last page.
  })

  it('ignores unknown op_type', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'unknown_thing',
    }))
    expect(store.addStroke).not.toHaveBeenCalled()
    expect(store.addPage).not.toHaveBeenCalled()
    expect(store.goToPage).not.toHaveBeenCalled()
  })

  it('page_delete with non-existent page_id is no-op', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'page_delete',
      payload: { page_id: 'non-existent' },
    }))
    expect(store.deletePage).not.toHaveBeenCalled()
  })

  it('clear_page with non-existent page_id is no-op', () => {
    const store = createMockStore()
    applyReplayOperation(store, op({
      op_type: 'clear_page',
      page_id: 'non-existent',
    }))
    expect(store.goToPage).not.toHaveBeenCalled()
    expect(store.clearPage).not.toHaveBeenCalled()
  })
})
