<!-- WB: WBLessons — list of user's lessons with create/clone/delete + filter
     Ref: DAY18_AGENT-B.md B16, DAY23_AGENT-B.md B21
     API: GET /lessons/my/ (apps/lessons/) — TODO: replace mock with real -->
<template>
  <div class="wb-lessons">
    <header class="wb-lessons__header">
      <h1 class="wb-lessons__title">{{ t('winterboard.lessons.title') }}</h1>
      <button
        class="wb-lessons__create-btn"
        data-testid="create-lesson"
        @click="showCreate = true"
      >
        + {{ t('winterboard.lessons.create') }}
      </button>
    </header>

    <!-- Filter bar (B21) -->
    <LessonFilterBar
      v-if="!loading && !error"
      :categories="categories"
      :available-tags="availableTags"
      :filtered-count="filteredLessons.length"
      @update:search="searchQuery = $event"
      @update:category="selectedCategory = $event"
      @update:tags="selectedTags = $event"
      @clear="clearFilters"
    />

    <!-- Error state -->
    <div v-if="error" class="wb-lessons__error" data-testid="lessons-error">
      <p>{{ error }}</p>
      <button class="wb-lessons__retry" @click="loadLessons">
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-else-if="loading" class="wb-lessons__loading" data-testid="lessons-loading" aria-live="polite" aria-busy="true">
      <div v-for="i in 4" :key="i" class="wb-lesson-skeleton">
        <div class="wb-skeleton-pulse wb-skeleton-line" />
        <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--short" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="lessons.length === 0" class="wb-lessons__empty" data-testid="lessons-empty">
      <p>{{ t('winterboard.lessons.noLessons') }}</p>
      <button class="wb-lessons__create-btn" @click="showCreate = true">
        {{ t('winterboard.lessons.create') }}
      </button>
    </div>

    <!-- No results after filter -->
    <div
      v-else-if="filteredLessons.length === 0"
      class="wb-lessons__empty"
      data-testid="lessons-no-results"
    >
      <p>{{ t('lessons.noResults') }}</p>
    </div>

    <!-- Lessons list -->
    <div v-else class="wb-lessons__list" data-testid="lessons-list">
      <LessonCard
        v-for="lesson in filteredLessons"
        :key="lesson.id"
        :lesson="normalizeLesson(lesson)"
        @click="openLesson(lesson.id)"
        @clone="cloneLesson(lesson)"
        @delete="deleteLesson(lesson)"
      />
    </div>

    <!-- Create lesson modal -->
    <Teleport to="body">
      <div
        v-if="showCreate"
        class="wb-modal-overlay"
        data-testid="create-modal"
        @click.self="showCreate = false"
      >
        <div class="wb-modal" role="dialog" aria-modal="true" :aria-label="t('winterboard.lessons.create')">
          <h2 class="wb-modal__title">{{ t('winterboard.lessons.create') }}</h2>
          <input
            v-model="newLessonName"
            class="wb-modal__input"
            :placeholder="t('winterboard.lessons.namePlaceholder')"
            :aria-label="t('winterboard.lessons.namePlaceholder')"
            data-testid="lesson-name-input"
            @keydown.enter="createLesson"
            @keydown.esc="showCreate = false"
          />
          <div class="wb-modal__actions">
            <button class="wb-modal__btn wb-modal__btn--secondary" @click="showCreate = false">
              {{ t('common.cancel') }}
            </button>
            <button
              class="wb-modal__btn wb-modal__btn--primary"
              :disabled="!newLessonName.trim() || creating"
              data-testid="create-lesson-submit"
              @click="createLesson"
            >
              {{ creating ? t('common.loading') : t('common.create') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
// B16: WBLessons — create/clone/delete + LessonCard
// Ref: DAY18_AGENT-B.md

import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import LessonCard from '../components/lessons/LessonCard.vue'
import LessonFilterBar from '../components/lessons/LessonFilterBar.vue'
import lessonsApi from '@/api/lessons'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useToast } from '../composables/useToast'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const { showToast } = useToast()

// ─── State ────────────────────────────────────────────────────────────────────

const lessons = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const showCreate = ref(false)
const newLessonName = ref('')
const creating = ref(false)

// B21: Filter state
const searchQuery = ref('')
const selectedCategory = ref<number | string | null>(null)
const selectedTags = ref<string[]>([])

// TODO: replace with GET /api/v1/lessons/categories/ when endpoint exists
const categories = ref([
  { id: 1, name: 'Math', slug: 'math' },
  { id: 2, name: 'Physics', slug: 'physics' },
  { id: 3, name: 'English', slug: 'english' },
])

// Collect available tags from loaded lessons
const availableTags = computed(() => {
  const tags = new Set<string>()
  lessons.value.forEach((l) => (l.tags ?? []).forEach((tag: string) => tags.add(tag)))
  return Array.from(tags).sort()
})

// Filtered lessons computed
const filteredLessons = computed(() => {
  let result = lessons.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter((l) =>
      (l.title ?? l.subject ?? l.name ?? '').toLowerCase().includes(q),
    )
  }

  if (selectedCategory.value !== null) {
    result = result.filter((l) => l.category_id === selectedCategory.value)
  }

  if (selectedTags.value.length > 0) {
    result = result.filter((l) =>
      selectedTags.value.every((tag) => (l.tags ?? []).includes(tag)),
    )
  }

  return result
})

