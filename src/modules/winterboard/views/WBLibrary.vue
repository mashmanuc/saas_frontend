<!-- WB: Library view — folder tree + asset grid + pagination
     Ref: TASK_BOARD.md B15
     API: /v1/winterboard/library/*
     Note: GET /library/assets/ → {count, results} — НЕ plain array
           toggleFavorite = PATCH /assets/{id}/ — НЕ toggle_favorite endpoint
           LibraryFolder.parent (not parent_id), LibraryFolder.assets_count (not asset_count)
           LibraryAsset.folder (not folder_id) -->
<template>
  <div class="wb-library">
    <!-- Sidebar: folder tree -->
    <aside class="wb-library__sidebar">
      <LibraryFolderTree
        :folders="foldersTree"
        :selected-id="selectedFolderId"
        :loading="loadingFolders"
        editable
        @select="onSelectFolder"
        @create="handleCreateFolder"
        @rename="handleRenameFolder"
        @delete="handleDeleteFolder"
        @drop="handleFolderDrop"
      />
    </aside>

    <!-- Main content -->
    <main class="wb-library__main">
      <!-- Toolbar -->
      <div class="wb-library__toolbar">
        <input
          v-model="searchQuery"
          type="search"
          class="wb-library__search"
          :placeholder="t('winterboard.library.search')"
          :aria-label="t('winterboard.library.search')"
        />

        <div class="wb-library__toolbar-actions">
          <!-- Filter: favorites -->
          <button
            type="button"
            class="wb-library__filter-btn"
            :class="{ 'wb-library__filter-btn--active': filterFavorites }"
            :aria-pressed="filterFavorites"
            :title="t('winterboard.library.favorites')"
            @click="toggleFavoritesFilter"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
              <path
                d="M7.5 1.5l1.8 3.66L13.5 5.7l-3 2.92.71 4.13L7.5 10.75l-3.71 1.97.71-4.13L1.5 5.7l4.2-.54L7.5 1.5z"
                :fill="filterFavorites ? '#f59e0b' : 'none'"
                stroke="#f59e0b"
                stroke-width="1.2"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          <!-- YouTube URL button -->
          <button
            v-if="!showYtInput"
            type="button"
            class="wb-library__yt-btn"
            @click="showYtInput = true"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <rect x="2" y="4" width="16" height="12" rx="3" fill="#FF0000"/>
              <path d="M8.5 7.5l5 2.5-5 2.5V7.5z" fill="#fff"/>
            </svg>
            + YouTube
          </button>
          <div v-else class="wb-library__yt-row">
            <input
              ref="ytInputRef"
              v-model="ytUrl"
              type="url"
              class="wb-library__yt-input"
              placeholder="https://youtube.com/watch?v=..."
              @keydown.enter="submitYouTube"
              @keydown.escape="showYtInput = false"
            />
            <button
              type="button"
              class="wb-library__yt-submit"
              :disabled="!ytUrl.trim()"
              @click="submitYouTube"
            >
              +
            </button>
          </div>

          <!-- Upload button -->
          <button
            type="button"
            class="wb-library__upload-btn"
            @click="showUpload = true"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v8M4 4l3-3 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M1.5 9.5v1.5A1.5 1.5 0 003 12.5h8a1.5 1.5 0 001.5-1.5V9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            {{ t('winterboard.library.upload') }}
          </button>

          <!-- View mode toggle -->
          <div class="wb-library__view-toggle" role="radiogroup" :aria-label="t('winterboard.library.viewMode')">
            <button
              type="button"
              class="wb-library__view-btn"
              :class="{ 'wb-library__view-btn--active': viewMode === 'grid' }"
              :aria-pressed="viewMode === 'grid'"
              :title="t('winterboard.library.gridView')"
              @click="viewMode = 'grid'"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
                <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
                <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
                <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
              </svg>
            </button>
            <button
              type="button"
              class="wb-library__view-btn"
              :class="{ 'wb-library__view-btn--active': viewMode === 'list' }"
              :aria-pressed="viewMode === 'list'"
              :title="t('winterboard.library.listView')"
              @click="viewMode = 'list'"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 3h12M1 7h12M1 11h12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Breadcrumb (Phase 33 B6) -->
      <LibraryBreadcrumb
        :items="breadcrumb"
        @navigate="onSelectFolder"
      />

      <!-- Loading -->
      <div v-if="loading" class="wb-library__grid" aria-busy="true">
        <div
          v-for="i in 12"
          :key="i"
          class="library-asset-card library-asset-card--skeleton"
        >
          <div class="library-asset-card__preview wb-skeleton-pulse" />
          <div class="library-asset-card__info">
            <div class="wb-skeleton-pulse wb-skeleton-line" />
            <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--short" />
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredAssets.length === 0" class="wb-library__empty">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
          <rect x="6" y="10" width="44" height="36" rx="4" stroke="#94a3b8" stroke-width="1.5"/>
          <path d="M18 24h20M18 31h14" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p class="wb-library__empty-title">{{ t('winterboard.library.noFiles') }}</p>
        <button type="button" class="wb-library__upload-cta" @click="showUpload = true">
          {{ t('winterboard.library.upload') }}
        </button>
      </div>

      <!-- Asset grid view -->
      <div
        v-else-if="viewMode === 'grid'"
        class="wb-library__grid"
        role="list"
        :aria-label="t('winterboard.library.assetsLabel')"
      >
        <LibraryAssetCard
          v-for="asset in filteredAssets"
          :key="asset.id"
          :asset="asset"
          role="listitem"
          @toggle-favorite="onToggleFavorite"
          @move="showMoveDropdown"
          @delete="onDeleteAsset"
        />
      </div>

      <!-- Asset list view -->
      <div
        v-else
        class="wb-library__list"
        role="list"
        :aria-label="t('winterboard.library.assetsLabel')"
      >
        <div
          v-for="asset in filteredAssets"
          :key="asset.id"
          class="wb-library__list-item"
          role="listitem"
        >
          <div class="wb-library__list-preview">
            <img
              v-if="asset.thumbnail_url || asset.content_type.startsWith('image/')"
              :src="asset.thumbnail_url || asset.cdn_url"
              :alt="asset.name"
              class="wb-library__list-img"
              loading="lazy"
            />
            <span v-else class="wb-library__list-icon">{{ getFileIcon(asset.content_type) }}</span>
          </div>
          <div class="wb-library__list-info">
            <span class="wb-library__list-name" :title="asset.name">{{ asset.name }}</span>
            <span class="wb-library__list-meta">{{ formatFileSize(asset.size_bytes) }}</span>
          </div>
          <div class="wb-library__list-actions">
            <button
              type="button"
              class="wb-library__list-action"
              :class="{ 'wb-library__list-action--active': asset.is_favorite }"
              :title="t('winterboard.library.favorite')"
              @click="onToggleFavorite(asset)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1.5l1.545 3.13 3.455.5-2.5 2.435.59 3.435L7 9.25l-3.09 1.75.59-3.435L2 5.13l3.455-.5L7 1.5z"
                  :fill="asset.is_favorite ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              class="wb-library__list-action wb-library__list-action--danger"
              :title="t('winterboard.library.delete')"
              @click="onDeleteAsset(asset)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3.5h10M4.5 3.5V2.5A.5.5 0 015 2h4a.5.5 0 01.5.5v1M5.5 6.5v3M8.5 6.5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                <path d="M2.5 3.5l.7 7.5a.5.5 0 00.5.5h6.6a.5.5 0 00.5-.5l.7-7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <nav
        v-if="total > LIMIT"
        class="wb-library__pagination"
        :aria-label="t('winterboard.library.pagination')"
      >
        <button
          type="button"
          class="wb-library__page-btn"
          :disabled="offset === 0"
          :aria-label="t('winterboard.library.prevPage')"
          @click="prevPage"
        >
          ←
        </button>
        <span class="wb-library__page-info">
          {{ Math.floor(offset / LIMIT) + 1 }} / {{ Math.ceil(total / LIMIT) }}
        </span>
        <button
          type="button"
          class="wb-library__page-btn"
          :disabled="offset + LIMIT >= total"
          :aria-label="t('winterboard.library.nextPage')"
          @click="nextPage"
        >
          →
        </button>
      </nav>
    </main>

    <!-- Upload modal -->
    <LibraryUploadModal
      v-if="showUpload"
      :folder-id="activeFolderId"
      :folders="foldersTree"
      @close="showUpload = false"
      @uploaded="onUploaded"
    />

    <!-- Move asset dropdown (Phase 33 B6) -->
    <MoveAssetDropdown
      v-if="moveTargetAsset"
      :asset-id="moveTargetAsset.id"
      :current-folder="moveTargetAsset.folder"
      :folders="foldersTree"
      @moved="onMoveConfirmed"
      @close="moveTargetAsset = null"
    />

    <!-- Phase 32: folder CRUD now inline in LibraryFolderTree (editable prop) -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import LibraryFolderTree, { FAVORITES_ID, RECENT_ID } from '../components/library/LibraryFolderTree.vue'
import LibraryAssetCard from '../components/library/LibraryAssetCard.vue'
import LibraryUploadModal from '../components/library/LibraryUploadModal.vue'
import LibraryBreadcrumb from '../components/library/LibraryBreadcrumb.vue'
import MoveAssetDropdown from '../components/library/MoveAssetDropdown.vue'
import {
  fetchFoldersTree,
  fetchAssets,
  fetchRecentAssets,
  toggleFavorite as apiFavorite,
  deleteAsset as apiDelete,
  createFolder as apiCreateFolder,
  updateFolder as apiUpdateFolder,
  deleteFolder as apiDeleteFolder,
  addYouTubeAsset,
} from '../api/library'
import type { LibraryFolderTree as FolderTree, LibraryAsset } from '../types/library'
import { parseYouTubeVideoId } from '../utils/youtubeParser'
import { useToast } from '../composables/useToast'
import { useAssetMove } from '../composables/useAssetMove'

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT = 24

// ─── Composables ──────────────────────────────────────────────────────────────

const { t } = useI18n()
const { showToast } = useToast()

// ─── State ────────────────────────────────────────────────────────────────────

const foldersTree = ref<FolderTree[]>([])
const loadingFolders = ref(false)
const assets = ref<LibraryAsset[]>([])
const total = ref(0)
const loading = ref(false)
const selectedFolderId = ref<number | null>(null)
const searchQuery = ref('')
const filterFavorites = ref(false)
const offset = ref(0)
const showUpload = ref(false)
const showYtInput = ref(false)
const ytUrl = ref('')
const ytInputRef = ref<HTMLInputElement | null>(null)
// Phase 32: folder CRUD now handled by LibraryFolderTree (editable prop)
const viewMode = ref<'grid' | 'list'>('grid')
// Phase 33 B6: move asset state
const moveTargetAsset = ref<LibraryAsset | null>(null)

// activeFolderId: only real folder IDs (not virtual FAVORITES/RECENT)
const activeFolderId = computed<number | null>(() => {
  if (selectedFolderId.value === FAVORITES_ID || selectedFolderId.value === RECENT_ID) return null
  return selectedFolderId.value
})

// Phase 33 B6: breadcrumb computed
const breadcrumb = computed(() => {
  if (selectedFolderId.value === null) {
    return [{ id: null, name: t('winterboard.library.breadcrumbAll') }]
  }
  if (selectedFolderId.value === FAVORITES_ID) {
    return [
      { id: null, name: t('winterboard.library.breadcrumbAll') },
      { id: FAVORITES_ID, name: t('winterboard.library.favorites') }
    ]
  }
  if (selectedFolderId.value === RECENT_ID) {
    return [
      { id: null, name: t('winterboard.library.breadcrumbAll') },
      { id: RECENT_ID, name: t('winterboard.library.recent') }
    ]
  }
  
  // Real folder: build path from root
  const path: Array<{ id: number | null; name: string }> = [
    { id: null, name: t('winterboard.library.breadcrumbAll') }
  ]
  
  function findPath(folders: FolderTree[], targetId: number): FolderTree[] | null {
    for (const folder of folders) {
      if (folder.id === targetId) return [folder]
      if (folder.children.length > 0) {
        const childPath = findPath(folder.children, targetId)
        if (childPath) return [folder, ...childPath]
      }
    }
    return null
  }
  
  const folderPath = findPath(foldersTree.value, selectedFolderId.value)
  if (folderPath) {
    folderPath.forEach(f => path.push({ id: f.id, name: f.name }))
  }
  
  return path
})

// ─── YouTube ─────────────────────────────────────────────────────────────────

watch(showYtInput, (v) => {
  if (v) nextTick(() => ytInputRef.value?.focus())
})

async function submitYouTube(): Promise<void> {
  const url = ytUrl.value.trim()
  if (!url) return
  const videoId = parseYouTubeVideoId(url)
  if (!videoId) {
    showToast(t('winterboard.library.ytInvalidUrl'), 'error')
    return
  }
  try {
    const asset = await addYouTubeAsset(url, activeFolderId.value)
    // Dedup: не додавати якщо вже є в списку (backend повертає 200 для існуючих)
    const alreadyExists = assets.value.some(a => a.id === asset.id)
    if (!alreadyExists) {
      assets.value.unshift(asset)
      total.value += 1
    }
    ytUrl.value = ''
    showYtInput.value = false
    showToast(t('winterboard.library.ytAdded'), 'success')
  } catch (err) {
    console.error('[WB:Library] YouTube add failed', err)
    showToast(t('winterboard.library.ytError'), 'error')
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function loadFolders(): Promise<void> {
  loadingFolders.value = true
  try {
    foldersTree.value = await fetchFoldersTree()
  } catch (err) {
    console.error('[WB:Library] Failed to load folders', err)
  } finally {
    loadingFolders.value = false
  }
}

async function loadAssets(): Promise<void> {
  loading.value = true
  try {
    if (selectedFolderId.value === RECENT_ID) {
      const recent = await fetchRecentAssets()
      assets.value = recent
      total.value = recent.length
    } else {
      const query: Record<string, unknown> = {
        limit: LIMIT,
        offset: offset.value,
      }
      if (selectedFolderId.value === FAVORITES_ID) {
        query.favorite = true
      } else if (activeFolderId.value !== null) {
        query.folder = activeFolderId.value
      }
      const res = await fetchAssets(query as any)
      assets.value = res.results
      total.value = res.count
    }
  } catch (err) {
    console.error('[WB:Library] Failed to load assets', err)
  } finally {
    loading.value = false
  }
}

// ─── Phase 33: Asset move ─────────────────────────────────────────────────────

const { moveAsset } = useAssetMove({
  assets,
  total,
  reloadFolders: loadFolders,
  folders: foldersTree,
})

async function handleMoveAsset(asset: LibraryAsset, newFolderId: number | null): Promise<void> {
  await moveAsset(asset, newFolderId)
}

// ─── Filter (client-side search) ─────────────────────────────────────────────

const filteredAssets = computed<LibraryAsset[]>(() => {
  let result = assets.value
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((a) => a.name.toLowerCase().includes(q))
  }
  if (filterFavorites.value) {
    result = result.filter((a) => a.is_favorite)
  }
  return result
})

// ─── CRUD actions ─────────────────────────────────────────────────────────────

function onSelectFolder(id: number | null): void {
  selectedFolderId.value = id
  offset.value = 0
  filterFavorites.value = false
  searchQuery.value = ''
}

function toggleFavoritesFilter(): void {
  filterFavorites.value = !filterFavorites.value
}

async function onToggleFavorite(asset: LibraryAsset): Promise<void> {
  try {
    const updated = await apiFavorite(asset.id, asset.is_favorite)
    const idx = assets.value.findIndex((a) => a.id === asset.id)
    if (idx !== -1) assets.value[idx] = updated
  } catch (err) {
    console.error('[WB:Library] Toggle favorite failed', err)
    showToast(t('winterboard.library.favoriteError'), 'error')
  }
}

async function onDeleteAsset(asset: LibraryAsset): Promise<void> {
  try {
    await apiDelete(asset.id)
    assets.value = assets.value.filter((a) => a.id !== asset.id)
    total.value = Math.max(0, total.value - 1)
    showToast(t('winterboard.library.deleted'), 'success')
  } catch (err) {
    console.error('[WB:Library] Delete asset failed', err)
    showToast(t('winterboard.library.deleteError'), 'error')
  }
}

function onUploaded(asset: LibraryAsset): void {
  assets.value.unshift(asset)
  total.value += 1
  showUpload.value = false
}

async function handleCreateFolder(name: string, parentId: number | null): Promise<void> {
  try {
    await apiCreateFolder({ name, parent: parentId })
    await loadFolders()
    showToast(t('winterboard.library.folderCreated'), 'success')
  } catch (err) {
    console.error('[WB:Library] Create folder failed', err)
    showToast(t('winterboard.library.folderError'), 'error')
  }
}

async function handleRenameFolder(id: number, newName: string): Promise<void> {
  try {
    await apiUpdateFolder(id, { name: newName })
    await loadFolders()
    showToast(t('winterboard.library.folderRenamed'), 'success')
  } catch (err) {
    console.error('[WB:Library] Rename folder failed', err)
    showToast(t('winterboard.library.folderError'), 'error')
  }
}

async function handleDeleteFolder(id: number, name: string): Promise<void> {
  if (!confirm(t('winterboard.library.deleteFolderConfirm', { name }))) return
  try {
    await apiDeleteFolder(id)
    await loadFolders()
    if (selectedFolderId.value === id) {
      selectedFolderId.value = null
    }
    await loadAssets()
    showToast(t('winterboard.library.folderDeleted'), 'success')
  } catch (err) {
    console.error('[WB:Library] Delete folder failed', err)
    showToast(t('winterboard.library.folderError'), 'error')
  }
}

// ─── List view helpers ────────────────────────────────────────────────────────

function getFileIcon(contentType: string): string {
  if (contentType.startsWith('image/')) return '🖼'
  if (contentType === 'application/pdf') return '📄'
  if (contentType.startsWith('video/')) return '🎬'
  if (contentType.startsWith('audio/')) return '🎵'
  return '📁'
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Move asset (Phase 33 B6) ────────────────────────────────────────────────

function showMoveDropdown(asset: LibraryAsset): void {
  moveTargetAsset.value = asset
}

function onMoveConfirmed(assetId: number, newFolderId: number | null): void {
  const asset = assets.value.find(a => a.id === assetId)
  if (asset) {
    moveAsset(asset, newFolderId)
  }
  moveTargetAsset.value = null
}

function handleFolderDrop(data: { assetId: number; folderId: number | null }): void {
  const asset = assets.value.find(a => a.id === data.assetId)
  if (asset) {
    moveAsset(asset, data.folderId)
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function prevPage(): void {
  offset.value = Math.max(0, offset.value - LIMIT)
  loadAssets()
}

function nextPage(): void {
  offset.value += LIMIT
  loadAssets()
}

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(selectedFolderId, () => {
  offset.value = 0
  loadAssets()
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadFolders(), loadAssets()])
})
</script>

<style scoped>
.wb-library {
  display: flex;
  min-height: 600px;
  height: calc(100vh - 140px);
  overflow: hidden;
  background: var(--wb-card-bg, #ffffff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 12px;
}

/* ── Sidebar ─────────────────────────────────────────────────────────── */

