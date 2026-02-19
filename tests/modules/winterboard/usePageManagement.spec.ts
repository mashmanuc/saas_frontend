// WB5: Unit tests for usePageManagement composable + boardStore page actions
// Ref: TASK_BOARD_V5.md A7

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useWBStore } from '@/modules/winterboard/board/state/boardStore'
import { usePageManagement } from '@/modules/winterboard/composables/usePageManagement'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePageManagement composable', () => {
  let store: ReturnType<typeof useWBStore>
  let pm: ReturnType<typeof usePageManagement>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    pm = usePageManagement(store)
  })

  it('pageCount reflects store pages length', () => {
    expect(pm.pageCount.value).toBe(1) // default 1 page
    store.addPageUndoable()
    expect(pm.pageCount.value).toBe(2)
  })

  it('canDeletePage is false with 1 page, true with 2+', () => {
    expect(pm.canDeletePage.value).toBe(false)
    store.addPageUndoable()
    expect(pm.canDeletePage.value).toBe(true)
  })
})

describe('boardStore.reorderPages', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    // Create 3 pages
    store.addPageUndoable({ name: 'Page 2' })
    store.addPageUndoable({ name: 'Page 3' })
    store.undoStack = []
  })

  it('reorderPages(0, 2) moves page from index 0 to 2', () => {
    const ids = store.pages.map((p) => p.id)
    store.reorderPages(0, 2)
    expect(store.pages[0].id).toBe(ids[1])
    expect(store.pages[1].id).toBe(ids[2])
    expect(store.pages[2].id).toBe(ids[0])
  })

  it('reorderPages same index → no-op', () => {
    const ids = store.pages.map((p) => p.id)
    store.reorderPages(1, 1)
    expect(store.pages.map((p) => p.id)).toEqual(ids)
    expect(store.undoStack).toHaveLength(0)
  })

  it('reorderPages out of bounds → no-op', () => {
    const ids = store.pages.map((p) => p.id)
    store.reorderPages(-1, 2)
    expect(store.pages.map((p) => p.id)).toEqual(ids)
    store.reorderPages(0, 5)
    expect(store.pages.map((p) => p.id)).toEqual(ids)
    expect(store.undoStack).toHaveLength(0)
  })

  it('reorderPages updates currentPageIndex correctly (active page follows)', () => {
    // Currently on page 2 (index 2, last page)
    expect(store.currentPageIndex).toBe(2)
    const activePageId = store.pages[2].id

    // Move page 0 to index 2 — active page shifts
    store.reorderPages(0, 2)

    // Active page should still be the same page
    expect(store.pages[store.currentPageIndex].id).toBe(activePageId)
  })

  it('reorderPages when current page is between from/to → index adjusted', () => {
    // Go to page 1
    store.goToPage(1)
    const activePageId = store.pages[1].id

    // Move page 0 to index 2 — page at index 1 shifts to index 0
    store.reorderPages(0, 2)

    // Active page should still be the same page
    expect(store.pages[store.currentPageIndex].id).toBe(activePageId)
  })

  it('undo pageReorder → previous order restored', () => {
    const originalIds = store.pages.map((p) => p.id)
    store.reorderPages(0, 2)
    expect(store.pages.map((p) => p.id)).not.toEqual(originalIds)

    store.undo()
    expect(store.pages.map((p) => p.id)).toEqual(originalIds)
  })

  it('redo pageReorder → new order applied', () => {
    store.reorderPages(0, 2)
    const reorderedIds = store.pages.map((p) => p.id)

    store.undo()
    store.redo()
    expect(store.pages.map((p) => p.id)).toEqual(reorderedIds)
  })
})

