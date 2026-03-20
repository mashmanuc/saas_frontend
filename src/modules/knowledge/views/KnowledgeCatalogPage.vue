<!-- Phase 15 A1.2: Knowledge Catalog Page — public lesson catalog with categories, search, ratings
     No auth required. CDN-cacheable data via catalogApi.
     Ref: AGENT_A_FE_CORE.md A1.2 -->
<template>
  <div class="catalog-page">
    <BreadcrumbNav :items="breadcrumbs" />
    <!-- Header -->
    <header class="catalog-page__header">
      <div class="catalog-page__header-inner">
        <h1 class="catalog-page__title">{{ $t('sidebar.item.lessonCatalog') }}</h1>
        <div class="catalog-page__search-wrap">
          <svg class="catalog-page__search-icon" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12.5 12.5L16 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <input
            v-model="filters.query"
            type="search"
            class="catalog-page__search-input"
            :placeholder="$t('knowledge.catalog.filter.searchPlaceholder')"
          />
        </div>
      </div>
    </header>

    <div class="catalog-page__body">
      <!-- Sidebar: categories -->
      <aside class="catalog-page__sidebar" :class="{ 'catalog-page__sidebar--open': sidebarOpen }">
        <div class="catalog-page__sidebar-head">
          <h2 class="catalog-page__sidebar-title">{{ $t('knowledge.catalog.filter.categories') }}</h2>
          <button
            type="button"
            class="catalog-page__sidebar-close"
            :aria-label="$t('knowledge.catalog.filter.closeCategories')"
            @click="sidebarOpen = false"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>

        <div v-if="categories.length === 0" class="catalog-page__cat-loading">
          <div v-for="i in 5" :key="i" class="catalog-page__cat-skeleton" />
        </div>

        <nav v-else class="catalog-page__cat-list" :aria-label="$t('knowledge.catalog.filter.categories')">
          <button
            type="button"
            class="catalog-page__cat-item"
            :class="{ 'catalog-page__cat-item--active': !filters.category }"
            @click="filters.category = undefined; sidebarOpen = false"
          >
            <span class="catalog-page__cat-icon">📚</span>
            <span class="catalog-page__cat-name">{{ $t('knowledge.catalog.allCategories') }}</span>
            <span class="catalog-page__cat-count">{{ totalCount }}</span>
          </button>

          <!-- Level 6: Personalized sidebar -->
          <template v-if="hasPersonalization">
            <div class="catalog-page__cat-section-label">{{ $t('knowledge.catalog.mySubjects') }}</div>
            <template v-for="cat in visibleMyCategories" :key="cat.id">
              <button
                type="button"
                class="catalog-page__cat-item"
                :class="{ 'catalog-page__cat-item--active': filters.category === cat.slug }"
                @click="filters.category = cat.slug; sidebarOpen = false"
              >
                <component :is="getCatIcon(cat.icon)" v-if="getCatIcon(cat.icon)" class="catalog-page__cat-icon" :size="18" />
                <span v-else class="catalog-page__cat-icon">📖</span>
                <span class="catalog-page__cat-name">{{ cat.name }}</span>
                <span class="catalog-page__cat-count">{{ cat.lesson_count }}</span>
              </button>
              <button
                v-for="child in cat.children" :key="child.id"
                type="button"
                class="catalog-page__cat-item catalog-page__cat-item--child"
                :class="{ 'catalog-page__cat-item--active': filters.category === child.slug }"
                @click="filters.category = child.slug; sidebarOpen = false"
              >
                <span class="catalog-page__cat-name">{{ child.name }}</span>
                <span class="catalog-page__cat-count">{{ child.lesson_count }}</span>
              </button>
            </template>

            <button
              v-if="visibleOtherCategories.length > 0"
              type="button"
              class="catalog-page__cat-toggle"
              @click="showOther = !showOther"
            >
              {{ showOther ? $t('knowledge.catalog.hideOther') : $t('knowledge.catalog.showAll', { count: visibleOtherCategories.length }) }}
            </button>

            <template v-if="showOther">
              <template v-for="cat in visibleOtherCategories" :key="cat.id">
                <button
                  type="button"
                  class="catalog-page__cat-item"
                  :class="{ 'catalog-page__cat-item--active': filters.category === cat.slug }"
                  @click="filters.category = cat.slug; sidebarOpen = false"
                >
                  <component :is="getCatIcon(cat.icon)" v-if="getCatIcon(cat.icon)" class="catalog-page__cat-icon" :size="18" />
                  <span v-else class="catalog-page__cat-icon">📖</span>
                  <span class="catalog-page__cat-name">{{ cat.name }}</span>
                  <span class="catalog-page__cat-count">{{ cat.lesson_count }}</span>
                </button>
                <button
                  v-for="child in cat.children" :key="child.id"
                  type="button"
                  class="catalog-page__cat-item catalog-page__cat-item--child"
                  :class="{ 'catalog-page__cat-item--active': filters.category === child.slug }"
                  @click="filters.category = child.slug; sidebarOpen = false"
                >
                  <span class="catalog-page__cat-name">{{ child.name }}</span>
                  <span class="catalog-page__cat-count">{{ child.lesson_count }}</span>
                </button>
              </template>
            </template>
          </template>

          <!-- Fallback: non-personalized (anonymous or no subjects) -->
          <template v-else>
            <template v-for="cat in visibleCategories" :key="cat.id">
              <button
                type="button"
                class="catalog-page__cat-item"
                :class="{ 'catalog-page__cat-item--active': filters.category === cat.slug }"
                @click="filters.category = cat.slug; sidebarOpen = false"
              >
                <component :is="getCatIcon(cat.icon)" v-if="getCatIcon(cat.icon)" class="catalog-page__cat-icon" :size="18" />
                <span v-else class="catalog-page__cat-icon">📖</span>
                <span class="catalog-page__cat-name">{{ cat.name }}</span>
                <span class="catalog-page__cat-count">{{ cat.lesson_count }}</span>
              </button>
              <button
                v-for="child in cat.children" :key="child.id"
                type="button"
                class="catalog-page__cat-item catalog-page__cat-item--child"
                :class="{ 'catalog-page__cat-item--active': filters.category === child.slug }"
                @click="filters.category = child.slug; sidebarOpen = false"
              >
                <span class="catalog-page__cat-name">{{ child.name }}</span>
                <span class="catalog-page__cat-count">{{ child.lesson_count }}</span>
              </button>
            </template>
          </template>
        </nav>
      </aside>

      <!-- Main content -->
      <main class="catalog-page__main">
        <!-- Mobile category toggle -->
        <button
          type="button"
          class="catalog-page__mobile-cat-btn"
          @click="sidebarOpen = true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          {{ activeCategoryName }}
        </button>

        <!-- B3.1: Tutor filter indicator -->
        <div v-if="filters.tutor" class="catalog-page__active-filter">
          <span>{{ $t('knowledge.catalog.filteredByTutor') }}: <strong>{{ filters.tutor }}</strong></span>
          <button type="button" class="catalog-page__clear-filter" @click="clearTutorFilter">✕</button>
        </div>

        <!-- CAT-3: Smart toolbar — sort always visible, advanced filters only if ≥10 lessons -->
        <div class="catalog-page__toolbar">
          <div class="catalog-page__filter-group">
            <label class="catalog-page__filter-label">{{ $t('knowledge.catalog.filter.sort') }}</label>
            <select v-model="filters.sort" class="catalog-page__select">
              <option value="popular">{{ $t('knowledge.catalog.filter.popular') }}</option>
              <option value="newest">{{ $t('knowledge.catalog.filter.newest') }}</option>
              <option value="top-rated">{{ $t('knowledge.catalog.filter.topRated') }}</option>
            </select>
          </div>

          <template v-if="totalCount >= 10">
            <div class="catalog-page__filter-group">
              <label class="catalog-page__filter-label">{{ $t('knowledge.catalog.filter.minRating') }}</label>
              <div class="catalog-page__star-filter">
                <button
                  v-for="star in 5"
                  :key="star"
                  type="button"
                  class="catalog-page__star-btn"
                  :class="{ 'catalog-page__star-btn--active': (filters.min_rating ?? 0) >= star }"
                  :aria-label="$t('knowledge.catalog.filter.minStars', { n: star })"
                  @click="filters.min_rating = filters.min_rating === star ? undefined : star"
                >★</button>
              </div>
            </div>

            <div class="catalog-page__filter-group">
              <label class="catalog-page__filter-label">{{ $t('knowledge.catalog.filter.difficulty') }}</label>
              <select v-model="filters.difficulty" class="catalog-page__select">
                <option :value="undefined">{{ $t('knowledge.catalog.filter.diffAll') }}</option>
                <option :value="1">{{ $t('knowledge.catalog.filter.diff1') }}</option>
                <option :value="2">{{ $t('knowledge.catalog.filter.diff2') }}</option>
                <option :value="3">{{ $t('knowledge.catalog.filter.diff3') }}</option>
                <option :value="4">{{ $t('knowledge.catalog.filter.diff4') }}</option>
                <option :value="5">{{ $t('knowledge.catalog.filter.diff5') }}</option>
              </select>
            </div>

            <div class="catalog-page__filter-group">
              <label class="catalog-page__filter-label">{{ $t('knowledge.catalog.filter.language') }}</label>
              <select v-model="filters.language" class="catalog-page__select">
                <option :value="undefined">{{ $t('knowledge.catalog.filter.langAll') }}</option>
                <option value="uk">{{ $t('knowledge.catalog.filter.lang.uk') }}</option>
                <option value="en">{{ $t('knowledge.catalog.filter.lang.en') }}</option>
                <option value="pl">{{ $t('knowledge.catalog.filter.lang.pl') }}</option>
              </select>
            </div>
          </template>
        </div>

        <!-- Error -->
        <div v-if="error" class="catalog-page__error">
          <p>{{ error }}</p>
          <button type="button" class="catalog-page__retry-btn" @click="searchLessons(true)">
            {{ $t('knowledge.catalog.filter.retryBtn') }}
          </button>
        </div>

        <!-- Loading skeleton -->
        <div v-else-if="isLoading && lessons.length === 0" class="catalog-page__grid">
          <div v-for="i in 6" :key="i" class="catalog-page__card-skeleton">
            <div class="catalog-page__card-skeleton-img" />
            <div class="catalog-page__card-skeleton-text" />
            <div class="catalog-page__card-skeleton-text catalog-page__card-skeleton-text--short" />
          </div>
        </div>

        <!-- CAT-2: Empty state for specific category (no search query) -->
        <div
          v-else-if="!isLoading && lessons.length === 0 && filters.category && !filters.query"
          class="catalog-page__empty"
        >
          <BookOpen :size="48" class="catalog-page__empty-icon" />
          <h3 class="catalog-page__empty-title">
            {{ $t('knowledge.catalog.categoryEmptyTitle', { category: activeCategoryName }) }}
          </h3>
          <p class="catalog-page__empty-text">
            {{ isTutor
              ? $t('knowledge.catalog.categoryEmptyTextTutor')
              : $t('knowledge.catalog.categoryEmptyTextStudent')
            }}
          </p>
          <router-link
            v-if="isTutor"
            to="/winterboard"
            class="catalog-page__empty-btn catalog-page__empty-btn--primary"
          >
            <PenTool :size="18" />
            {{ $t('knowledge.catalog.categoryEmptyPublish') }}
          </router-link>
          <button
            v-else
            type="button"
            class="catalog-page__reset-btn"
            @click="filters.category = undefined"
          >
            {{ $t('knowledge.catalog.categoryEmptyBack') }}
          </button>
        </div>

        <!-- Empty state: active filters → no results -->
        <div v-else-if="!isLoading && lessons.length === 0 && hasActiveFilters" class="catalog-page__empty">
          <Search :size="48" class="catalog-page__empty-icon" />
          <h3 class="catalog-page__empty-title">{{ $t('knowledge.catalog.emptyTitle') }}</h3>
          <p class="catalog-page__empty-text">{{ $t('knowledge.catalog.emptySubtitle') }}</p>
          <button type="button" class="catalog-page__reset-btn" @click="resetFilters">
            {{ $t('knowledge.catalog.resetFilters') }}
          </button>
        </div>

        <!-- Empty state: catalog globally empty -->
        <div v-else-if="!isLoading && lessons.length === 0 && !hasActiveFilters" class="catalog-page__empty catalog-page__empty--welcome">
          <BookOpen :size="48" class="catalog-page__empty-icon" />
          <h3 class="catalog-page__empty-title">{{ $t('knowledge.catalog.globalEmptyTitle') }}</h3>
          <p class="catalog-page__empty-text">{{ $t('knowledge.catalog.globalEmptyText') }}</p>
          <div class="catalog-page__empty-actions">
            <router-link to="/winterboard" class="catalog-page__empty-btn catalog-page__empty-btn--primary">
              <PenTool :size="18" />
              {{ $t('knowledge.catalog.createLesson') }}
            </router-link>
            <router-link to="/knowledge" class="catalog-page__empty-btn">
              {{ $t('knowledge.catalog.goToMyLessons') }}
            </router-link>
          </div>
        </div>

        <!-- Lesson grid -->
        <div v-else class="catalog-page__grid">
          <a
            v-for="lesson in lessons"
            :key="lesson.id"
            :href="`/lesson/${lesson.tutor?.slug}/${lesson.slug}`"
            class="catalog-page__card"
          >
            <div class="catalog-page__card-img-wrap">
              <img
                v-if="lesson.board_thumbnail_url"
                :src="lesson.board_thumbnail_url"
                :alt="lesson.title"
                class="catalog-page__card-img"
                loading="lazy"
                @error="() => { lesson.board_thumbnail_url = '' }"
              />
              <div v-else class="catalog-page__card-img-placeholder">
                <span class="catalog-page__card-letter">{{ lesson.title?.[0]?.toUpperCase() || '?' }}</span>
              </div>
            </div>
            <div class="catalog-page__card-body">
              <h3 class="catalog-page__card-title">{{ lesson.title }}</h3>
              <div class="catalog-page__card-meta">
                <a
                  :href="`/marketplace/${lesson.tutor?.slug}`"
                  class="catalog-page__card-author catalog-page__card-author--link"
                  @click.stop
                >{{ lesson.tutor?.name }}</a>
                <span v-if="lesson.category_name" class="catalog-page__card-category">{{ lesson.category_name }}</span>
              </div>
              <div v-if="lesson.average_rating != null" class="catalog-page__card-rating">
                <span class="catalog-page__card-stars">★ {{ lesson.average_rating.toFixed(1) }}</span>
                <span class="catalog-page__card-rating-count">({{ lesson.rating_count }})</span>
              </div>
              <!-- Phase 27 E2: Views count badge -->
              <div v-if="lesson.views_count != null" class="catalog-page__card-views">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" stroke-width="1.2"/>
                  <circle cx="7" cy="7" r="2" stroke="currentColor" stroke-width="1.2"/>
                </svg>
                <span>{{ lesson.views_count }}</span>
              </div>
              <!-- Phase 16 INT-31: Fork badge -->
              <ForkBadge v-if="(lesson as any).parent_lesson" :parent-lesson="(lesson as any).parent_lesson" />
            </div>
          </a>
        </div>

        <!-- Load more -->
        <div v-if="hasMore() && !isLoading" class="catalog-page__load-more-wrap">
          <button type="button" class="catalog-page__load-more-btn" @click="loadMore">
            {{ $t('knowledge.catalog.loadMore') }}
          </button>
        </div>
        <div v-if="isLoading && lessons.length > 0" class="catalog-page__loading-more">
          <div class="catalog-page__spinner" />
        </div>

        <!-- CAT-1: Recently added (transparent logic — sorted by date) -->
        <section v-if="recentlyAddedLessons.length > 0 && !hasActiveFilters" class="catalog-page__recent">
          <h2 class="catalog-page__section-title">{{ $t('knowledge.catalog.recentlyAdded') }}</h2>
          <div class="catalog-page__grid catalog-page__grid--recent">
            <a
              v-for="lesson in recentlyAddedLessons"
              :key="lesson.id"
              :href="`/lesson/${lesson.tutor?.slug}/${lesson.slug}`"
              class="catalog-page__card"
            >
              <div class="catalog-page__card-body">
                <h3 class="catalog-page__card-title">{{ lesson.title }}</h3>
                <div class="catalog-page__card-meta">
                  <span class="catalog-page__card-author">{{ lesson.tutor?.name }}</span>
                  <span v-if="lesson.category_name" class="catalog-page__card-category">{{ lesson.category_name }}</span>
                </div>
              </div>
            </a>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import BreadcrumbNav from '@/components/ui/BreadcrumbNav.vue'
