<template>
  <div class="cohort-analysis" data-testid="cohort-table">
    <div class="cohort-header">
      <h2 class="cohort-title">{{ $t('staff.analytics.cohorts.title') }}</h2>
      <div class="cohort-filters">
        <select v-model="cohortType" class="cohort-select" @change="loadCohorts">
          <option value="reg_week">{{ $t('staff.analytics.cohorts.byWeek') }}</option>
          <option value="reg_month">{{ $t('staff.analytics.cohorts.byMonth') }}</option>
        </select>
        <select v-model.number="cohortWeeks" class="cohort-select" @change="loadCohorts">
          <option :value="8">8</option>
          <option :value="12">12</option>
          <option :value="24">24</option>
          <option :value="52">52</option>
        </select>
      </div>
    </div>

    <div v-if="loading" class="cohort-loading">
      <LoadingSpinner />
    </div>

    <div v-else-if="error" class="cohort-error">
      <Alert variant="danger">{{ error }}</Alert>
    </div>

    <div v-else-if="cohorts.length === 0" class="cohort-empty">
      <EmptyState :text="$t('staff.analytics.cohorts.noData')" />
    </div>

    <div v-else class="cohort-table-wrap">
      <table class="cohort-table">
        <thead>
          <tr>
            <th class="cohort-col-key">{{ $t('staff.analytics.cohorts.cohort') }}</th>
            <th class="cohort-col-size text-right">{{ $t('staff.analytics.cohorts.size') }}</th>
            <th
              v-for="m in MILESTONES"
              :key="m.key"
              class="cohort-col-milestone text-right"
              :title="$t(m.tooltipKey)"
            >
              {{ $t(m.labelKey) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in cohorts" :key="c.cohort_key">
            <td class="cohort-key-cell">{{ c.cohort_key }}</td>
            <td class="cohort-size-cell text-right">{{ c.cohort_size }}</td>
            <td
              v-for="m in MILESTONES"
              :key="m.key"
              class="cohort-milestone-cell text-right"
              :style="heatmapStyle(pctVal(c, m.pctKey))"
            >
              <span class="cohort-pct">{{ pctVal(c, m.pctKey) }}%</span>
              <span class="cohort-abs">{{ absVal(c, m.absKey) }}</span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="cohort-legend">
        <span class="cohort-legend-label">{{ $t('staff.analytics.cohorts.legend') }}:</span>
        <span class="cohort-legend-item" :style="{ background: heatmapColor(0) }">0%</span>
        <span class="cohort-legend-item" :style="{ background: heatmapColor(25) }">25%</span>
        <span class="cohort-legend-item" :style="{ background: heatmapColor(50) }">50%</span>
        <span class="cohort-legend-item" :style="{ background: heatmapColor(75) }">75%</span>
        <span class="cohort-legend-item" :style="{ background: heatmapColor(100) }">100%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import staffAnalyticsApi from '../api/staffAnalyticsApi'
import type { CohortSnapshotItem } from '../api/staffAnalyticsApi'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import Alert from '@/ui/Alert.vue'
import EmptyState from '@/ui/EmptyState.vue'

const { t } = useI18n()

const MILESTONES = [
  {
    key: 'day_1_verified',
    absKey: 'day_1_verified' as keyof CohortSnapshotItem,
    pctKey: 'pct_day_1_verified' as keyof CohortSnapshotItem,
    labelKey: 'staff.analytics.cohorts.milestones.day1Verified',
    tooltipKey: 'staff.analytics.cohorts.milestones.day1VerifiedTooltip',
  },
  {
    key: 'day_1_login',
    absKey: 'day_1_login' as keyof CohortSnapshotItem,
    pctKey: 'pct_day_1_login' as keyof CohortSnapshotItem,
    labelKey: 'staff.analytics.cohorts.milestones.day1Login',
    tooltipKey: 'staff.analytics.cohorts.milestones.day1LoginTooltip',
  },
  {
    key: 'day_3_onboarding',
    absKey: 'day_3_onboarding' as keyof CohortSnapshotItem,
    pctKey: 'pct_day_3_onboarding' as keyof CohortSnapshotItem,
    labelKey: 'staff.analytics.cohorts.milestones.day3Onboarding',
    tooltipKey: 'staff.analytics.cohorts.milestones.day3OnboardingTooltip',
  },
  {
    key: 'day_7_published',
    absKey: 'day_7_published' as keyof CohortSnapshotItem,
    pctKey: 'pct_day_7_published' as keyof CohortSnapshotItem,
    labelKey: 'staff.analytics.cohorts.milestones.day7Published',
    tooltipKey: 'staff.analytics.cohorts.milestones.day7PublishedTooltip',
  },
  {
    key: 'day_14_inquiry',
    absKey: 'day_14_inquiry' as keyof CohortSnapshotItem,
    pctKey: 'pct_day_14_inquiry' as keyof CohortSnapshotItem,
    labelKey: 'staff.analytics.cohorts.milestones.day14Inquiry',
    tooltipKey: 'staff.analytics.cohorts.milestones.day14InquiryTooltip',
  },
  {
    key: 'day_30_active',
    absKey: 'day_30_active' as keyof CohortSnapshotItem,
    pctKey: 'pct_day_30_active' as keyof CohortSnapshotItem,
    labelKey: 'staff.analytics.cohorts.milestones.day30Active',
    tooltipKey: 'staff.analytics.cohorts.milestones.day30ActiveTooltip',
  },
] as const

const cohortType = ref<'reg_week' | 'reg_month'>('reg_week')
const cohortWeeks = ref(12)
const loading = ref(false)
const error = ref<string | null>(null)
const cohorts = ref<CohortSnapshotItem[]>([])

function pctVal(c: CohortSnapshotItem, key: keyof CohortSnapshotItem): number {
  return (c[key] as number) ?? 0
}

function absVal(c: CohortSnapshotItem, key: keyof CohortSnapshotItem): number {
  return (c[key] as number) ?? 0
}

function heatmapColor(pct: number): string {
  if (pct <= 0) return 'rgba(239, 68, 68, 0.15)'
  if (pct < 20) return 'rgba(239, 68, 68, 0.12)'
  if (pct < 40) return 'rgba(234, 179, 8, 0.15)'
  if (pct < 60) return 'rgba(234, 179, 8, 0.25)'
  if (pct < 80) return 'rgba(34, 197, 94, 0.15)'
  return 'rgba(34, 197, 94, 0.25)'
}

function heatmapStyle(pct: number): Record<string, string> {
  return { background: heatmapColor(pct) }
}

async function loadCohorts() {
  loading.value = true
  error.value = null
  try {
    const res = await staffAnalyticsApi.getCohorts({
      type: cohortType.value,
      weeks: cohortWeeks.value,
    })
    cohorts.value = res.results
  } catch (err: any) {
    error.value = err?.message || t('staff.analytics.errorLoad')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCohorts()
})
</script>

<style scoped>
.cohort-analysis {
  width: 100%;
}

.cohort-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.cohort-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.cohort-filters {
  display: flex;
  gap: var(--space-sm);
}

.cohort-select {
  padding: 4px 10px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}

.cohort-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb, 99, 102, 241), 0.15);
}

.cohort-loading {
  display: flex;
  justify-content: center;
  padding: var(--space-xl) 0;
}

.cohort-error {
  margin-top: var(--space-sm);
}

.cohort-empty {
  padding: var(--space-xl) 0;
}

.cohort-table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.cohort-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.cohort-table th {
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  padding: var(--space-sm) var(--space-md);
  border-bottom: 2px solid var(--border-color);
  white-space: nowrap;
  font-size: var(--text-xs);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cohort-table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.cohort-table tr:last-child td {
  border-bottom: none;
}

.cohort-key-cell {
  font-weight: 600;
  color: var(--text-primary);
  font-family: var(--font-mono, monospace);
  font-size: var(--text-xs);
}

.cohort-size-cell {
  font-weight: 500;
  color: var(--text-secondary);
}

.cohort-milestone-cell {
  position: relative;
  transition: background 0.15s;
}

.cohort-pct {
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  line-height: 1.2;
}

.cohort-abs {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  display: block;
  line-height: 1;
}

.text-right {
  text-align: right !important;
}

.cohort-legend {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-md);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.cohort-legend-label {
  font-weight: 500;
}

.cohort-legend-item {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .cohort-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
