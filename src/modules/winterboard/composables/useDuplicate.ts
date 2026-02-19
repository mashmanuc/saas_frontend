// WB5: Duplicate composable — Ctrl+D to duplicate selected items
// Ref: TASK_BOARD_V5.md A5

import { computed } from 'vue'
import type { useWBStore } from '../board/state/boardStore'

// ─── Types ───────────────────────────────────────────────────────────────────

type WBStore = ReturnType<typeof useWBStore>

// ─── Composable ──────────────────────────────────────────────────────────────

export function useDuplicate(store: WBStore) {
  /**
   * Duplicate all selected strokes and assets.
   * Delegates to store.duplicateSelected() which handles:
   * - Deep clone with new IDs
   * - +20px offset
   * - Unlock clones
   * - Select new items
   * - Push undo action
   */
  function duplicateSelected(): string[] {
    return store.duplicateSelected()
  }

  /**
   * Can duplicate: at least 1 item selected.
   * Locked items CAN be duplicated — the clone will be unlocked.
   */
  const canDuplicate = computed(() => store.selectedIds.length > 0)

  return {
    duplicateSelected,
    canDuplicate,
  }
}
