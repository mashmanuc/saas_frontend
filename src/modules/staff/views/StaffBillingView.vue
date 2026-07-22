<template>
  <div class="staff-billing" data-testid="staff-billing">
    <div class="page-header">
      <h1 class="page-title">{{ $t('staff.billing.title') }}</h1>
      <p class="help-text">{{ $t('staff.billing.helpText') }}</p>
    </div>

    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
    </div>

    <template v-else>
      <!-- Plan cards -->
      <div class="stat-cards-row">
        <Card class="stat-card">
          <div class="stat-value accent">{{ stats.pro_count ?? 0 }}</div>
          <div class="stat-label">PRO</div>
        </Card>
        <Card class="stat-card">
          <div class="stat-value accent">{{ stats.business_count ?? 0 }}</div>
          <div class="stat-label">BUSINESS</div>
        </Card>
        <Card class="stat-card">
          <div class="stat-value">{{ stats.trial_active ?? 0 }}</div>
          <div class="stat-label">{{ $t('staff.billing.trialing') }}</div>
        </Card>
        <Card class="stat-card">
          <div class="stat-value" :class="(stats.pending_sessions ?? 0) > 0 ? 'danger' : ''">
            {{ stats.pending_sessions ?? 0 }}
          </div>
          <div class="stat-label">{{ $t('staff.billing.pendingCheckouts') }}</div>
        </Card>
      </div>

      <!-- Pending checkouts -->
      <Card>
        <h2 class="section-title">{{ $t('staff.billing.pendingCheckoutsTable') }}</h2>
        <div v-if="!billing.pending_checkouts?.length" class="empty-hint">
          {{ $t('staff.billing.noPending') }}
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>{{ $t('staff.billing.order') }}</th>
              <th>{{ $t('staff.billing.user') }}</th>
              <th>{{ $t('staff.billing.plan') }}</th>
              <th>{{ $t('staff.billing.pendingAge') }}</th>
              <th>{{ $t('staff.billing.created') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="cs in billing.pending_checkouts" :key="cs.order_id">
              <td class="cell-mono">{{ cs.order_id.slice(0, 8) }}…</td>
              <td>{{ cs.user_email }}</td>
              <td>{{ cs.plan }}</td>
              <td :class="cs.pending_age_seconds > 3600 ? 'cell-danger' : ''">
                {{ formatAge(cs.pending_age_seconds) }}
              </td>
              <td class="cell-muted">{{ formatDate(cs.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </Card>

      <!-- Recent payments with filter + pagination -->
      <Card>
        <div class="section-header-row">
          <h2 class="section-title">{{ $t('staff.billing.recentPayments') }}</h2>
          <div class="filters-row">
            <select v-model="statusFilter" class="filter-select" @change="applyFilter">
              <option value="">{{ $t('staff.billing.allStatuses') }}</option>
              <option value="success">{{ $t('staff.billing.statusSuccess') }}</option>
              <option value="failed">{{ $t('staff.billing.statusFailed') }}</option>
              <option value="pending">{{ $t('staff.billing.statusPending') }}</option>
            </select>
          </div>
        </div>

        <div v-if="!filteredPayments.length" class="empty-hint">
          {{ $t('staff.billing.noPayments') }}
        </div>
        <table v-else class="data-table">
          <thead>
            <tr>
              <th>{{ $t('staff.billing.user') }}</th>
              <th>{{ $t('staff.billing.amount') }}</th>
              <th>{{ $t('staff.billing.status') }}</th>
              <th>{{ $t('staff.billing.date') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="p in pagedPayments"
              :key="p.id"
              class="clickable-row"
              @click="openDetail(p)"
            >
              <td>{{ p.user_email }}</td>
              <td class="cell-mono">{{ formatAmount(p.amount, p.currency) }}</td>
              <td>
                <Badge :variant="paymentStatusVariant(p.payment_status)" size="sm">
                  {{ paymentStatusLabel(p.payment_status) }}
                </Badge>
              </td>
              <td class="cell-muted">{{ formatDate(p.created_at) }}</td>
              <td class="cell-action">
                <ChevronRight :size="14" class="row-arrow" />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div v-if="filteredPayments.length > pageSize" class="pagination-bar">
          <span class="pagination-info">
            {{ $t('staff.billing.showing', { from: pageOffset + 1, to: Math.min(pageOffset + pageSize, filteredPayments.length), total: filteredPayments.length }) }}
          </span>
          <div class="pagination-btns">
            <button class="page-btn" :disabled="pageOffset === 0" @click="pageOffset -= pageSize">‹</button>
            <button class="page-btn" :disabled="pageOffset + pageSize >= filteredPayments.length" @click="pageOffset += pageSize">›</button>
          </div>
        </div>
      </Card>
    </template>

    <!-- Payment Detail Modal -->
    <div v-if="detailPayment" class="modal-overlay" @click.self="detailPayment = null">
      <div class="modal-content">
        <div class="modal-header">
          <h3 class="modal-title">{{ $t('staff.billing.paymentDetail') }}</h3>
          <button class="modal-close" @click="detailPayment = null">
            <X :size="18" />
          </button>
        </div>
        <dl class="detail-list">
          <div class="detail-row">
            <dt>{{ $t('staff.billing.user') }}</dt>
            <dd>{{ detailPayment.user_email }}</dd>
          </div>
          <div class="detail-row">
            <dt>{{ $t('staff.billing.amount') }}</dt>
            <dd class="mono">{{ formatAmount(detailPayment.amount, detailPayment.currency) }}</dd>
          </div>
          <div class="detail-row">
            <dt>{{ $t('staff.billing.status') }}</dt>
            <dd>
              <Badge :variant="paymentStatusVariant(detailPayment.payment_status)" size="sm">
                {{ paymentStatusLabel(detailPayment.payment_status) }}
              </Badge>
            </dd>
          </div>
          <div class="detail-row" v-if="detailPayment.plan">
            <dt>{{ $t('staff.billing.plan') }}</dt>
            <dd>{{ detailPayment.plan }}</dd>
          </div>
          <div class="detail-row" v-if="detailPayment.provider">
            <dt>{{ $t('staff.billing.provider') }}</dt>
            <dd>{{ detailPayment.provider }}</dd>
          </div>
          <div class="detail-row" v-if="detailPayment.order_id">
            <dt>{{ $t('staff.billing.order') }}</dt>
            <dd class="mono">{{ detailPayment.order_id }}</dd>
          </div>
          <div class="detail-row">
            <dt>{{ $t('staff.billing.date') }}</dt>
            <dd>{{ formatDate(detailPayment.created_at) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronRight, X } from 'lucide-vue-next'
import apiClient from '@/utils/apiClient'
import Card from '@/ui/Card.vue'
import Badge from '@/ui/Badge.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { activeLocale } from '@/utils/i18nDate'

const { t } = useI18n()

const loading = ref(true)
const stats = ref<any>({})
const billing = ref<any>({})
const statusFilter = ref('')
const pageOffset = ref(0)
const pageSize = 10
const detailPayment = ref<any>(null)

const filteredPayments = computed(() => {
  const payments: any[] = billing.value.recent_payments || []
  if (!statusFilter.value) return payments
  return payments.filter(p => p.payment_status === statusFilter.value)
})

const pagedPayments = computed(() => {
  return filteredPayments.value.slice(pageOffset.value, pageOffset.value + pageSize)
})

function applyFilter() {
  pageOffset.value = 0
}

function openDetail(payment: any) {
  detailPayment.value = payment
}

function paymentStatusVariant(status: string): string {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  return 'muted'
}

function paymentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    success: t('staff.billing.statusSuccess'),
    failed: t('staff.billing.statusFailed'),
    pending: t('staff.billing.statusPending'),
  }
  return map[status] || status
}

function formatAmount(amount: number | string, currency: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (isNaN(num)) return `${amount} ${currency}`
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: currency || 'UAH',
    minimumFractionDigits: 2,
  }).format(num / 100)
}

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}с`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}хв`
  return `${Math.floor(seconds / 3600)}год ${Math.floor((seconds % 3600) / 60)}хв`
}

function formatDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(activeLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(async () => {
  try {
    const [overviewRes, billingRes] = await Promise.all([
      apiClient.get('/v1/staff/stats/overview/', { meta: { skipLoader: true } } as any),
      apiClient.get('/v1/staff/stats/billing/', { meta: { skipLoader: true } } as any),
    ])
    stats.value = overviewRes?.billing || {}
    billing.value = billingRes || {}
  } catch {
    // Silent
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.staff-billing {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-header { margin-bottom: 0; }

.help-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: var(--space-xs) 0 0 0;
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.stat-cards-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-md);
}

.stat-card {
  text-align: center;
  padding: var(--space-lg);
}

.stat-value {
  font-size: var(--text-3xl, 1.875rem);
  font-weight: 700;
  color: var(--text-primary);
}

.stat-value.accent { color: var(--accent); }

.stat-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-xs);
}

.section-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-md);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
  text-align: left;
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.data-table td {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
}

.cell-mono { font-family: monospace; font-size: var(--text-xs); }
.cell-muted { color: var(--text-secondary); }
.cell-danger { color: var(--danger-bg, #ef4444); font-weight: 600; }
.cell-action { width: 32px; color: var(--text-secondary); }

.stat-value.danger { color: var(--danger-bg, #ef4444); }

.empty-hint {
  padding: var(--space-lg);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--text-sm);
}

.loading-state {
  padding: var(--space-xl);
  text-align: center;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.section-header-row .section-title {
  margin-bottom: 0;
}

.filters-row {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.filter-select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.clickable-row {
  cursor: pointer;
  transition: background var(--transition-base);
}

.clickable-row:hover {
  background: var(--bg-secondary);
}

.row-arrow {
  opacity: 0.4;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--border-color);
  margin-top: var(--space-xs);
}

.pagination-info {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.pagination-btns {
  display: flex;
  gap: 4px;
}

.page-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--text-base);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn:not(:disabled):hover {
  background: var(--bg-secondary);
  border-color: var(--accent);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.modal-content {
  background: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  width: 100%;
  max-width: 480px;
  box-shadow: var(--shadow-lg);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0;
  color: var(--text-primary);
}

.modal-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
}

.modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-secondary);
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.detail-row {
  display: grid;
  grid-template-columns: 140px 1fr;
  gap: var(--space-sm);
  align-items: center;
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--border-color);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row dt {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.detail-row dd {
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin: 0;
}

.detail-row dd.mono {
  font-family: monospace;
  font-size: 0.8rem;
}
</style>
