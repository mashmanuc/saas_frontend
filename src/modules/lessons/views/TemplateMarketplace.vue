<template>
  <div class="mp-page">
    <!-- Header -->
    <div class="mp-header">
      <h1 class="mp-title">{{ t('lessons.marketplace.title') }}</h1>
      <p class="mp-subtitle">{{ t('lessons.marketplace.subtitle') }}</p>
    </div>

    <!-- Filters bar -->
    <div class="mp-filters">
      <div class="mp-filters-row">
        <!-- Search -->
        <input
          v-model="searchQuery"
          type="text"
          class="mp-search-input"
          :placeholder="t('lessons.marketplace.searchPlaceholder')"
          data-test="mp-search"
          @input="onSearchInput"
        />

        <!-- Subject filter -->
        <select
          v-model="filters.subject"
          class="mp-select"
          data-test="mp-filter-subject"
          @change="fetchPage(1)"
        >
          <option value="">{{ t('lessons.marketplace.allSubjects') }}</option>
          <option v-for="s in availableSubjects" :key="s" :value="s">{{ s }}</option>
        </select>

        <!-- Lesson type filter -->
        <select
          v-model="filters.lesson_type"
          class="mp-select"
          data-test="mp-filter-type"
          @change="fetchPage(1)"
        >
          <option value="">{{ t('lessons.marketplace.allTypes') }}</option>
          <option value="PLANNED">{{ t('lessons.type.PLANNED') }}</option>
          <option value="INSTANT">{{ t('lessons.type.INSTANT') }}</option>
          <option value="TEMPLATE_BASED">{{ t('lessons.type.TEMPLATE_BASED') }}</option>
          <option value="PRE_BUILT">{{ t('lessons.type.PRE_BUILT') }}</option>
          <option value="DYNAMIC">{{ t('lessons.type.DYNAMIC') }}</option>
          <option value="PACKAGE">{{ t('lessons.type.PACKAGE') }}</option>
          <option value="PROGRAM">{{ t('lessons.type.PROGRAM') }}</option>
        </select>

        <!-- Sort -->
        <select
          v-model="filters.sort"
          class="mp-select"
          data-test="mp-filter-sort"
          @change="fetchPage(1)"
        >
          <option value="newest">{{ t('lessons.marketplace.sortNewest') }}</option>
          <option value="popular">{{ t('lessons.marketplace.sortPopular') }}</option>
          <option value="price_asc">{{ t('lessons.marketplace.sortPriceAsc') }}</option>
          <option value="price_desc">{{ t('lessons.marketplace.sortPriceDesc') }}</option>
        </select>
      </div>

      <div class="mp-filters-row-second">
        <!-- Free only checkbox -->
        <label class="mp-checkbox-label" data-test="mp-filter-free">
          <input
            v-model="filters.free_only"
            type="checkbox"
            class="mp-checkbox"
            @change="fetchPage(1)"
          />
          {{ t('lessons.marketplace.freeOnly') }}
        </label>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="mp-state" data-test="mp-loading">
      {{ t('lessons.marketplace.loading') }}
    </div>

    <!-- Error -->
    <div v-else-if="error" class="mp-state mp-state-error" data-test="mp-error">
      {{ error }}
      <button class="mp-retry-btn" @click="fetchPage(currentPage)">&#8635;</button>
    </div>

    <!-- Empty -->
    <div v-else-if="!results.length" class="mp-state" data-test="mp-empty">
      {{ t('lessons.marketplace.noResults') }}
    </div>

    <!-- Grid -->
    <div v-else class="mp-grid" data-test="mp-grid">
      <MarketplaceCard
        v-for="item in results"
        :key="item.id"
        :template="item"
        @click="openPreview(item.id)"
      />
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="mp-pagination" data-test="mp-pagination">
      <button
        class="mp-page-btn"
        :disabled="currentPage <= 1"
        @click="fetchPage(currentPage - 1)"
      >
        &laquo;
      </button>

      <template v-for="p in paginationRange" :key="p">
        <button
          v-if="typeof p === 'number'"
          class="mp-page-btn"
          :class="{ 'mp-page-active': p === currentPage }"
          @click="fetchPage(p)"
        >
          {{ p }}
        </button>
        <span v-else class="mp-page-ellipsis">...</span>
      </template>

      <button
        class="mp-page-btn"
        :disabled="currentPage >= totalPages"
        @click="fetchPage(currentPage + 1)"
      >
        &raquo;
      </button>
    </div>

    <!-- Preview Modal -->
    <TemplatePreviewModal
      :template-id="previewTemplateId"
      :visible="previewVisible"
      @close="closePreview"
      @used="onTemplateUsed"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { lessonsTemplateApi } from '../api/lessonsTemplateApi'
