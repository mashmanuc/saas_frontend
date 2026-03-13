// usePageGrid — unit tests
// Ref: responsive/prompts/active/DAY12-13_PHASE6.md A9
// Coverage: DEFAULT_PAGE_GRID, currentPageGrid computed, updatePageGrid, _applyGridToCanvas,
//           per-page isolation, page switch, disabled grid

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import {
  usePageGrid,
  DEFAULT_PAGE_GRID,
  _applyGridToCanvas,
} from '@/modules/winterboard/composables/usePageGrid'
import type { WBPageGridSettings } from '@/modules/winterboard/types/winterboard'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStore() {
  const store = useWBStore()
  store.$patch({
    workspaceId: 'test-ws',
    pages: [
      { id: 'p1', name: 'Page 1', strokes: [], assets: [] },
      { id: 'p2', name: 'Page 2', strokes: [], assets: [] },
    ],
    currentPageIndex: 0,
  })
  return store
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('DEFAULT_PAGE_GRID', () => {
  it('has expected default values', () => {
    expect(DEFAULT_PAGE_GRID.enabled).toBe(true)
    expect(DEFAULT_PAGE_GRID.size).toBe(20)
    expect(DEFAULT_PAGE_GRID.style).toBe('dots')
    expect(DEFAULT_PAGE_GRID.color).toBe('#000000')
    expect(DEFAULT_PAGE_GRID.opacity).toBe(0.15)
  })

  it('default opacity 0.15 is in valid range', () => {
    expect(DEFAULT_PAGE_GRID.opacity).toBeGreaterThanOrEqual(0.05)
    expect(DEFAULT_PAGE_GRID.opacity).toBeLessThanOrEqual(0.5)
  })
})

describe('usePageGrid — currentPageGrid', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('returns default grid when page has no grid settings', () => {
    makeStore()
    const { currentPageGrid } = usePageGrid()
    expect(currentPageGrid.value).toEqual(DEFAULT_PAGE_GRID)
  })

  it('returns page.grid when set', () => {
    const store = makeStore()
    const customGrid: WBPageGridSettings = {
      enabled: false,
      size: 40,
      style: 'lines',
      color: '#ff0000',
      opacity: 0.3,
    }
    store.updateCurrentPageGrid(customGrid)
    const { currentPageGrid } = usePageGrid()
    expect(currentPageGrid.value).toEqual(customGrid)
  })

  it('returns defaults for missing fields (partial grid)', () => {
    const store = makeStore()
    // Manually patch page with partial grid (simulates old persisted state)
    store.$patch((s) => {
      s.pages[0] = { ...s.pages[0], grid: { enabled: false } as WBPageGridSettings }
    })
    const { currentPageGrid } = usePageGrid()
    // enabled should be false from the page
    expect(currentPageGrid.value.enabled).toBe(false)
    // rest should fall back to defaults
    expect(currentPageGrid.value.size).toBe(DEFAULT_PAGE_GRID.size)
    expect(currentPageGrid.value.style).toBe(DEFAULT_PAGE_GRID.style)
  })
})

describe('usePageGrid — updatePageGrid', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('updatePageGrid writes to current page grid', () => {
    const store = makeStore()
    const { updatePageGrid } = usePageGrid()
    updatePageGrid({ enabled: false, opacity: 0.4 })
    const page = store.currentPage!
    expect(page.grid?.enabled).toBe(false)
    expect(page.grid?.opacity).toBe(0.4)
  })

  it('updatePageGrid marks store dirty', () => {
    const store = makeStore()
    store.isDirty = false
    const { updatePageGrid } = usePageGrid()
    updatePageGrid({ enabled: true })
    expect(store.isDirty).toBe(true)
  })
})

describe('usePageGrid — per-page isolation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('grid settings are independent per page', () => {
    const store = makeStore()
    // Set grid on page 0
    store.updateCurrentPageGrid({ enabled: true, size: 60, style: 'lines', color: '#000', opacity: 0.3 })
    // Switch to page 1
    store.goToPage(1)
    // Page 1 should have default grid (no settings yet)
    const { currentPageGrid } = usePageGrid()
    expect(currentPageGrid.value).toEqual(DEFAULT_PAGE_GRID)
    // Page 0 settings preserved
    const page0Grid = store.pages[0].grid
    expect(page0Grid?.size).toBe(60)
    expect(page0Grid?.style).toBe('lines')
  })

  it('switching pages updates currentPageGrid reactively', () => {
    const store = makeStore()
    store.updateCurrentPageGrid({ enabled: true, opacity: 0.45 })
    const { currentPageGrid } = usePageGrid()
    expect(currentPageGrid.value.opacity).toBe(0.45)
    // Switch to page 1 (no grid)
    store.goToPage(1)
    expect(currentPageGrid.value.opacity).toBe(DEFAULT_PAGE_GRID.opacity)
  })
})

