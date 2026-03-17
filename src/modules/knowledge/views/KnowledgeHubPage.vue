<!-- Knowledge Hub — central tutor page.
     Adapts UI: friendly onboarding for new tutors, full dashboard for active ones. -->
<template>
  <div class="knowledge-hub">
    <h1 class="knowledge-hub__title">Knowledge Hub</h1>

    <!-- Stats — показуємо ТІЛЬКИ якщо є хоч щось -->
    <KnowledgeStatsWidget v-if="hasAnyContent" class="knowledge-hub__stats" />

    <!-- ═══ Новий тьютор — Onboarding ═══ -->
    <template v-if="!isLoadingLessons && !hasAnyContent">
      <!-- Привітальний блок замість порожнечі -->
      <section class="knowledge-hub__welcome">
        <div class="knowledge-hub__welcome-icon">
          <BookOpen :size="40" />
        </div>
        <h2 class="knowledge-hub__welcome-title">Ласкаво просимо!</h2>
        <p class="knowledge-hub__welcome-text">
          Тут будуть ваші уроки, шаблони та аналітика.
          Почніть з дошки — створіть свій перший урок.
        </p>
        <router-link to="/winterboard" class="knowledge-hub__welcome-btn">
          <PenTool :size="18" />
          Створити урок на дошці
        </router-link>
      </section>

      <!-- Підказка для новачка — 2 простих кроки -->
      <section class="knowledge-hub__steps">
        <h3 class="knowledge-hub__steps-title">Як це працює</h3>
        <div class="knowledge-hub__steps-grid">
          <div class="knowledge-hub__step">
            <span class="knowledge-hub__step-number">1</span>
            <div>
              <strong>Створіть урок на дошці</strong>
              <p>Використовуйте Winterboard — малюйте, додавайте слайди, текст</p>
            </div>
          </div>
          <div class="knowledge-hub__step">
            <span class="knowledge-hub__step-number">2</span>
            <div>
              <strong>Опублікуйте в каталог</strong>
              <p>Урок стане доступним для учнів у каталозі M4SH</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Каталог — єдина швидка дія для новачка -->
      <section class="knowledge-hub__section">
        <router-link to="/knowledge/catalog" class="knowledge-hub__explore-card">
          <Search :size="20" />
          <div>
            <strong>Переглянути каталог уроків</strong>
            <p>Подивіться що створюють інші тьютори</p>
          </div>
          <ChevronRight :size="18" class="knowledge-hub__explore-arrow" />
        </router-link>
      </section>
    </template>

    <!-- ═══ Активний тьютор — повний dashboard ═══ -->
    <template v-else-if="!isLoadingLessons && hasAnyContent">
      <!-- Quick Actions — лише 2 основних + 2 допоміжних -->
      <section class="knowledge-hub__section">
        <div class="knowledge-hub__actions">
          <router-link to="/winterboard" class="knowledge-hub__action-card knowledge-hub__action-card--primary">
            <PenTool :size="22" />
            <span class="knowledge-hub__action-label">Створити урок</span>
          </router-link>
          <router-link to="/knowledge/catalog" class="knowledge-hub__action-card">
            <Search :size="22" />
            <span class="knowledge-hub__action-label">Каталог уроків</span>
          </router-link>
          <router-link to="/knowledge/library" class="knowledge-hub__action-card">
            <Layout :size="22" />
            <span class="knowledge-hub__action-label">Шаблони</span>
          </router-link>
          <router-link to="/knowledge/packs" class="knowledge-hub__action-card">
            <Package :size="22" />
            <span class="knowledge-hub__action-label">Мої серії</span>
          </router-link>
        </div>
      </section>

      <!-- Recent Lessons -->
      <section class="knowledge-hub__section">
        <h2 class="knowledge-hub__section-title">Останні уроки</h2>
        <div class="knowledge-hub__lessons-grid">
          <div
            v-for="lesson in recentLessons"
            :key="lesson.id"
            class="knowledge-hub__lesson-card"
          >
            <router-link
              :to="`/lesson/${lesson.tutor_slug || ''}/${lesson.slug || ''}`"
              class="knowledge-hub__lesson-link"
            >
              <h3 class="knowledge-hub__lesson-title">{{ lesson.title || 'Без назви' }}</h3>
              <div class="knowledge-hub__lesson-meta">
                <span v-if="lesson.subject_tag" class="knowledge-hub__lesson-tag">{{ lesson.subject_tag }}</span>
                <span class="knowledge-hub__lesson-date">{{ formatDate(lesson.published_at || lesson.created_at) }}</span>
              </div>
            </router-link>
            <div class="knowledge-hub__lesson-actions">
              <span
                class="knowledge-hub__lesson-status"
                :class="lesson.status === 'public' ? 'knowledge-hub__lesson-status--public' : 'knowledge-hub__lesson-status--draft'"
              >
                {{ lesson.status === 'public' ? 'Опублікований' : 'Чернетка' }}
              </span>
              <button
                type="button"
                class="knowledge-hub__visibility-btn"
                :disabled="togglingId === lesson.id"
                :title="lesson.status === 'public' ? 'Сховати з каталогу' : 'Опублікувати'"
                @click="toggleVisibility(lesson)"
              >
                <Eye v-if="lesson.status !== 'public'" :size="16" />
                <EyeOff v-else :size="16" />
                {{ lesson.status === 'public' ? 'Сховати' : 'Опублікувати' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Achievements — тільки якщо є хоч 1 earned -->
      <section v-if="hasEarnedAchievements" class="knowledge-hub__section">
        <AchievementsPanel :achievements="achievements" />
      </section>

      <!-- Аналітика / Колекції — карточки-посилання -->
      <div class="knowledge-hub__link-cards">
        <router-link to="/knowledge/analytics" class="knowledge-hub__link-card">
          <BarChart3 :size="24" />
          <div>
            <h3 class="knowledge-hub__link-card-title">Аналітика</h3>
            <p class="knowledge-hub__link-card-desc">Статистика ваших уроків</p>
          </div>
        </router-link>
        <router-link to="/knowledge/collections" class="knowledge-hub__link-card">
          <FolderOpen :size="24" />
          <div>
            <h3 class="knowledge-hub__link-card-title">Підбірки</h3>
            <p class="knowledge-hub__link-card-desc">Тематичні підбірки уроків</p>
          </div>
        </router-link>
      </div>
    </template>

    <!-- Loading skeleton -->
    <template v-else>
      <div class="knowledge-hub__skeleton-grid">
        <div v-for="i in 4" :key="i" class="knowledge-hub__skeleton-card" />
      </div>
    </template>

    <!-- Terms Hint — показуємо завжди (dismissable) -->
    <KnowledgeTermsHint />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import {
  Eye, EyeOff, BookOpen, PenTool, Search, Layout,
  Package, ChevronRight, BarChart3, FolderOpen,
} from 'lucide-vue-next'
import apiClient from '@/utils/apiClient'

const KnowledgeStatsWidget = defineAsyncComponent({
  loader: () => import('../components/KnowledgeStatsWidget.vue'),
  errorComponent: { render: () => null },
})
const AchievementsPanel = defineAsyncComponent({
  loader: () => import('../components/AchievementsPanel.vue'),
  errorComponent: { render: () => null },
})
const KnowledgeTermsHint = defineAsyncComponent({
  loader: () => import('../components/KnowledgeTermsHint.vue'),
  errorComponent: { render: () => null },
  loadingComponent: { render: () => null },
})

import { analyticsApi, type TutorAchievement } from '../api/analyticsApi'

interface RecentLesson {
  id: string
  title: string
  slug?: string
  tutor_slug?: string
  subject_tag?: string
  status?: string
  published_at?: string
  created_at?: string
}

const recentLessons = ref<RecentLesson[]>([])
const isLoadingLessons = ref(true)
const achievements = ref<TutorAchievement[]>([])
const togglingId = ref<string | null>(null)

// Є контент — показати повний dashboard
const hasAnyContent = computed(() => recentLessons.value.length > 0)

// Є хоч одне earned досягнення — тоді показуємо блок
const hasEarnedAchievements = computed(() =>
  achievements.value.some(a => a.earned_at || a.progress >= 100)
)

async function toggleVisibility(lesson: RecentLesson): Promise<void> {
  togglingId.value = lesson.id
  try {
    const endpoint = lesson.status === 'public'
      ? `/v1/knowledge/my-lessons/${lesson.id}/unpublish/`
      : `/v1/knowledge/my-lessons/${lesson.id}/republish/`
    const res = await apiClient.post(endpoint) as { status: string }
    lesson.status = res.status
  } catch (err) {
    console.error('[KnowledgeHubPage] Toggle visibility failed:', err)
  } finally {
    togglingId.value = null
  }
}

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

  // Achievements (non-blocking)
  try {
    achievements.value = await analyticsApi.getMyAchievements()
  } catch {
    // не критично
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
  color: var(--text-primary);
  margin: 0 0 20px;
}

.knowledge-hub__stats {
  margin-bottom: 24px;
}

/* ── Section ───────────────────────────────────────── */
.knowledge-hub__section {
  margin-bottom: 28px;
}

.knowledge-hub__section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
}

/* ══ Welcome (new tutor) ═══════════════════════════ */
.knowledge-hub__welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 24px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  margin-bottom: 24px;
}