.wb-library__sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--wb-toolbar-border, #e2e8f0);
  background: var(--wb-card-bg, #ffffff);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.wb-library__sidebar-footer {
  padding: 8px;
  border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
  margin-top: auto;
}

.wb-library__new-folder-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 7px 10px;
  background: none;
  border: 1px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 12px;
  color: var(--wb-fg-secondary, #64748b);
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}

.wb-library__new-folder-btn:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  border-color: var(--wb-brand, #0066ff);
  color: var(--wb-brand, #0066ff);
}

/* ── Main ────────────────────────────────────────────────────────────── */

.wb-library__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Toolbar ─────────────────────────────────────────────────────────── */

.wb-library__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--wb-toolbar-border, #e2e8f0);
  background: var(--wb-card-bg, #ffffff);
  flex-shrink: 0;
}

.wb-library__search {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  font-size: 14px;
  color: var(--wb-fg, #0f172a);
  background: var(--wb-canvas-bg, #f8fafc);
  outline: none;
  transition: border-color 0.15s;
  min-width: 0;
}

.wb-library__search:focus {
  border-color: var(--wb-brand, #0066ff);
  background: var(--wb-card-bg, #ffffff);
}

.wb-library__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── View toggle ────────────────────────────────────────────────────── */

.wb-library__view-toggle {
  display: flex;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 8px;
  overflow: hidden;
}

.wb-library__view-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--wb-fg-secondary, #94a3b8);
  transition: background 0.1s, color 0.1s;
}

.wb-library__view-btn:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #374151);
}

.wb-library__view-btn--active {
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
}

.wb-library__view-btn--active:hover {
  background: var(--wb-brand-hover, #0052cc);
  color: #ffffff;
}

.wb-library__filter-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: none;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 7px;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
}

.wb-library__filter-btn:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
}

.wb-library__filter-btn--active {
  background: #fffbeb;
  border-color: #f59e0b;
}

.wb-library__upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
  border: none;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  min-height: 34px;
}

.wb-library__upload-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-library__yt-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  color: #dc2626;
  cursor: pointer;
  transition: background 0.12s;
  min-height: 34px;
  white-space: nowrap;
}
.wb-library__yt-btn:hover { background: #fee2e2; }
.wb-library__yt-row {
  display: flex;
  gap: 4px;
}
.wb-library__yt-input {
  padding: 7px 10px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 7px;
  font-size: 13px;
  outline: none;
  width: 220px;
  transition: border-color 0.12s;
}
.wb-library__yt-input:focus { border-color: var(--wb-brand, #6366f1); }
.wb-library__yt-submit {
  padding: 6px 12px;
  background: var(--wb-brand, #6366f1);
  color: white;
  border: none;
  border-radius: 7px;
  font-weight: 700;
  cursor: pointer;
}
.wb-library__yt-submit:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Grid ────────────────────────────────────────────────────────────── */

.wb-library__grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
  align-content: start;
}

/* ── List view ──────────────────────────────────────────────────────── */

.wb-library__list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-library__list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background 0.1s;
  cursor: default;
}

.wb-library__list-item:hover {
  background: var(--wb-canvas-bg, #f1f5f9);
}

.wb-library__list-preview {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: var(--wb-canvas-bg, #f8fafc);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.wb-library__list-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.wb-library__list-icon {
  font-size: 18px;
  line-height: 1;
}

.wb-library__list-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-library__list-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-library__list-meta {
  font-size: 11px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-library__list-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.1s;
  flex-shrink: 0;
}

.wb-library__list-item:hover .wb-library__list-actions {
  opacity: 1;
}

.wb-library__list-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #64748b);
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}

.wb-library__list-action:hover {
  background: var(--wb-card-bg, #ffffff);
  border-color: var(--wb-toolbar-border, #e2e8f0);
  color: var(--wb-fg, #0f172a);
}

.wb-library__list-action--active {
  color: #f59e0b;
}

.wb-library__list-action--danger:hover {
  color: #ef4444;
  border-color: #fecaca;
}

@media (hover: none) {
  .wb-library__list-actions {
    opacity: 1;
  }
}

/* ── Empty ───────────────────────────────────────────────────────────── */

.wb-library__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 60px 24px;
  text-align: center;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-library__empty-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-library__upload-cta {
  padding: 10px 24px;
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.wb-library__upload-cta:hover {
  background: var(--wb-brand-hover, #0052cc);
}

/* ── Skeleton ────────────────────────────────────────────────────────── */

.library-asset-card--skeleton {
  pointer-events: none;
}

.wb-skeleton-pulse {
  background: linear-gradient(
    90deg,
    var(--wb-toolbar-border, #e2e8f0) 25%,
    var(--wb-canvas-bg, #f1f5f9) 50%,
    var(--wb-toolbar-border, #e2e8f0) 75%
  );
  background-size: 200% 100%;
  animation: wb-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.wb-skeleton-line { height: 12px; width: 75%; }
.wb-skeleton-line--short { width: 45%; height: 10px; }

@keyframes wb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Pagination ──────────────────────────────────────────────────────── */

.wb-library__pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px 20px;
  border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
  flex-shrink: 0;
}

.wb-library__page-btn {
  padding: 6px 14px;
  background: var(--wb-canvas-bg, #f1f5f9);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.1s;
  min-height: 32px;
}

.wb-library__page-btn:hover:not(:disabled) {
  background: var(--wb-toolbar-border, #e2e8f0);
}

.wb-library__page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wb-library__page-info {
  font-size: 13px;
  color: var(--wb-fg-secondary, #94a3b8);
}

/* ── Create folder dialog ────────────────────────────────────────────── */

.wb-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.wb-dialog {
  background: var(--wb-card-bg, #ffffff);
  border-radius: 12px;
  padding: 24px;
  max-width: 360px;
  width: 90%;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.14);
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.wb-dialog__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--wb-fg, #0f172a);
  margin: 0;
}

.wb-dialog__input {
  padding: 9px 12px;
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 7px;
  font-size: 14px;
  color: var(--wb-fg, #0f172a);
  background: var(--wb-canvas-bg, #f8fafc);
  outline: none;
  transition: border-color 0.15s;
}

.wb-dialog__input:focus {
  border-color: var(--wb-brand, #0066ff);
  background: var(--wb-card-bg, #ffffff);
}

.wb-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.wb-dialog__btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
  min-height: 36px;
}

.wb-dialog__btn--cancel {
  background: var(--wb-canvas-bg, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-dialog__btn--cancel:hover { background: var(--wb-toolbar-border, #e2e8f0); }

.wb-dialog__btn--primary {
  background: var(--wb-brand, #0066ff);
  color: #ffffff;
}

.wb-dialog__btn--primary:hover:not(:disabled) { background: var(--wb-brand-hover, #0052cc); }
.wb-dialog__btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

.wb-dialog-fade-enter-active,
.wb-dialog-fade-leave-active {
  transition: opacity 0.2s ease;
}

.wb-dialog-fade-enter-from,
.wb-dialog-fade-leave-to {
  opacity: 0;
}

/* ── Responsive ──────────────────────────────────────────────────────── */

@media (max-width: 768px) {
  .wb-library {
    flex-direction: column;
    height: auto;
  }

  .wb-library__sidebar {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid var(--wb-toolbar-border, #e2e8f0);
    overflow-x: auto;
    overflow-y: hidden;
    flex-direction: row;
  }

  .wb-library__grid {
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .wb-library__upload-btn,
  .wb-library__upload-cta,
  .wb-library__new-folder-btn,
  .wb-dialog__btn,
  .wb-dialog__input {
    transition: none;
  }

  .wb-skeleton-pulse { animation: none; }
  .wb-dialog-fade-enter-active,
  .wb-dialog-fade-leave-active { transition: none; }
}
</style>
