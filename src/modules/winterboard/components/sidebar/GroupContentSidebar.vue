<template>
  <div
    class="content-sidebar"
    :class="{ 'content-sidebar--dragover': isDragOver }"
    @dragover.prevent="onDragOver"
    @dragleave="isDragOver = false"
    @drop.prevent="onDrop"
  >
    <!-- Drop overlay for file upload from OS -->
    <Transition name="fade">
      <div v-if="isDragOver" class="content-sidebar__drop-overlay">
        {{ t('winterboard.contentSidebar.dropToUpload') }}
      </div>
    </Transition>

    <!-- Tab switcher -->
    <div class="content-sidebar__tabs" role="tablist">
      <button
        class="content-sidebar__tab"
        :class="{ 'content-sidebar__tab--active': activeTab === 'materials' }"
        role="tab"
        :aria-selected="activeTab === 'materials'"
        @click="activeTab = 'materials'"
      >{{ t('winterboard.contentSidebar.tabMaterials') }}</button>
      <button
        class="content-sidebar__tab"
        :class="{ 'content-sidebar__tab--active': activeTab === 'tools' }"
        role="tab"
        :aria-selected="activeTab === 'tools'"
        @click="activeTab = 'tools'"
      >{{ t('winterboard.contentSidebar.tabTools') }}</button>
    </div>

    <!-- ── МАТЕРІАЛИ tab ── -->
    <template v-if="activeTab === 'materials'">

    <!-- Phase 3.1: Storage quota bar — shown only when usage ≥ 70% to reduce noise -->
    <StorageQuotaBar
      v-if="isTutor && storageQuota && (storageQuota.usage_percent ?? 0) >= 70"
      :quota="storageQuota"
    />

    <!-- Folder tree (library mode only) -->
    <template v-if="!groupId">
      <div v-if="isFoldersPanelOpen" class="content-sidebar__folders">
        <LibraryFolderTree
          :folders="folders"
          :selected-id="selectedFolderId"
          :loading="isLoadingFolders"
          @select="handleFolderSelect"
        />
      </div>
      <button
        type="button"
        class="content-sidebar__folders-toggle"
        @click="isFoldersPanelOpen = !isFoldersPanelOpen"
      >
        <FolderIcon :size="14" />
        {{ isFoldersPanelOpen ? t('winterboard.materials.hideFolders') : t('winterboard.materials.showFolders') }}
      </button>
    </template>

    <!-- Header -->
    <div class="content-sidebar__header">
      <span class="content-sidebar__title">
        {{ t('knowledge.materials') }}
      </span>
      <span class="content-sidebar__count">{{ filteredCount }}</span>
      <label v-if="isTutor" class="content-sidebar__upload-btn" :title="t('winterboard.contentSidebar.upload')">
        <input
          type="file"
          multiple
          accept="image/*,application/pdf,audio/*,video/*,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          class="sr-only"
          @change="handleFileInput"
        />
        <span>+</span>
      </label>
    </div>

    <!-- Search -->
    <div class="content-sidebar__search-wrap">
      <input
        v-model="searchQuery"
        type="search"
        class="content-sidebar__search"
        :placeholder="t('winterboard.contentSidebar.search')"
        autocomplete="off"
      />
    </div>

    <!-- Filter chips -->
    <div
      v-if="sidebar.totalCount.value > 0 || (sidebar.pasteCount.value > 0)"
      class="content-sidebar__filters"
    >
      <button
        class="filter-chip"
        :class="{ 'filter-chip--active': activeFilter === 'all' && !sidebar.showPasteOnly.value }"
        @click="onFilterAll"
      >
        {{ t('winterboard.contentSidebar.filterAll') }}
      </button>
      <button
        v-for="cat in availableCategories"
        :key="cat"
        class="filter-chip"
        :class="{ 'filter-chip--active': activeFilter === cat && !sidebar.showPasteOnly.value }"
        :title="t(`winterboard.contentSidebar.category.${cat}`)"
        @click="onFilterCategory(cat)"
      >
        <svg v-if="cat === 'youtube'" width="12" height="9" viewBox="0 0 20 14" aria-hidden="true" style="flex-shrink:0">
          <rect x="1" y="1" width="18" height="12" rx="3" fill="#FF0000"/>
          <path d="M8 4l5 3-5 3V4z" fill="#fff"/>
        </svg>
        <span v-else class="filter-chip__icon" aria-hidden="true">{{ CATEGORY_ICONS[cat] ?? '📎' }}</span>
        <span class="filter-chip__label">{{ t(`winterboard.contentSidebar.category.${cat}`) }}</span>
      </button>
      <!-- Paste chip (2026-04-16) — окремо від category chips -->
      <button
        v-if="!groupId && sidebar.pasteCount.value > 0"
        class="filter-chip filter-chip--paste"
        :class="{ 'filter-chip--active': sidebar.showPasteOnly.value }"
        :title="t('winterboard.contentSidebar.pasteFilterTitle')"
        @click="onFilterPaste"
      >
        📋
        <span class="filter-chip__counter">{{ sidebar.pasteCount.value }}</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="sidebar.isLoading.value" class="content-sidebar__loading">
      {{ t('winterboard.contentSidebar.loading') }}
    </div>

    <!-- Error -->
    <div v-else-if="sidebar.error.value" class="content-sidebar__error">
      <span>{{ t(`winterboard.contentSidebar.${sidebar.error.value}`) }}</span>
      <button class="content-sidebar__retry" @click="sidebar.reload">&#8635;</button>
    </div>

    <!-- Empty (no materials at all) -->
    <div v-else-if="sidebar.totalCount.value === 0" class="content-sidebar__empty">
      {{ t('knowledge.noMaterials') }}
    </div>

    <!-- Empty (filter / search miss) -->
    <div v-else-if="filteredCount === 0" class="content-sidebar__empty">
      {{ t('winterboard.contentSidebar.noResults') }}
    </div>

    <!-- Grouped items -->
    <template v-if="!sidebar.isLoading.value && sidebar.totalCount.value > 0">
      <template v-for="(categoryItems, category) in filteredGrouped" :key="category">
        <div v-if="categoryItems.length > 0" class="content-sidebar__group">
          <div class="content-sidebar__group-header">
            {{ t(`winterboard.contentSidebar.category.${category}`) }}
            <span class="content-sidebar__group-count">{{ categoryItems.length }}</span>
          </div>
          <ContentSidebarItem
            v-for="item in categoryItems"
            :key="item.id || item.content_item_id"
            :item="item"
            :is-tutor="isTutor"
            @place="emit('place', $event)"
          />
        </div>
      </template>
    </template>

    </template><!-- /materials tab -->

    <!-- ── ІНСТРУМЕНТИ tab ── -->
    <template v-else>
      <div class="content-sidebar__tools-tab">
        <SolidsTray />
        <Geometry2DTray />
        <CalculusTray />
        <TrigCircleTray />
      </div>
    </template>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { FolderIcon } from 'lucide-vue-next'
