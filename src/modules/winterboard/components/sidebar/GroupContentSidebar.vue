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

    <!-- Contextual inspectors — shown when a specific asset type is selected; replace tabs.
         Only one can be active at a time (single selection model). -->
    <template v-if="hasActiveInspector">
      <!-- Zoom bar — A− / % / A+ — для демонстрацій учням (маленький шрифт скарги).
           Знаходиться ПОЗАзумованою зоною, завжди кліковна.
           Зберігається в localStorage між сесіями. -->
      <div class="insp-zoom-bar">
        <button
          class="insp-zoom-btn"
          :disabled="zoomIdx === 0"
          title="Зменшити"
          @click="zoomOut"
        >A−</button>
        <span class="insp-zoom-label">{{ ZOOM_LABELS[zoomIdx] }}</span>
        <button
          class="insp-zoom-btn"
          :disabled="zoomIdx === ZOOM_LEVELS.length - 1"
          title="Збільшити"
          @click="zoomIn"
        >A+</button>
      </div>

      <!-- Зумована обгортка — CSS zoom масштабує весь інспектор -->
      <div class="insp-zoom-wrap" :style="{ zoom: ZOOM_LEVELS[zoomIdx] }">
        <Nmt3dInspector       v-if="nmt3dUiState.ws" />
        <TrigCircleInspector  v-else-if="trigCircleUiState.bridge" />
        <HelixInspector       v-else-if="helixUiState.bridge" />
        <GraphCalcInspector   v-else-if="graphCalcInspectorState.bridge" />
        <TrigSolverInspector  v-else-if="trigSolverUiState.bridge" />
        <CalculusInspector    v-else-if="calculusUiState.bridge" />
        <QuadraticInspector   v-else-if="quadUiState.bridge" />
        <GeomashInspector     v-else-if="geomashInspectorState.bridge" />
        <Graphmash3dInspector v-else-if="graphmash3dInspectorState.bridge" />
      </div>
    </template>

    <!-- Виділено PDF/DOCX/PPTX на дошці → сторінки цього документа (перетяг як у «Матеріалах») -->
    <template v-else-if="selectedDocItem">
      <!-- A−/A+ калібрує величину плитки → auto-fill рефлоує колонки, решта в скролі -->
      <div class="insp-zoom-bar">
        <button class="insp-zoom-btn" :disabled="zoomIdx === 0" title="Менші сторінки" @click="zoomOut">A−</button>
        <span class="insp-zoom-label">{{ ZOOM_LABELS[zoomIdx] }}</span>
        <button class="insp-zoom-btn" :disabled="zoomIdx === ZOOM_LEVELS.length - 1" title="Більші сторінки" @click="zoomIn">A+</button>
      </div>
      <div class="content-sidebar__doc-pages" :style="{ '--wb-doc-thumb': docThumbPx + 'px' }">
        <PresentationSlideSelector
          v-if="selectedDocKind === 'pptx'"
          :item="selectedDocItem"
          @close="closeDocPages"
          @retry="() => {}"
        />
        <DocxPageSelector
          v-else-if="selectedDocKind === 'docx'"
          :item="selectedDocItem"
          @close="closeDocPages"
          @retry="() => {}"
        />
        <PdfPageSelector
          v-else
          :item="selectedDocItem"
          @close="closeDocPages"
          @retry="() => {}"
        />
      </div>
    </template>

    <!-- Normal sidebar content (tabs + materials/tools) -->
    <template v-else>

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
        <!-- Пошук по всьому каталогу (SSOT insertRegistry) -->
        <div class="tools-search-wrap">
          <input
            v-model="toolQuery"
            type="search"
            class="tools-search"
            :placeholder="t('winterboard.contentSidebar.toolsSearch')"
            autocomplete="off"
          />
        </div>

        <!-- Пошук активний → плоский grid результатів (перекриває секції) -->
        <template v-if="toolQuery.trim()">
          <div v-if="toolResults.length" class="tools-results">
            <InsertResultTile v-for="e in toolResults" :key="e.id" :entry="e" />
          </div>
          <div v-else class="content-sidebar__empty">
            {{ t('winterboard.contentSidebar.noResults') }}
          </div>
        </template>

        <!-- Порожній пошук → 4 картки-сімейства (root) АБО каталог сімейства -->
        <template v-else>
          <!-- RIGHT_PANEL_MODE = catalog_root: 4 картки -->
          <div v-if="catalogFamily === null" class="tools-cards">
            <button
              v-for="app in MASH_APPS"
              :key="app.app"
              type="button"
              class="tools-card"
              @click="catalogFamily = app.app"
            >
              <span class="tools-card__icon" aria-hidden="true">
                <InsertIcon :family="app.iconFamily" :icon-key="app.iconKey" />
              </span>
              <span class="tools-card__label">{{ app.labelFallback }}</span>
              <span class="tools-card__count">{{ appCounts[app.app] }}</span>
            </button>
          </div>

          <!-- RIGHT_PANEL_MODE = catalog_family: drilldown -->
          <div v-else class="tools-family">
            <div class="tools-crumb">
              <button type="button" class="tools-crumb__back" @click="catalogFamily = null">←</button>
              <span class="tools-crumb__label">{{ currentAppLabel }}</span>
            </div>

            <!-- 2D: аналіз + квадратне + тригонометрія (трей із власними заголовками) -->
            <template v-if="catalogFamily === '2d'">
              <CalculusTray />
              <QuadraticTray />
              <TrigCircleTray />
            </template>

            <!-- Stereo -->
            <template v-else-if="catalogFamily === 'stereo'">
              <Nmt3dTray />
            </template>

            <!-- Geometry: Планіметрія + GeoMASH — ДВІ окремі підсекції (не мішати) -->
            <template v-else-if="catalogFamily === 'geometry'">
              <Geometry2DTray />
              <div class="tools-subhead">GeoMASH</div>
              <div class="tools-results">
                <InsertResultTile v-for="e in geomashEntries" :key="e.id" :entry="e" />
              </div>
            </template>

            <!-- 3D: стартовий набір -->
            <template v-else-if="catalogFamily === '3d'">
              <div class="tools-results">
                <InsertResultTile v-for="e in threeDEntries" :key="e.id" :entry="e" />
              </div>
            </template>
          </div>
        </template>
      </div>
    </template>

    </template><!-- /v-else (normal sidebar, no NMT3D active) -->

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
import PdfPageSelector from './PdfPageSelector.vue'
import DocxPageSelector from './DocxPageSelector.vue'
import PresentationSlideSelector from './PresentationSlideSelector.vue'
import LibraryFolderTree from '../library/LibraryFolderTree.vue'
// NMT3D (2026-05-21): 21 parametric 3D stereometry templates (replaces Phase O SolidsTray)
import Nmt3dTray from './Nmt3dTray.vue'
import Nmt3dInspector from './Nmt3dInspector.vue'
import { nmt3dUiState } from '../../board/state/nmt3dUiState'
// Contextual inspectors (2026-05-22): controls move to sidebar when asset is selected
import TrigCircleInspector from './TrigCircleInspector.vue'
import HelixInspector from './HelixInspector.vue'
import GraphCalcInspector from './GraphCalcInspector.vue'
import TrigSolverInspector from './TrigSolverInspector.vue'
import CalculusInspector from './CalculusInspector.vue'
import QuadraticInspector from './QuadraticInspector.vue'
import QuadraticTray from './QuadraticTray.vue'
import GeomashInspector from './GeomashInspector.vue'
import Graphmash3dInspector from './Graphmash3dInspector.vue'
import { trigCircleUiState } from '../../board/state/trigCircleUiState'
import { helixUiState } from '../../board/state/helixUiState'
import { graphCalcInspectorState } from '../../board/state/graphCalcInspectorState'
import { trigSolverUiState } from '../../board/state/trigSolverUiState'
import { calculusUiState } from '../../board/state/calculusUiState'
import { quadUiState } from '../../board/state/quadUiState'
import { geomashInspectorState } from '../../board/state/geomashInspectorState'
import { graphmash3dInspectorState } from '../../board/state/graphmash3dInspectorState'
// Phase G PR-G1 (2026-05-13): geometry_2d_v2 dynamic geometry tray (skeleton)
import Geometry2DTray from './Geometry2DTray.vue'
// Phase Calculus (2026-05-15): derivative + integral cards tray
import CalculusTray from './CalculusTray.vue'
// TrigCircle (2026-05-16): unit circle ↔ sin/cos/tg/ctg graph tray
import TrigCircleTray from './TrigCircleTray.vue'
// BoardMASH panel Фаза 1: пошук каталогу через insertRegistry SSOT
import InsertResultTile from './InsertResultTile.vue'
import { InsertIcon } from './insertIcons'
import {
  searchInserts, allInserts, insertsByApp, MASH_APPS,
  type MashApp, type InsertEntry,
} from './insertRegistry'
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

