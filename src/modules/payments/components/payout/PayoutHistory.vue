<script setup lang="ts">
// F23: Payout History Component
import { computed } from 'vue'
import { Clock, CheckCircle, XCircle, AlertCircle, Loader } from 'lucide-vue-next'
import type { PayoutRequest } from '../../api/payments'

const props = defineProps<{
  payouts: PayoutRequest[]
  currency: string
}>()

const emit = defineEmits<{
  cancel: [id: number]
}>()

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: props.currency,
  }).format(amount / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getStatusConfig(status: string) {
  const configs: Record<string, { icon: any; color: string; label: string }> = {
    pending: { icon: Clock, color: 'warning', label: 'Pending' },
    approved: { icon: CheckCircle, color: 'info', label: 'Approved' },
    processing: { icon: Loader, color: 'info', label: 'Processing' },
    completed: { icon: CheckCircle, color: 'success', label: 'Completed' },
    failed: { icon: XCircle, color: 'danger', label: 'Failed' },
    cancelled: { icon: XCircle, color: 'gray', label: 'Cancelled' },
  }
  return configs[status] || configs.pending
}

function canCancel(payout: PayoutRequest): boolean {
  return payout.status === 'pending'
}
</script>

<template>
  <div class="payout-history">
    <!-- Empty State -->
    <div v-if="payouts.length === 0" class="empty-state">
      <Clock :size="40" />
      <p>No payout history yet</p>
    </div>

    <!-- Payouts List -->
    <div v-else class="payouts-list">
      <div v-for="payout in payouts" :key="payout.id" class="payout-item">
        <div :class="['payout-icon', getStatusConfig(payout.status).color]">
          <component :is="getStatusConfig(payout.status).icon" :size="18" />
        </div>

        <div class="payout-info">
          <span class="payout-amount">{{ formatCurrency(payout.amount) }}</span>
          <span class="payout-date">{{ formatDate(payout.created_at) }}</span>
        </div>

        <div class="payout-right">
          <span :class="['payout-status', getStatusConfig(payout.status).color]">
            {{ getStatusConfig(payout.status).label }}
          </span>

          <button
            v-if="canCancel(payout)"
            class="cancel-btn"
            @click="emit('cancel', payout.id)"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payout-history {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 0;
  color: var(--color-text-secondary, #6b7280);
}

.empty-state svg {
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
}

/* Payouts List */
.payouts-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.payout-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 10px;
}

.payout-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.payout-icon.success {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success, #10b981);
}

.payout-icon.warning {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning, #f59e0b);
}

.payout-icon.info {
  background: var(--color-info-light, #dbeafe);
  color: var(--color-info, #3b82f6);
}

.payout-icon.danger {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
}

.payout-icon.gray {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-secondary, #6b7280);
}

.payout-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.payout-amount {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.payout-date {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.payout-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.payout-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.payout-status.success {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success-dark, #065f46);
}

.payout-status.warning {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
}

.payout-status.info {
  background: var(--color-info-light, #dbeafe);
  color: var(--color-info-dark, #1e40af);
}

.payout-status.danger {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger-dark, #991b1b);
}

.payout-status.gray {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-secondary, #6b7280);
}

.cancel-btn {
  padding: 4px 10px;
  background: none;
  border: 1px solid var(--color-danger, #ef4444);
  border-radius: 6px;
  font-size: 12px;
  color: var(--color-danger, #ef4444);
  cursor: pointer;
  transition: all 0.15s;
}

.cancel-btn:hover {
  background: var(--color-danger-light, #fee2e2);
}
</style>