.knowledge-hub__welcome-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--accent);
  margin-bottom: 16px;
}

.knowledge-hub__welcome-title {
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.knowledge-hub__welcome-text {
  font-size: 15px;
  color: var(--text-secondary);
  margin: 0 0 20px;
  max-width: 420px;
  line-height: 1.5;
}

.knowledge-hub__welcome-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  background: var(--accent);
  color: #fff;
  border-radius: 10px;
  text-decoration: none;
  font-size: 15px;
  font-weight: 700;
  transition: background 0.15s, transform 0.1s;
}

.knowledge-hub__welcome-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

/* ── Steps ──────────────────────────────────────────── */
.knowledge-hub__steps {
  margin-bottom: 24px;
}

.knowledge-hub__steps-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 12px;
}

.knowledge-hub__steps-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.knowledge-hub__step {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.knowledge-hub__step strong {
  font-size: 14px;
  color: var(--text-primary);
  display: block;
  margin-bottom: 4px;
}

.knowledge-hub__step p {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.4;
}

.knowledge-hub__step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}

/* ── Explore card (new tutor) ──────────────────────── */
.knowledge-hub__explore-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  text-decoration: none;
  color: var(--text-primary);
  transition: border-color 0.15s;
}

.knowledge-hub__explore-card:hover {
  border-color: var(--accent);
}

