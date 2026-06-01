<!-- Knowledge Hub — central tutor page.
     Adapts UI: friendly onboarding for new tutors, full dashboard for active ones. -->
<template>
  <div class="knowledge-hub">
    <BreadcrumbNav :items="breadcrumbs" />
    <h1 class="knowledge-hub__title">{{ $t('sidebar.item.knowledgeHub') }}</h1>

    <!-- UX-2 + UX-4: Stats — при 5+ уроків, collapsible -->
    <details v-if="lessonsCount >= 5" class="knowledge-hub__collapsible" :open="!statsCollapsed" @toggle="handleStatsToggle">
      <summary class="knowledge-hub__collapsible-summary">📊 {{ t('knowledge.hub.analyticsTitle') }}</summary>
      <KnowledgeStatsWidget class="knowledge-hub__stats" />
    </details>

    <!-- ═══ Новий тьютор — Onboarding ═══ -->
    <template v-if="!isLoadingLessons && !hasAnyContent">
      <!-- Привітальний блок замість порожнечі -->
      <section class="knowledge-hub__welcome">
        <div class="knowledge-hub__welcome-icon">
          <BookOpen :size="40" />
        </div>
        <h2 class="knowledge-hub__welcome-title">{{ t('knowledge.hub.welcomeTitle') }}</h2>
        <p class="knowledge-hub__welcome-text">
          {{ t('knowledge.hub.welcomeText') }}
        </p>
        <router-link to="/winterboard/boards" class="knowledge-hub__welcome-btn">
          <PenTool :size="18" />
          {{ t('knowledge.hub.welcomeBtn') }}
        </router-link>
      </section>

      <!-- Підказка для новачка — 2 простих кроки -->
      <section class="knowledge-hub__steps">
        <h3 class="knowledge-hub__steps-title">{{ t('knowledge.hub.stepsTitle') }}</h3>
        <div class="knowledge-hub__steps-grid">
          <div class="knowledge-hub__step">
            <span class="knowledge-hub__step-number">1</span>
            <div>
              <strong>{{ t('knowledge.hub.step1Title') }}</strong>
              <p>{{ t('knowledge.hub.step1Desc') }}</p>
            </div>
          </div>
          <div class="knowledge-hub__step">
            <span class="knowledge-hub__step-number">2</span>
            <div>
              <strong>{{ t('knowledge.hub.step2Title') }}</strong>
              <p>{{ t('knowledge.hub.step2Desc') }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Каталог — єдина швидка дія для новачка -->
      <section class="knowledge-hub__section">
        <router-link to="/knowledge/catalog" class="knowledge-hub__explore-card">
          <Search :size="20" />
          <div>
            <strong>{{ t('knowledge.hub.exploreCatalog') }}</strong>
            <p>{{ t('knowledge.hub.exploreCatalogDesc') }}</p>
          </div>
          <ChevronRight :size="18" class="knowledge-hub__explore-arrow" />
        </router-link>
      </section>
    </template>

    <!-- ═══ Активний тьютор — повний dashboard ═══ -->
    <template v-else-if="!isLoadingLessons && hasAnyContent">
      <!-- UX-1: Progressive QuickActions — 0→1 CTA (welcome), <5→2, 5+→all 4 -->
      <section class="knowledge-hub__section">
        <div class="knowledge-hub__actions">
          <router-link to="/winterboard/boards" class="knowledge-hub__action-card knowledge-hub__action-card--primary">
            <PenTool :size="22" />
            <span class="knowledge-hub__action-label">{{ t('knowledge.hub.createLesson') }}</span>
          </router-link>
          <router-link to="/knowledge/catalog" class="knowledge-hub__action-card">
            <Search :size="22" />
            <span class="knowledge-hub__action-label">{{ $t('sidebar.item.lessonCatalog') }}</span>
          </router-link>
          <router-link v-if="lessonsCount >= 5" to="/knowledge/library" class="knowledge-hub__action-card">
            <Layout :size="22" />
            <span class="knowledge-hub__action-label">{{ $t('sidebar.item.templateLibrary') }}</span>
          </router-link>
          <router-link v-if="lessonsCount >= 5" to="/knowledge/packs" class="knowledge-hub__action-card">
            <Package :size="22" />
            <span class="knowledge-hub__action-label">{{ $t('sidebar.item.myPacks') }}</span>
          </router-link>
        </div>
      </section>

      <!-- Lessons list -->
      <section class="knowledge-hub__section">
        <div class="knowledge-hub__section-header">
          <h2 class="knowledge-hub__section-title">
            {{ showAllLessons ? t('knowledge.hub.myLessons') : t('knowledge.hub.recentLessons') }}
          </h2>
          <span v-if="totalLessonsCount > 4" class="knowledge-hub__total-badge">
            {{ t('knowledge.hub.totalLessons', { count: totalLessonsCount }) }}
          </span>
          <button
            v-if="totalLessonsCount > 4"
            type="button"
            class="knowledge-hub__show-all-btn"
            :disabled="isLoadingAll"
            @click="toggleShowAll"
          >
            {{ showAllLessons ? t('knowledge.hub.showLess') : t('knowledge.hub.showAll') }}
          </button>
        </div>
        <div class="knowledge-hub__lessons-grid">
          <div
            v-for="lesson in displayedLessons"
            :key="lesson.id"
            class="knowledge-hub__lesson-card"
          >
            <router-link
              :to="`/lesson/${lesson.tutor_slug || ''}/${lesson.slug || ''}`"
              class="knowledge-hub__lesson-link"
            >
              <h3 class="knowledge-hub__lesson-title">{{ lesson.title || t('knowledge.hub.noTitle') }}</h3>
              <div class="knowledge-hub__lesson-meta">
                <span v-if="lesson.subject_tag" class="knowledge-hub__lesson-tag">{{ lesson.subject_tag }}</span>
                <span class="knowledge-hub__lesson-date">{{ formatDate(lesson.published_at || lesson.created_at) }}</span>
              </div>
            </router-link>
            <!-- C1: Source board link — у конструкторі (це шаблон, не урок). -->
            <router-link
              v-if="lesson.source_session_id"
              :to="{ name: 'winterboard-prepare', params: { id: lesson.source_session_id } }"
              class="knowledge-hub__board-link"
            >
              {{ t('knowledge.hub.openBoard') }} →
            </router-link>
            <button
              type="button"
              class="knowledge-hub__use-lesson-btn"
              :disabled="loadingLessonId === lesson.id"
              @click="useLessonInSession(lesson)"
            >
              {{ loadingLessonId === lesson.id
                ? $t('knowledge.lesson.reuse.loading')
                : $t('knowledge.lesson.reuse.useLesson') }}
            </button>
            <p v-if="loadLessonError && loadingLessonId === lesson.id" class="knowledge-hub__use-lesson-error">{{ loadLessonError }}</p>
            <div class="knowledge-hub__lesson-actions">
              <span
                class="knowledge-hub__lesson-status"
                :class="lesson.status === 'public' ? 'knowledge-hub__lesson-status--public' : 'knowledge-hub__lesson-status--draft'"
              >
                {{ lesson.status === 'public' ? t('knowledge.hub.statusPublic') : t('knowledge.hub.statusDraft') }}
              </span>
              <div class="knowledge-hub__lesson-btns">
                <button
                  type="button"
                  class="knowledge-hub__visibility-btn"
                  :disabled="togglingId === lesson.id"
                  :title="lesson.status === 'public' ? t('knowledge.hub.hideFromCatalog') : t('knowledge.hub.publishAction')"
                  @click="toggleVisibility(lesson)"
                >
                  <Eye v-if="lesson.status !== 'public'" :size="16" />
                  <EyeOff v-else :size="16" />
                  {{ lesson.status === 'public' ? t('knowledge.hub.hideAction') : t('knowledge.hub.publishAction') }}
                </button>
                <button
                  type="button"
                  class="knowledge-hub__delete-btn"
                  :disabled="deletingId === lesson.id"
                  :title="t('knowledge.hub.deleteLesson')"
                  @click="confirmDelete(lesson)"
                >
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- C1: Delete confirmation dialog -->
      <Teleport to="body">
        <div v-if="deleteTarget" class="knowledge-hub__confirm-overlay" @click.self="deleteTarget = null">
          <div class="knowledge-hub__confirm-dialog" role="alertdialog" aria-modal="true">
            <p class="knowledge-hub__confirm-text">
              {{ t('knowledge.hub.deleteLessonConfirm', { title: deleteTarget.title }) }}
            </p>
            <div class="knowledge-hub__confirm-actions">
              <button type="button" class="knowledge-hub__confirm-cancel" @click="deleteTarget = null">
                {{ t('knowledge.hub.deleteLessonCancel') }}
              </button>
              <button
                type="button"
                class="knowledge-hub__confirm-delete"
                :disabled="deletingId === deleteTarget.id"
                @click="executeDelete"
              >
                {{ t('knowledge.hub.deleteLessonConfirmBtn') }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- Achievements — тільки якщо є хоч 1 earned -->
      <section v-if="hasEarnedAchievements" class="knowledge-hub__section">
        <AchievementsPanel :achievements="achievements" />
      </section>

      <!-- UX-2: Analytics/Collections — тільки при 5+ уроків -->
      <div v-if="lessonsCount >= 5" class="knowledge-hub__link-cards">
        <router-link to="/knowledge/analytics" class="knowledge-hub__link-card">
          <BarChart3 :size="24" />
          <div>
            <h3 class="knowledge-hub__link-card-title">{{ t('knowledge.hub.analyticsTitle') }}</h3>
            <p class="knowledge-hub__link-card-desc">{{ t('knowledge.hub.analyticsDesc') }}</p>
          </div>
        </router-link>
        <router-link to="/knowledge/collections" class="knowledge-hub__link-card">
          <FolderOpen :size="24" />
          <div>
            <h3 class="knowledge-hub__link-card-title">{{ t('knowledge.hub.collectionsTitle') }}</h3>
            <p class="knowledge-hub__link-card-desc">{{ t('knowledge.hub.collectionsDesc') }}</p>
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
  Package, ChevronRight, BarChart3, FolderOpen, Trash2,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import apiClient from '@/utils/apiClient'
import { useI18n } from 'vue-i18n'
import { lessonViewApi } from '../api/lessonViewApi'
import BreadcrumbNav from '@/components/ui/BreadcrumbNav.vue'

const router = useRouter()
const { t } = useI18n()

const breadcrumbs = computed(() => [
  { label: t('breadcrumb.home'), to: '/tutor' },
  { label: t('breadcrumb.knowledgeHub') },
])

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
  source_session_id?: string | null
}

const recentLessons = ref<RecentLesson[]>([])
const allLessons = ref<RecentLesson[]>([])
const isLoadingLessons = ref(true)
const isLoadingAll = ref(false)
const showAllLessons = ref(false)
const totalLessonsCount = ref(0)
const achievements = ref<TutorAchievement[]>([])
const togglingId = ref<string | null>(null)
const loadingLessonId = ref<string | null>(null)
const loadLessonError = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const deleteTarget = ref<RecentLesson | null>(null)

// Є контент — показати повний dashboard
const hasAnyContent = computed(() => recentLessons.value.length > 0)

// C1: Displayed lessons — recent 4 or full list
const displayedLessons = computed(() =>
  showAllLessons.value ? allLessons.value : recentLessons.value
)

// UX-1: Progressive QuickActions — lessons_count determines visible actions
const lessonsCount = computed(() =>
  showAllLessons.value ? allLessons.value.length : recentLessons.value.length
)

// UX-4: Collapsible sections — persist collapse state in localStorage
const statsCollapsed = ref(localStorage.getItem('kb:stats:collapsed') === 'true')

function handleStatsToggle(e: Event) {
  const open = (e.target as HTMLDetailsElement).open
  statsCollapsed.value = !open
  localStorage.setItem('kb:stats:collapsed', String(!open))
}

// Є хоч одне earned досягнення — тоді показуємо блок
const hasEarnedAchievements = computed(() =>
  achievements.value.some(a => a.earned_at || a.progress >= 100)
)

// C1: Toggle show all lessons
async function toggleShowAll(): Promise<void> {
  if (showAllLessons.value) {
    showAllLessons.value = false
    return
  }
  if (allLessons.value.length > 0) {
    showAllLessons.value = true
    return
  }
  isLoadingAll.value = true
  try {
    const res = await apiClient.get('/v1/knowledge/my-lessons/') as { lessons?: RecentLesson[]; total?: number }
    allLessons.value = res.lessons ?? []
    totalLessonsCount.value = res.total ?? allLessons.value.length
    showAllLessons.value = true
  } catch (err) {
    console.error('[KnowledgeHubPage] Failed to load all lessons:', err)
  } finally {
    isLoadingAll.value = false
  }
}

// C1: Delete lesson (soft delete)
function confirmDelete(lesson: RecentLesson): void {
  deleteTarget.value = lesson
}

async function executeDelete(): Promise<void> {
  if (!deleteTarget.value) return
  const id = deleteTarget.value.id
  deletingId.value = id
  try {
    await apiClient.delete(`/v1/knowledge/my-lessons/${id}/`)
    recentLessons.value = recentLessons.value.filter(l => l.id !== id)
    allLessons.value = allLessons.value.filter(l => l.id !== id)
    totalLessonsCount.value = Math.max(0, totalLessonsCount.value - 1)
    deleteTarget.value = null
  } catch (err) {
    console.error('[KnowledgeHubPage] Delete failed:', err)
  } finally {
    deletingId.value = null
  }
}

async function useLessonInSession(lesson: RecentLesson): Promise<void> {
  if (loadingLessonId.value) return
  loadingLessonId.value = lesson.id
  loadLessonError.value = null
  try {
    const { session_id, lesson_id } = await lessonViewApi.loadToSession(lesson.id)
    await router.push({
      name: 'winterboard-solo',
      params: { id: session_id },
      query: { source_lesson: lesson_id },
    })
  } catch (err) {
    console.error('[KnowledgeHubPage] load lesson error:', err)
    loadLessonError.value = t('knowledge.lesson.reuse.loadError')
  } finally {
    loadingLessonId.value = null
  }
}

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
    const res = await apiClient.get('/v1/knowledge/my-lessons/?limit=4') as { lessons?: RecentLesson[]; total?: number }
    recentLessons.value = res.lessons ?? []
    totalLessonsCount.value = res.total ?? recentLessons.value.length
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

/* UX-4: Collapsible sections */
.knowledge-hub__collapsible {
  margin-bottom: 20px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.knowledge-hub__collapsible-summary {
  padding: 12px 16px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  background: var(--bg-secondary);
  list-style: none;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

.knowledge-hub__collapsible-summary::-webkit-details-marker { display: none; }

.knowledge-hub__collapsible-summary::after {
  content: '▸';
  margin-left: auto;
  transition: transform 0.15s;
}

.knowledge-hub__collapsible[open] > .knowledge-hub__collapsible-summary::after {
  transform: rotate(90deg);
}

.knowledge-hub__stats {
  margin-bottom: 24px;
}

/* ── Section ───────────────────────────────────────── */
.knowledge-hub__section {
  margin-bottom: 28px;
}

.knowledge-hub__section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.knowledge-hub__section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.knowledge-hub__total-badge {
  font-size: 12px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: var(--bg-tertiary);
  border-radius: 10px;
}

.knowledge-hub__show-all-btn {
  margin-left: auto;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  background: none;
  border: 1px solid var(--accent);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.knowledge-hub__show-all-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.knowledge-hub__show-all-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

.knowledge-hub__use-lesson-btn {
  display: block;
  width: 100%;
  margin-top: 10px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 700;
  border: none;
  border-radius: 8px;
  background: var(--accent, #6366f1);
  color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.knowledge-hub__use-lesson-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.knowledge-hub__use-lesson-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.knowledge-hub__use-lesson-error {
  font-size: 11px;
  color: var(--error, #ef4444);
  margin: 4px 0 0;
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

.knowledge-hub__board-link {
  display: inline-block;
  font-size: 12px;
  color: var(--accent);
  text-decoration: none;
  margin-top: 6px;
  transition: color 0.15s;
}

.knowledge-hub__board-link:hover {
  color: var(--accent-hover, #4f46e5);
  text-decoration: underline;
}

.knowledge-hub__lesson-btns {
  display: flex;
  align-items: center;
  gap: 6px;
}

.knowledge-hub__delete-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.knowledge-hub__delete-btn:hover:not(:disabled) {
  border-color: var(--error, #ef4444);
  color: var(--error, #ef4444);
  background: color-mix(in srgb, var(--error, #ef4444) 8%, var(--bg-secondary));
}

.knowledge-hub__delete-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Confirm Dialog ──────────────────────────────────── */
.knowledge-hub__confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.knowledge-hub__confirm-dialog {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.knowledge-hub__confirm-text {
  font-size: 14px;
  color: var(--text-primary);
  margin: 0 0 20px;
  line-height: 1.5;
}

.knowledge-hub__confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.knowledge-hub__confirm-cancel {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.15s;
}

.knowledge-hub__confirm-cancel:hover {
  border-color: var(--text-secondary);
}

.knowledge-hub__confirm-delete {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  background: var(--error, #ef4444);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}

.knowledge-hub__confirm-delete:hover:not(:disabled) {
  background: color-mix(in srgb, var(--error, #ef4444) 85%, #000);
}

.knowledge-hub__confirm-delete:disabled {
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
