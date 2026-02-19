// WB5: Page management composable — reorder, add, delete pages
// Ref: TASK_BOARD_V5.md A7

import { computed } from 'vue'
import type { useWBStore } from '../board/state/boardStore'

// ─── Types ───────────────────────────────────────────────────────────────────

type WBStore = ReturnType<typeof useWBStore>

// ─── Composable ──────────────────────────────────────────────────────────────

export function usePageManagement(store: WBStore) {
  /**
   * Reorder pages by moving page from one index to another.
   * Delegates to store.reorderPages() which handles validation,
   * currentPageIndex update, undo/redo, and markDirty.
   */
  function reorderPages(fromIndex: number, toIndex: number): void {
    store.reorderPages(fromIndex, toIndex)
  }

  /**
   * Add a new empty page at the end with undo support.
   * Returns the new page ID (empty string if max pages reached).
   */
  function addPage(): string {
    return store.addPageUndoable()
  }

  /**
   * Delete a page by index with undo support.
   * Cannot delete last remaining page.
   * Returns true if page was deleted.
   */
  function deletePage(index: number): boolean {
    return store.deletePageUndoable(index)
  }

  const pageCount = computed(() => store.pages.length)
  const canDeletePage = computed(() => store.pages.length > 1)

  return {
    reorderPages,
    addPage,
    deletePage,
    pageCount,
    canDeletePage,
  }
}