.knowledge-hub__explore-card strong {
  font-size: 14px;
  display: block;
  margin-bottom: 2px;
}

.knowledge-hub__explore-card p {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.knowledge-hub__explore-arrow {
  margin-left: auto;
  color: var(--text-secondary);
}

/* ── Quick Actions (active tutor) ─────────────────── */
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
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  text-decoration: none;
  color: var(--text-primary);
  transition: border-color 0.15s, box-shadow 0.15s;
  text-align: center;
}

.knowledge-hub__action-card:hover {
  border-color: var(--accent);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.1);
}

.knowledge-hub__action-card--primary {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-secondary));
  border-color: color-mix(in srgb, var(--accent) 30%, var(--border-color));
}

.knowledge-hub__action-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
}

/* ── Skeleton ────────────────────────────────────────── */
.knowledge-hub__skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.knowledge-hub__skeleton-card {
  height: 80px;
  background: var(--bg-secondary);
  border-radius: 10px;
  animation: kh-pulse 1.5s ease-in-out infinite;
}

@keyframes kh-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── Lessons Grid ────────────────────────────────────── */
.knowledge-hub__lessons-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.knowledge-hub__lesson-card {
  padding: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  transition: border-color 0.15s;
}

.knowledge-hub__lesson-card:hover {
  border-color: var(--accent);
}

.knowledge-hub__lesson-link {
  text-decoration: none;
  color: inherit;
  display: block;
}

.knowledge-hub__lesson-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border-color);
}

.knowledge-hub__lesson-status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.knowledge-hub__lesson-status--public {
  background: var(--success-bg, #dcfce7);
  color: var(--success-text, #166534);
}

.knowledge-hub__lesson-status--draft {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.knowledge-hub__visibility-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.knowledge-hub__visibility-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.knowledge-hub__visibility-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.knowledge-hub__lesson-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
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
  color: var(--text-secondary);
}

.knowledge-hub__lesson-tag {
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.knowledge-hub__lesson-date {
  white-space: nowrap;
}

/* ── Link Cards ──────────────────────────────────────── */
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
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s;
}

.knowledge-hub__link-card:hover {
  border-color: var(--accent);
}

.knowledge-hub__link-card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 2px;
}

.knowledge-hub__link-card-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

/* ── Mobile ──────────────────────────────────────────── */
@media (max-width: 640px) {
  .knowledge-hub { padding: 16px; }
  .knowledge-hub__title { font-size: 20px; }

  .knowledge-hub__actions {
    grid-template-columns: repeat(2, 1fr);
  }

  .knowledge-hub__lessons-grid {
    grid-template-columns: 1fr;
  }

  .knowledge-hub__skeleton-grid {
    grid-template-columns: 1fr;
  }

  .knowledge-hub__link-cards {
    grid-template-columns: 1fr;
  }

  .knowledge-hub__steps-grid {
    grid-template-columns: 1fr;
  }

  .knowledge-hub__welcome {
    padding: 28px 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .knowledge-hub__skeleton-card { animation: none; }
}
</style>