function clearFilters() {
  searchQuery.value = ''
  selectedCategory.value = null
  selectedTags.value = []
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function loadLessons(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    // Backend requires from/to params; use wide range to fetch all relevant lessons
    const now = new Date()
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
    const yearAhead = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    const role = (authStore.user as any)?.role ?? 'tutor'
    const res = await lessonsApi.listMyLessons({
      from: yearAgo.toISOString(),
      to: yearAhead.toISOString(),
      role,
    })
    lessons.value = res?.results ?? res ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : t('winterboard.lessons.loadError')
    error.value = msg
    showToast(msg, 'error')
    console.error('[WB:Lessons] Failed to load lessons', err)
  } finally {
    loading.value = false
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeLesson(lesson: any) {
  return {
    id: lesson.id,
    name: lesson.title || lesson.subject || lesson.name || t('winterboard.lessons.untitled'),
    description: lesson.description,
    materials_count: lesson.materials_count,
    created_at: lesson.scheduled_at || lesson.created_at || new Date().toISOString(),
  }
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function openLesson(lessonId: number | string): void {
  router.push({ name: 'winterboard-lesson', params: { lessonId } })
}

async function createLesson(): Promise<void> {
  if (!newLessonName.value.trim()) return
  creating.value = true
  try {
    // TODO: replace with real API when lessons CRUD is ready
    // const res = await lessonsApi.create({ name: newLessonName.value })
    // lessons.value.unshift(res)
    showCreate.value = false
    newLessonName.value = ''
  } catch (err) {
    showToast(t('winterboard.lessons.createError'), 'error')
    console.error('[WB:Lessons] Failed to create lesson', err)
  } finally {
    creating.value = false
  }
}

async function cloneLesson(lesson: any): Promise<void> {
  const newName = prompt(t('winterboard.lessons.clonePrompt'), `${normalizeLesson(lesson).name} (copy)`)
  if (!newName?.trim()) return
  try {
    // TODO: replace with real API when clone endpoint exists
    console.log('[WB:Lessons] Clone lesson:', lesson.id, 'as:', newName)
    showToast(t('winterboard.lessons.cloned'), 'success')
  } catch (err) {
    showToast(t('winterboard.lessons.cloneError'), 'error')
    console.error('[WB:Lessons] Failed to clone lesson', err)
  }
}

async function deleteLesson(lesson: any): Promise<void> {
  const name = normalizeLesson(lesson).name
  if (!confirm(t('winterboard.lessons.confirmDelete', { name }))) return
  try {
    // TODO: replace with real API
    lessons.value = lessons.value.filter((l) => l.id !== lesson.id)
    showToast(t('winterboard.lessons.deleted'), 'success')
  } catch (err) {
    showToast(t('winterboard.lessons.deleteError'), 'error')
    console.error('[WB:Lessons] Failed to delete lesson', err)
  }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(loadLessons)
</script>

<style scoped>
.wb-lessons {
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.wb-lessons__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.wb-lessons__title {
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: var(--wb-fg, #0f172a);
}

.wb-lessons__error {
  padding: 24px;
  border: 1px solid #fecaca;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  display: flex;
  align-items: center;
  gap: 16px;
}

.wb-lessons__retry {
  padding: 6px 14px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

.wb-lessons__loading,
.wb-lessons__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.wb-lessons__empty {
  padding: 48px;
  text-align: center;
  color: var(--wb-fg-secondary, #94a3b8);
  border: 2px dashed var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
}

.wb-lesson-card {
  background: var(--wb-card-bg, #fff);
  border: 1px solid var(--wb-toolbar-border, #e2e8f0);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
  outline: none;
}

.wb-lesson-card:hover,
.wb-lesson-card:focus-visible {
  border-color: var(--wb-brand, #0066ff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.wb-lesson-card--skeleton {
  pointer-events: none;
  height: 72px;
}

.wb-lesson-card__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.wb-lesson-card__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-fg, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-lesson-card__meta {
  font-size: 12px;
  color: var(--wb-fg-secondary, #94a3b8);
}

.wb-lesson-card__status {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  width: fit-content;
}

.wb-lesson-card__status--scheduled { background: #dbeafe; color: #1d4ed8; }
.wb-lesson-card__status--in_progress { background: #dcfce7; color: #15803d; }
.wb-lesson-card__status--completed { background: #f1f5f9; color: #64748b; }
.wb-lesson-card__status--cancelled { background: #fee2e2; color: #b91c1c; }

.wb-lesson-card__actions {
  flex-shrink: 0;
}

.wb-lesson-card__open-btn {
  padding: 6px 14px;
  background: var(--wb-brand, #0066ff);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.15s;
}

.wb-lesson-card__open-btn:hover {
  background: var(--wb-brand-hover, #0052cc);
}

.wb-skeleton-pulse {
  background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
  background-size: 200% 100%;
  animation: wb-shimmer 1.5s ease-in-out infinite;
  border-radius: 4px;
}

.wb-skeleton-line { height: 13px; width: 70%; margin-bottom: 8px; }
.wb-skeleton-line--short { width: 40%; height: 11px; }

@keyframes wb-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 640px) {
  .wb-lessons { padding: 20px 12px; }
  .wb-lessons__grid { grid-template-columns: 1fr; }
  .wb-lesson-card { flex-direction: column; align-items: flex-start; }
}
</style>