import { useGroupSidebar } from '../../composables/useGroupSidebar'
import { useWBStore } from '../../board/state/boardStore'
import { fetchFoldersTree } from '../../api/library'
import ContentSidebarItem from './ContentSidebarItem.vue'
import LibraryFolderTree from '../library/LibraryFolderTree.vue'
import SolidsTray from './SolidsTray.vue'
// Phase G PR-G1 (2026-05-13): geometry_2d_v2 dynamic geometry tray (skeleton)
import Geometry2DTray from './Geometry2DTray.vue'
// Phase Calculus (2026-05-15): derivative + integral cards tray
import CalculusTray from './CalculusTray.vue'
// TrigCircle (2026-05-16): unit circle ↔ sin/cos/tg/ctg graph tray
import TrigCircleTray from './TrigCircleTray.vue'


import StorageQuotaBar from '@/modules/learning-content/components/StorageQuotaBar.vue'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import type { StorageQuota } from '@/modules/learning-content/api/learningContentApi'
import type { AssetCategoryGroup, AllowedContentItem } from '../../types/sidebar'
import type { LibraryFolderTree as LibraryFolderTreeType } from '../../types/library'

// Phase 38: module-level кеш щоб не дублювати запити при remount sidebar
let _quotaCache: StorageQuota | null = null
let _quotaCacheTime = 0
let _foldersCache: LibraryFolderTreeType[] | null = null
let _foldersCacheTime = 0
const CACHE_MS = 30_000 // 30 секунд

