<!-- Phase 15 A2.2: Knowledge Analytics Page — tutor stats, views chart, top lessons, achievements
     Authenticated. Ref: AGENT_A_FE_CORE.md A2.2 -->
<template>
  <div class="analytics-page">
    <h1 class="analytics-page__title">Аналітика Knowledge</h1>

    <!-- Loading -->
    <div v-if="isLoading" class="analytics-page__loading">
      <div class="analytics-page__spinner" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="analytics-page__error">
      <p>{{ error }}</p>
      <button type="button" class="analytics-page__retry-btn" @click="loadAll">Спробувати знову</button>
    </div>

    <template v-else-if="stats">
      <!-- KPI Cards -->
      <section class="analytics-page__kpis">
        <div class="analytics-page__kpi">
          <span class="analytics-page__kpi-value">{{ formatNumber(stats.total_views) }}</span>
          <span class="analytics-page__kpi-label">Переглядів</span>
        </div>
        <div class="analytics-page__kpi">
          <span class="analytics-page__kpi-value">{{ formatNumber(stats.total_forks) }}</span>
          <span class="analytics-page__kpi-label">Форків</span>
        </div>
        <div class="analytics-page__kpi">
          <span class="analytics-page__kpi-value">{{ formatNumber(stats.total_clones) }}</span>
          <span class="analytics-page__kpi-label">Клонів</span>
        </div>
        <div class="analytics-page__kpi">
          <span class="analytics-page__kpi-value">
            {{ stats.average_rating != null ? `★ ${stats.average_rating.toFixed(1)}` : '—' }}
          </span>
          <span class="analytics-page__kpi-label">Рейтинг</span>
        </div>
      </section>

      <!-- Views Chart -->
      <section class="analytics-page__chart-section">
        <div class="analytics-page__chart-header">
          <h2 class="analytics-page__section-title">Перегляди за {{ period }} днів</h2>
          <div class="analytics-page__period-select">
            <button
              v-for="p in ([7, 30, 90] as const)"
              :key="p"
              type="button"
              class="analytics-page__period-btn"
              :class="{ 'analytics-page__period-btn--active': period === p }"
              @click="period = p"
            >{{ p }}д</button>
          </div>
        </div>

        <div v-if="viewsTimeseries.length === 0" class="analytics-page__chart-empty">
          Немає даних за цей період
        </div>
        <div v-else class="analytics-page__chart">
          <div
            v-for="point in chartData"
            :key="point.date"
            class="analytics-page__bar-wrap"
            :title="`${point.label}: ${point.views_count} переглядів`"
          >
            <div
              class="analytics-page__bar"
              :style="{ height: point.heightPercent + '%' }"
            />
            <span class="analytics-page__bar-label">{{ point.label }}</span>
          </div>
        </div>
      </section>

      <!-- Top Lessons -->
      <section v-if="stats.top_lessons.length > 0" class="analytics-page__top-section">
        <h2 class="analytics-page__section-title">Топ-5 уроків</h2>
        <div class="analytics-page__top-table">
          <div class="analytics-page__top-head">
            <span class="analytics-page__top-col analytics-page__top-col--name">Назва</span>
            <span class="analytics-page__top-col">Views</span>
            <span class="analytics-page__top-col">Forks</span>
            <span class="analytics-page__top-col">Rating</span>
          </div>
          <a
            v-for="lesson in stats.top_lessons"
            :key="lesson.id"
            :href="`/lesson/${lesson.slug}`"
            class="analytics-page__top-row"
          >
            <span class="analytics-page__top-col analytics-page__top-col--name">{{ lesson.title }}</span>
            <span class="analytics-page__top-col">{{ lesson.views }}</span>
            <span class="analytics-page__top-col">{{ lesson.forks }}</span>
            <span class="analytics-page__top-col">
              {{ lesson.avg_rating != null ? `★${lesson.avg_rating.toFixed(1)}` : '—' }}
            </span>
          </a>
        </div>
      </section>

      <!-- Phase 16 INT-45: Knowledge network mini-graph -->
      <KnowledgeGraph
        v-if="stats.top_lessons.length > 0"
        :lessons="stats.top_lessons"
      />

      <!-- Achievements -->
      <section v-if="achievements.length > 0" class="analytics-page__achievements-section">
        <h2 class="analytics-page__section-title">Досягнення</h2>
        <div class="analytics-page__achievements-grid">
          <div
            v-for="ach in achievements"
            :key="ach.achievement_type"
            class="analytics-page__ach-card"
            :class="{ 'analytics-page__ach-card--locked': !ach.earned_at }"
          >
            <span class="analytics-page__ach-icon">{{ ach.icon || '🎖️' }}</span>
            <div class="analytics-page__ach-info">
              <h3 class="analytics-page__ach-name">{{ ach.display_name }}</h3>
              <p class="analytics-page__ach-desc">{{ ach.description }}</p>
              <div v-if="ach.earned_at" class="analytics-page__ach-date">
                {{ formatDate(ach.earned_at) }}
              </div>
              <div v-else-if="ach.progress != null" class="analytics-page__ach-progress">
                <div class="analytics-page__ach-progress-bar">
                  <div
                    class="analytics-page__ach-progress-fill"
                    :style="{ width: ach.progress + '%' }"
                  />
                </div>
                <span class="analytics-page__ach-progress-text">{{ ach.progress }}%</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useKnowledgeAnalytics } from '../composables/useKnowledgeAnalytics'