import { useCatalog } from '../composables/useCatalog'
import { catalogApi, type SubjectCategory } from '../api/catalogApi'
import { useAuthStore } from '@/modules/auth/store/authStore'
import ForkBadge from '../components/ForkBadge.vue'
import { Calculator, Atom, FlaskConical, Leaf, BookText, Globe2, Laptop, Languages, Clock, BookOpen, Music, Palette, Dumbbell, Scale, Search, PenTool } from 'lucide-vue-next'

// FIX-2: map category icon slugs to Lucide components
const ICON_MAP: Record<string, Component> = {
  calculator: Calculator,
  atom: Atom,
  'flask-conical': FlaskConical,
  leaf: Leaf,
  'book-text': BookText,
  globe2: Globe2,
  globe: Globe2,
  laptop: Laptop,
  languages: Languages,
  clock: Clock,
  'book-open': BookOpen,
  music: Music,
  palette: Palette,
  dumbbell: Dumbbell,
  scale: Scale,
}

function getCatIcon(name: string | undefined): Component | null {
  if (!name) return null
  return ICON_MAP[name] ?? null
}

const {
  categories,
  lessons,
  isLoading,
  error,
  filters,
  totalCount,
  loadCategories,
  searchLessons,
  loadMore,
  hasMore,
} = useCatalog()

