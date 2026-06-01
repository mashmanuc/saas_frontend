<!-- Phase 14 A1.2: LessonLibraryPage — template library with filters, grid, cursor pagination
     Ref: AGENT_A_FE_CORE.md A1.2
     Uses useTemplateLibrary composable for data/filters/pagination.
     Grid cards: LessonTemplateCard (Agent B) — fallback stub until created.
     Search: debounced server-side (query param in filters).
     Skeleton: 6 placeholders while loading. -->
<template>
  <div class="lesson-library">
    <BreadcrumbNav :items="breadcrumbs" />
    <!-- Header -->
    <header class="lesson-library__header">
      <h1 class="lesson-library__title">{{ t('knowledge.library.title') || 'Бібліотека шаблонів' }}</h1>
      <div class="lesson-library__search">
        <input
          v-model="searchQuery"
          type="search"
          class="lesson-library__search-input"
          :placeholder="t('knowledge.library.searchPlaceholder') || 'Пошук шаблонів...'"
          @input="handleSearchInput"
        />
      </div>
    </header>

    <!-- Filters bar -->
    <div class="lesson-library__filters">
      <!-- Subject tags -->
      <div class="lesson-library__subject-tags">
        <button
          v-for="subj in subjectOptions"
          :key="subj.value"
          type="button"
          class="lesson-library__tag"
          :class="{ 'lesson-library__tag--active': filters.subject === subj.value }"
          @click="toggleSubject(subj.value)"
        >
          {{ subj.label }}
        </button>
      </div>

      <!-- Difficulty filter -->
      <div class="lesson-library__difficulty">
        <label class="lesson-library__filter-label">
          {{ t('knowledge.library.difficulty') || 'Складність' }}:
        </label>
        <select v-model.number="filters.difficulty_min" class="lesson-library__select">
          <option :value="undefined">{{ t('knowledge.library.any') || 'Будь-яка' }}</option>
          <option :value="1">1+</option>
          <option :value="2">2+</option>
          <option :value="3">3+</option>
          <option :value="4">4+</option>
        </select>
      </div>

      <!-- Sort -->
      <div class="lesson-library__sort">
        <label class="lesson-library__filter-label">
          {{ t('knowledge.library.sortBy') || 'Сортувати' }}:
        </label>
        <select v-model="filters.sort" class="lesson-library__select">
          <option value="popular">{{ t('knowledge.library.sortPopular') || 'Популярні' }}</option>
          <option value="newest">{{ t('knowledge.library.sortNewest') || 'Нові' }}</option>
        </select>
      </div>
    </div>

    <!-- Error state -->
    <div v-if="error" class="lesson-library__error">
      <p>{{ error }}</p>
      <button type="button" class="lesson-library__retry-btn" @click="loadTemplates(true)">
        {{ t('knowledge.library.retry') || 'Спробувати знову' }}
      </button>
    </div>

    <!-- Grid -->
    <div class="lesson-library__grid">
      <!-- Skeleton loading -->
      <template v-if="isLoading && templates.length === 0">
        <div v-for="i in 6" :key="`skeleton-${i}`" class="lesson-library__skeleton">
          <div class="lesson-library__skeleton-thumb" />
          <div class="lesson-library__skeleton-line lesson-library__skeleton-line--title" />
          <div class="lesson-library__skeleton-line lesson-library__skeleton-line--sub" />
          <div class="lesson-library__skeleton-line lesson-library__skeleton-line--short" />
        </div>
      </template>

      <!-- Template cards -->
      <template v-else-if="templates.length > 0">
        <div
          v-for="tmpl in templates"
          :key="tmpl.id"
          class="lesson-library__card"
          @click="handleCardClick(tmpl)"
        >
          <!-- Thumbnail -->
          <div class="lesson-library__card-thumb">
            <img
              v-if="tmpl.board_thumbnail_url"
              :src="tmpl.board_thumbnail_url"
              :alt="tmpl.source_lesson_title"
              class="lesson-library__card-img"
              loading="lazy"
              @error="(e: Event) => (e.target as HTMLImageElement).style.display = 'none'"
            />
            <div v-else class="lesson-library__card-placeholder">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
                <path d="M3 15l5-5 4 4 3-3 6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>

          <!-- Info -->
          <div class="lesson-library__card-info">
            <h3 class="lesson-library__card-title">{{ tmpl.source_lesson_title }}</h3>
            <p class="lesson-library__card-meta">
              {{ tmpl.tutor_name }}
              <span v-if="tmpl.subject_tag" class="lesson-library__card-tag">{{ tmpl.subject_tag }}</span>
            </p>
            <div class="lesson-library__card-footer">
              <span class="lesson-library__card-stat">
                {{ t('knowledge.library.usedCount', { count: tmpl.used_count }) || `${tmpl.used_count} разів` }}
              </span>
              <span class="lesson-library__card-difficulty">
                <span v-for="d in 5" :key="d" :class="d <= tmpl.difficulty_level ? 'dot--filled' : 'dot--empty'" class="lesson-library__dot" />
              </span>
            </div>
          </div>

          <!-- Clone button -->
          <button
            type="button"
            class="lesson-library__clone-btn"
            :disabled="isCloning"
            :title="t('knowledge.library.clone') || 'Клонувати'"
            @click.stop="handleClone(tmpl.id)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
              <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.4"/>
            </svg>
          </button>
        </div>
      </template>

      <!-- Empty state -->
      <div v-else-if="!isLoading && !error" class="lesson-library__empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M9 2H4a2 2 0 00-2 2v5m11-7h5a2 2 0 012 2v5M9 22H4a2 2 0 01-2-2v-5m11 7h5a2 2 0 002-2v-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <p>{{ t('knowledge.library.empty') || 'Шаблонів ще немає' }}</p>
      </div>
    </div>

    <!-- Load more -->
    <div v-if="nextCursor !== null && templates.length > 0" class="lesson-library__loadmore">
      <button
        type="button"
        class="lesson-library__loadmore-btn"
        :disabled="isLoading"
        @click="loadMore"
      >
        {{ isLoading ? '...' : (t('knowledge.library.loadMore') || 'Завантажити ще') }}
      </button>
    </div>

    <!-- Total count -->
    <p v-if="totalCount > 0" class="lesson-library__total">
      {{ t('knowledge.library.totalCount', { count: totalCount }) || `Всього: ${totalCount}` }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import BreadcrumbNav from '@/components/ui/BreadcrumbNav.vue'
import { useTemplateLibrary } from '../composables/useTemplateLibrary'
import { useCloneTemplate } from '../composables/useCloneTemplate'
import type { LessonTemplate } from '../api/templateApi'

const { t } = useI18n()
const router = useRouter()

const breadcrumbs = computed(() => [
  { label: t('breadcrumb.knowledgeHub'), to: '/knowledge' },
  { label: t('breadcrumb.library') },
])

// ─── Template library composable ────────────────────────────────────────────

const {
  templates,
  isLoading,
  error,
  filters,
  nextCursor,
  totalCount,
  loadTemplates,
  loadMore,
} = useTemplateLibrary()

// ─── Search (debounced) ─────────────────────────────────────────────────────

const searchQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

function handleSearchInput(): void {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    // Subject filter doubles as search query for server-side search
    filters.subject = searchQuery.value.trim() || undefined
  }, 400)
}

