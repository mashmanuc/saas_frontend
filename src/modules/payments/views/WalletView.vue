<script setup lang="ts">
// F7: Wallet View (Tutor Dashboard)
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Wallet, TrendingUp, ArrowUpRight, RefreshCw } from 'lucide-vue-next'
import { useWalletStore } from '../stores/walletStore'
import WalletBalance from '../components/wallet/WalletBalance.vue'
import WalletStats from '../components/wallet/WalletStats.vue'
import TransactionList from '../components/wallet/TransactionList.vue'
import EarningsChart from '../components/wallet/EarningsChart.vue'

const router = useRouter()
const store = useWalletStore()

const {
  wallet,
  transactions,
  analytics,
  isLoading,
  error,
  hasMoreTransactions,
} = storeToRefs(store)

const analyticsPeriod = ref<'week' | 'month' | 'year'>('month')
const transactionFilter = ref<string>('')

onMounted(async () => {
  await Promise.all([
    store.loadWallet(),
    store.loadTransactions({}, true),
    store.loadAnalytics(analyticsPeriod.value),
    store.loadPayouts(),
  ])
})

watch(analyticsPeriod, (period) => {
  store.loadAnalytics(period)
})

watch(transactionFilter, () => {
  store.loadTransactions(
    { type: transactionFilter.value || undefined },
    true
  )
})

function goToWithdraw() {
  router.push('/wallet/payout')
}

function loadMoreTransactions() {
  store.loadMoreTransactions({ type: transactionFilter.value || undefined })
}

async function refreshData() {
  await store.loadWallet()
  await store.loadTransactions({}, true)
}
</script>

<template>
  <div class="wallet-view">
    <header class="view-header">
      <div>
        <h1>Wallet</h1>
        <p class="subtitle">Manage your earnings and payouts</p>
      </div>
      <button class="refresh-btn" @click="refreshData" :disabled="isLoading">
        <RefreshCw :size="18" :class="{ spinning: isLoading }" />
      </button>
    </header>

    <!-- Loading -->
    <div v-if="isLoading && !wallet" class="loading-state">
      <div class="spinner" />
    </div>

    <template v-else-if="wallet">
      <!-- Balance Card -->
      <WalletBalance :wallet="wallet" @withdraw="goToWithdraw" />

      <!-- Stats Grid -->
      <div class="stats-grid">
        <WalletStats :wallet="wallet" />

        <!-- Earnings Chart -->
        <div class="chart-card">
          <EarningsChart
            v-if="analytics"
            :analytics="analytics"
            v-model:period="analyticsPeriod"
          />
        </div>
      </div>

      <!-- Transactions -->
      <section class="transactions-section">
        <div class="section-header">
          <h2>Recent Transactions</h2>
          <select v-model="transactionFilter">
            <option value="">All Types</option>
            <option value="earning">Earnings</option>
            <option value="withdrawal">Withdrawals</option>
            <option value="tip">Tips</option>
            <option value="refund">Refunds</option>
            <option value="bonus">Bonuses</option>
          </select>
        </div>

        <TransactionList
          :transactions="transactions"
          :is-loading="isLoading"
          :has-more="hasMoreTransactions"
          :currency="wallet.currency"
          @load-more="loadMoreTransactions"
        />
      </section>
    </template>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.wallet-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
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

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary, #f5f5f5);
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.refresh-btn .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 24px;
  margin-top: 24px;
}

@media (max-width: 1024px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

/* Transactions Section */
.transactions-section {
  margin-top: 32px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.section-header select {
  padding: 8px 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 6px;
  font-size: 14px;
  background: var(--color-bg-primary, white);
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