// ── Inspector zoom (A− / A+) ──────────────────────────────────────────────
// Масштабує всі contextual inspectors разом (CSS zoom).
// Зберігається в localStorage щоб не скидати при переключенні між сторінками.
const ZOOM_LEVELS = [0.8, 0.9, 1, 1.2, 1.4, 1.6, 1.8, 2.0] as const
const ZOOM_LABELS = ['80%', '90%', '100%', '120%', '140%', '160%', '180%', '200%'] as const
const ZOOM_KEY = 'wb-inspector-zoom'
const DEFAULT_ZOOM_IDX = 2 // 100%

function _loadZoomIdx(): number {
  try {
    const v = parseInt(localStorage.getItem(ZOOM_KEY) ?? '', 10)
    return Number.isFinite(v) && v >= 0 && v < ZOOM_LEVELS.length ? v : DEFAULT_ZOOM_IDX
  } catch { return DEFAULT_ZOOM_IDX }
}
const zoomIdx = ref(_loadZoomIdx())

function zoomIn(): void {
  if (zoomIdx.value < ZOOM_LEVELS.length - 1) {
    zoomIdx.value++
    try { localStorage.setItem(ZOOM_KEY, String(zoomIdx.value)) } catch { /* blocked */ }
  }
}
function zoomOut(): void {
  if (zoomIdx.value > 0) {
    zoomIdx.value--
    try { localStorage.setItem(ZOOM_KEY, String(zoomIdx.value)) } catch { /* blocked */ }
  }
}