const route = useRoute()
const router = useRouter()
const sidebarOpen = ref(false)
const recentlyAddedLessons = ref<any[]>([])
const authStore = useAuthStore()

// Level 6: Personalization
const myCategories = ref<SubjectCategory[]>([])
const otherCategories = ref<SubjectCategory[]>([])
const showOther = ref(false)
const hasPersonalization = computed(() => myCategories.value.length > 0)

const hasActiveFilters = computed(() =>
  !!(filters.query || filters.category || filters.min_rating || filters.difficulty || filters.language || filters.tutor)
)

// CAT-2: isTutor for per-category empty state CTA
const isTutor = computed(() => authStore.user?.role === 'tutor')

function filterVisible(cats: SubjectCategory[]): SubjectCategory[] {
  return cats
    .map(cat => {
      const visibleChildren = (cat.children || []).filter((child: any) => child.lesson_count > 0)
      return { ...cat, children: visibleChildren }
    })
    .filter(cat => cat.lesson_count > 0 || cat.children?.length > 0)
}

const visibleCategories = computed(() => filterVisible(categories.value))
const visibleMyCategories = computed(() => filterVisible(myCategories.value))
const visibleOtherCategories = computed(() => filterVisible(otherCategories.value))

function resetFilters() {
  filters.query = undefined
  filters.category = undefined
  filters.min_rating = undefined
  filters.difficulty = undefined
  filters.language = undefined
  filters.tutor = undefined
  filters.sort = 'popular'
  router.replace({ query: { ...route.query, tutor: undefined } })
  searchLessons(true)
}

