<script setup lang="ts">
// TASK F2: Search Results View
import { ref, computed, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { SlidersHorizontal } from 'lucide-vue-next'
import { useSearchStore } from '../stores/searchStore'
import type { SearchFilters } from '../api/marketplace'
import { useI18n } from 'vue-i18n'

// Components
import SearchBar from '../components/search/SearchBar.vue'
import FilterChips from '../components/catalog/FilterChips.vue'
import CatalogFilters from '../components/catalog/CatalogFilters.vue'
import CatalogSort from '../components/catalog/CatalogSort.vue'
import TutorGrid from '../components/catalog/TutorGrid.vue'
import FiltersStatusBanner from '../components/filters/FiltersStatusBanner.vue'

const store = useSearchStore()
const {
  filters,
  results,
  totalCount,
  isLoading,
  searchTime,
  hasMore,
  hasFilters,
  activeFiltersCount,
  filterOptions,
  isLoadingOptions,
  sortBy,
  filtersCacheExpired,
  filtersCacheLastUpdated,
} = storeToRefs(store)

const searchQuery = ref('')
const showFilters = ref(false)
const loadMoreTrigger = ref<HTMLElement | null>(null)

const { t } = useI18n()

// Intersection observer for infinite scroll
let observer: IntersectionObserver | null = null

onMounted(async () => {
  store.syncFiltersFromUrl()
  searchQuery.value = filters.value.query

  await Promise.all([store.loadFilterOptions(), store.search(true)])

  // Setup infinite scroll
  if (loadMoreTrigger.value) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore.value && !isLoading.value) {
          store.loadMore()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(loadMoreTrigger.value)
  }
})

// Watch for query changes
watch(
  () => filters.value.query,
  (newQuery) => {
    searchQuery.value = newQuery
  }
)

const handleSearch = (query: string) => {
  store.setFilter('query', query)
}

const handleClear = () => {
  store.setFilter('query', '')
}

const handleFiltersUpdate = (newFilters: Partial<SearchFilters>) => {
  store.setFilters(newFilters)
}

const handleRemoveFilter = (key: string) => {
  store.setFilter(key as keyof SearchFilters, null as any)
}

const handleClearFilters = () => {
  store.clearFilters()
}

const handleSortUpdate = (sort: string) => {
  store.setSort(sort)
}

const toggleFilters = () => {
  showFilters.value = !showFilters.value
}

const handleRefreshFilters = async () => {
  await store.refreshFilters()
}
</script>

<template>
  <div class="search-results-view">
    <!-- Search Header -->
    <header class="search-header">
      <SearchBar
        v-model="searchQuery"
        :loading="isLoading"
        @search="handleSearch"
        @clear="handleClear"
      />

      <div v-if="totalCount > 0" class="search-meta">
        <span class="results-count">
          {{ t('marketplace.search.resultsCount', { count: totalCount }) }}
        </span>
        <span v-if="searchTime > 0" class="search-time"> ({{ searchTime }}ms) </span>
      </div>
    </header>

    <!-- Cache Status Banner -->
    <FiltersStatusBanner
      :cache-expired="filtersCacheExpired"
      :last-updated="filtersCacheLastUpdated"
      :on-refresh="handleRefreshFilters"
    />

    <!-- Active Filters -->
    <FilterChips
      v-if="hasFilters"
      :filters="filters"
      :options="filterOptions"
      @remove="handleRemoveFilter"
      @clear="handleClearFilters"
    />

    <div class="search-layout">
      <!-- Filters Sidebar -->
      <aside class="filters-sidebar" :class="{ 'is-open': showFilters }">
        <div class="sidebar-header">
          <h3>{{ t('marketplace.filters.title') }}</h3>
          <button class="close-btn" @click="showFilters = false">×</button>
        </div>
        <CatalogFilters
          :filters="filters"
          :options="filterOptions"
          :loading="isLoadingOptions"
          @update="handleFiltersUpdate"
        />
      </aside>

      <!-- Overlay for mobile -->
      <div
        v-if="showFilters"
        class="filters-overlay"
        @click="showFilters = false"
      />

      <!-- Results -->
      <main class="results-main">
        <!-- Sort & View Options -->
        <div class="results-toolbar">
          <button class="btn-filters-toggle" @click="toggleFilters">
            <SlidersHorizontal :size="18" />
            {{ t('marketplace.filters.title') }}
            <span v-if="activeFiltersCount" class="badge">
              {{ activeFiltersCount }}
            </span>
          </button>

          <CatalogSort :value="sortBy" @update="handleSortUpdate" />
        </div>

        <!-- Results Grid -->
        <TutorGrid :tutors="results" :loading="isLoading && results.length === 0" />

        <!-- Infinite Scroll Trigger -->
        <div v-if="hasMore" ref="loadMoreTrigger" class="load-more-trigger">
          <div v-if="isLoading" class="loading-spinner">
            <div class="spinner" />
          </div>
        </div>

        <!-- Empty State -->
        <div v-if="!isLoading && results.length === 0" class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>{{ t('marketplace.catalog.emptyTitle') }}</h3>
          <p>{{ t('marketplace.catalog.emptyDescription') }}</p>
          <button class="btn btn-primary" @click="handleClearFilters">
            {{ t('marketplace.catalog.clearFilters') }}
          </button>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.search-results-view {
  min-height: 100vh;
  background: var(--surface-marketplace);
}

.search-header {
  background: var(--surface-card);
  padding: 24px;
  border-bottom: 1px solid var(--border-color);
}

.search-meta {
  margin-top: 12px;
  font-size: 14px;
  color: var(--text-muted);
}

.search-time {
  margin-left: 4px;
  opacity: 0.7;
}

.search-layout {
  display: flex;
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  gap: 24px;
}

.filters-sidebar {
  width: 280px;
  flex-shrink: 0;
  background: var(--surface-card);
  border-radius: 12px;
  padding: 20px;
  height: fit-content;
  position: sticky;
  top: 24px;
}

.sidebar-header {
  display: none;
}

.results-main {
  flex: 1;
  min-width: 0;
}

.results-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
}

.btn-filters-toggle {
  display: none;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-filters-toggle:hover {
  border-color: var(--accent-primary);
}

.btn-filters-toggle .badge {
  background: var(--accent-primary);
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}

.load-more-trigger {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  display: flex;
  justify-content: center;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  background: var(--surface-card);
  border-radius: 12px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 8px;
  color: var(--text-primary);
}

.empty-state p {
  color: var(--text-muted);
  margin: 0 0 24px;
}

.filters-overlay {
  display: none;
}

@media (max-width: 1024px) {
  .filters-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 100%;
    max-width: 320px;
    background: var(--surface-card);
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    border-radius: 0;
    padding: 0;
    overflow-y: auto;
  }

  .filters-sidebar.is-open {
    transform: translateX(0);
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border-color);
  }

  .sidebar-header h3 {
    margin: 0;
    font-size: 1.125rem;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted);
  }

  .btn-filters-toggle {
    display: flex;
  }

  .filters-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, var(--text-primary) 50%, transparent);
    z-index: 99;
  }
}

@media (max-width: 640px) {
  .search-layout {
    padding: 16px;
  }

  .results-toolbar {
    flex-wrap: wrap;
  }
}
</style>
