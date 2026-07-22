<template>
  <div class="staff-payouts" data-test="payouts-page">
    <div class="page-header">
      <div class="header-left">
        <h1 class="page-title">{{ $t('staff.payouts.title') }}</h1>
        <p class="help-text">{{ $t('staff.payouts.helpText') }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-bar">
      <select v-model="statusFilter" class="filter-select" @change="loadPayouts">
        <option value="">{{ $t('staff.payouts.allStatuses') }}</option>
        <option value="pending">{{ $t('staff.payouts.statusPending') }}</option>
        <option value="approved">{{ $t('staff.payouts.statusApproved') }}</option>
        <option value="processing">{{ $t('staff.payouts.statusProcessing') }}</option>
        <option value="completed">{{ $t('staff.payouts.statusCompleted') }}</option>
        <option value="failed">{{ $t('staff.payouts.statusFailed') }}</option>
        <option value="cancelled">{{ $t('staff.payouts.statusCancelled') }}</option>
      </select>
      <Button variant="default" size="sm" @click="loadPayouts">
        {{ $t('staff.payouts.refresh') }}
      </Button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <LoadingSpinner />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <p class="error-text">{{ error }}</p>
      <Button variant="primary" size="sm" @click="loadPayouts">{{ $t('common.retry') }}</Button>
    </div>

    <!-- Empty -->
    <div v-else-if="payouts.length === 0" class="empty-state">
      <p>{{ $t('staff.payouts.empty') }}</p>
    </div>

    <!-- Table -->
    <div v-else class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ $t('staff.payouts.table.id') }}</th>
            <th>{{ $t('staff.payouts.table.tutor') }}</th>
            <th>{{ $t('staff.payouts.table.amount') }}</th>
            <th>{{ $t('staff.payouts.table.method') }}</th>
            <th>{{ $t('staff.payouts.table.status') }}</th>
            <th>{{ $t('staff.payouts.table.createdAt') }}</th>
            <th>{{ $t('staff.payouts.table.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payout in payouts" :key="payout.uuid" :class="rowClass(payout.status)">
            <td class="mono">{{ payout.uuid?.slice(0, 8) }}…</td>
            <td>
              <div class="tutor-name">{{ payout.tutor_name || '—' }}</div>
              <div class="tutor-email">{{ payout.tutor_email }}</div>
            </td>
            <td class="amount-cell">
              <span class="amount">{{ formatAmount(payout.amount, payout.currency) }}</span>
            </td>
            <td>{{ payout.payout_method || '—' }}</td>
            <td>
              <Badge :variant="statusVariant(payout.status)" size="sm">
                {{ statusLabel(payout.status) }}
              </Badge>
            </td>
            <td>{{ formatDate(payout.created_at) }}</td>
            <td class="actions-cell">
              <Button
                v-if="payout.status === 'pending'"
                variant="primary"
                size="sm"
                :disabled="actionLoading"
                @click="handleApprove(payout)"
              >
                {{ $t('staff.payouts.approve') }}
              </Button>
              <Button
                v-if="payout.status === 'approved'"
                variant="primary"
                size="sm"
                :disabled="actionLoading"
                @click="handleProcess(payout)"
              >
                {{ $t('staff.payouts.process') }}
              </Button>
              <Button
                v-if="payout.status === 'processing'"
                variant="success"
                size="sm"
                :disabled="actionLoading"
                @click="openCompleteModal(payout)"
              >
                {{ $t('staff.payouts.complete') }}
              </Button>
              <Button
                v-if="['approved', 'processing'].includes(payout.status)"
                variant="danger"
                size="sm"
                :disabled="actionLoading"
                @click="openFailModal(payout)"
              >
                {{ $t('staff.payouts.fail') }}
              </Button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination-bar">
        <span class="pagination-info">{{ $t('staff.payouts.showing', { count: payouts.length, total: totalCount }) }}</span>
        <div class="pagination-btns">
          <Button variant="default" size="sm" :disabled="offset === 0" @click="prevPage">
            {{ $t('common.previous') }}
          </Button>
          <Button variant="default" size="sm" :disabled="offset + limit >= totalCount" @click="nextPage">
            {{ $t('common.next') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Complete Modal -->
    <div v-if="completeModal.open" class="modal-overlay" @click.self="completeModal.open = false">
      <div class="modal-content">
        <h3 class="modal-title">{{ $t('staff.payouts.completeModal.title') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ $t('staff.payouts.completeModal.providerIdLabel') }}</label>
          <input
            v-model="completeModal.providerId"
            class="form-input"
            :placeholder="$t('staff.payouts.completeModal.providerIdPlaceholder')"
          />
        </div>
        <div class="modal-actions">
          <Button variant="default" size="sm" @click="completeModal.open = false">{{ $t('common.cancel') }}</Button>
          <Button variant="success" size="sm" :disabled="actionLoading" @click="handleComplete">
            {{ $t('staff.payouts.completeModal.confirm') }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Fail Modal -->
    <div v-if="failModal.open" class="modal-overlay" @click.self="failModal.open = false">
      <div class="modal-content">
        <h3 class="modal-title">{{ $t('staff.payouts.failModal.title') }}</h3>
        <div class="form-group">
          <label class="form-label">{{ $t('staff.payouts.failModal.reasonLabel') }}</label>
          <textarea
            v-model="failModal.reason"
            class="form-textarea"
            :placeholder="$t('staff.payouts.failModal.reasonPlaceholder')"
            rows="3"
          />
        </div>
        <div class="modal-actions">
          <Button variant="default" size="sm" @click="failModal.open = false">{{ $t('common.cancel') }}</Button>
          <Button
            variant="danger"
            size="sm"
            :disabled="!failModal.reason.trim() || actionLoading"
            @click="handleFail"
          >
            {{ $t('staff.payouts.failModal.confirm') }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { activeLocale } from '@/utils/i18nDate'
import {
  getAdminPayouts,
  approvePayout,
  processPayout,
  completePayout,
  failPayout,
} from '../api/payoutsApi'
import type { PayoutItem } from '../api/payoutsApi'
import Button from '@/ui/Button.vue'
import Badge from '@/ui/Badge.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'

const { t } = useI18n()

const payouts = ref<PayoutItem[]>([])
const loading = ref(false)
const error = ref('')
const actionLoading = ref(false)
const statusFilter = ref('')
const totalCount = ref(0)
const limit = 20
const offset = ref(0)

const completeModal = ref({ open: false, payout: null as PayoutItem | null, providerId: '' })
const failModal = ref({ open: false, payout: null as PayoutItem | null, reason: '' })

async function loadPayouts() {
  loading.value = true
  error.value = ''
  try {
    const params: any = { limit, offset: offset.value }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await getAdminPayouts(params)
    payouts.value = res.results
    totalCount.value = res.count
  } catch (err: any) {
    error.value = err.message || t('staff.payouts.error')
  } finally {
    loading.value = false
  }
}

function prevPage() {
  offset.value = Math.max(0, offset.value - limit)
  loadPayouts()
}

function nextPage() {
  offset.value += limit
  loadPayouts()
}

async function handleApprove(payout: PayoutItem) {
  if (!confirm(t('staff.payouts.confirmApprove', { id: payout.uuid?.slice(0, 8) }))) return
  actionLoading.value = true
  try {
    await approvePayout(payout.uuid)
    await loadPayouts()
  } catch {
    alert(t('staff.payouts.error'))
  } finally {
    actionLoading.value = false
  }
}

async function handleProcess(payout: PayoutItem) {
  if (!confirm(t('staff.payouts.confirmProcess', { id: payout.uuid?.slice(0, 8) }))) return
  actionLoading.value = true
  try {
    await processPayout(payout.uuid)
    await loadPayouts()
  } catch {
    alert(t('staff.payouts.error'))
  } finally {
    actionLoading.value = false
  }
}

function openCompleteModal(payout: PayoutItem) {
  completeModal.value = { open: true, payout, providerId: '' }
}

async function handleComplete() {
  if (!completeModal.value.payout) return
  actionLoading.value = true
  try {
    await completePayout(completeModal.value.payout.uuid, completeModal.value.providerId)
    completeModal.value.open = false
    await loadPayouts()
  } catch {
    alert(t('staff.payouts.error'))
  } finally {
    actionLoading.value = false
  }
}

function openFailModal(payout: PayoutItem) {
  failModal.value = { open: true, payout, reason: '' }
}

async function handleFail() {
  if (!failModal.value.payout || !failModal.value.reason.trim()) return
  actionLoading.value = true
  try {
    await failPayout(failModal.value.payout.uuid, failModal.value.reason.trim())
    failModal.value.open = false
    await loadPayouts()
  } catch {
    alert(t('staff.payouts.error'))
  } finally {
    actionLoading.value = false
  }
}

function statusVariant(status: string): string {
  const map: Record<string, string> = {
    pending: 'warning',
    approved: 'accent',
    processing: 'accent',
    completed: 'success',
    failed: 'danger',
    cancelled: 'muted',
  }
  return map[status] || 'default'
}

function statusLabel(status: string): string {
  const key = `staff.payouts.status${status.charAt(0).toUpperCase() + status.slice(1)}`
  return t(key)
}

function rowClass(status: string): string {
  if (status === 'failed') return 'row-danger'
  if (status === 'completed') return 'row-success'
  return ''
}

function formatAmount(amount: number, currency: string): string {
  const value = amount / 100
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: currency || 'UAH' }).format(value)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(activeLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

onMounted(() => loadPayouts())
</script>

<style scoped>
.staff-payouts {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.page-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.help-text {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

.filters-bar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.filter-select {
  padding: var(--space-xs) var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
}

.loading-state,
.empty-state,
.error-state {
  text-align: center;
  padding: var(--space-2xl);
  color: var(--text-secondary);
}

.error-text {
  color: var(--danger-bg, #ef4444);
  margin-bottom: var(--space-md);
}

.table-container {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

.data-table th {
  padding: var(--space-sm) var(--space-md);
  text-align: left;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border-bottom: 2px solid var(--border-color);
}

.data-table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-primary);
  vertical-align: middle;
}

.data-table tbody tr:hover {
  background: var(--bg-secondary);
}

.row-danger td { background: color-mix(in srgb, #ef4444 5%, transparent); }
.row-success td { background: color-mix(in srgb, #22c55e 5%, transparent); }

.mono {
  font-family: monospace;
  font-size: 0.8rem;
}

.tutor-name {
  font-weight: 500;
}

.tutor-email {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.amount {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.actions-cell {
  display: flex;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.pagination-info {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.pagination-btns {
  display: flex;
  gap: var(--space-xs);
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
  max-width: 440px;
  box-shadow: var(--shadow-lg);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  margin: 0 0 var(--space-lg) 0;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: var(--space-md);
}

.form-label {
  display: block;
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: var(--space-xs);
}

.form-input,
.form-textarea {
  width: 100%;
  padding: var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--card-bg);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
}

.form-textarea {
  resize: vertical;
}

.modal-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}
</style>