import type { MarketplaceTemplateSummary, MarketplaceSearchParams, LessonType, MarketplaceSortOption } from '../types/lessonTypes'
import MarketplaceCard from '../components/MarketplaceCard.vue'
import TemplatePreviewModal from '../components/TemplatePreviewModal.vue'

const { t } = useI18n()
const router = useRouter()

// State
const results = ref<MarketplaceTemplateSummary[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const currentPage = ref(1)
const totalPages = ref(1)
const totalCount = ref(0)
const pageSize = ref(20)

// Search
const searchQuery = ref('')
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

// Filters
const filters = reactive<{
  subject: string
  lesson_type: string
  sort: MarketplaceSortOption
  free_only: boolean
}>({
  subject: '',
  lesson_type: '',
  sort: 'newest',
  free_only: false,
})

// Preview modal
const previewVisible = ref(false)
const previewTemplateId = ref<number | null>(null)

// Available subjects (collected from results for quick filter)
const availableSubjects = computed(() => {
  const set = new Set<string>()
  results.value.forEach(r => { if (r.subject) set.add(r.subject) })
  return Array.from(set).sort()
})

// Pagination range
const paginationRange = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const range: (number | string)[] = []

  if (total <= 7) {
    for (let i = 1; i <= total; i++) range.push(i)
    return range
  }

  range.push(1)
  if (current > 3) range.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) range.push(i)

  if (current < total - 2) range.push('...')
  range.push(total)

  return range
})

// Actions
function buildParams(page: number): MarketplaceSearchParams {
  const params: MarketplaceSearchParams = {
    page,
    page_size: pageSize.value,
    sort: filters.sort,
  }
  if (searchQuery.value.trim()) params.search = searchQuery.value.trim()
  if (filters.subject) params.subject = filters.subject
  if (filters.lesson_type) params.lesson_type = filters.lesson_type as LessonType
  if (filters.free_only) params.free_only = true
  return params
}

async function fetchPage(page: number) {
  isLoading.value = true
  error.value = null
  try {
    const resp = await lessonsTemplateApi.searchMarketplace(buildParams(page))
    results.value = resp.results
    currentPage.value = resp.page
    totalPages.value = resp.total_pages
    totalCount.value = resp.count
  } catch {
    error.value = t('lessons.marketplace.error')
  } finally {
    isLoading.value = false
  }
}

function onSearchInput() {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
  searchDebounceTimer = setTimeout(() => {
    fetchPage(1)
  }, 300)
}

function openPreview(id: number) {
  previewTemplateId.value = id
  previewVisible.value = true
}

function closePreview() {
  previewVisible.value = false
  previewTemplateId.value = null
}

function onTemplateUsed(lessonId: number) {
  closePreview()
  router.push({ name: 'lesson', params: { id: lessonId } })
}

onMounted(() => {
  fetchPage(1)
})
</script>

<style scoped>
.mp-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
}
.mp-header {
  margin-bottom: 20px;
}
.mp-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}
.mp-subtitle {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Filters */
.mp-filters {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--border-color);
}
.mp-filters-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.mp-filters-row-second {
  margin-top: 8px;
  display: flex;
  gap: 16px;
  align-items: center;
}
.mp-search-input {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  background: var(--card-bg);
  transition: border-color 0.15s;
}
.mp-search-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent);
}
.mp-select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 13px;
  background: var(--card-bg);
  cursor: pointer;
  min-width: 140px;
  transition: border-color 0.15s;
}
.mp-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent);
}
.mp-checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
}
.mp-checkbox {
  accent-color: var(--accent);
}

/* States */
.mp-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-secondary);
  font-size: 14px;
}
.mp-state-error {
  color: var(--danger-bg);
  background: color-mix(in srgb, var(--danger-bg) 8%, var(--card-bg));
  border-radius: 8px;
  margin: 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
}
.mp-retry-btn {
  background: none;
  border: 1px solid color-mix(in srgb, var(--danger-bg) 40%, transparent);
  border-radius: 6px;
  color: var(--danger-bg);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 10px;
}
.mp-retry-btn:hover { background: color-mix(in srgb, var(--danger-bg) 12%, var(--card-bg)); }

/* Grid */
.mp-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) {
  .mp-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 768px) {
  .mp-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .mp-grid { grid-template-columns: 1fr; }
}

/* Pagination */
.mp-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 24px;
  padding: 12px 0;
}
.mp-page-btn {
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--card-bg);
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.mp-page-btn:hover:not(:disabled) {
  background: var(--bg-secondary);
  border-color: var(--text-secondary);
}
.mp-page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.mp-page-active {
  background: var(--accent);
  color: var(--accent-contrast);
  border-color: var(--accent);
}
.mp-page-active:hover:not(:disabled) {
  background: var(--accent-hover);
}
.mp-page-ellipsis {
  padding: 0 6px;
  color: var(--text-secondary);
  font-size: 13px;
}
</style>
