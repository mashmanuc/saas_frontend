/**
 * Phase 32: Materials Browser composable
 *
 * Manages folder tree + assets state for the board sidebar "Materials" tab (browse mode).
 * Reuses existing library API without modification (INV-1).
 *
 * Folder routing:
 *   selectedFolderId === null  → fetchAssets() (no folder param = all files)
 *   selectedFolderId === -1    → fetchAssets({ favorite: true })
 *   selectedFolderId === -2    → fetchRecentAssets()
 *   selectedFolderId > 0       → fetchAssets({ folder: id })
 */
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  fetchFoldersTree,
  fetchAssets,
  fetchRecentAssets,
} from '../api/library'
import { FAVORITES_ID, RECENT_ID } from '../components/library/LibraryFolderTree.vue'
import { useAssetMove } from './useAssetMove'
import type { LibraryFolderTree as LibraryFolderTreeType, LibraryAsset, LibraryAssetsQuery } from '../types/library'

// ─── SidebarAsset: shape expected by WBAssetItem.vue ─────────────────────────

export interface SidebarAsset {
  id: string
  filename: string
  cdn_url: string
  thumbnail_url?: string
}

function toSidebarAsset(a: LibraryAsset): SidebarAsset {
  return {
    id: String(a.id),
    filename: a.name,
    cdn_url: a.cdn_url,
    thumbnail_url: a.thumbnail_url || undefined,
  }
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useMaterialsBrowser() {
  const { t } = useI18n()
  const folders = ref<LibraryFolderTreeType[]>([])
  const rawAssets = ref<LibraryAsset[]>([])
  const selectedFolderId = ref<number | null>(null)
  const isLoadingFolders = ref(false)
  const isLoadingAssets = ref(false)
  const isFoldersPanelOpen = ref(true)
  const error = ref<string | null>(null)

  // Mapped assets for WBAssetItem consumption
  const assets = computed<SidebarAsset[]>(() => rawAssets.value.map(toSidebarAsset))

  // ─── Load folders ──────────────────────────────────────────────────────────

  async function loadFolders(): Promise<void> {
    isLoadingFolders.value = true
    try {
      folders.value = await fetchFoldersTree()
    } catch (err) {
      console.error('[WB:MaterialsBrowser] Failed to load folders', err)
    } finally {
      isLoadingFolders.value = false
    }
  }

  // ─── Load assets (folder-routed) ──────────────────────────────────────────

  async function loadAssets(): Promise<void> {
    isLoadingAssets.value = true
    error.value = null
    try {
      const folderId = selectedFolderId.value

      if (folderId === RECENT_ID) {
        // Virtual "Recent" folder → dedicated endpoint
        const recent = await fetchRecentAssets()
        rawAssets.value = recent
      } else {
        // Build query based on folder type
        const query: LibraryAssetsQuery = { limit: 50 }

        if (folderId === FAVORITES_ID) {
          // Virtual "Favorites" folder → favorite filter
          query.favorite = true
        } else if (folderId !== null && folderId > 0) {
          // Real folder
          query.folder = folderId
        }
        // folderId === null → no folder param → all files

        const res = await fetchAssets(query)
        rawAssets.value = res.results
      }
    } catch (err) {
      console.error('[WB:MaterialsBrowser] Failed to load assets', err)
      error.value = 'load_failed'
      rawAssets.value = []
    } finally {
      isLoadingAssets.value = false
    }
  }

  // ─── Actions ───────────────────────────────────────────────────────────────

  function selectFolder(id: number | null): void {
    selectedFolderId.value = id
  }

  function toggleFoldersPanel(): void {
    isFoldersPanelOpen.value = !isFoldersPanelOpen.value
  }

  // Auto-reload assets when folder changes
  watch(selectedFolderId, () => loadAssets())

  // ─── Phase 33: Breadcrumb ──────────────────────────────────────────────────

  const breadcrumb = computed(() =>
    buildBreadcrumb(folders.value, selectedFolderId.value, t('winterboard.library.allFiles')),
  )

  // ─── Phase 33: Move integration ───────────────────────────────────────────

  const { moveAsset } = useAssetMove({
    assets: rawAssets,
    reloadFolders: loadFolders,
    folders,
  })

  return {
    // State
    folders,
    assets,
    rawAssets,
    selectedFolderId,
    isLoadingFolders,
    isLoadingAssets,
    isFoldersPanelOpen,
    error,
    breadcrumb,
    // Actions
    loadFolders,
    loadAssets,
    selectFolder,
    toggleFoldersPanel,
    moveAsset,
    // Re-export for convenience
    FAVORITES_ID,
    RECENT_ID,
  }
}

// ─── Breadcrumb Builder ────────────────────────────────────────────────────

export interface BreadcrumbItem {
  id: number | null
  name: string
}

/**
 * Build breadcrumb chain from root to selected folder.
 * Returns array: [{ id: null, name: "All" }, { id: 10, name: "Math" }, { id: 42, name: "Algebra" }]
 */
export function buildBreadcrumb(
  folders: LibraryFolderTreeType[],
  selectedId: number | null,
  allFilesLabel: string = 'All files',
): BreadcrumbItem[] {
  const root: BreadcrumbItem = { id: null, name: allFilesLabel }

  if (selectedId === null || selectedId < 0) {
    // Root or virtual folder → just root
    return [root]
  }

  // Find path from root to selected folder
  const path: BreadcrumbItem[] = [root]

  function findPath(nodes: LibraryFolderTreeType[]): boolean {
    for (const node of nodes) {
      path.push({ id: node.id, name: node.name })
      if (node.id === selectedId) return true
      if (node.children?.length && findPath(node.children)) return true
      path.pop()
    }
    return false
  }

  findPath(folders)
  return path
}
