<template>
  <div class="replay-panel">
    <header class="replay-panel__header">
      <div>
        <h2 class="replay-panel__title">{{ t('staff.replayAnalytics.title') }}</h2>
        <p class="replay-panel__subtitle">{{ t('staff.replayAnalytics.subtitle') }}</p>
      </div>
      <div class="replay-panel__filters">
        <label class="replay-panel__label">
          {{ t('staff.replayAnalytics.period') }}
          <select v-model.number="days" class="replay-panel__select" @change="load">
            <option :value="7">{{ t('staff.replayAnalytics.last7d') }}</option>
            <option :value="14">{{ t('staff.replayAnalytics.last14d') }}</option>
            <option :value="30">{{ t('staff.replayAnalytics.last30d') }}</option>
            <option :value="90">{{ t('staff.replayAnalytics.last90d') }}</option>
          </select>
        </label>
        <button
          type="button"
          class="replay-panel__refresh"
          :disabled="loading"
          @click="load"
        >
          🔄 {{ t('common.refresh') }}
        </button>
      </div>
    </header>

    <div v-if="error" class="replay-panel__error" role="alert">
      {{ error }}
    </div>

    <div v-if="loading" class="replay-panel__loading">
      <LoadingSpinner />
    </div>

    <template v-else-if="data">
      <!-- KPI Cards -->
      <section class="replay-panel__kpi">
        <div class="kpi-card">
          <span class="kpi-card__value">{{ formatNumber(data.kpi.total_views) }}</span>
          <span class="kpi-card__label">{{ t('staff.replayAnalytics.kpi.totalViews') }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__value">{{ formatNumber(data.kpi.views_7d) }}</span>
          <span class="kpi-card__label">{{ t('staff.replayAnalytics.kpi.views7d') }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__value">{{ formatNumber(data.kpi.views_30d) }}</span>
          <span class="kpi-card__label">{{ t('staff.replayAnalytics.kpi.views30d') }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-card__value">{{ formatNumber(data.kpi.unique_ips) }}</span>
          <span class="kpi-card__label">
            {{ t('staff.replayAnalytics.kpi.uniqueIps') }}
            <span class="kpi-card__hint">({{ t('staff.replayAnalytics.kpi.privacyNote') }})</span>
          </span>
        </div>
      </section>

      <!-- Replay counts -->
      <section class="replay-panel__counts">
        <div class="count-pill count-pill--total">
          <span class="count-pill__label">{{ t('staff.replayAnalytics.counts.total') }}</span>
          <strong class="count-pill__value">{{ data.replay_counts.total }}</strong>
        </div>
        <div class="count-pill count-pill--active">
          <span class="count-pill__label">{{ t('winterboard.replayList.tabs.active') }}</span>
          <strong class="count-pill__value">{{ data.replay_counts.active }}</strong>
        </div>
        <div class="count-pill count-pill--archived">
          <span class="count-pill__label">{{ t('winterboard.replayList.tabs.archived') }}</span>
          <strong class="count-pill__value">{{ data.replay_counts.archived }}</strong>
        </div>
        <div class="count-pill count-pill--trashed">
          <span class="count-pill__label">{{ t('winterboard.replayList.tabs.trashed') }}</span>
          <strong class="count-pill__value">{{ data.replay_counts.trashed }}</strong>
        </div>
      </section>

      <!-- Daily trend (inline bar chart) -->
      <section class="replay-panel__trend">
        <h3 class="replay-panel__section-title">
          {{ t('staff.replayAnalytics.trendTitle', { days: data.trend.days }) }}
        </h3>
        <div v-if="data.trend.data.length === 0" class="replay-panel__empty">
          {{ t('staff.replayAnalytics.noTrend') }}
        </div>
        <div v-else class="trend-chart">
          <div
            v-for="point in data.trend.data"
            :key="point.day"
            class="trend-chart__bar-wrap"
            :title="`${formatDate(point.day)}: ${point.views}`"
          >
            <div
              class="trend-chart__bar"
              :style="{ height: trendBarHeight(point.views) + '%' }"
            />
            <span class="trend-chart__value">{{ point.views }}</span>
          </div>
        </div>
      </section>

      <!-- Top replays table -->
      <section class="replay-panel__top">
        <h3 class="replay-panel__section-title">
          {{ t('staff.replayAnalytics.topTitle', { count: data.top_replays.length }) }}
        </h3>
        <div v-if="data.top_replays.length === 0" class="replay-panel__empty">
          {{ t('staff.replayAnalytics.noReplays') }}
        </div>
        <table v-else class="top-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{{ t('staff.replayAnalytics.columns.title') }}</th>
              <th>{{ t('staff.replayAnalytics.columns.owner') }}</th>
              <th class="top-table__num">{{ t('staff.replayAnalytics.columns.views') }}</th>
              <th>{{ t('staff.replayAnalytics.columns.status') }}</th>
              <th>{{ t('staff.replayAnalytics.columns.visibility') }}</th>
              <th>{{ t('staff.replayAnalytics.columns.lastViewed') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in data.top_replays" :key="r.id">
              <td>{{ i + 1 }}</td>
              <td class="top-table__title">{{ r.title }}</td>
              <td class="top-table__owner">{{ r.owner_email }}</td>
              <td class="top-table__num"><strong>{{ r.view_count }}</strong></td>
              <td>
                <span class="status-badge" :class="`status-badge--${r.status}`">
                  {{ t(`staff.replayAnalytics.status.${r.status}`) }}
                </span>
              </td>
              <td>
                <span class="vis-badge" :class="`vis-badge--${r.visibility}`">
                  {{ t(`winterboard.replayList.visibility.${r.visibility}`) }}
                </span>
              </td>
              <td class="top-table__date">
                {{ r.last_viewed_at ? formatDate(r.last_viewed_at) : '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer class="replay-panel__footer">
        {{ t('staff.replayAnalytics.generatedAt') }}: {{ formatDateTime(data.generated_at) }}
      </footer>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import staffAnalyticsApi, { type ReplayAnalyticsResponse } from '../api/staffAnalyticsApi'

const { t } = useI18n()

const days = ref<7 | 14 | 30 | 90>(30)
const loading = ref(false)
const error = ref<string | null>(null)
const data = ref<ReplayAnalyticsResponse | null>(null)

const maxTrendViews = computed(() => {
  if (!data.value?.trend.data.length) return 1
  return Math.max(...data.value.trend.data.map((p) => p.views), 1)
})

function trendBarHeight(views: number): number {
  return Math.max(4, Math.round((views / maxTrendViews.value) * 100))
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await staffAnalyticsApi.getReplayAnalytics({ days: days.value, top: 10 })
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status
    error.value = status === 403
      ? t('staff.replayAnalytics.error403')
      : t('staff.replayAnalytics.errorLoad')
    console.error('[ReplayAnalyticsPanel] load failed', err)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.replay-panel {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.replay-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.replay-panel__title {
  margin: 0 0 4px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.replay-panel__subtitle {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.replay-panel__filters {
  display: flex;
  align-items: end;
  gap: 8px;
}

.replay-panel__label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.replay-panel__select {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.replay-panel__refresh {
  padding: 7px 14px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-primary);
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
}
.replay-panel__refresh:hover:not(:disabled) {
  background: var(--bg-secondary);
}
.replay-panel__refresh:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.replay-panel__error {
  padding: 12px 16px;
  background: color-mix(in srgb, var(--color-error, #dc2626) 8%, transparent);
  color: var(--color-error, #dc2626);
  border-radius: 8px;
}

.replay-panel__loading {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

/* KPI cards */
.replay-panel__kpi {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.kpi-card__value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--accent);
}

.kpi-card__label {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.kpi-card__hint {
  font-size: 0.6875rem;
  opacity: 0.7;
}

/* Replay counts pills */
.replay-panel__counts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.count-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
}

.count-pill__label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.count-pill__value {
  font-size: 0.9375rem;
  color: var(--text-primary);
}

.count-pill--trashed { border-color: color-mix(in srgb, var(--color-error, #dc2626) 30%, transparent); }

/* Section titles */
.replay-panel__section-title {
  margin: 0 0 12px;
  font-size: 0.9375rem;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.replay-panel__empty {
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-radius: 8px;
}

/* Trend chart */
.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  min-height: 120px;
  padding: 8px;
  background: var(--bg-secondary);
  border-radius: 8px;
  overflow-x: auto;
}

.trend-chart__bar-wrap {
  flex: 1 0 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 12px;
  height: 100px;
  justify-content: flex-end;
}

.trend-chart__bar {
  width: 100%;
  background: var(--accent);
  border-radius: 2px 2px 0 0;
  min-height: 4px;
  transition: height 0.2s;
}

.trend-chart__value {
  font-size: 0.625rem;
  color: var(--text-secondary);
}

/* Top table */
.top-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.top-table th,
.top-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-color);
  text-align: left;
}

.top-table th {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.top-table__num {
  text-align: right;
}

.top-table__title {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.top-table__owner {
  font-family: monospace;
  font-size: 0.8125rem;
  color: var(--text-secondary);
}

.top-table__date {
  color: var(--text-secondary);
  font-size: 0.8125rem;
}

.status-badge,
.vis-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
}

.status-badge--active { background: color-mix(in srgb, var(--accent) 12%, transparent); color: var(--accent); }
.status-badge--archived { background: color-mix(in srgb, var(--text-secondary) 12%, transparent); color: var(--text-secondary); }
.status-badge--trashed { background: color-mix(in srgb, var(--color-error, #dc2626) 12%, transparent); color: var(--color-error, #dc2626); }

.vis-badge--public { background: color-mix(in srgb, var(--color-success, #10b981) 12%, transparent); color: var(--color-success, #10b981); }
.vis-badge--unlisted { background: color-mix(in srgb, var(--accent) 10%, transparent); color: var(--accent); }
.vis-badge--private { background: var(--bg-secondary); color: var(--text-secondary); }

.replay-panel__footer {
  font-size: 0.75rem;
  color: var(--text-secondary);
  text-align: right;
}
</style>
