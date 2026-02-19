// WB5: Group/Ungroup composable — flat grouping of strokes/assets
// Ref: TASK_BOARD_V5.md A2

import { computed } from 'vue'
import type { WBGroup } from '../types/winterboard'
import type { useWBStore } from '../board/state/boardStore'

type WBStore = ReturnType<typeof useWBStore>

export function useGrouping(store: WBStore) {
  const currentGroups = computed(() => store.currentPage?.groups ?? [])

  /**
   * Group selected items.
   * - selectedIds.length >= 2
   * - Items NOT already in another group (no nested groups)
   * - Creates WBGroup { id, itemIds, createdBy }
   * - Pushes undo action
   * - Returns group or null if invalid
   */
  function groupSelected(): WBGroup | null {
    const ids = store.selectedIds
    if (ids.length < 2) return null

    const result = store.createGroup(ids)
    return result
  }

  /**
   * Ungroup: find groups containing any selectedId, remove those groups.
   * After ungroup, items remain selected.
   */
  function ungroupSelected(): void {
    const ids = new Set(store.selectedIds)
    if (ids.size === 0) return

    const groups = currentGroups.value
    const groupsToRemove = groups.filter((g) =>
      g.itemIds.some((itemId) => ids.has(itemId)),
    )

    for (const g of groupsToRemove) {
      store.deleteGroup(g.id)
    }
    // Items remain selected — no clearSelection
  }

  /**
   * Get group containing this item (or null).
   */
  function getGroupForItem(itemId: string): WBGroup | null {
    return currentGroups.value.find((g) => g.itemIds.includes(itemId)) ?? null
  }

  /**
   * Select all items in a group.
   * Used when user clicks on one item that's in a group → select whole group.
   */
  function selectGroup(groupId: string): void {
    const group = currentGroups.value.find((g) => g.id === groupId)
    if (!group) return
    store.selectItems(group.itemIds)
  }

  function isItemInGroup(itemId: string): boolean {
    return currentGroups.value.some((g) => g.itemIds.includes(itemId))
  }

  function getGroupItems(groupId: string): string[] {
    const group = currentGroups.value.find((g) => g.id === groupId)
    return group ? [...group.itemIds] : []
  }

  /**
   * Check if all selected items can be grouped
   * (>= 2 items, none already in a group).
   */
  const canGroup = computed(() => {
    const ids = store.selectedIds
    if (ids.length < 2) return false
    const groups = currentGroups.value
    return !ids.some((id) => groups.some((g) => g.itemIds.includes(id)))
  })

  /**
   * Check if any selected item is in a group (can ungroup).
   */
  const canUngroup = computed(() => {
    const ids = new Set(store.selectedIds)
    if (ids.size === 0) return false
    return currentGroups.value.some((g) =>
      g.itemIds.some((itemId) => ids.has(itemId)),
    )
  })

  return {
    currentGroups,
    canGroup,
    canUngroup,
    groupSelected,
    ungroupSelected,
    getGroupForItem,
    selectGroup,
    isItemInGroup,
    getGroupItems,
  }
}
