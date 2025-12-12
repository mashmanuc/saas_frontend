<script setup lang="ts">
// F16: Wallet Balance Component
import { computed } from 'vue'
import { Wallet, ArrowUpRight, Clock } from 'lucide-vue-next'
import type { Wallet as WalletType } from '../../api/payments'

const props = defineProps<{
  wallet: WalletType
}>()

const emit = defineEmits<{
  withdraw: []
}>()

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: props.wallet.currency,
  }).format(amount / 100)
}
</script>

<template>
  <div class="wallet-balance">
    <div class="balance-header">
      <div class="balance-icon">
        <Wallet :size="24" />
      </div>
      <span class="balance-label">Available Balance</span>
    </div>

    <div class="balance-amount">
      {{ formatCurrency(wallet.balance) }}
    </div>

    <div class="balance-secondary">
      <div class="secondary-item">
        <Clock :size="16" />
        <span>Pending: {{ formatCurrency(wallet.pending) }}</span>
      </div>
    </div>

    <div class="balance-actions">
      <button
        v-if="wallet.can_withdraw"
        class="withdraw-btn"
        @click="emit('withdraw')"
      >
        <ArrowUpRight :size="18" />
        Withdraw Funds
      </button>

      <p v-else class="threshold-notice">
        Minimum {{ formatCurrency(wallet.payout_threshold) }} required for withdrawal
      </p>
    </div>

    <div class="balance-stats">
      <div class="stat-item">
        <span class="stat-label">Total Earned</span>
        <span class="stat-value">{{ formatCurrency(wallet.total_earned) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Total Withdrawn</span>
        <span class="stat-value">{{ formatCurrency(wallet.total_withdrawn) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wallet-balance {
  padding: 28px;
  background: linear-gradient(135deg, var(--color-primary, #3b82f6) 0%, var(--color-primary-dark, #2563eb) 100%);
  border-radius: 16px;
  color: white;
}

.balance-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.balance-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
}

.balance-label {
  font-size: 14px;
  opacity: 0.9;
}

.balance-amount {
  font-size: 40px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 8px;
}

.balance-secondary {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.secondary-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  opacity: 0.85;
}

.balance-actions {
  margin-bottom: 24px;
}

.withdraw-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary, #3b82f6);
  cursor: pointer;
  transition: all 0.15s;
}

.withdraw-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.threshold-notice {
  margin: 0;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
  font-size: 13px;
  opacity: 0.9;
}

.balance-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
}

.stat-value {
  font-size: 18px;
  font-weight: 600;
}
</style>