describe('boardStore — updateCurrentPageGrid', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('creates grid from scratch when page.grid is undefined', () => {
    const store = makeStore()
    expect(store.currentPage!.grid).toBeUndefined()
    store.updateCurrentPageGrid({ enabled: false })
    expect(store.currentPage!.grid).toBeDefined()
    expect(store.currentPage!.grid!.enabled).toBe(false)
    // Other fields should come from DEFAULT_GRID inside the action
    expect(store.currentPage!.grid!.size).toBe(20)
  })

  it('merges partial updates with existing grid', () => {
    const store = makeStore()
    store.updateCurrentPageGrid({ enabled: true, size: 40 })
    store.updateCurrentPageGrid({ opacity: 0.35 })
    // size should still be 40
    expect(store.currentPage!.grid!.size).toBe(40)
    expect(store.currentPage!.grid!.opacity).toBe(0.35)
  })

  it('does nothing when no current page', () => {
    const store = useWBStore()
    store.$patch({ pages: [], currentPageIndex: 0 })
    expect(() => store.updateCurrentPageGrid({ enabled: false })).not.toThrow()
  })

  it('setGridPattern stores and clears dataUrl', () => {
    const store = makeStore()
    expect(store.gridPatternDataUrl).toBeNull()
    store.setGridPattern('data:image/png;base64,abc')
    expect(store.gridPatternDataUrl).toBe('data:image/png;base64,abc')
    store.setGridPattern(null)
    expect(store.gridPatternDataUrl).toBeNull()
  })
})

// ─── Canvas mock helpers ─────────────────────────────────────────────────────

function makeMockCtx() {
  return {
    clearRect: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    globalAlpha: 0,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  }
}

function mockCanvasCreation(toDataURL = 'data:image/png;base64,MOCK') {
  const ctx = makeMockCtx()
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toDataURL: vi.fn(() => toDataURL),
  }
  const origCreate = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement
    return origCreate(tag)
  })
  return { ctx, mockCanvas }
}

describe('_applyGridToCanvas', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls setGridPattern(null) when grid is disabled', () => {
    const store = makeStore()
    const spy = vi.spyOn(store, 'setGridPattern')
    _applyGridToCanvas(store, { ...DEFAULT_PAGE_GRID, enabled: false })
    expect(spy).toHaveBeenCalledWith(null)
  })

  it('calls setGridPattern with dataURL string for dots style', () => {
    const store = makeStore()
    mockCanvasCreation('data:image/png;base64,DOTS')
    const captured: Array<string | null> = []
    store.setGridPattern = (url: string | null) => { captured.push(url) }
    _applyGridToCanvas(store, { ...DEFAULT_PAGE_GRID, style: 'dots', enabled: true })
    expect(captured).toHaveLength(1)
    expect(captured[0]).toBe('data:image/png;base64,DOTS')
  })

  it('calls setGridPattern with dataURL string for lines style', () => {
    const store = makeStore()
    mockCanvasCreation('data:image/png;base64,LINES')
    const captured: Array<string | null> = []
    store.setGridPattern = (url: string | null) => { captured.push(url) }
    _applyGridToCanvas(store, { ...DEFAULT_PAGE_GRID, style: 'lines', enabled: true })
    expect(captured).toHaveLength(1)
    expect(captured[0]).toBe('data:image/png;base64,LINES')
  })

  it('draws arc for dots style', () => {
    const store = makeStore()
    const { ctx } = mockCanvasCreation()
    store.setGridPattern = vi.fn()
    _applyGridToCanvas(store, { ...DEFAULT_PAGE_GRID, style: 'dots', enabled: true })
    expect(ctx.arc).toHaveBeenCalled()
    expect(ctx.fill).toHaveBeenCalled()
  })

  it('draws lines for lines style', () => {
    const store = makeStore()
    const { ctx } = mockCanvasCreation()
    store.setGridPattern = vi.fn()
    _applyGridToCanvas(store, { ...DEFAULT_PAGE_GRID, style: 'lines', enabled: true })
    expect(ctx.moveTo).toHaveBeenCalled()
    expect(ctx.lineTo).toHaveBeenCalled()
    expect(ctx.stroke).toHaveBeenCalled()
  })

  it('sets globalAlpha from grid.opacity', () => {
    const store = makeStore()
    const { ctx } = mockCanvasCreation()
    store.setGridPattern = vi.fn()
    _applyGridToCanvas(store, { ...DEFAULT_PAGE_GRID, opacity: 0.35, enabled: true })
    expect(ctx.globalAlpha).toBe(0.35)
  })
})
