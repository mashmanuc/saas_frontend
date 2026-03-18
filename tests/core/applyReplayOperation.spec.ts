import { describe, it, expect, vi } from 'vitest'
import { applyReplayOperation, type ReplayStoreApi } from
  '@/modules/winterboard/engine/applyReplayOperation'

function createMockStore(): ReplayStoreApi {
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
    pages: [{ id: 'page-1' }, { id: 'page-2' }],
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
