<!-- Phase 16 INT-1/INT-7: Knowledge Hub — central tutor page for Knowledge domain.
     Authenticated, inside PageShell. Shows stats, quick actions, recent lessons. -->
<template>
  <div class="knowledge-hub">
    <h1 class="knowledge-hub__title">Knowledge Hub</h1>

    <!-- Stats -->
    <KnowledgeStatsWidget class="knowledge-hub__stats" />

    <!-- Quick Actions -->
    <section class="knowledge-hub__section">
      <h2 class="knowledge-hub__section-title">Швидкі дії</h2>
      <div class="knowledge-hub__actions">
        <router-link to="/winterboard" class="knowledge-hub__action-card">
          <span class="knowledge-hub__action-icon">🎓</span>
          <span class="knowledge-hub__action-label">Опублікувати урок</span>
        </router-link>
        <router-link to="/knowledge/catalog" class="knowledge-hub__action-card">
          <span class="knowledge-hub__action-icon">📚</span>
          <span class="knowledge-hub__action-label">Каталог уроків</span>
        </router-link>
        <router-link to="/knowledge/library" class="knowledge-hub__action-card">
          <span class="knowledge-hub__action-icon">📋</span>
          <span class="knowledge-hub__action-label">Бібліотека шаблонів</span>
        </router-link>
        <router-link to="/knowledge/packs" class="knowledge-hub__action-card">
          <span class="knowledge-hub__action-icon">📦</span>
          <span class="knowledge-hub__action-label">Мої серії</span>
        </router-link>
      </div>
    </section>

    <!-- Recent Lessons -->
    <section v-if="isLoadingLessons" class="knowledge-hub__section">
      <h2 class="knowledge-hub__section-title">Останні уроки</h2>
      <div class="knowledge-hub__skeleton-grid">
        <div v-for="i in 4" :key="i" class="knowledge-hub__skeleton-card" />
      </div>
    </section>

    <section v-else-if="recentLessons.length > 0" class="knowledge-hub__section">
      <h2 class="knowledge-hub__section-title">Останні уроки</h2>
      <div class="knowledge-hub__lessons-grid">
        <router-link
          v-for="lesson in recentLessons"
          :key="lesson.id"
          :to="`/lesson/${lesson.tutor_slug || ''}/${lesson.slug || ''}`"
          class="knowledge-hub__lesson-card"
        >
          <h3 class="knowledge-hub__lesson-title">{{ lesson.title || 'Без назви' }}</h3>
          <div class="knowledge-hub__lesson-meta">
            <span v-if="lesson.subject_tag" class="knowledge-hub__lesson-tag">{{ lesson.subject_tag }}</span>
            <span class="knowledge-hub__lesson-date">{{ formatDate(lesson.published_at || lesson.created_at) }}</span>
          </div>
        </router-link>
      </div>
    </section>

    <section v-else class="knowledge-hub__section">
      <div class="knowledge-hub__empty">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <rect x="6" y="6" width="36" height="36" rx="6" stroke="#94a3b8" stroke-width="2"/>
          <path d="M16 20h16M16 28h10" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <h3 class="knowledge-hub__empty-title">Поки немає уроків</h3>
        <p class="knowledge-hub__empty-text">Створіть свій перший урок на Winterboard і опублікуйте його</p>
        <router-link to="/winterboard" class="knowledge-hub__empty-btn">
          Створити урок
        </router-link>
      </div>
    </section>

    <!-- Terms Hint (Agent B) -->
    <KnowledgeTermsHint />

    <!-- Link cards -->
    <div class="knowledge-hub__link-cards">
      <router-link to="/knowledge/analytics" class="knowledge-hub__link-card">
        <span class="knowledge-hub__link-card-icon">📊</span>
        <div>
          <h3 class="knowledge-hub__link-card-title">Аналітика</h3>
          <p class="knowledge-hub__link-card-desc">Переглядайте статистику ваших уроків</p>
        </div>
      </router-link>
      <router-link to="/knowledge/collections" class="knowledge-hub__link-card">
        <span class="knowledge-hub__link-card-icon">🗂️</span>
        <div>
          <h3 class="knowledge-hub__link-card-title">Підбірки</h3>
          <p class="knowledge-hub__link-card-desc">Тематичні підбірки уроків</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent, h } from 'vue'
import KnowledgeStatsWidget from '../components/KnowledgeStatsWidget.vue'
import apiClient from '@/utils/apiClient'