function clearTutorFilter(): void {
  filters.tutor = undefined
  router.replace({ query: { ...route.query, tutor: undefined } })
  searchLessons(true)
}

const { t: $t } = useI18n()

const breadcrumbs = computed(() => [
  { label: $t('breadcrumb.knowledgeHub'), to: '/knowledge' },
  { label: $t('breadcrumb.catalog') },
])

const activeCategoryName = computed(() => {
  if (!filters.category) return $t('knowledge.catalog.allCategories')
  for (const cat of categories.value) {
    if (cat.slug === filters.category) return cat.name
    for (const child of cat.children) {
      if (child.slug === filters.category) return child.name
    }
  }
  return $t('knowledge.catalog.allCategories')
})

function lessonWord(count: number): string {
  if (count % 10 === 1 && count % 100 !== 11) return 'урок'
  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'уроки'
  return 'уроків'
}

// ── SEO ──────────────────────────────────────────────────────────────────────

function updateSeo(): void {
  const cat = activeCategoryName.value
  const allCats = $t('knowledge.catalog.allCategories')
  document.title = cat !== allCats
    ? `${cat} — ${$t('sidebar.item.lessonCatalog')} | M4SH`
    : `${$t('sidebar.item.lessonCatalog')} | M4SH`
  setMeta('description', `${$t('sidebar.item.lessonCatalog')} — ${cat}.`)
}

