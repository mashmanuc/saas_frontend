<template>
  <div class="mph-panel" data-testid="marketplace-health-panel">
    <!-- Summary Cards -->
    <div v-if="summary" class="mph-summary-grid">
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.marketplaceHealth.totalTutors') }}</span>
        <span class="summary-value">{{ summary.total_tutors }}</span>
        <span class="summary-sub">{{ $t('staff.marketplaceHealth.published') }}: {{ summary.published_tutors }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.marketplaceHealth.totalStudents') }}</span>
        <span class="summary-value">{{ summary.total_students }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.marketplaceHealth.activeTutors7d') }}</span>
        <span class="summary-value">{{ summary.active_tutors_7d }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.marketplaceHealth.activeStudents7d') }}</span>
        <span class="summary-value">{{ summary.active_students_7d }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.marketplaceHealth.sdRatio') }}</span>
        <span class="summary-value" :class="ratioClass(summary.supply_demand_ratio)">
          {{ summary.supply_demand_ratio.toFixed(2) }}
        </span>
        <span class="summary-sub">{{ ratioLabel(summary.supply_demand_ratio) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.marketplaceHealth.acceptRate') }}</span>
        <span class="summary-value">{{ summary.accept_rate }}%</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="mph-filters">
      <select v-model.number="filters.days" class="filter-select" @change="loadData">
        <option :value="7">7 {{ $t('staff.marketplaceHealth.daysLabel') }}</option>
        <option :value="14">14 {{ $t('staff.marketplaceHealth.daysLabel') }}</option>
        <option :value="30">30 {{ $t('staff.marketplaceHealth.daysLabel') }}</option>
        <option :value="60">60 {{ $t('staff.marketplaceHealth.daysLabel') }}</option>
        <option :value="90">90 {{ $t('staff.marketplaceHealth.daysLabel') }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="mph-loading">
      <div class="spinner" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="mph-error">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="loadData">{{ $t('staff.marketplaceHealth.retry') }}</button>
    </div>

    <!-- Empty -->
    <div v-else-if="items.length === 0" class="mph-empty">
      <p>{{ $t('staff.marketplaceHealth.noData') }}</p>
    </div>

    <!-- Health Table -->
    <div v-else class="mph-table-wrap">
      <table class="mph-table">
        <thead>
          <tr>
            <th>{{ $t('staff.marketplaceHealth.colDate') }}</th>
            <th class="text-right">{{ $t('staff.marketplaceHealth.colTutors') }}</th>
            <th class="text-right">{{ $t('staff.marketplaceHealth.colPublished') }}</th>
            <th class="text-right">{{ $t('staff.marketplaceHealth.colStudents') }}</th>
            <th class="text-right">{{ $t('staff.marketplaceHealth.colInqCreated') }}</th>
            <th class="text-right">{{ $t('staff.marketplaceHealth.colInqAccepted') }}</th>
            <th class="text-right">{{ $t('staff.marketplaceHealth.colAvgAcceptH') }}</th>
            <th class="text-right">{{ $t('staff.marketplaceHealth.colRepeatRate') }}</th>
            <th class="text-right">{{ $t('staff.marketplaceHealth.colRatio') }}</th>
            <th>{{ $t('staff.marketplaceHealth.colSubjects') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td class="date-cell">{{ item.period_start }}</td>
            <td class="text-right">{{ item.total_tutors }}</td>
            <td class="text-right">{{ item.published_tutors }}</td>
            <td class="text-right">{{ item.total_students }}</td>
            <td class="text-right">{{ item.inquiries_created }}</td>
            <td class="text-right">
              <span class="badge" :class="item.inquiries_accepted > 0 ? 'positive' : 'neutral'">
                {{ item.inquiries_accepted }}
              </span>
            </td>
            <td class="text-right">
              {{ item.avg_time_to_accept_hours != null ? item.avg_time_to_accept_hours.toFixed(1) + 'h' : '—' }}
            </td>
            <td class="text-right">{{ item.repeat_inquiry_rate.toFixed(1) }}%</td>
            <td class="text-right">
              <span class="ratio-indicator" :class="ratioClass(item.supply_demand_ratio)">
                {{ item.supply_demand_ratio.toFixed(2) }}
              </span>
            </td>
            <td>
              <div class="subject-pills">
                <span
                  v-for="(info, subj) in topSubjects(item.subject_breakdown)"
                  :key="subj"
                  class="subject-pill"
                >
                  {{ subj }}: {{ info.tutors }}
                </span>
                <span v-if="Object.keys(item.subject_breakdown).length > 3" class="subject-pill more">
                  +{{ Object.keys(item.subject_breakdown).length - 3 }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="mph-pagination">
        <button
          class="page-btn"
          :disabled="filters.page <= 1"
          @click="filters.page--; loadData()"
        >&laquo;</button>
        <span class="page-info">{{ $t('staff.marketplaceHealth.page') }} {{ filters.page }} / {{ totalPages }}</span>
        <button
          class="page-btn"
          :disabled="filters.page >= totalPages"
          @click="filters.page++; loadData()"
        >&raquo;</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import staffAnalyticsApi from '../api/staffAnalyticsApi'
import type { MarketplaceHealthItem, MarketplaceHealthSummary } from '../api/staffAnalyticsApi'

const { t } = useI18n()

const loading = ref(false)
const error = ref<string | null>(null)
const items = ref<MarketplaceHealthItem[]>([])
const summary = ref<MarketplaceHealthSummary | null>(null)
const total = ref(0)

const filters = reactive({
  days: 30,
  page: 1,
  page_size: 30,
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / filters.page_size)))

function ratioClass(ratio: number): string {
  if (ratio >= 0.8 && ratio <= 1.5) return 'ratio-green'
  if (ratio >= 0.5 && ratio <= 2.0) return 'ratio-yellow'
  return 'ratio-red'
}

function ratioLabel(ratio: number): string {
  if (ratio > 1.5) return t('staff.marketplaceHealth.ratioSurplus')
  if (ratio < 0.5) return t('staff.marketplaceHealth.ratioDeficit')
  return t('staff.marketplaceHealth.ratioBalanced')
}

function topSubjects(breakdown: Record<string, { tutors: number; ratio: number }>): Record<string, { tutors: number; ratio: number }> {
  const entries = Object.entries(breakdown)
  const sorted = entries.sort((a, b) => b[1].tutors - a[1].tutors).slice(0, 3)
  return Object.fromEntries(sorted)
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await staffAnalyticsApi.getMarketplaceHealth({
      days: filters.days,
      page: filters.page,
      page_size: filters.page_size,
    })
    items.value = res.results
    total.value = res.total
    summary.value = res.summary
  } catch (e: any) {
    error.value = e?.message || 'Failed to load marketplace health data'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.mph-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.mph-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 0.75rem;
}

.summary-card {
  background: var(--color-bg-secondary, #f8f9fa);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.summary-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #6b7280);
  text-transform: uppercase;
  letter-spacing: 0.025em;
}

.summary-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.summary-sub {
  font-size: 0.7rem;
  color: var(--color-text-secondary, #9ca3af);
}

.ratio-green { color: #059669; }
.ratio-yellow { color: #d97706; }
.ratio-red { color: #dc2626; }

.mph-filters {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-select {
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 0.875rem;
  background: var(--color-bg, #fff);
  color: var(--color-text-primary, #111827);
}

.mph-loading {
  display: flex;
  justify-content: center;
  padding: 2rem;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.mph-error {
  text-align: center;
  padding: 1.5rem;
  color: var(--color-danger, #dc2626);
}

.retry-btn {
  margin-top: 0.5rem;
  padding: 0.375rem 1rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  background: var(--color-bg, #fff);
  cursor: pointer;
}

.mph-empty {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary, #6b7280);
}

.mph-table-wrap {
  overflow-x: auto;
}

.mph-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.mph-table th {
  text-align: left;
  padding: 0.5rem 0.75rem;
  border-bottom: 2px solid var(--color-border, #e5e7eb);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  color: var(--color-text-secondary, #6b7280);
  white-space: nowrap;
}

.mph-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border-light, #f3f4f6);
  vertical-align: middle;
}

.mph-table tbody tr:hover {
  background: var(--color-bg-hover, #f9fafb);
}

.text-right {
  text-align: right;
}

.date-cell {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.badge {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge.positive {
  background: #d1fae5;
  color: #065f46;
}

.badge.neutral {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-secondary, #6b7280);
}

.ratio-indicator {
  font-weight: 600;
  font-size: 0.8rem;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.ratio-indicator.ratio-green {
  background: #d1fae5;
  color: #065f46;
}

.ratio-indicator.ratio-yellow {
  background: #fef3c7;
  color: #92400e;
}

.ratio-indicator.ratio-red {
  background: #fee2e2;
  color: #991b1b;
}

.subject-pills {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.subject-pill {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #374151);
}

.subject-pill.more {
  background: var(--color-border, #d1d5db);
  color: var(--color-text-secondary, #6b7280);
}

.mph-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0.75rem 0;
}

.page-btn {
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  background: var(--color-bg, #fff);
  cursor: pointer;
  font-size: 0.875rem;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}
</style>
