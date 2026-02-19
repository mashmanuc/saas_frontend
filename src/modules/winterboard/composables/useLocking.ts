// WB5: Lock/Unlock composable — prevent modification of locked items
// Ref: TASK_BOARD_V5.md A3

import { computed } from 'vue'
import type { useWBStore } from '../board/state/boardStore'

type WBStore = ReturnType<typeof useWBStore>

export function useLocking(store: WBStore) {
  /**
   * Lock selected items.
   * - Skips already locked items
   * - Clears selection after lock (locked items can't be selected for editing)
   * - Pushes undo action
   */
  function lockSelected(lockedBy = 'local'): void {
    const ids = store.selectedIds
    if (ids.length === 0) return
    store.lockItems([...ids], lockedBy)
  }

  /**
   * Unlock specific items.
   * - Pushes undo action
   */
  function unlockItems(itemIds: string[]): void {
    if (itemIds.length === 0) return
    store.unlockItems(itemIds)
  }

  /**
   * Unlock all locked items that are currently selected.
   * Since locked items are deselected on lock, this is used
   * when user explicitly selects locked items for unlock (e.g. via shortcut).
   */
  function unlockSelected(): void {
    const ids = store.selectedIds
    if (ids.length === 0) return
    const lockedIds = ids.filter((id) => store.isItemLocked(id))
    if (lockedIds.length === 0) return
    store.unlockItems(lockedIds)
  }

  /**
   * Check if item is locked.
   */
  function isLocked(itemId: string): boolean {
    return store.isItemLocked(itemId)
  }

  /**
   * Check if current user can modify this item.
   * Returns true if: item not locked, OR locked by current user.
   */
  function canModify(itemId: string, currentUserId = 'local'): boolean {
    const page = store.currentPage
    if (!page) return true

    const stroke = page.strokes.find((s) => s.id === itemId)
    if (stroke) {
      if (!stroke.locked) return true
      return stroke.lockedBy === currentUserId
    }

    const asset = page.assets.find((a) => a.id === itemId)
    if (asset) {
      if (!asset.locked) return true
      return asset.lockedBy === currentUserId
    }

    return true
  }

  /**
   * Get all locked item IDs on current page.
   */
  const lockedIds = computed((): string[] => {
    const page = store.currentPage
    if (!page) return []
    const ids: string[] = []
    for (const s of page.strokes) {
      if (s.locked) ids.push(s.id)
    }
    for (const a of page.assets) {
      if (a.locked) ids.push(a.id)
    }
    return ids
  })

  /**
   * Whether any selected item can be locked (at least one unlocked item selected).
   */
  const canLock = computed((): boolean => {
    const ids = store.selectedIds
    if (ids.length === 0) return false
    return ids.some((id) => !store.isItemLocked(id))
  })

  /**
   * Whether any selected item can be unlocked (at least one locked item selected).
   */
  const canUnlock = computed((): boolean => {
    const ids = store.selectedIds
    if (ids.length === 0) return false
    return ids.some((id) => store.isItemLocked(id))
  })

  return {
    lockSelected,
    unlockItems,
    unlockSelected,
    isLocked,
    canModify,
    lockedIds,
    canLock,
    canUnlock,
  }
}
