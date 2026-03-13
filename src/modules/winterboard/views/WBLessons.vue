<!-- WB: WBLessons — list of user's lessons with winterboard sessions
     Ref: DAY19_AGENT-A.md A13
     API: GET /lessons/my/ (apps/lessons/) -->
<template>
  <div class="wb-lessons">
    <header class="wb-lessons__header">
      <h1 class="wb-lessons__title">{{ t('winterboard.lessons.title') }}</h1>
    </header>

    <!-- Error state -->
    <div v-if="error" class="wb-lessons__error" data-testid="lessons-error">
      <p>{{ error }}</p>
      <button class="wb-lessons__retry" @click="loadLessons">
        {{ t('common.retry') }}
      </button>
    </div>

    <!-- Loading state -->
    <div v-else-if="loading" class="wb-lessons__loading" data-testid="lessons-loading">
      <div v-for="i in 6" :key="i" class="wb-lesson-card wb-lesson-card--skeleton">
        <div class="wb-skeleton-pulse wb-skeleton-line" />
        <div class="wb-skeleton-pulse wb-skeleton-line wb-skeleton-line--short" />
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="lessons.length === 0" class="wb-lessons__empty" data-testid="lessons-empty">
      <p>{{ t('winterboard.lessons.noLessons') }}</p>
    </div>

    <!-- Lessons list -->
    <div v-else class="wb-lessons__grid" data-testid="lessons-grid">
      <div
        v-for="lesson in lessons"
        :key="lesson.id"
        class="wb-lesson-card"
        role="button"
        tabindex="0"
        :aria-label="lesson.title || lesson.subject || t('winterboard.lessons.untitled')"
        data-testid="lesson-card"
        @click="openLesson(lesson.id)"
        @keydown.enter="openLesson(lesson.id)"
      >
        <div class="wb-lesson-card__body">
          <span class="wb-lesson-card__title">
            {{ lesson.title || lesson.subject || t('winterboard.lessons.untitled') }}
          </span>
          <span class="wb-lesson-card__meta">
            {{ formatDate(lesson.scheduled_at || lesson.created_at) }}
          </span>
          <span
            v-if="lesson.status"
            class="wb-lesson-card__status"
            :class="`wb-lesson-card__status--${lesson.status}`"
          >
            {{ t(`winterboard.board.status${capitalize(lesson.status)}`, lesson.status) }}
          </span>
        </div>
        <div class="wb-lesson-card__actions">
          <button
            class="wb-lesson-card__open-btn"
            @click.stop="openLesson(lesson.id)"
          >
            {{ t('winterboard.lessons.openBoard') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// A13: WBLessons — real API, error/loading states, toast
// Ref: DAY19_AGENT-A.md

import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import lessonsApi from '@/api/lessons'
import { useToast } from '../composables/useToast'

const { t } = useI18n()
const router = useRouter()
const { showToast } = useToast()

// ─── State ────────────────────────────────────────────────────────────────────

const lessons = ref<any[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function loadLessons(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const res = await lessonsApi.listMyLessons()
    // API may return { results: [...] } (paginated) or plain array
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

// ─── Actions ─────────────────────────────────────────────────────────────────

function openLesson(lessonId: number): void {
  router.push({ name: 'winterboard-lesson', params: { lessonId } })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString()
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
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
