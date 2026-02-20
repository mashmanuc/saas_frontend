<script setup lang="ts">
// TASK MF3: Tutor Catalog View
import { ref, onMounted, computed, watch } from 'vue'
import MarketplaceHero from '../components/catalog/MarketplaceHero.vue'
import TrustStrip from '../components/catalog/TrustStrip.vue'
import CatalogFilterBar from '../components/catalog/CatalogFilterBar.vue'
import AdvancedFiltersModal from '../components/catalog/AdvancedFiltersModal.vue'
import CatalogPagination from '../components/catalog/CatalogPagination.vue'
import CatalogSort from '../components/catalog/CatalogSort.vue'
import TutorGrid from '../components/catalog/TutorGrid.vue'
import EmptyState from '@/ui/EmptyState.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import type { CatalogFilters as CatalogFiltersType } from '../api/marketplace'
import { telemetry } from '@/services/telemetry'
import { useI18n } from 'vue-i18n'
import { useMarketplace } from '../composables/useMarketplace'
import Button from '@/ui/Button.vue'

const { t } = useI18n()
const { tutors, totalCount, totalPages, currentPage, pageSize, isLoading, hasMore, filters, sortBy, filterOptions, error, setFilters, setSort, setPage, loadTutors, loadMore, clearFilters, loadFilterOptions, syncFiltersWithUrl } =
  useMarketplace()

const showAdvancedFilters = ref(false)
const activeFiltersCount = computed(() => {
  let count = 0
  if (filters.value.experience_min) count++
  if (filters.value.experience_max) count++
  if (filters.value.direction) count++
  if (filters.value.format) count++
  if (filters.value.timezone) count++
  if (filters.value.has_certifications) count++
  return count
})

onMounted(async () => {
  syncFiltersWithUrl()
  await Promise.all([loadTutors(true), loadFilterOptions()])
})

function handleFiltersUpdate(newFilters: Partial<any>) {
  setFilters(newFilters as Partial<CatalogFiltersType>)
}

function handleSortUpdate(sort: string) {
  setSort(sort)
}

function handleLoadMore() {
  loadMore()
}

function handlePageChange(page: number) {
  setPage(page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function handleClearFilters() {
  clearFilters()
}

function handleOpenAdvanced() {
  showAdvancedFilters.value = true
}

function handleCloseAdvanced() {
  showAdvancedFilters.value = false
}

function handleRetry() {
  loadTutors(true)
}

watch(
  () => ({
    ...filters.value,
    sort: sortBy.value,
  }),
  (payload) => {
    // no PII
    telemetry.trigger('marketplace_search', {
      has_q: typeof payload.q === 'string' ? payload.q.length >= 2 : false,
      language_count: Array.isArray(payload.language) ? payload.language.length : 0,
      subject_count: Array.isArray(payload.subject) ? payload.subject.length : 0,
      has_price_min: typeof payload.price_min === 'number',
      has_price_max: typeof payload.price_max === 'number',
      has_experience_min: typeof payload.experience_min === 'number',
      has_experience_max: typeof payload.experience_max === 'number',
      direction: payload.direction || null,
      format: payload.format || null,
      has_certifications: payload.has_certifications ?? null,
      sort: payload.sort,
    })
  },
  { deep: true }
)
</script>

<template>
  <div class="catalog-view" data-test="marketplace-catalog">
    <div class="catalog-page">
      <!-- Hero -->
      <MarketplaceHero />

      <!-- Trust Strip -->
      <TrustStrip />

      <!-- Filter Bar -->
      <CatalogFilterBar
      :filters="filters"
      :options="filterOptions"
      :active-filters-count="activeFiltersCount"
      @update="handleFiltersUpdate"
      @clear="handleClearFilters"
      @open-advanced="handleOpenAdvanced"
    />

    <!-- Advanced Filters Modal -->
    <AdvancedFiltersModal
      :show="showAdvancedFilters"
      :filters="filters"
      :options="filterOptions"
      @update="handleFiltersUpdate"
      @close="handleCloseAdvanced"
      @apply="handleCloseAdvanced"
    />

      <!-- Results bar -->
      <div class="results-bar">
        <div class="results-count">
          <span v-if="totalCount > 0">{{ t('marketplace.catalog.resultsCount', { count: totalCount }) }}</span>
        </div>
        <div class="sort-wrap">
          <CatalogSort :value="sortBy" @update="handleSortUpdate" />
        </div>
      </div>

      <div class="catalog-main">

        <LoadingSpinner v-if="isLoading && tutors.length === 0" data-test="marketplace-loading" />

        <EmptyState
          v-else-if="!isLoading && !!error"
          data-test="marketplace-error"
          :title="t('marketplace.catalog.errorTitle')"
          :description="t('marketplace.catalog.errorDescription')"
          icon="alert"
        >
          <div class="error-actions">
            <Button variant="secondary" data-test="marketplace-retry" @click="handleRetry">
              {{ t('common.retry') }}
            </Button>
            <Button variant="primary" data-test="marketplace-clear" @click="handleClearFilters">
              {{ t('marketplace.catalog.clearFilters') }}
            </Button>
          </div>
        </EmptyState>

        <TutorGrid v-else :tutors="tutors" :loading="isLoading" />

        <!-- Pagination -->
        <CatalogPagination
          v-if="!isLoading && tutors.length > 0 && totalPages > 1"
          :current-page="currentPage"
          :total-pages="totalPages"
          :total-count="totalCount"
          :page-size="pageSize"
          @update:page="handlePageChange"
        />

        <EmptyState
          v-if="!isLoading && tutors.length === 0"
          data-test="marketplace-empty"
          :title="t('marketplace.catalog.emptyTitle')"
          :description="t('marketplace.catalog.emptyDescription')"
          icon="search"
        >
          <Button variant="primary" @click="handleClearFilters">
            {{ t('marketplace.catalog.clearFilters') }}
          </Button>
        </EmptyState>
      </div>
    </div>
  </div>
</template>

<style scoped>
.catalog-view {
  min-height: 100vh;
  background: var(--bg, #f5f7f6);
}

.catalog-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 32px 28px 80px;
}

.results-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}

.results-count {
  font-size: 13px;
  font-weight: 700;
  color: var(--text, #111816);
}

.sort-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.catalog-main {
  min-width: 0;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 1.5rem;
}

@media (max-width: 768px) {
  .catalog-page {
    padding: 16px 12px 60px;
  }
}
</style>
