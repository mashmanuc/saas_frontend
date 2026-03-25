<template>
  <div class="materials-browser">
    <!-- Collapsible folder panel (B2) -->
    <div v-if="isFoldersPanelOpen" class="materials-browser__folders">
      <LibraryFolderTree
        :folders="folders"
        :selected-id="selectedFolderId"
        :loading="isLoadingFolders"
        @select="selectFolder"
      />
    </div>

    <!-- Toggle button (B2) -->
    <button
      type="button"
      class="materials-browser__toggle"
      @click="toggleFoldersPanel"
      :aria-label="isFoldersPanelOpen ? t('winterboard.materials.hideFolders') : t('winterboard.materials.showFolders')"
    >
      <FolderIcon :size="14" aria-hidden="true" />
      <span>{{ isFoldersPanelOpen ? t('winterboard.materials.hideFolders') : t('winterboard.materials.showFolders') }}</span>
    </button>

    <!-- Assets list (B3) -->
    <div class="materials-browser__assets">
      <!-- Loading skeleton -->
      <div v-if="isLoadingAssets" class="materials-browser__skeleton">
        <div v-for="i in 6" :key="i" class="materials-browser__skeleton-item" />
      </div>

      <!-- Empty state (Phase 33 B5: actionable) -->
      <div v-else-if="assets.length === 0" class="materials-browser__empty">
        <FolderOpenIcon :size="48" aria-hidden="true" class="materials-browser__empty-icon" />
        <p class="materials-browser__empty-title">{{ t('winterboard.materials.emptyFolder') }}</p>
        <p class="materials-browser__empty-hint">{{ t('winterboard.materials.emptyFolderHint') }}</p>
        <button
          v-if="isTutor"
          type="button"
          class="materials-browser__empty-upload"
          @click="emit('upload-request')"
        >
          📤 {{ t('winterboard.materials.uploadFile') }}
        </button>
      </div>

      <!-- Asset grid -->
      <template v-else>
        <WBAssetItem
          v-for="asset in assets"
          :key="asset.id"
          :asset="asset"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 32 B1-B4: Materials Browser
 *
 * Sidebar component for board "Materials" tab (browse mode).
 * Shows folder tree + filtered asset list.
 *
 * INV-1: Reuses LibraryFolderTree, WBAssetItem, useMaterialsBrowser
 * INV-2: Does NOT modify ContentSidebar (lesson mode)
 */
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderIcon, FolderOpenIcon } from 'lucide-vue-next'
import { useMaterialsBrowser } from '../../composables/useMaterialsBrowser'
import LibraryFolderTree from '../library/LibraryFolderTree.vue'
import WBAssetItem from './WBAssetItem.vue'

// ─── Props & Emits ───────────────────────────────────────────────────────────

interface Props {
  isTutor?: boolean
}

withDefaults(defineProps<Props>(), {
  isTutor: false,
})

const emit = defineEmits<{
  'upload-request': []
}>()

// ─── Composables ─────────────────────────────────────────────────────────────

const { t } = useI18n()
const {
  folders,
  assets,
  selectedFolderId,
  isLoadingFolders,
  isLoadingAssets,
  isFoldersPanelOpen,
  loadFolders,
  loadAssets,
  selectFolder,
  toggleFoldersPanel,
} = useMaterialsBrowser()

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  // INV-4: Max 2 API calls on mount
  await Promise.all([
    loadFolders(),
    loadAssets(), // selectedFolderId = null → all files
  ])
})
</script>

<style scoped>
.materials-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--wb-sidebar-bg, #ffffff);
  overflow: hidden;
}

/* ─── Folder panel (collapsible) ───────────────────────────────────────────── */

.materials-browser__folders {
  flex-shrink: 0;
  max-height: 40%;
  overflow-y: auto;
  border-bottom: 1px solid var(--wb-border-color, #e5e7eb);
  padding: 8px 0;
}

/* ─── Toggle button ──────────────────────────────────────────────────────── */

.materials-browser__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-bottom: 1px solid var(--wb-border-color, #e5e7eb);
  background: var(--wb-sidebar-bg, #ffffff);
  color: var(--wb-text-secondary, #6b7280);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.materials-browser__toggle:hover {
  background: var(--wb-hover-bg, #f3f4f6);
  color: var(--wb-text-primary, #111827);
}

.materials-browser__toggle:active {
  background: var(--wb-active-bg, #e5e7eb);
}

/* ─── Assets list ────────────────────────────────────────────────────────── */

.materials-browser__assets {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  align-content: start;
}

/* ─── Loading skeleton ───────────────────────────────────────────────────── */

.materials-browser__skeleton {
  display: contents;
}

.materials-browser__skeleton-item {
  aspect-ratio: 1;
  background: linear-gradient(
    90deg,
    var(--wb-skeleton-from, #f3f4f6) 0%,
    var(--wb-skeleton-to, #e5e7eb) 50%,
    var(--wb-skeleton-from, #f3f4f6) 100%
  );
  background-size: 200% 100%;
  border-radius: 8px;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

.materials-browser__empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--wb-text-secondary, #6b7280);
}

.materials-browser__empty-icon {
  margin-bottom: 16px;
  opacity: 0.4;
}

.materials-browser__empty-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: var(--wb-text-primary, #111827);
}

.materials-browser__empty-hint {
  font-size: 13px;
  margin: 0 0 16px 0;
  max-width: 240px;
}

.materials-browser__empty-upload {
  padding: 8px 16px;
  background: var(--wb-brand, #0066ff);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.materials-browser__empty-upload:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.materials-browser__empty-upload:active {
  background: var(--wb-brand-active, #003d99);
}

/* ─── Responsive (narrow sidebar) ───────────────────────────────────────── */

@media (max-width: 320px) {
  .materials-browser__assets {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
    padding: 8px;
  }
}
</style>