describe('boardStore.addPageUndoable', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    store.undoStack = []
  })

  it('addPageUndoable → new page added at end', () => {
    expect(store.pages).toHaveLength(1)
    const id = store.addPageUndoable()
    expect(store.pages).toHaveLength(2)
    expect(store.pages[1].id).toBe(id)
    expect(store.currentPageIndex).toBe(1) // navigated to new page
  })

  it('addPageUndoable → returns empty string at max 200 pages', () => {
    // Simulate 200 pages
    for (let i = 0; i < 199; i++) {
      store.pages.push({ id: `p-${i}`, name: `P${i}`, strokes: [], assets: [], background: 'white' })
    }
    expect(store.pages).toHaveLength(200)
    const id = store.addPageUndoable()
    expect(id).toBe('')
    expect(store.pages).toHaveLength(200)
  })

  it('undo addPage → page removed', () => {
    const id = store.addPageUndoable()
    expect(store.pages).toHaveLength(2)

    store.undo()
    expect(store.pages).toHaveLength(1)
    expect(store.pages.find((p) => p.id === id)).toBeUndefined()
  })

  it('redo addPage → page re-added', () => {
    const id = store.addPageUndoable()
    store.undo()
    expect(store.pages).toHaveLength(1)

    store.redo()
    expect(store.pages).toHaveLength(2)
    expect(store.pages[1].id).toBe(id)
  })
})

describe('boardStore.deletePageUndoable', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    store.addPageUndoable({ name: 'Page 2' })
    store.addPageUndoable({ name: 'Page 3' })
    store.undoStack = []
  })

  it('deletePage → page removed, currentPageIndex adjusted', () => {
    store.goToPage(2)
    const deletedId = store.pages[1].id
    store.deletePageUndoable(1)
    expect(store.pages).toHaveLength(2)
    expect(store.pages.find((p) => p.id === deletedId)).toBeUndefined()
    // Was on page 2, page 1 deleted → now on page 1
    expect(store.currentPageIndex).toBe(1)
  })

  it('deletePage last page → no-op (canDeletePage=false)', () => {
    // Delete until 1 page left
    store.deletePageUndoable(2)
    store.deletePageUndoable(1)
    expect(store.pages).toHaveLength(1)

    const result = store.deletePageUndoable(0)
    expect(result).toBe(false)
    expect(store.pages).toHaveLength(1)
  })

  it('deletePage out of bounds → no-op', () => {
    const result = store.deletePageUndoable(5)
    expect(result).toBe(false)
    expect(store.pages).toHaveLength(3)
  })

  it('undo deletePage → page restored at original index', () => {
    const deletedPage = store.pages[1]
    const deletedId = deletedPage.id
    store.deletePageUndoable(1)
    expect(store.pages).toHaveLength(2)

    store.undo()
    expect(store.pages).toHaveLength(3)
    expect(store.pages[1].id).toBe(deletedId)
  })

  it('redo deletePage → page removed again', () => {
    const deletedId = store.pages[1].id
    store.deletePageUndoable(1)
    store.undo()
    expect(store.pages).toHaveLength(3)

    store.redo()
    expect(store.pages).toHaveLength(2)
    expect(store.pages.find((p) => p.id === deletedId)).toBeUndefined()
  })

  it('deletePage adjusts currentPageIndex when deleting before current', () => {
    store.goToPage(2)
    expect(store.currentPageIndex).toBe(2)

    store.deletePageUndoable(0)
    expect(store.currentPageIndex).toBe(1) // shifted down
  })

  it('deletePage adjusts currentPageIndex when deleting last page while on it', () => {
    store.goToPage(2)
    store.deletePageUndoable(2)
    expect(store.currentPageIndex).toBe(1) // clamped to last
  })
})

describe('boardStore.handleRemotePageReorder', () => {
  let store: ReturnType<typeof useWBStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useWBStore()
    store.addPageUndoable({ name: 'Page 2' })
    store.addPageUndoable({ name: 'Page 3' })
    store.undoStack = []
  })

  it('reorders local pages to match remote order', () => {
    const ids = store.pages.map((p) => p.id)
    store.goToPage(0)
    const activeId = store.pages[0].id

    store.handleRemotePageReorder([ids[2], ids[0], ids[1]])
    expect(store.pages[0].id).toBe(ids[2])
    expect(store.pages[1].id).toBe(ids[0])
    expect(store.pages[2].id).toBe(ids[1])

    // Active page follows
    expect(store.pages[store.currentPageIndex].id).toBe(activeId)
  })
})
