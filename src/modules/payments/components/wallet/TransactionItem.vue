<script setup lang="ts">
// F19: Transaction Item Component
import { computed } from 'vue'
import { ArrowUpRight, ArrowDownLeft, Gift, RefreshCw, Minus, Plus } from 'lucide-vue-next'
import type { WalletTransaction } from '../../api/payments'

const props = defineProps<{
  transaction: WalletTransaction
  currency: string
}>()

const typeConfig = computed(() => {
  const configs: Record<string, { icon: any; color: string; label: string }> = {
    earning: { icon: ArrowDownLeft, color: 'green', label: 'Earning' },
    tip: { icon: Gift, color: 'purple', label: 'Tip' },
    withdrawal: { icon: ArrowUpRight, color: 'blue', label: 'Withdrawal' },
    refund: { icon: RefreshCw, color: 'orange', label: 'Refund' },
    adjustment: { icon: Minus, color: 'gray', label: 'Adjustment' },
    bonus: { icon: Plus, color: 'green', label: 'Bonus' },
  }
  return configs[props.transaction.transaction_type] || configs.adjustment
})

const isPositive = computed(() =>
  ['earning', 'tip', 'bonus'].includes(props.transaction.transaction_type)
)

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
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="transaction-item">
    <div :class="['transaction-icon', typeConfig.color]">
      <component :is="typeConfig.icon" :size="18" />
    </div>

    <div class="transaction-info">
      <span class="transaction-type">{{ typeConfig.label }}</span>
      <span class="transaction-description">{{ transaction.description }}</span>
    </div>

    <div class="transaction-right">
      <span :class="['transaction-amount', { positive: isPositive, negative: !isPositive }]">
        {{ isPositive ? '+' : '-' }}{{ formatCurrency(Math.abs(transaction.amount)) }}
      </span>
      <span class="transaction-date">{{ formatDate(transaction.created_at) }}</span>
    </div>
  </div>
</template>

<style scoped>
.transaction-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
}

.transaction-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.transaction-icon.green {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success, #10b981);
}

.transaction-icon.blue {
  background: var(--color-info-light, #dbeafe);
  color: var(--color-info, #3b82f6);
}

.transaction-icon.orange {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning, #f59e0b);
}

.transaction-icon.purple {
  background: #f3e8ff;
  color: #9333ea;
}

.transaction-icon.gray {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-secondary, #6b7280);
}

.transaction-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.transaction-type {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.transaction-description {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transaction-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.transaction-amount {
  font-size: 15px;
  font-weight: 600;
}

.transaction-amount.positive {
  color: var(--color-success, #10b981);
}

.transaction-amount.negative {
  color: var(--color-text-primary, #111827);
}

.transaction-date {
  font-size: 12px;
  color: var(--color-text-tertiary, #9ca3af);
}
</style>
