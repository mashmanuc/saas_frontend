/**
 * Phase 33: Asset Move composable
 *
 * Handles optimistic move, undo, and error recovery.
 * Uses updateAsset() from library.ts — 0 backend changes (INV-1).
 */
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { updateAsset } from '../api/library'
import { useToast } from './useToast'
import type { LibraryAsset, LibraryFolderTree } from '../types/library'

// ─── Context interface ───────────────────────────────────────────────────────

export interface MoveContext {
  /** Reactive assets array to optimistically filter */
  assets: Ref<LibraryAsset[]>
  /** Total count ref to decrement (optional — WBLibrary has it, MaterialsBrowser doesn't) */
  total?: Ref<number>
  /** Callback to reload folder tree (for counts) */
  reloadFolders: () => void
  /** Folder tree ref for name lookup */
  folders: Ref<LibraryFolderTree[]>
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useAssetMove(ctx: MoveContext) {
  const { t } = useI18n()
  const { showToast } = useToast()

  /**
   * Move asset to a different folder.
   * Optimistic: removes from list instantly, then async API + folder reload.
   */
  async function moveAsset(asset: LibraryAsset, newFolderId: number | null): Promise<void> {
    // INV-7: noop if same folder
    if (asset.folder === newFolderId) return

    const previousIndex = ctx.assets.value.findIndex(a => a.id === asset.id)

    // 1. Optimistic remove from current list
    ctx.assets.value = ctx.assets.value.filter(a => a.id !== asset.id)
    if (ctx.total) ctx.total.value = Math.max(0, ctx.total.value - 1)

    // 2. Async API call
    try {
      await updateAsset(asset.id, { folder: newFolderId })
    } catch (err) {
      console.error('[WB:Library] Move asset failed', err)
      // Rollback: re-insert at original position
      if (previousIndex >= 0) {
        ctx.assets.value.splice(previousIndex, 0, asset)
      } else {
        ctx.assets.value.unshift(asset)
      }
      if (ctx.total) ctx.total.value += 1
      showToast(t('winterboard.library.moveError'), 'error')
      return
    }

    // 3. Async folder counts update (fire-and-forget)
    ctx.reloadFolders()

    // 4. Toast with folder name
    const folderName = findFolderName(ctx.folders.value, newFolderId)
    showToast(
      newFolderId === null
        ? t('winterboard.library.fileMoved')
        : t('winterboard.library.fileMovedTo', { folder: folderName }),
      'success',
    )
  }

  return { moveAsset }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Find folder name by ID in recursive tree.
 */
export function findFolderName(folders: LibraryFolderTree[], id: number | null): string {
  if (id === null) return 'root'
  for (const f of folders) {
    if (f.id === id) return f.name
    if (f.children?.length) {
      const found = findFolderName(f.children, id)
      if (found !== 'root') return found
    }
  }
  return 'root'
}
