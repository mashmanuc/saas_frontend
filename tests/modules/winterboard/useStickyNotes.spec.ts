// WB5 A9: Unit tests for sticky notes — composable + boardStore actions + undo/redo
// Ref: TASK_BOARD_V5.md A9

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { useStickyNotes } from '@/modules/winterboard/composables/useStickyNotes'
import { STICKY_DEFAULTS, STICKY_COLORS } from '@/modules/winterboard/types/winterboard'
import type { WBAsset } from '@/modules/winterboard/types/winterboard'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSticky(id: string, opts?: Partial<WBAsset>): WBAsset {
  return {
    id,
    type: 'sticky',
    src: '',
    x: 100,
    y: 100,
    w: STICKY_DEFAULTS.width,
    h: STICKY_DEFAULTS.height,
    rotation: 0,
    text: '',
    bgColor: STICKY_DEFAULTS.bgColor,
    textColor: STICKY_DEFAULTS.textColor,
    fontSize: STICKY_DEFAULTS.fontSize,
    ...opts,
  }
}

// ─── Tests: createSticky ─────────────────────────────────────────────────────

describe('useStickyNotes — createSticky', () => {
  let store: ReturnType<typeof useWBStore>
  let sticky: ReturnType<typeof useStickyNotes>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    sticky = useStickyNotes(store)
  })

  it('creates sticky with default yellow color', () => {
    const id = sticky.createSticky(100, 200)
    expect(id).toBeTruthy()
    const asset = store.currentPage!.assets.find((a) => a.id === id)
    expect(asset).toBeDefined()
    expect(asset!.type).toBe('sticky')
    expect(asset!.bgColor).toBe(STICKY_DEFAULTS.bgColor)
    expect(asset!.textColor).toBe(STICKY_DEFAULTS.textColor)
    expect(asset!.fontSize).toBe(STICKY_DEFAULTS.fontSize)
  })

  it('creates sticky with custom color', () => {
    const id = sticky.createSticky(100, 200, STICKY_COLORS[2].bg) // blue
    const asset = store.currentPage!.assets.find((a) => a.id === id)
    expect(asset!.bgColor).toBe('#93c5fd')
  })

  it('creates sticky with correct dimensions', () => {
    const id = sticky.createSticky(50, 75)
    const asset = store.currentPage!.assets.find((a) => a.id === id)
    expect(asset!.x).toBe(50)
    expect(asset!.y).toBe(75)
    expect(asset!.w).toBe(STICKY_DEFAULTS.width)
    expect(asset!.h).toBe(STICKY_DEFAULTS.height)
  })

  it('selects newly created sticky', () => {
    const id = sticky.createSticky(100, 200)
    expect(store.selectedIds).toEqual([id])
  })

  it('undo addSticky removes it', () => {
    const id = sticky.createSticky(100, 200)
    expect(store.currentPage!.assets).toHaveLength(1)

    store.undo()
    expect(store.currentPage!.assets).toHaveLength(0)
    expect(store.currentPage!.assets.find((a) => a.id === id)).toBeUndefined()
  })

  it('redo addSticky restores it', () => {
    const id = sticky.createSticky(100, 200)
    store.undo()
    expect(store.currentPage!.assets).toHaveLength(0)

    store.redo()
    expect(store.currentPage!.assets).toHaveLength(1)
    expect(store.currentPage!.assets[0].id).toBe(id)
  })
})

// ─── Tests: updateText ───────────────────────────────────────────────────────

describe('useStickyNotes — updateText', () => {
  let store: ReturnType<typeof useWBStore>
  let sticky: ReturnType<typeof useStickyNotes>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    sticky = useStickyNotes(store)
  })

  it('updates text on sticky', () => {
    const id = sticky.createSticky(100, 200)
    store.undoStack = []

    sticky.updateText(id, 'Hello World')
    const asset = store.currentPage!.assets.find((a) => a.id === id)
    expect(asset!.text).toBe('Hello World')
  })

  it('clamps text to max 500 chars', () => {
    const id = sticky.createSticky(100, 200)
    store.undoStack = []

    const longText = 'A'.repeat(600)
    sticky.updateText(id, longText)
    const asset = store.currentPage!.assets.find((a) => a.id === id)
    expect(asset!.text).toBe('A'.repeat(500))
  })

  it('locked sticky text update is no-op', () => {
    store.addStickyNote(makeSticky('s1', { locked: true, lockedBy: 'user-1', text: 'original' }))
    store.undoStack = []

    store.updateStickyText('s1', 'changed')
    const asset = store.currentPage!.assets.find((a) => a.id === 's1')
    expect(asset!.text).toBe('original')
    expect(store.undoStack).toHaveLength(0)
  })

  it('undo text update restores previous text', () => {
    const id = sticky.createSticky(100, 200)
    store.undoStack = []

    sticky.updateText(id, 'New text')
    expect(store.currentPage!.assets.find((a) => a.id === id)!.text).toBe('New text')

    store.undo()
    expect(store.currentPage!.assets.find((a) => a.id === id)!.text).toBe('')
  })
})

// ─── Tests: updateColor, updateFontSize, updateDimensions ────────────────────