function setMeta(name: string, content: string): void {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

async function loadPersonalizedCategories(): Promise<void> {
  if (!authStore.user) return
  try {
    const data = await catalogApi.getPersonalizedCategories()
    myCategories.value = data.my_categories || []
    otherCategories.value = data.other_categories || []
  } catch {
    // Fallback: no personalization, use standard categories
    myCategories.value = []
    otherCategories.value = []
  }
}

onMounted(async () => {
  // CAT-4: Read ?tutor=slug query param to filter by tutor
  if (route.query.tutor) {
    filters.tutor = route.query.tutor as string
  }

  updateSeo()
  await Promise.all([
    loadCategories(),
    searchLessons(true),
    loadPersonalizedCategories(),
  ])
  // CAT-1: Load recently added lessons (transparent sort by date)
  try {
    const { lessons: recent } = await catalogApi.search({ sort: 'newest', cursor: 0 })
    recentlyAddedLessons.value = recent.slice(0, 4)
  } catch {
    // Recently added is supplementary, don't block page
  }
})
</script>

<style scoped>
.catalog-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: #ffffff;
}

/* ── Header ────────────────────────────────────────────────────── */
.catalog-page__header {
  border-bottom: 1px solid #e2e8f0;
  padding: 20px 24px;
}

.catalog-page__header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.catalog-page__title {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  margin: 0;
  white-space: nowrap;
}

