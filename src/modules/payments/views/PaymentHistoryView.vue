<script setup lang="ts">
// F6: Payment History View
import { ref, onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { CreditCard, Filter, Download } from 'lucide-vue-next'
import { usePaymentStore } from '../stores/paymentStore'
import type { Payment } from '../api/payments'

const store = usePaymentStore()
const { payments, isLoading, error, hasMore, totalCount } = storeToRefs(store)

const statusFilter = ref<string>('')
const typeFilter = ref<string>('')

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
]

const typeOptions = [
  { value: '', label: 'All Types' },
  { value: 'lesson', label: 'Lessons' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'package', label: 'Packages' },
  { value: 'tip', label: 'Tips' },
]

onMounted(() => {
  loadPayments()
})

watch([statusFilter, typeFilter], () => {
  loadPayments()
})

function loadPayments() {
  store.loadPayments(
    {
      status: statusFilter.value || undefined,
      type: typeFilter.value || undefined,
    },
    true
  )
}

function loadMore() {
  store.loadMorePayments({
    status: statusFilter.value || undefined,
    type: typeFilter.value || undefined,
  })
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'status-success'
    case 'pending':
    case 'processing':
      return 'status-warning'
    case 'failed':
      return 'status-danger'
    case 'refunded':
      return 'status-info'
    default:
      return ''
  }
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getPaymentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    lesson: 'Lesson',
    subscription: 'Subscription',
    package: 'Package',
    tip: 'Tip',
  }
  return labels[type] || type
}
</script>

<template>
  <div class="payment-history-view">
    <header class="view-header">
      <div>
        <h1>Payment History</h1>
        <p class="subtitle">{{ totalCount }} payments</p>
      </div>
    </header>

    <!-- Filters -->
    <div class="filters-bar">
      <div class="filter-group">
        <Filter :size="18" />
        <select v-model="statusFilter">
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div class="filter-group">
        <select v-model="typeFilter">
          <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && payments.length === 0" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Empty State -->
    <div v-else-if="payments.length === 0" class="empty-state">
      <CreditCard :size="48" />
      <h2>No Payments</h2>
      <p>You haven't made any payments yet.</p>
    </div>

    <!-- Payments List -->
    <div v-else class="payments-list">
      <div v-for="payment in payments" :key="payment.id" class="payment-item">
        <div class="payment-icon">
          <CreditCard :size="20" />
        </div>

        <div class="payment-info">
          <div class="payment-main">
            <span class="payment-description">{{ payment.description }}</span>
            <span class="payment-type">{{ getPaymentTypeLabel(payment.payment_type) }}</span>
          </div>
          <div class="payment-meta">
            <span class="payment-date">{{ formatDate(payment.created_at) }}</span>
            <span class="payment-id">#{{ payment.uuid.slice(0, 8) }}</span>
          </div>
        </div>

        <div class="payment-right">
          <span class="payment-amount">
            {{ formatCurrency(payment.amount, payment.currency) }}
          </span>
          <span class="payment-status" :class="getStatusClass(payment.status)">
            {{ payment.status }}
          </span>
        </div>
      </div>

      <!-- Load More -->
      <button
        v-if="hasMore"
        class="load-more-btn"
        :disabled="isLoading"
        @click="loadMore"
      >
        {{ isLoading ? 'Loading...' : 'Load More' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.payment-history-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
}

.view-header {
  margin-bottom: 24px;
}

.view-header h1 {
  margin: 0 0 4px;
  font-size: 28px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

/* Filters */
.filters-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group svg {
  color: var(--color-text-secondary, #6b7280);
}

.filter-group select {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg-primary, white);
}

/* Loading */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 64px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 64px 0;
  color: var(--color-text-secondary, #6b7280);
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: var(--color-text-primary, #111827);
}

.empty-state p {
  margin: 0;
}

/* Payments List */
.payments-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.payment-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.payment-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 10px;
  color: var(--color-text-secondary, #6b7280);
}

.payment-info {
  flex: 1;
  min-width: 0;
}

.payment-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.payment-description {
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.payment-type {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.payment-meta {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary, #9ca3af);
}

.payment-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.payment-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.payment-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-success {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success-dark, #065f46);
}

.status-warning {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
}

.status-danger {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger-dark, #991b1b);
}

.status-info {
  background: var(--color-info-light, #dbeafe);
  color: var(--color-info-dark, #1e40af);
}

/* Load More */
.load-more-btn {
  padding: 12px 24px;
  margin-top: 12px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
  align-self: center;
}

.load-more-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f5f5f5);
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Error */
.error-message {
  margin-top: 16px;
  padding: 12px;
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
  border-radius: 8px;
  font-size: 14px;
}
</style>