describe('useStickyNotes — style updates', () => {
  let store: ReturnType<typeof useWBStore>
  let sticky: ReturnType<typeof useStickyNotes>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    sticky = useStickyNotes(store)
  })

  it('updateColor changes bgColor', () => {
    const id = sticky.createSticky(100, 200)
    store.undoStack = []

    sticky.updateColor(id, '#86efac') // green
    const asset = store.currentPage!.assets.find((a) => a.id === id)
    expect(asset!.bgColor).toBe('#86efac')
  })

  it('updateFontSize clamps to 10-32', () => {
    const id = sticky.createSticky(100, 200)
    store.undoStack = []

    sticky.updateFontSize(id, 5) // below min
    expect(store.currentPage!.assets.find((a) => a.id === id)!.fontSize).toBe(10)

    sticky.updateFontSize(id, 50) // above max
    expect(store.currentPage!.assets.find((a) => a.id === id)!.fontSize).toBe(32)

    sticky.updateFontSize(id, 20) // valid
    expect(store.currentPage!.assets.find((a) => a.id === id)!.fontSize).toBe(20)
  })

  it('updateDimensions clamps to 50-800', () => {
    const id = sticky.createSticky(100, 200)
    store.undoStack = []

    sticky.updateDimensions(id, 30, 900)
    const asset = store.currentPage!.assets.find((a) => a.id === id)
    expect(asset!.w).toBe(50)
    expect(asset!.h).toBe(800)
  })

  it('undo style update restores previous style', () => {
    const id = sticky.createSticky(100, 200)
    store.undoStack = []

    sticky.updateColor(id, '#f9a8d4') // pink
    expect(store.currentPage!.assets.find((a) => a.id === id)!.bgColor).toBe('#f9a8d4')

    store.undo()
    expect(store.currentPage!.assets.find((a) => a.id === id)!.bgColor).toBe(STICKY_DEFAULTS.bgColor)
  })
})

// ─── Tests: currentPageStickies ──────────────────────────────────────────────

describe('useStickyNotes — currentPageStickies', () => {
  let store: ReturnType<typeof useWBStore>
  let sticky: ReturnType<typeof useStickyNotes>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    sticky = useStickyNotes(store)
  })

  it('filters only sticky assets from current page', () => {
    sticky.createSticky(100, 200)
    sticky.createSticky(300, 400)
    // Add a regular image asset
    store.addAsset({
      id: 'img-1', type: 'image', src: 'test.png',
      x: 0, y: 0, w: 100, h: 100, rotation: 0,
    })

    expect(sticky.currentPageStickies.value).toHaveLength(2)
    expect(sticky.currentPageStickies.value.every((s) => s.type === 'sticky')).toBe(true)
  })

  it('returns empty when no stickies on page', () => {
    expect(sticky.currentPageStickies.value).toHaveLength(0)
  })
})

// ─── Tests: locked sticky ────────────────────────────────────────────────────

describe('useStickyNotes — locked sticky', () => {
  let store: ReturnType<typeof useWBStore>
  let sticky: ReturnType<typeof useStickyNotes>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    sticky = useStickyNotes(store)
  })

  it('locked sticky position update is no-op', () => {
    store.addStickyNote(makeSticky('s1', { locked: true, lockedBy: 'user-1', x: 100, y: 200 }))
    store.undoStack = []

    sticky.updatePosition('s1', 500, 600)
    const asset = store.currentPage!.assets.find((a) => a.id === 's1')
    expect(asset!.x).toBe(100)
    expect(asset!.y).toBe(200)
  })

  it('locked sticky style update is no-op', () => {
    store.addStickyNote(makeSticky('s1', { locked: true, lockedBy: 'user-1', bgColor: '#fde047' }))
    store.undoStack = []

    store.updateStickyStyle('s1', { bgColor: '#86efac' })
    const asset = store.currentPage!.assets.find((a) => a.id === 's1')
    expect(asset!.bgColor).toBe('#fde047')
    expect(store.undoStack).toHaveLength(0)
  })
})

// ─── Tests: position update ──────────────────────────────────────────────────

describe('useStickyNotes — updatePosition', () => {
  let store: ReturnType<typeof useWBStore>
  let sticky: ReturnType<typeof useStickyNotes>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    sticky = useStickyNotes(store)
  })

  it('updates position of sticky', () => {
    const id = sticky.createSticky(100, 200)
    store.undoStack = []

    sticky.updatePosition(id, 500, 600)
    const asset = store.currentPage!.assets.find((a) => a.id === id)
    expect(asset!.x).toBe(500)
    expect(asset!.y).toBe(600)
  })
})

// ─── Tests: WS handlers ─────────────────────────────────────────────────────

describe('boardStore — remote sticky handlers', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    store.addStickyNote(makeSticky('s1', { text: 'original', bgColor: '#fde047' }))
    store.undoStack = []
  })

  it('handleRemoteStickyTextUpdate updates text', () => {
    const pageId = store.pages[0].id
    store.handleRemoteStickyTextUpdate({ pageId, assetId: 's1', text: 'remote text' })
    expect(store.currentPage!.assets.find((a) => a.id === 's1')!.text).toBe('remote text')
  })

  it('handleRemoteStickyStyleUpdate updates bgColor', () => {
    const pageId = store.pages[0].id
    store.handleRemoteStickyStyleUpdate({ pageId, assetId: 's1', bgColor: '#86efac' })
    expect(store.currentPage!.assets.find((a) => a.id === 's1')!.bgColor).toBe('#86efac')
  })

  it('handleRemoteStickyTextUpdate with unknown page is no-op', () => {
    store.handleRemoteStickyTextUpdate({ pageId: 'unknown', assetId: 's1', text: 'nope' })
    expect(store.currentPage!.assets.find((a) => a.id === 's1')!.text).toBe('original')
  })
})