.catalog-page__search-wrap {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.catalog-page__search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
}

.catalog-page__search-input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  color: #0f172a;
  background: #f8fafc;
  transition: border-color 0.15s;
}

.catalog-page__search-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

/* ── Body layout ───────────────────────────────────────────────── */
.catalog-page__body {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  gap: 0;
  padding: 0 24px;
}

/* ── Sidebar ───────────────────────────────────────────────────── */
.catalog-page__sidebar {
  width: 220px;
  flex-shrink: 0;
  padding: 20px 16px 20px 0;
  border-right: 1px solid #f1f5f9;
}

.catalog-page__sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.catalog-page__sidebar-title {
  font-size: 13px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}

.catalog-page__sidebar-close {
  display: none;
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
}

.catalog-page__cat-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.catalog-page__cat-skeleton {
  height: 36px;
  background: #f1f5f9;
  border-radius: 8px;
  animation: cat-pulse 1.5s ease-in-out infinite;
}

@keyframes cat-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.catalog-page__cat-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.catalog-page__cat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: none;
  background: none;
  border-radius: 8px;
  font-size: 14px;
  color: #334155;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  width: 100%;
}

.catalog-page__cat-item:hover { background: #f1f5f9; }

.catalog-page__cat-item--active {
  background: #e0e7ff;
  color: #4338ca;
  font-weight: 600;
}

.catalog-page__cat-item--child {
  padding-left: 34px;
  font-size: 13px;
}

.catalog-page__cat-section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  padding: 12px 10px 4px;
}