const CATEGORY_ICONS: Record<string, string> = {
  problem: '📐',
  image: '🖼',
  pdf: '📄',
  audio: '🎵',
  video: '▶️',
  presentation: '📊',
  youtube: '▶️',
  document: '📝',  // Phase 35 B7: DOCX/Word documents
}

const props = defineProps<{
  groupId: string | null
  isTutor: boolean
}>()

const emit = defineEmits<{
  place: [item: AllowedContentItem]
  'apply-template': [templateId: string]
}>()

const { t } = useI18n()

// ── Folder navigation (library mode only) ──
const selectedFolderId = ref<number | null>(null)
const folders = ref<LibraryFolderTreeType[]>([])
const isLoadingFolders = ref(false)
const isFoldersPanelOpen = ref(false)

// Tab switcher: 'materials' | 'tools'
const activeTab = ref<'materials' | 'tools'>('materials')

const sidebar = useGroupSidebar(toRef(props, 'groupId'), selectedFolderId)
const wbStore = useWBStore()

function handleFolderSelect(id: number | null) {
  selectedFolderId.value = id
}

async function loadFolders() {
  if (props.groupId) return // папки тільки в library mode
  // Phase 38: кеш щоб не дублювати при remount
  if (_foldersCache && Date.now() - _foldersCacheTime < CACHE_MS) {
    folders.value = _foldersCache
    return
  }
  isLoadingFolders.value = true
  try {
    const data = await fetchFoldersTree()
    folders.value = data
    _foldersCache = data
    _foldersCacheTime = Date.now()
  } catch (e) {
    console.warn('[GroupContentSidebar] Failed to load folders:', e)
  } finally {
    isLoadingFolders.value = false
  }
}

// ── Filter + Search state ──
const activeFilter = ref<string>('all')
const searchQuery = ref('')

// 2026-04-16: paste filter handlers.
// Чіпся «📋» toggle'ає paste-only view; інші chip'и повертають до default.
function onFilterAll() {
  sidebar.showPasteOnly.value = false
  activeFilter.value = 'all'
}
function onFilterCategory(cat: string) {
  sidebar.showPasteOnly.value = false
  activeFilter.value = cat
}
function onFilterPaste() {
  sidebar.showPasteOnly.value = !sidebar.showPasteOnly.value
  activeFilter.value = 'all'  // у paste-only режимі category chips не активні
}

/** Categories that actually have items — shown as chips */
const availableCategories = computed<string[]>(() => {
  const cats = new Set<string>()
  for (const item of sidebar.items.value) {
    if (item.asset_category) cats.add(item.asset_category)
  }
  // Return in consistent display order
  return ['problem', 'image', 'pdf', 'document', 'audio', 'video', 'youtube', 'presentation'].filter(c => cats.has(c))
})

/** Items after filter + search */
const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return sidebar.items.value.filter(item => {
    const matchCat = activeFilter.value === 'all' || item.asset_category === activeFilter.value
    const matchQ = !q || item.title.toLowerCase().includes(q)
    return matchCat && matchQ
  })
})

/** Grouped filtered items (same structure as sidebar.grouped) */
const filteredGrouped = computed<Record<string, typeof filteredItems.value>>(() => {
  const result: Record<string, typeof filteredItems.value> = {}
  for (const item of filteredItems.value) {
    const cat = item.asset_category || 'other'
    if (!result[cat]) result[cat] = []
    result[cat].push(item)
  }
  return result
})

const filteredCount = computed(() => filteredItems.value.length)

// ── Storage quota (кешується на module level щоб не дублювати запит при remount) ──
const storageQuota = ref<StorageQuota | null>(_quotaCache)