// Agent B components — loaded via defineAsyncComponent with null fallback
const KnowledgeTermsHint = defineAsyncComponent({
  loader: () => import('../components/KnowledgeTermsHint.vue'),
  errorComponent: { render: () => null },
  loadingComponent: { render: () => null },
})
const KnowledgeEmptyState = defineAsyncComponent({
  loader: () => import('../components/KnowledgeEmptyState.vue'),
  errorComponent: { render: () => null },
  loadingComponent: { render: () => null },
})

interface RecentLesson {
  id: string
  title: string
  slug?: string
  tutor_slug?: string
  subject_tag?: string
  published_at?: string
  created_at?: string
}

const recentLessons = ref<RecentLesson[]>([])
const isLoadingLessons = ref(true)

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
}

onMounted(async () => {
  try {
    const res = await apiClient.get('/v1/knowledge/my-lessons/?limit=4&ordering=-published_at')
    const data = res as Record<string, unknown>
    recentLessons.value = Array.isArray(data)
      ? data.slice(0, 4)
      : Array.isArray((data as { results?: unknown[] }).results)
        ? ((data as { results: RecentLesson[] }).results).slice(0, 4)
        : []
  } catch (err) {
    console.warn('[KnowledgeHubPage] Failed to load recent lessons:', err)
  } finally {
    isLoadingLessons.value = false
  }
})
</script>

<style scoped>
.knowledge-hub {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.knowledge-hub__title {
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary, #0f172a);
  margin: 0 0 20px;
}

.knowledge-hub__stats {
  margin-bottom: 24px;
}

/* ── Section ───────────────────────────────────────────────── */
.knowledge-hub__section {
  margin-bottom: 28px;
}

.knowledge-hub__section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  margin: 0 0 12px;
}

/* ── Quick Actions ─────────────────────────────────────────── */
.knowledge-hub__actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 640px) {
  .knowledge-hub__actions {
    grid-template-columns: repeat(4, 1fr);
  }
}

.knowledge-hub__action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  text-decoration: none;
  color: var(--text-primary, #0f172a);
  transition: border-color 0.15s, box-shadow 0.15s;
  text-align: center;
}

.knowledge-hub__action-card:hover {
  border-color: var(--accent, #6366f1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.knowledge-hub__action-icon {
  font-size: 24px;
}

.knowledge-hub__action-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

/* ── Skeleton ──────────────────────────────────────────────── */
.knowledge-hub__skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.knowledge-hub__skeleton-card {
  height: 80px;
  background: var(--bg-secondary, #f1f5f9);
  border-radius: 10px;
  animation: kh-pulse 1.5s ease-in-out infinite;
}

@keyframes kh-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── Lessons Grid ──────────────────────────────────────────── */
.knowledge-hub__lessons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.knowledge-hub__lesson-card {
  padding: 14px;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}

.knowledge-hub__lesson-card:hover {
  border-color: var(--accent, #6366f1);
}

.knowledge-hub__lesson-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #0f172a);
  margin: 0 0 6px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.knowledge-hub__lesson-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.knowledge-hub__lesson-tag {
  padding: 1px 6px;
  background: var(--bg-tertiary, #f1f5f9);
  border-radius: 4px;
}

.knowledge-hub__lesson-date {
  white-space: nowrap;
}

/* ── Empty ─────────────────────────────────────────────────── */
.knowledge-hub__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 16px;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  gap: 10px;
}

.knowledge-hub__empty-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  margin: 0;
}

.knowledge-hub__empty-text {
  font-size: 13px;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.knowledge-hub__empty-btn {
  margin-top: 8px;
  padding: 8px 20px;
  background: var(--accent, #6366f1);
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 600;
  transition: background 0.15s;
}

.knowledge-hub__empty-btn:hover {
  background: var(--accent-hover, #4f46e5);
}

/* ── Link Cards ────────────────────────────────────────────── */
.knowledge-hub__link-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.knowledge-hub__link-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary, #f8fafc);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}

.knowledge-hub__link-card:hover {
  border-color: var(--accent, #6366f1);
}

.knowledge-hub__link-card-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.knowledge-hub__link-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  margin: 0 0 2px;
}

.knowledge-hub__link-card-desc {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

/* ── Mobile ────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .knowledge-hub { padding: 16px; }
  .knowledge-hub__title { font-size: 20px; }
}

@media (prefers-reduced-motion: reduce) {
  .knowledge-hub__skeleton-card { animation: none; }
}
</style>
