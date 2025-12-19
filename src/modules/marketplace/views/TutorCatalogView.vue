<script setup lang="ts">
// TASK MF3: Tutor Catalog View
import { onMounted, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import CatalogFilters from '../components/catalog/CatalogFilters.vue'
import CatalogSort from '../components/catalog/CatalogSort.vue'
import TutorGrid from '../components/catalog/TutorGrid.vue'
import EmptyState from '@/ui/EmptyState.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import type { CatalogFilters as CatalogFiltersType } from '../api/marketplace'
import { telemetry } from '@/services/telemetry'
import { useI18n } from 'vue-i18n'

const store = useMarketplaceStore()
const { t } = useI18n()
const {
  tutors,
  totalCount,
  isLoading,
  hasMore,
  filters,
  sortBy,
  filterOptions,
  error,
} = storeToRefs(store)

const showFilters = computed(() => filterOptions.value !== null)

onMounted(async () => {
  await Promise.all([store.loadTutors(true), store.loadFilterOptions()])
})

function handleFiltersUpdate(newFilters: Partial<CatalogFiltersType>) {
  store.setFilters(newFilters)
}

function handleSortUpdate(sort: string) {
  store.setSort(sort)
}

function handleLoadMore() {
  store.loadMore()
}

function handleClearFilters() {
  store.clearFilters()
}

function handleRetry() {
  store.loadTutors(true)
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
    <header class="catalog-header">
      <div class="header-content">
        <h1>{{ t('marketplace.catalog.title') }}</h1>
        <p class="subtitle">
          {{ t('marketplace.catalog.subtitle', { count: totalCount }) }}
        </p>
      </div>
    </header>

    <div class="catalog-layout">
      <aside v-if="showFilters" class="catalog-sidebar">
        <CatalogFilters
          :filters="filters"
          :options="filterOptions"
          @update="handleFiltersUpdate"
          @clear="handleClearFilters"
        />
      </aside>

      <main class="catalog-main">
        <div class="catalog-toolbar">
          <CatalogSort :value="sortBy" @update="handleSortUpdate" />
          <span class="results-count">
            {{ t('marketplace.catalog.resultsCount', { count: totalCount }) }}
          </span>
        </div>

        <LoadingSpinner v-if="isLoading && tutors.length === 0" data-test="marketplace-loading" />

        <EmptyState
          v-else-if="!isLoading && !!error"
          data-test="marketplace-error"
          :title="t('marketplace.catalog.errorTitle')"
          :description="t('marketplace.catalog.errorDescription')"
          icon="alert"
        >
          <div class="error-actions">
            <button class="btn btn-secondary" data-test="marketplace-retry" @click="handleRetry">
              {{ t('common.retry') }}
            </button>
            <button class="btn btn-primary" data-test="marketplace-clear" @click="handleClearFilters">
              {{ t('marketplace.catalog.clearFilters') }}
            </button>
          </div>
        </EmptyState>

        <TutorGrid v-else :tutors="tutors" :loading="isLoading" />

        <div v-if="hasMore && tutors.length > 0" class="load-more">
          <button
            class="btn btn-secondary"
            :disabled="isLoading"
            data-test="marketplace-load-more"
            @click="handleLoadMore"
          >
            {{ isLoading ? t('marketplace.catalog.loading') : t('marketplace.catalog.loadMore') }}
          </button>
        </div>

        <EmptyState
          v-if="!isLoading && tutors.length === 0"
          data-test="marketplace-empty"
          :title="t('marketplace.catalog.emptyTitle')"
          :description="t('marketplace.catalog.emptyDescription')"
          icon="search"
        >
          <button class="btn btn-primary" @click="handleClearFilters">
            {{ t('marketplace.catalog.clearFilters') }}
          </button>
        </EmptyState>
      </main>
    </div>
  </div>
</template>

<style scoped>
.catalog-view {
  min-height: 100vh;
  background: var(--surface-marketplace);
}

.catalog-header {
  background: var(--bg-gradient);
  color: var(--text-primary);
  padding: 3rem 1.5rem;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
}

.catalog-header h1 {
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.5rem;
}

.subtitle {
  font-size: 1.125rem;
  opacity: 0.9;
  margin: 0;
}

.catalog-layout {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .catalog-layout {
    grid-template-columns: 1fr;
  }

  .catalog-sidebar {
    display: none;
  }
}

.catalog-sidebar {
  position: sticky;
  top: 1.5rem;
  height: fit-content;
}

.catalog-main {
  min-width: 0;
}

.catalog-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding: 1rem;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
}

.results-count {
  font-size: 0.875rem;
  color: #6b7280;
}

.load-more {
  display: flex;
  justify-content: center;
  padding: 2rem 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: white;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #f9fafb;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}
</style>