const hasActiveInspector = computed(() =>
  !!(nmt3dUiState.ws || trigCircleUiState.bridge || helixUiState.bridge ||
     graphCalcInspectorState.bridge || trigSolverUiState.bridge || calculusUiState.bridge ||
     quadUiState.bridge || geomashInspectorState.bridge || graphmash3dInspectorState.bridge),
)

// ── Виділено PDF/DOCX на дошці → права панель показує сторінки ЦЬОГО документа ──
// (жодної нової логіки drag/asset — перевикористання PdfPageSelector/DocxPageSelector;
//  матч board-asset ↔ матеріал за content_ref.content_id === item.content_item_id,
//  див. useContentDrop.ts:778). Знято виділення → назад у «Матеріали».
const selectedDocAsset = computed(() => {
  const ids = wbStore.selectedIds
  if (!ids || ids.length !== 1) return null
  const a = wbStore.currentAssets.find(x => x.id === ids[0])
  if (!a || a.type !== 'document_viewer') return null
  const ct = (a.content_ref as { content_type?: string } | undefined)?.content_type
  return (ct === 'pdf' || ct === 'document' || ct === 'presentation') ? a : null
})
const selectedDocItem = computed<AllowedContentItem | null>(() => {
  const a = selectedDocAsset.value
  const cid = (a?.content_ref as { content_id?: number } | undefined)?.content_id
  if (cid == null) return null
  return sidebar.items.value.find(it =>
    it.content_item_id === cid || (it as { content_id?: number }).content_id === cid || it.id === cid,
  ) ?? null
})
const selectedDocKind = computed<'pdf' | 'docx' | 'pptx'>(() => {
  const ct = (selectedDocAsset.value?.content_ref as { content_type?: string } | undefined)?.content_type
  return ct === 'document' ? 'docx' : ct === 'presentation' ? 'pptx' : 'pdf'
})
/** Розмір плитки сторінки (px) від A−/A+ zoom → грид auto-fill рефлоує колонки. */
const docThumbPx = computed(() => Math.round(ZOOM_LEVELS[zoomIdx.value] * 82))
/** Кнопка «закрити» у селекторі → зняти виділення → панель повернеться в «Матеріали». */
function closeDocPages(): void { wbStore.clearSelection() }

// ── Folder navigation (library mode only) ──
const selectedFolderId = ref<number | null>(null)
const folders = ref<LibraryFolderTreeType[]>([])
const isLoadingFolders = ref(false)
const isFoldersPanelOpen = ref(false)

// Tab switcher: 'materials' | 'tools'
const activeTab = ref<'materials' | 'tools'>('materials')

// Фаза 1: пошук по каталогу інструментів (SSOT insertRegistry). Порожній q → картки.
const toolQuery = ref('')
const toolResults = computed(() => searchInserts(toolQuery.value))

// Ф3.2: 4-картковий каталог. null = root (4 картки), інакше — drilldown у сімейство.
const catalogFamily = ref<MashApp | null>(null)
const appCounts = computed<Record<MashApp, number>>(() => {
  const by = insertsByApp()
  return { '2d': by['2d'].length, '3d': by['3d'].length, geometry: by.geometry.length, stereo: by.stereo.length }
})
const currentAppLabel = computed(() =>
  MASH_APPS.find(a => a.app === catalogFamily.value)?.labelFallback ?? '',
)
const threeDEntries = computed<InsertEntry[]>(() => allInserts().filter(e => e.family === '3d'))
const geomashEntries = computed<InsertEntry[]>(() => allInserts().filter(e => e.family === 'geomash'))

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
  touch-action: pan-y;
  /* NOTE: -webkit-overflow-scrolling: touch видалено.
     Воно викликало Android repaint bug: position:absolute (z-index) елементи
     (кнопки "+") мали свій GPU layer і перемальовувались після скролу,
     але normal-flow кнопки (основний контент) — ні.
     transform: translateZ(0) форсує єдиний GPU compositing layer для всього
     контенту скролу, що виправляє це. */
  transform: translateZ(0);
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

