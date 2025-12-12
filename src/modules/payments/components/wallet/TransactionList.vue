<script setup lang="ts">
// F18: Transaction List Component
import type { WalletTransaction } from '../../api/payments'
import TransactionItem from './TransactionItem.vue'

defineProps<{
  transactions: WalletTransaction[]
  isLoading?: boolean
  hasMore?: boolean
  currency: string
}>()

const emit = defineEmits<{
  loadMore: []
}>()
</script>

<template>
  <div class="transaction-list">
    <!-- Loading -->
    <div v-if="isLoading && transactions.length === 0" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Empty State -->
    <div v-else-if="transactions.length === 0" class="empty-state">
      <p>No transactions yet</p>
    </div>

    <!-- Transactions -->
    <template v-else>
      <TransactionItem
        v-for="transaction in transactions"
        :key="transaction.id"
        :transaction="transaction"
        :currency="currency"
      />

      <!-- Load More -->
      <button
        v-if="hasMore"
        class="load-more-btn"
        :disabled="isLoading"
        @click="emit('loadMore')"
      >
        {{ isLoading ? 'Loading...' : 'Load More' }}
      </button>
    </template>
  </div>
</template>

<style scoped>
.transaction-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Loading */
.loading-state {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.spinner {
  width: 32px;
  height: 32px;
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
  padding: 48px 0;
  color: var(--color-text-secondary, #6b7280);
}

.empty-state p {
  margin: 0;
}

/* Load More */
.load-more-btn {
  padding: 12px 24px;
  margin-top: 8px;
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
</style>