.catalog-page__cat-toggle {
  display: block;
  width: 100%;
  padding: 8px 10px;
  background: none;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: #6366f1;
  cursor: pointer;
  text-align: left;
  transition: color 0.15s;
}

.catalog-page__cat-toggle:hover {
  color: #4f46e5;
}

.catalog-page__cat-icon {
  flex-shrink: 0;
  font-size: 16px;
}

.catalog-page__cat-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-page__cat-count {
  flex-shrink: 0;
  font-size: 12px;
  color: #94a3b8;
}

/* ── Main ──────────────────────────────────────────────────────── */
.catalog-page__main {
  flex: 1;
  min-width: 0;
  padding: 20px 0 48px 24px;
}

.catalog-page__mobile-cat-btn {
  display: none;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  margin-bottom: 16px;
}

/* ── Tutor filter indicator ────────────────────────────────────── */
.catalog-page__active-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: #e0e7ff;
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 13px;
  color: #3730a3;
  margin-bottom: 16px;
}

.catalog-page__clear-filter {
  background: none;
  border: none;
  color: #6366f1;
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.catalog-page__clear-filter:hover {
  color: #4338ca;
}

/* ── Toolbar ───────────────────────────────────────────────────── */
.catalog-page__toolbar {
  display: flex;
  align-items: flex-end;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.catalog-page__filter-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.catalog-page__filter-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.catalog-page__select {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  color: #0f172a;
  background: #ffffff;
  cursor: pointer;
}

.catalog-page__select:focus {
  outline: none;
  border-color: #6366f1;
}

.catalog-page__star-filter {
  display: flex;
  gap: 2px;
}

.catalog-page__star-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #cbd5e1;
  cursor: pointer;
  padding: 2px;
  transition: color 0.1s;
}

.catalog-page__star-btn--active { color: #f59e0b; }
.catalog-page__star-btn:hover { color: #fbbf24; }

/* ── Error / Empty ─────────────────────────────────────────────── */
.catalog-page__error {
  text-align: center;
  padding: 32px 0;
  color: #64748b;
  font-size: 14px;
}

.catalog-page__retry-btn {
  margin-top: 12px;
  padding: 6px 14px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
}

.catalog-page__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
  gap: 12px;
  text-align: center;
}

.catalog-page__empty-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.catalog-page__empty-text {
  font-size: 14px;
  color: #64748b;
  margin: 0;
  max-width: 400px;
  line-height: 1.5;
}

.catalog-page__empty-icon {
  color: #94a3b8;
  margin-bottom: 4px;
}

.catalog-page__empty--welcome {
  padding: 64px 24px;
}

.catalog-page__empty-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.catalog-page__empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, transform 0.1s;
  color: #475569;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.catalog-page__empty-btn:hover {
  background: #e2e8f0;
}

.catalog-page__empty-btn--primary {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}

.catalog-page__empty-btn--primary:hover {
  background: #4f46e5;
  transform: translateY(-1px);
}

.catalog-page__reset-btn {
  margin-top: 4px;
  padding: 8px 18px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s;
}

.catalog-page__reset-btn:hover {
  background: #e2e8f0;
}

/* ── Grid ──────────────────────────────────────────────────────── */
.catalog-page__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.catalog-page__card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.catalog-page__card:hover {
  border-color: #cbd5e1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.catalog-page__card-img-wrap {
  height: 140px;
  background: #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.catalog-page__card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.catalog-page__card-img-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.catalog-page__card-letter {
  font-size: 2rem;
  font-weight: 700;
  color: #16a34a;
  opacity: 0.7;
}

.catalog-page__card-body {
  padding: 12px 14px 14px;
}

.catalog-page__card-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 6px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.catalog-page__card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #64748b;
}

