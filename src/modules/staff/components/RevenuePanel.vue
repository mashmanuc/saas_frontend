<template>
  <div class="revenue-panel" data-testid="revenue-panel">
    <!-- Summary Cards -->
    <div v-if="summary" class="revenue-summary-grid">
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.revenue.totalRevenue') }}</span>
        <span class="summary-value revenue-value">{{ formatCurrency(summary.total_revenue) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.revenue.avgDaily') }}</span>
        <span class="summary-value">{{ formatCurrency(summary.avg_daily_revenue) }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.revenue.activeSubs') }}</span>
        <span class="summary-value">{{ summary.current_active_subs }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.revenue.netSubs') }}</span>
        <span class="summary-value" :class="summary.net_subs >= 0 ? 'positive' : 'negative'">
          {{ summary.net_subs >= 0 ? '+' : '' }}{{ summary.net_subs }}
        </span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.revenue.newSubs') }}</span>
        <span class="summary-value positive">+{{ summary.total_new_subs }}</span>
      </div>
      <div class="summary-card">
        <span class="summary-label">{{ $t('staff.revenue.churned') }}</span>
        <span class="summary-value negative">-{{ summary.total_churned }}</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="revenue-filters">
      <select v-model="filters.period" class="filter-select" @change="loadData">
        <option value="daily">{{ $t('staff.revenue.periodDaily') }}</option>
        <option value="weekly">{{ $t('staff.revenue.periodWeekly') }}</option>
        <option value="monthly">{{ $t('staff.revenue.periodMonthly') }}</option>
      </select>
      <select v-model.number="filters.days" class="filter-select" @change="loadData">
        <option :value="7">7 {{ $t('staff.revenue.daysLabel') }}</option>
        <option :value="14">14 {{ $t('staff.revenue.daysLabel') }}</option>
        <option :value="30">30 {{ $t('staff.revenue.daysLabel') }}</option>
        <option :value="60">60 {{ $t('staff.revenue.daysLabel') }}</option>
        <option :value="90">90 {{ $t('staff.revenue.daysLabel') }}</option>
      </select>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="revenue-loading">
      <div class="spinner" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="revenue-error">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="loadData">{{ $t('staff.revenue.retry') }}</button>
    </div>

    <!-- Empty -->
    <div v-else-if="items.length === 0" class="revenue-empty">
      <p>{{ $t('staff.revenue.noData') }}</p>
    </div>

    <!-- Revenue Table -->
    <div v-else class="revenue-table-wrap">
      <table class="revenue-table">
        <thead>
          <tr>
            <th>{{ $t('staff.revenue.colDate') }}</th>
            <th class="text-right">{{ $t('staff.revenue.colRevenue') }}</th>
            <th class="text-right">{{ $t('staff.revenue.colArpu') }}</th>
            <th class="text-right">{{ $t('staff.revenue.colNewSubs') }}</th>
            <th class="text-right">{{ $t('staff.revenue.colChurned') }}</th>
            <th class="text-right">{{ $t('staff.revenue.colActive') }}</th>
            <th class="text-right">{{ $t('staff.revenue.colTrialStarts') }}</th>
            <th class="text-right">{{ $t('staff.revenue.colTrialConv') }}</th>
            <th>{{ $t('staff.revenue.colBreakdown') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td class="date-cell">{{ item.period_start }}</td>
            <td class="text-right font-semibold">{{ formatCurrency(item.total_revenue) }}</td>
            <td class="text-right">{{ formatCurrency(item.avg_revenue_per_user) }}</td>
            <td class="text-right">
              <span class="badge positive">+{{ item.new_subscriptions }}</span>
            </td>
            <td class="text-right">
              <span class="badge negative" v-if="item.churned_subscriptions > 0">-{{ item.churned_subscriptions }}</span>
              <span v-else class="badge neutral">0</span>
            </td>
            <td class="text-right">{{ item.active_subscriptions }}</td>
            <td class="text-right">{{ item.trial_starts }}</td>
            <td class="text-right">
              <span v-if="item.trial_starts > 0">
                {{ item.trial_conversions }} ({{ Math.round((item.trial_conversions / item.trial_starts) * 100) }}%)
              </span>
              <span v-else>0</span>
            </td>
            <td>
              <div class="breakdown-pills">
                <span
                  v-for="(amount, plan) in item.revenue_breakdown"
                  :key="plan"
                  class="breakdown-pill"
                  :class="'plan-' + String(plan).toLowerCase()"
                >
                  {{ plan }}: {{ formatCurrency(amount) }}
                </span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="revenue-pagination">
        <button
          class="page-btn"
          :disabled="filters.page <= 1"
          @click="filters.page--; loadData()"
        >&laquo;</button>
        <span class="page-info">{{ $t('staff.revenue.page') }} {{ filters.page }} / {{ totalPages }}</span>
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
import staffAnalyticsApi from '../api/staffAnalyticsApi'
import type { RevenueSnapshotItem, RevenueSummary } from '../api/staffAnalyticsApi'

const loading = ref(false)
const error = ref<string | null>(null)
const items = ref<RevenueSnapshotItem[]>([])
const summary = ref<RevenueSummary | null>(null)
const total = ref(0)

const filters = reactive({
  period: 'daily' as 'daily' | 'weekly' | 'monthly',
  days: 30,
  page: 1,
  page_size: 30,
})

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / filters.page_size)))

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    const res = await staffAnalyticsApi.getRevenue({
      period: filters.period,
      days: filters.days,
      page: filters.page,
      page_size: filters.page_size,
    })
    items.value = res.results
    total.value = res.total
    summary.value = res.summary
  } catch (e: any) {
    error.value = e?.message || 'Failed to load revenue data'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.revenue-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.revenue-summary-grid {
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
  gap: 0.25rem;
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

.summary-value.revenue-value {
  color: var(--color-success, #059669);
}

.summary-value.positive {
  color: var(--color-success, #059669);
}

.summary-value.negative {
  color: var(--color-danger, #dc2626);
}

.revenue-filters {
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

.revenue-loading {
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

.revenue-error {
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

.revenue-empty {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary, #6b7280);
}

.revenue-table-wrap {
  overflow-x: auto;
}

.revenue-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.revenue-table th {
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

.revenue-table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--color-border-light, #f3f4f6);
  vertical-align: middle;
}

.revenue-table tbody tr:hover {
  background: var(--color-bg-hover, #f9fafb);
}

.text-right {
  text-align: right;
}

.font-semibold {
  font-weight: 600;
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

.badge.negative {
  background: #fee2e2;
  color: #991b1b;
}

.badge.neutral {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-secondary, #6b7280);
}

.breakdown-pills {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
}

.breakdown-pill {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 500;
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #374151);
}

.breakdown-pill.plan-pro {
  background: #dbeafe;
  color: #1e40af;
}

.breakdown-pill.plan-business {
  background: #fef3c7;
  color: #92400e;
}

.revenue-pagination {
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