// ─── Subject filter options ─────────────────────────────────────────────────

const subjectOptions = [
  { value: 'math', label: t('subject.math') || 'Математика' },
  { value: 'physics', label: t('subject.physics') || 'Фізика' },
  { value: 'english', label: t('subject.english') || 'Англійська' },
  { value: 'ukrainian', label: t('subject.ukrainian') || 'Українська' },
  { value: 'chemistry', label: t('subject.chemistry') || 'Хімія' },
  { value: 'biology', label: t('subject.biology') || 'Біологія' },
  { value: 'history', label: t('subject.history') || 'Історія' },
]

function toggleSubject(value: string): void {
  filters.subject = filters.subject === value ? undefined : value
  // Clear search when toggling subject
  if (filters.subject !== undefined) {
    searchQuery.value = ''
  }
}

// ─── Clone flow (A2.3) ──────────────────────────────────────────────────────

const { clone, isCloning } = useCloneTemplate()

async function handleClone(templateId: string): Promise<void> {
  const result = await clone(templateId)
  if (result?.session_id) {
    // Клон шаблону з каталогу — відкриваємо у конструкторі для редагування.
    router.push({ name: 'winterboard-prepare', params: { id: result.session_id } })
  }
}

// ─── Card click → detail (or preview) ───────────────────────────────────────