/* ── Фаза 1: пошук каталогу ── */
.tools-search-wrap {
  padding: 8px 8px 6px;
  position: sticky;
  top: 38px; /* під табами (.content-sidebar__tabs height 38px) */
  background: #ffffff;
  z-index: 1;
}
.tools-search {
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
.tools-search:focus {
  border-color: #3b82f6;
  background: #fff;
}
.tools-results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(78px, 1fr));
  gap: 6px;
  padding: 8px;
}

/* ── Ф3.2: 4 картки-сімейства (root) ── */
.tools-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 10px 8px;
}
.tools-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  position: relative;
}
.tools-card:hover { background: #e0f2fe; border-color: #7dd3fc; }
.tools-card__icon { color: #2563eb; display: flex; }
.tools-card__icon :deep(svg) { width: 28px; height: 28px; }
.tools-card__label { font-size: 12px; font-weight: 600; color: #334155; text-align: center; }
.tools-card__count {
  position: absolute; top: 6px; right: 8px;
  font-size: 10px; font-weight: 600; color: #64748b;
  background: #e2e8f0; border-radius: 9px; padding: 0 6px;
}

/* ── Ф3.2: drilldown ── */
.tools-crumb {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-bottom: 1px solid #f1f5f9;
  position: sticky; top: 74px; background: #fff; z-index: 1;
}
.tools-crumb__back {
  border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 6px;
  width: 24px; height: 24px; cursor: pointer; color: #475569; font-size: 14px; line-height: 1;
}
.tools-crumb__back:hover { background: #e0f2fe; border-color: #7dd3fc; }
.tools-crumb__label { font-size: 13px; font-weight: 700; color: #1e293b; }
.tools-subhead {
  padding: 8px 12px 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em; color: #64748b; background: #f8fafc; border-top: 1px solid #f1f5f9;
}

/* ── Фаза 1: згортні секції-родини ── */
.tools-section {
  border-top: 1px solid #f1f5f9;
}
.tools-section__sum {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #64748b;
  background: #f8fafc;
  cursor: pointer;
  user-select: none;
  list-style: revert; /* лишаємо нативний disclosure-трикутник */
}
.tools-section__sum:hover {
  background: #f1f5f9;
  color: #475569;
}
/* Уникаємо ДУБЛЬ-заголовка: усі трей мають власний `*-tray__header` — ховаємо його
   в режимі секцій, бо назву родини вже показує <summary>. */
.tools-section :deep([class$="-tray__header"]) {
  display: none;
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

/* ── Inspector zoom bar ── */
.insp-zoom-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 4px 8px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.insp-zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 22px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  color: #475569;
  font-size: 11px;
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  cursor: pointer;
  line-height: 1;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
  user-select: none;
}
.insp-zoom-btn:hover:not(:disabled) {
  background: #e2e8f0;
  border-color: #94a3b8;
  color: #1e293b;
}
.insp-zoom-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.insp-zoom-label {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  min-width: 32px;
  text-align: center;
  font-family: 'JetBrains Mono', monospace;
}

/* Зумована обгортка — overflow-x hidden щоб при великому zoom не з'являвся горизонтальний скрол */
.insp-zoom-wrap {
  flex: 1 1 auto;
  overflow-x: hidden;
  overflow-y: auto;
  /* transform-origin не потрібен: CSS zoom розширює layout від top-left автоматично */
}

/* Sidebar має приховувати x-overflow при zoom > 100% */
.content-sidebar {
  overflow-x: hidden;
}

/* Повнопанельний режим сторінок документа — на всю висоту сайдбару (не 400px-cap
   як у вбудованому в список матеріалів). --wb-doc-thumb керує величиною плитки. */
.content-sidebar__doc-pages {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.content-sidebar__doc-pages :deep(.pdf-selector),
.content-sidebar__doc-pages :deep(.docx-selector),
.content-sidebar__doc-pages :deep(.slide-selector) {
  max-height: none;
  flex: 1 1 auto;
  min-height: 0;
  border-top: none;
}
/* auto-fill за величиною плитки (var) → рефлоу колонок при A−/A+; fallback = 3 колонки */
.content-sidebar__doc-pages :deep(.pdf-selector__grid),
.content-sidebar__doc-pages :deep(.docx-selector__grid),
.content-sidebar__doc-pages :deep(.slide-selector__grid) {
  grid-template-columns: repeat(auto-fill, minmax(var(--wb-doc-thumb, 88px), 1fr));
}
</style>
