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
import { catalogApi, type CatalogSearchResult } from '@/modules/knowledge/api/catalogApi'

const { t } = useI18n()
const { tutors, totalCount, totalPages, currentPage, pageSize, isLoading, hasMore, filters, sortBy, filterOptions, error, setFilters, setSort, setPage, loadTutors, loadMore, clearFilters, loadFilterOptions, syncFiltersWithUrl } =
  useMarketplace()

const showAdvancedFilters = ref(false)
const featuredLessons = ref<CatalogSearchResult[]>([])
const isLoadingFeatured = ref(true)
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
  // syncFiltersWithUrl вже викликається в useMarketplace composable (onMounted)
  await Promise.all([loadTutors(true), loadFilterOptions()])

  // Phase 16 INT-34: Load featured lessons (non-blocking)
  try {
    const data = await catalogApi.getFeatured()
    featuredLessons.value = data.slice(0, 3)
  } catch {
    // silent — featured section simply won't show
  } finally {
    isLoadingFeatured.value = false
  }
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
  }
)
</script>

<template>
  <div class="catalog-view" data-test="marketplace-catalog">
    <div class="catalog-page">
      <!-- Hero -->
      <MarketplaceHero />

      <!-- Trust Strip -->
      <TrustStrip />

      <!-- Phase 16 INT-34: Featured lessons from Knowledge catalog -->
      <section v-if="!isLoadingFeatured && featuredLessons.length > 0" class="featured-lessons" data-test="featured-lessons">
        <h2 class="featured-lessons__title">{{ t('marketplace.featuredLessons') }}</h2>
        <div class="featured-lessons__grid">
          <router-link
            v-for="lesson in featuredLessons"
            :key="lesson.id"
            :to="`/lesson/${lesson.tutor?.slug || ''}/${lesson.slug}`"
            class="featured-lessons__card"
          >
            <div v-if="lesson.board_thumbnail_url" class="featured-lessons__thumb">
              <img :src="lesson.board_thumbnail_url" :alt="lesson.title" loading="lazy" />
            </div>
            <div v-else class="featured-lessons__thumb featured-lessons__thumb--empty">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" stroke="#94a3b8" stroke-width="1.5"/><path d="M8 10h8M8 14h5" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/></svg>
            </div>
            <div class="featured-lessons__info">
              <h3 class="featured-lessons__name">{{ lesson.title }}</h3>
              <span v-if="lesson.tutor?.name" class="featured-lessons__author">{{ lesson.tutor.name }}</span>
              <div v-if="lesson.average_rating != null" class="featured-lessons__rating">
                <span class="featured-lessons__star">★</span>
                {{ lesson.average_rating.toFixed(1) }}
              </div>
            </div>
          </router-link>
        </div>
      </section>

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

        <!-- Phase 16 INT-23: Knowledge Catalog CTA -->
        <div class="lesson-catalog-cta">
          <p class="lesson-catalog-cta__text">{{ t('marketplace.lessonCatalogCTA') }}</p>
          <router-link to="/knowledge/catalog" class="lesson-catalog-cta__link">
            {{ t('marketplace.lessonCatalogCTALink') }} →
          </router-link>
        </div>
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

/* ── Phase 16 INT-34: Featured lessons ────────────────────────────── */
.featured-lessons {
  margin-bottom: 24px;
}

.featured-lessons__title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text, #111816);
  margin: 0 0 12px;
}

.featured-lessons__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 768px) {
  .featured-lessons__grid {
    grid-template-columns: 1fr;
  }
}

.featured-lessons__card {
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.featured-lessons__card:hover {
  border-color: #6366f1;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.featured-lessons__thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  background: #f8fafc;
}

.featured-lessons__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.featured-lessons__thumb--empty {
  display: flex;
  align-items: center;
  justify-content: center;
}

.featured-lessons__info {
  padding: 12px;
}

.featured-lessons__name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.featured-lessons__author {
  display: block;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 4px;
}

.featured-lessons__rating {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
  color: #f59e0b;
}

.featured-lessons__star {
  font-size: 13px;
}

/* ── Phase 16 INT-23: Lesson catalog CTA ────────────────────────── */
.lesson-catalog-cta {
  margin-top: 24px;
  padding: 16px 20px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 10px;
  text-align: center;
}

.lesson-catalog-cta__text {
  font-size: 14px;
  color: #1e40af;
  margin: 0 0 8px;
}

.lesson-catalog-cta__link {
  font-size: 14px;
  font-weight: 600;
  color: #2563eb;
  text-decoration: none;
}

.lesson-catalog-cta__link:hover {
  text-decoration: underline;
}

@media (max-width: 768px) {
  .catalog-page {
    padding: 16px 12px 60px;
  }
}
</style>