function handleCardClick(tmpl: LessonTemplate): void {
  router.push(`/lesson/${tmpl.tutor_slug}/${tmpl.source_lesson_slug}`)
}

// ─── Initial load ───────────────────────────────────────────────────────────

onMounted(() => {
  loadTemplates(true)
})
</script>

<style scoped>
.lesson-library {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px 48px;
}

/* Header */
.lesson-library__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}

.lesson-library__title {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.lesson-library__search-input {
  width: 260px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #334155;
  transition: border-color 0.15s;
}
.lesson-library__search-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
}

/* Filters */
.lesson-library__filters {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
}

.lesson-library__subject-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.lesson-library__tag {
  padding: 4px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s;
}
.lesson-library__tag:hover {
  border-color: #6366f1;
  color: #6366f1;
}
.lesson-library__tag--active {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}

.lesson-library__filter-label {
  font-size: 13px;
  color: #64748b;
  white-space: nowrap;
}

.lesson-library__select {
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #334155;
  background: #fff;
}

.lesson-library__difficulty,
.lesson-library__sort {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Error */
.lesson-library__error {
  text-align: center;
  padding: 32px;
  color: #ef4444;
}
.lesson-library__retry-btn {
  margin-top: 8px;
  padding: 6px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  cursor: pointer;
}

/* Grid */
.lesson-library__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

/* Card */
.lesson-library__card {
  position: relative;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.15s, transform 0.15s;
}
.lesson-library__card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.lesson-library__card-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #f1f5f9;
  overflow: hidden;
}
.lesson-library__card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.lesson-library__card-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cbd5e1;
}

.lesson-library__card-info {
  padding: 12px;
}

.lesson-library__card-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lesson-library__card-meta {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 8px;
}

.lesson-library__card-tag {
  display: inline-block;
  background: #ede9fe;
  color: #6d28d9;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  margin-left: 6px;
}

.lesson-library__card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lesson-library__card-stat {
  font-size: 12px;
  color: #94a3b8;
}

.lesson-library__card-difficulty {
  display: flex;
  gap: 2px;
}

.lesson-library__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.dot--filled {
  background: #6366f1;
}
.dot--empty {
  background: #e2e8f0;
}

/* Clone button */
.lesson-library__clone-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  color: #475569;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background 0.12s;
}
.lesson-library__card:hover .lesson-library__clone-btn {
  opacity: 1;
}
.lesson-library__clone-btn:hover {
  background: #6366f1;
  color: #fff;
  border-color: #6366f1;
}

/* Skeleton */
.lesson-library__skeleton {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}
.lesson-library__skeleton-thumb {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
.lesson-library__skeleton-line {
  margin: 12px;
  height: 14px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
}
.lesson-library__skeleton-line--title { width: 70%; }
.lesson-library__skeleton-line--sub { width: 50%; height: 12px; }
.lesson-library__skeleton-line--short { width: 30%; height: 10px; }

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty state */
.lesson-library__empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 64px 16px;
  color: #94a3b8;
  text-align: center;
}

/* Load more */
.lesson-library__loadmore {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
.lesson-library__loadmore-btn {
  padding: 10px 24px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
  font-size: 14px;
  font-weight: 500;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s;
}
.lesson-library__loadmore-btn:hover:not(:disabled) {
  border-color: #6366f1;
  color: #6366f1;
}
.lesson-library__loadmore-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Total count */
.lesson-library__total {
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
  margin-top: 12px;
}

/* Responsive */
@media (max-width: 640px) {
  .lesson-library__header {
    flex-direction: column;
    align-items: stretch;
  }
  .lesson-library__search-input {
    width: 100%;
  }
  .lesson-library__grid {
    grid-template-columns: 1fr;
  }
  .lesson-library__clone-btn {
    opacity: 1;
  }
}
</style>
