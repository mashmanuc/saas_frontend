<script setup lang="ts">
// TASK MF3: Tutor Catalog View
import { onMounted, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMarketplaceStore } from '../stores/marketplaceStore'
import CatalogFilters from '../components/catalog/CatalogFilters.vue'
import CatalogSort from '../components/catalog/CatalogSort.vue'
import TutorGrid from '../components/catalog/TutorGrid.vue'
import EmptyState from '@/ui/EmptyState.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import type { CatalogFilters as CatalogFiltersType } from '../api/marketplace'

const store = useMarketplaceStore()
const {
  tutors,
  totalCount,
  isLoading,
  hasMore,
  filters,
  sortBy,
  filterOptions,
} = storeToRefs(store)

const showFilters = computed(() => filterOptions.value !== null)

onMounted(async () => {
  await Promise.all([store.loadTutors(true), store.loadFilterOptions()])
})

function handleFiltersUpdate(newFilters: CatalogFiltersType) {
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
</script>

<template>
  <div class="catalog-view">
    <header class="catalog-header">
      <div class="header-content">
        <h1>Find Your Perfect Tutor</h1>
        <p class="subtitle">
          Browse {{ totalCount }} tutors ready to help you learn
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
            {{ totalCount }} tutor{{ totalCount !== 1 ? 's' : '' }} found
          </span>
        </div>

        <LoadingSpinner v-if="isLoading && tutors.length === 0" />

        <TutorGrid v-else :tutors="tutors" :loading="isLoading" />

        <div v-if="hasMore && tutors.length > 0" class="load-more">
          <button
            class="btn btn-secondary"
            :disabled="isLoading"
            @click="handleLoadMore"
          >
            {{ isLoading ? 'Loading...' : 'Load More' }}
          </button>
        </div>

        <EmptyState
          v-if="!isLoading && tutors.length === 0"
          title="No tutors found"
          description="Try adjusting your filters or search criteria"
          icon="search"
        >
          <button class="btn btn-primary" @click="handleClearFilters">
            Clear Filters
          </button>
        </EmptyState>
      </main>
    </div>
  </div>
</template>

<style scoped>
.catalog-view {
  min-height: 100vh;
  background: #f9fafb;
}

.catalog-header {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
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
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
</style>
