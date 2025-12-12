<script setup lang="ts">
// F17: Wallet Stats Component
import { TrendingUp, Users, BookOpen, Star } from 'lucide-vue-next'
import type { Wallet } from '../../api/payments'

const props = defineProps<{
  wallet: Wallet
}>()

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: props.wallet.currency,
  }).format(amount / 100)
}
</script>

<template>
  <div class="wallet-stats">
    <div class="stat-card">
      <div class="stat-icon green">
        <TrendingUp :size="20" />
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ formatCurrency(wallet.total_earned) }}</span>
        <span class="stat-label">Total Earned</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon blue">
        <BookOpen :size="20" />
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ formatCurrency(wallet.total_withdrawn) }}</span>
        <span class="stat-label">Total Withdrawn</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon orange">
        <Star :size="20" />
      </div>
      <div class="stat-content">
        <span class="stat-value">{{ formatCurrency(wallet.pending) }}</span>
        <span class="stat-label">Pending</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
}

.stat-icon.green {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success, #10b981);
}

.stat-icon.blue {
  background: var(--color-info-light, #dbeafe);
  color: var(--color-info, #3b82f6);
}

.stat-icon.orange {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning, #f59e0b);
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}
</style>