import KnowledgeGraph from '../components/KnowledgeGraph.vue'

const {
  stats,
  viewsTimeseries,
  achievements,
  isLoading,
  error,
  period,
  loadAll,
} = useKnowledgeAnalytics()

// ── Chart data ───────────────────────────────────────────────────────────────

const chartData = computed(() => {
  if (viewsTimeseries.value.length === 0) return []
  const maxViews = Math.max(...viewsTimeseries.value.map(p => p.views_count), 1)
  return viewsTimeseries.value.map(p => ({
    ...p,
    heightPercent: Math.max((p.views_count / maxViews) * 100, 2),
    label: formatChartDate(p.date),
  }))
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(loadAll)
</script>

<style scoped>
.analytics-page {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px 24px 64px;
}

.analytics-page__title {
  font-size: 24px;
  font-weight: 800;
  color: #0f172a;
  margin: 0 0 24px;
}

/* ── Loading / Error ──────────────────────────────────────────── */
.analytics-page__loading {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.analytics-page__spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: an-spin 0.7s linear infinite;
}

@keyframes an-spin { to { transform: rotate(360deg); } }

.analytics-page__error {
  text-align: center;
  padding: 32px 0;
  color: #64748b;
  font-size: 14px;
}

.analytics-page__retry-btn {
  margin-top: 12px;
  padding: 6px 14px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #475569;
  cursor: pointer;
}

/* ── KPIs ─────────────────────────────────────────────────────── */
.analytics-page__kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}

.analytics-page__kpi {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
}

.analytics-page__kpi-value {
  display: block;
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
  line-height: 1.2;
}

.analytics-page__kpi-label {
  display: block;
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

/* ── Chart ────────────────────────────────────────────────────── */
.analytics-page__chart-section {
  margin-bottom: 32px;
}

.analytics-page__chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.analytics-page__section-title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.analytics-page__period-select {
  display: flex;
  gap: 4px;
}

.analytics-page__period-btn {
  padding: 4px 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.analytics-page__period-btn--active {
  background: #6366f1;
  color: #ffffff;
  border-color: #6366f1;
}

.analytics-page__chart-empty {
  padding: 32px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 14px;
}

.analytics-page__chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 180px;
  padding: 0 4px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 12px 28px;
  overflow-x: auto;
}

.analytics-page__bar-wrap {
  flex: 1;
  min-width: 8px;
  max-width: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  position: relative;
}

.analytics-page__bar {
  width: 100%;
  background: #6366f1;
  border-radius: 3px 3px 0 0;
  min-height: 2px;
  transition: height 0.3s ease;
}

.analytics-page__bar-label {
  position: absolute;
  bottom: -20px;
  font-size: 9px;
  color: #94a3b8;
  white-space: nowrap;
}

/* ── Top lessons ──────────────────────────────────────────────── */
.analytics-page__top-section {
  margin-bottom: 32px;
}

.analytics-page__top-table {
  margin-top: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.analytics-page__top-head {
  display: grid;
  grid-template-columns: 1fr 70px 70px 70px;
  padding: 10px 16px;
  background: #f1f5f9;
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
}

.analytics-page__top-row {
  display: grid;
  grid-template-columns: 1fr 70px 70px 70px;
  padding: 12px 16px;
  border-top: 1px solid #f1f5f9;
  text-decoration: none;
  color: inherit;
  font-size: 14px;
  transition: background 0.15s;
}

.analytics-page__top-row:hover { background: #f8fafc; }

.analytics-page__top-col {
  display: flex;
  align-items: center;
}

.analytics-page__top-col--name {
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Achievements ─────────────────────────────────────────────── */
.analytics-page__achievements-section {
  margin-bottom: 32px;
}

.analytics-page__achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin-top: 12px;
}

.analytics-page__ach-card {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  transition: border-color 0.15s;
}

.analytics-page__ach-card:hover { border-color: #cbd5e1; }

.analytics-page__ach-card--locked {
  opacity: 0.55;
}

.analytics-page__ach-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.analytics-page__ach-info {
  flex: 1;
  min-width: 0;
}

.analytics-page__ach-name {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 2px;
}

.analytics-page__ach-desc {
  font-size: 12px;
  color: #64748b;
  margin: 0;
  line-height: 1.4;
}

.analytics-page__ach-date {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
}

.analytics-page__ach-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.analytics-page__ach-progress-bar {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.analytics-page__ach-progress-fill {
  height: 100%;
  background: #6366f1;
  border-radius: 3px;
}

.analytics-page__ach-progress-text {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}

/* ── Mobile ────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .analytics-page { padding: 20px 16px 48px; }

  .analytics-page__kpis {
    grid-template-columns: repeat(2, 1fr);
  }

  .analytics-page__kpi-value { font-size: 22px; }

  .analytics-page__top-head,
  .analytics-page__top-row {
    grid-template-columns: 1fr 56px 56px 56px;
    font-size: 12px;
    padding: 8px 12px;
  }

  .analytics-page__chart { height: 140px; }
}

@media (prefers-reduced-motion: reduce) {
  .analytics-page__spinner { animation: none; }
  .analytics-page__bar { transition: none; }
}
</style>