.catalog-page__card-author {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.catalog-page__card-author--link {
  color: #6366f1;
  text-decoration: none;
  transition: color 0.12s;
}

.catalog-page__card-author--link:hover {
  color: #4f46e5;
  text-decoration: underline;
}

.catalog-page__card-category {
  padding: 1px 6px;
  background: #f1f5f9;
  border-radius: 4px;
  white-space: nowrap;
}

.catalog-page__card-rating {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.catalog-page__card-stars {
  color: #f59e0b;
  font-weight: 600;
}

.catalog-page__card-rating-count {
  color: #94a3b8;
  font-size: 12px;
}

.catalog-page__card-views {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #94a3b8;
  margin-top: 4px;
}

/* ── Skeleton cards ────────────────────────────────────────────── */
.catalog-page__card-skeleton {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.catalog-page__card-skeleton-img {
  height: 140px;
  background: #e2e8f0;
  animation: cat-pulse 1.5s ease-in-out infinite;
}

.catalog-page__card-skeleton-text {
  height: 14px;
  background: #e2e8f0;
  border-radius: 4px;
  margin: 12px 14px 8px;
  animation: cat-pulse 1.5s ease-in-out infinite;
}

.catalog-page__card-skeleton-text--short {
  width: 60%;
  margin-top: 0;
}

/* ── Load more ─────────────────────────────────────────────────── */
.catalog-page__load-more-wrap {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.catalog-page__load-more-btn {
  padding: 10px 28px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  transition: background 0.15s;
}

.catalog-page__load-more-btn:hover { background: #e2e8f0; }

.catalog-page__loading-more {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.catalog-page__spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: cat-spin 0.7s linear infinite;
}

@keyframes cat-spin { to { transform: rotate(360deg); } }

/* ── Collections ───────────────────────────────────────────────── */
.catalog-page__collections {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid #e2e8f0;
}

.catalog-page__collections-title {
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 16px;
}

.catalog-page__collections-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.catalog-page__collection-card {
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}

.catalog-page__collection-card:hover { border-color: #cbd5e1; }

.catalog-page__collection-name {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px;
}

.catalog-page__collection-desc {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 8px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.catalog-page__collection-count {
  font-size: 12px;
  color: #6366f1;
  font-weight: 600;
}

/* ── Mobile ────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .catalog-page__header-inner {
    flex-direction: column;
    align-items: flex-start;
  }

  .catalog-page__search-wrap { max-width: 100%; }

  .catalog-page__body { padding: 0 16px; }

  .catalog-page__sidebar {
    position: fixed;
    inset: 0;
    z-index: 50;
    width: 100%;
    background: #ffffff;
    padding: 20px;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    border-right: none;
    overflow-y: auto;
  }

  .catalog-page__sidebar--open {
    transform: translateX(0);
  }

  .catalog-page__sidebar-close { display: flex; }

  .catalog-page__mobile-cat-btn { display: flex; }

  .catalog-page__main { padding-left: 0; }

  .catalog-page__grid {
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
  }

  .catalog-page__card-img-wrap { height: 110px; }
}

@media (prefers-reduced-motion: reduce) {
  .catalog-page__spinner,
  .catalog-page__cat-skeleton,
  .catalog-page__card-skeleton-img,
  .catalog-page__card-skeleton-text {
    animation: none;
  }

  .catalog-page__sidebar { transition: none; }
}
</style>