async function loadQuota() {
  // Phase 38: не перезавантажувати якщо дані свіжі
  if (_quotaCache && Date.now() - _quotaCacheTime < CACHE_MS) {
    storageQuota.value = _quotaCache
    return
  }
  try {
    const data = await learningContentApi.getStorageQuota()
    storageQuota.value = data
    _quotaCache = data
    _quotaCacheTime = Date.now()
  } catch (e) {
    console.warn('[GroupContentSidebar] Quota load failed:', e)
  }
}

onMounted(() => {
  // FE-P1 (2026-04-30): defer non-critical sidebar fetches на 2.5s щоб не
  // конфліктувати з initial burst (session detail + auth + me + WS connect).
  // Quota/folders не потрібні у перші 2-3 секунди — user ще не взаємодіє з
  // sidebar. Throttle window 1min cumulative — staggering запобігає 429 storm.
  // Якщо cache ще валідний (`_quotaCache`/`_foldersCache` з module-level
  // TTL=30s, e.g. remount протягом 30s) — load instant, без затримки.
  const _quotaCached = _quotaCache && Date.now() - _quotaCacheTime < CACHE_MS
  const _foldersCached = _foldersCache && Date.now() - _foldersCacheTime < CACHE_MS

  if (_quotaCached) {
    storageQuota.value = _quotaCache
  } else {
    setTimeout(loadQuota, 2500)
  }
  if (_foldersCached) {
    folders.value = _foldersCache
  } else {
    setTimeout(loadFolders, 2700)  // різний offset для desync
  }
})

function handleFileInput(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  if (!files.length) return
  sidebar.uploadFiles(files).then(loadQuota)
  ;(e.target as HTMLInputElement).value = ''
}

// ── File drag-upload from OS ──
const isDragOver = ref(false)

function onDragOver(e: DragEvent) {
  const hasFile = Array.from(e.dataTransfer?.items ?? [])
    .some(item => item.kind === 'file')
  if (hasFile && props.isTutor) {
    isDragOver.value = true
  }
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  if (e.dataTransfer?.getData(sidebar.SIDEBAR_DRAG_MIME)) return
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (!files.length || !props.isTutor) return
  sidebar.uploadFiles(files).then(loadQuota)
}
</script>

<style scoped>
/* ── Folder panel (library mode) ── */
.content-sidebar__folders {
  flex-shrink: 0;
  max-height: 35%;
  overflow-y: auto;
  border-bottom: 1px solid var(--wb-border-color, #e5e7eb);
  padding: 8px 0;
}
.content-sidebar__folders-toggle {
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
  transition: background 0.15s, color 0.15s;
  width: 100%;
  text-align: left;
}
.content-sidebar__folders-toggle:hover {
  background: var(--wb-hover-bg, #f3f4f6);
  color: var(--wb-text-primary, #111827);
}

/* ── Tab switcher ── */
.content-sidebar__tabs {
  display: flex;
  flex-shrink: 0;
  border-bottom: 2px solid #f1f5f9;
  background: #ffffff;
  position: sticky;
  top: 0;
  z-index: 2;
}

.content-sidebar__tab {
  flex: 1;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  letter-spacing: 0.01em;
}

.content-sidebar__tab:hover {
  color: #475569;
  background: #f8fafc;
}

.content-sidebar__tab--active {
  color: #2563eb;
  border-bottom-color: #2563eb;
}

/* ── Base sidebar ── */
.content-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.content-sidebar--dragover {
  outline: 2px dashed #3b82f6;
  outline-offset: -2px;
  background: #eff6ff;
}
.content-sidebar__drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
  font-size: 14px;
  font-weight: 600;
  z-index: 10;
  pointer-events: none;
}

/* ── Header ── */
.content-sidebar__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px 6px;
}
.content-sidebar__upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
  line-height: 1;
}
.content-sidebar__upload-btn:hover {
  background: #2563eb;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.content-sidebar__title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  flex: 1;
}
.content-sidebar__count {
  font-size: 11px;
  font-weight: 600;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 6px;
  border-radius: 10px;
}

