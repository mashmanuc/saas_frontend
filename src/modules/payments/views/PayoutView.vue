<script setup lang="ts">
// F8: Payout View
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowLeft, Banknote } from 'lucide-vue-next'
import { useWalletStore } from '../stores/walletStore'
import PayoutForm from '../components/payout/PayoutForm.vue'
import PayoutSettings from '../components/payout/PayoutSettings.vue'
import PayoutHistory from '../components/payout/PayoutHistory.vue'

const router = useRouter()
const store = useWalletStore()

const { wallet, payouts, isLoading, error } = storeToRefs(store)

const activeTab = ref<'request' | 'settings' | 'history'>('request')
const showSettings = ref(false)

onMounted(async () => {
  await Promise.all([
    store.loadWallet(),
    store.loadPayouts(),
  ])
})

async function handlePayoutRequest(amount?: number) {
  try {
    await store.requestPayout(amount)
    activeTab.value = 'history'
  } catch (e) {
    console.error('Payout request failed:', e)
  }
}

async function handleSettingsUpdate(settings: any) {
  try {
    await store.updatePayoutSettings(settings)
    showSettings.value = false
  } catch (e) {
    console.error('Settings update failed:', e)
  }
}

async function handleCancelPayout(id: number) {
  if (confirm('Are you sure you want to cancel this payout request?')) {
    await store.cancelPayout(id)
  }
}

function goBack() {
  router.push('/wallet')
}
</script>

<template>
  <div class="payout-view">
    <!-- Header -->
    <header class="view-header">
      <button class="back-btn" @click="goBack">
        <ArrowLeft :size="20" />
      </button>
      <div>
        <h1>Withdraw Funds</h1>
        <p class="subtitle">Request a payout to your bank account</p>
      </div>
    </header>

    <!-- Tabs -->
    <div class="tabs">
      <button
        :class="['tab', { active: activeTab === 'request' }]"
        @click="activeTab = 'request'"
      >
        Request Payout
      </button>
      <button
        :class="['tab', { active: activeTab === 'settings' }]"
        @click="activeTab = 'settings'"
      >
        Payout Settings
      </button>
      <button
        :class="['tab', { active: activeTab === 'history' }]"
        @click="activeTab = 'history'"
      >
        History
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading && !wallet" class="loading-state">
      <div class="spinner" />
    </div>

    <template v-else-if="wallet">
      <!-- Request Tab -->
      <div v-if="activeTab === 'request'" class="tab-content">
        <PayoutForm
          :wallet="wallet"
          :is-loading="isLoading"
          @submit="handlePayoutRequest"
          @edit-settings="activeTab = 'settings'"
        />
      </div>

      <!-- Settings Tab -->
      <div v-if="activeTab === 'settings'" class="tab-content">
        <PayoutSettings
          :wallet="wallet"
          :is-loading="isLoading"
          @submit="handleSettingsUpdate"
        />
      </div>

      <!-- History Tab -->
      <div v-if="activeTab === 'history'" class="tab-content">
        <PayoutHistory
          :payouts="payouts"
          :currency="wallet.currency"
          @cancel="handleCancelPayout"
        />
      </div>
    </template>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.payout-view {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px;
}

.view-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  border-radius: 8px;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: background 0.15s;
}

.back-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.view-header h1 {
  margin: 0 0 4px;
  font-size: 24px;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

/* Tabs */
.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
  padding: 4px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 10px;
}

.tab {
  flex: 1;
  padding: 10px 16px;
  background: none;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.tab:hover {
  color: var(--color-text-primary, #111827);
}

.tab.active {
  background: var(--color-bg-primary, white);
  color: var(--color-text-primary, #111827);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

/* Tab Content */
.tab-content {
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
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