/* ── Search ── */
.content-sidebar__search-wrap {
  padding: 0 8px 6px;
}
.content-sidebar__search {
  width: 100%;
  box-sizing: border-box;
  height: 30px;
  padding: 0 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  color: #1e293b;
  background: #f8fafc;
  outline: none;
  transition: border-color 0.15s;
}
.content-sidebar__search:focus {
  border-color: #3b82f6;
  background: #fff;
}

/* ── Filter chips ── */
.content-sidebar__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 8px 8px;
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  background: #f8fafc;
  color: #475569;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  line-height: 1;
  white-space: nowrap;
}
.filter-chip__icon {
  font-size: 11px;
  flex-shrink: 0;
  line-height: 1;
}
.filter-chip__label {
  font-size: 11px;
  line-height: 1;
}
.filter-chip:hover {
  background: #e0f2fe;
  border-color: #7dd3fc;
  color: #0369a1;
}
.filter-chip--active {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1d4ed8;
  font-weight: 600;
}

/* Paste chip — візуально відрізняється (gray → amber on active) бо це не
   category a окрема "bucket" для clipboard паст */
.filter-chip--paste {
  gap: 4px;
  padding-right: 4px;
  background: #fef3c7;
  border-color: #fde68a;
  color: #78350f;
}
.filter-chip--paste:hover {
  background: #fde68a;
  border-color: #fbbf24;
  color: #7c2d12;
}
.filter-chip--paste.filter-chip--active {
  background: #f59e0b;
  border-color: #d97706;
  color: #fff;
}
.filter-chip__counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 10px;
  background: rgba(120, 53, 15, 0.15);
  color: inherit;
  font-size: 10px;
  font-weight: 700;
}
.filter-chip--paste.filter-chip--active .filter-chip__counter {
  background: rgba(255, 255, 255, 0.25);
}

/* ── States ── */
.content-sidebar__loading,
.content-sidebar__empty {
  padding: 32px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.content-sidebar__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: #dc2626;
  font-size: 13px;
  background: #fef2f2;
  margin: 8px;
  border-radius: 6px;
}
.content-sidebar__retry {
  background: none;
  border: none;
  cursor: pointer;
  color: #dc2626;
  font-size: 16px;
  padding: 0 4px;
}

/* ── Groups ── */
.content-sidebar__group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  background: #f8fafc;
  border-top: 1px solid #f1f5f9;
}
.content-sidebar__group-count {
  font-size: 10px;
  font-weight: 600;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 5px;
  border-radius: 8px;
}

/* ── Solids section (collapsible) — Phase O Task 1 UX ── */
.content-sidebar__group-header--collapsible {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin: 0;
  /* Inherit visual styling from .content-sidebar__group-header (font, padding,
     bg, border-top) — only override button-specific defaults. */
  background: #f8fafc;
  border: none;
  border-top: 1px solid #f1f5f9;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
}
.content-sidebar__group-header--collapsible:hover {
  background: #f1f5f9;
}
.content-sidebar__group-header--collapsible:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: -2px;
}
.content-sidebar__group-header-text {
  flex: 1;
}
.content-sidebar__group-header-chevron {
  display: inline-block;
  transition: transform 0.2s ease;
  font-size: 12px;
  color: #64748b;
  line-height: 1;
}
.content-sidebar__group-header-chevron.open {
  transform: rotate(180deg);
}

.solids-collapse-enter-active,
.solids-collapse-leave-active {
  transition: opacity 0.2s ease, max-height 0.2s ease;
  overflow: hidden;
}
.solids-collapse-enter-from,
.solids-collapse-leave-to {
  opacity: 0;
  max-height: 0;
}
.solids-collapse-enter-to,
.solids-collapse-leave-from {
  opacity: 1;
  max-height: 600px;
}

/* ── Tools tab wrapper — removes redundant top border on first tray section ── */
.content-sidebar__tools-tab :deep(.solids-tray) {
  border-top: none;
  padding-top: 14px;
}

/* ── Fade transition ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
