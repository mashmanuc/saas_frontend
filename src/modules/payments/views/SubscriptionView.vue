<script setup lang="ts">
// F9: Subscription View
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { CreditCard, Calendar, AlertCircle } from 'lucide-vue-next'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import CurrentPlan from '../components/subscription/CurrentPlan.vue'
import CancelModal from '../components/subscription/CancelModal.vue'
import Button from '@/ui/Button.vue'

const router = useRouter()
const store = useSubscriptionStore()

const {
  currentSubscription,
  currentPlan,
  hasActiveSubscription,
  isCancelling,
  lessonsRemaining,
  lessonsUsed,
  daysUntilRenewal,
  isLoading,
  error,
} = storeToRefs(store)

const showCancelModal = ref(false)

onMounted(async () => {
  await store.loadCurrentSubscription()
})

function goToPlans() {
  router.push('/plans')
}

function openCancelModal() {
  showCancelModal.value = true
}

async function handleCancel(atPeriodEnd: boolean) {
  try {
    await store.cancelSubscription(atPeriodEnd)
    showCancelModal.value = false
  } catch (e) {
    console.error('Cancel failed:', e)
  }
}

async function handleReactivate() {
  try {
    await store.reactivate()
  } catch (e) {
    console.error('Reactivate failed:', e)
  }
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}
</script>

<template>
  <div class="subscription-view">
    <header class="view-header">
      <h1>Subscription</h1>
      <p class="subtitle">Manage your subscription plan</p>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- No Subscription -->
    <div v-else-if="!hasActiveSubscription && !currentSubscription" class="no-subscription">
      <div class="empty-card">
        <CreditCard :size="48" />
        <h2>No Active Subscription</h2>
        <p>Subscribe to a plan to unlock premium features and save on lessons.</p>
        <Button variant="primary" @click="goToPlans">
          View Plans
        </Button>
      </div>
    </div>

    <!-- Active Subscription -->
    <template v-else-if="currentSubscription && currentPlan">
      <CurrentPlan
        :subscription="currentSubscription"
        :plan="currentPlan"
        :lessons-remaining="lessonsRemaining"
        :lessons-used="lessonsUsed"
        :days-until-renewal="daysUntilRenewal"
        @change-plan="goToPlans"
        @cancel="openCancelModal"
        @reactivate="handleReactivate"
      />

      <!-- Cancellation Notice -->
      <div v-if="isCancelling" class="cancel-notice">
        <AlertCircle :size="20" />
        <div>
          <strong>Subscription Cancelling</strong>
          <p>
            Your subscription will end on
            {{ formatDate(currentSubscription.current_period_end) }}.
            You can reactivate anytime before then.
          </p>
        </div>
      </div>

      <!-- Usage Stats -->
      <section class="usage-section">
        <h2>This Period</h2>
        <div class="usage-grid">
          <div class="usage-card">
            <span class="usage-label">Lessons Used</span>
            <span class="usage-value">{{ lessonsUsed }}</span>
          </div>
          <div class="usage-card">
            <span class="usage-label">Lessons Remaining</span>
            <span class="usage-value">
              {{ lessonsRemaining === Infinity ? 'Unlimited' : lessonsRemaining }}
            </span>
          </div>
          <div class="usage-card">
            <span class="usage-label">Days Until Renewal</span>
            <span class="usage-value">{{ daysUntilRenewal }}</span>
          </div>
        </div>
      </section>

      <!-- Billing Info -->
      <section class="billing-section">
        <h2>Billing</h2>
        <div class="billing-info">
          <div class="billing-row">
            <span>Next billing date</span>
            <strong>{{ formatDate(currentSubscription.current_period_end) }}</strong>
          </div>
          <div class="billing-row">
            <span>Amount</span>
            <strong>{{ formatCurrency(currentPlan.price, currentPlan.currency) }}</strong>
          </div>
        </div>
        <router-link to="/invoices" class="invoices-link">
          View Invoices →
        </router-link>
      </section>
    </template>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Cancel Modal -->
    <CancelModal
      v-if="showCancelModal"
      :subscription="currentSubscription"
      @confirm="handleCancel"
      @close="showCancelModal = false"
    />
  </div>
</template>

<style scoped>
.subscription-view {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px;
}

.view-header {
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

/* No Subscription */
.no-subscription {
  display: flex;
  justify-content: center;
}

.empty-card {
  text-align: center;
  padding: 48px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  max-width: 400px;
}

.empty-card svg {
  color: var(--color-text-secondary, #6b7280);
  margin-bottom: 16px;
}

.empty-card h2 {
  margin: 0 0 8px;
  font-size: 20px;
}

.empty-card p {
  margin: 0 0 24px;
  color: var(--color-text-secondary, #6b7280);
}

/* Cancel Notice */
.cancel-notice {
  display: flex;
  gap: 12px;
  padding: 16px;
  margin-top: 24px;
  background: var(--color-warning-light, #fef3c7);
  border-radius: 8px;
}

.cancel-notice svg {
  flex-shrink: 0;
  color: var(--color-warning-dark, #92400e);
}

.cancel-notice strong {
  display: block;
  color: var(--color-warning-dark, #92400e);
}

.cancel-notice p {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--color-warning-dark, #92400e);
}

/* Usage Section */
.usage-section {
  margin-top: 32px;
}

.usage-section h2 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 640px) {
  .usage-grid {
    grid-template-columns: 1fr;
  }
}

.usage-card {
  padding: 20px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
  text-align: center;
}

.usage-label {
  display: block;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  margin-bottom: 8px;
}

.usage-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

/* Billing Section */
.billing-section {
  margin-top: 32px;
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.billing-section h2 {
  margin: 0 0 16px;
  font-size: 18px;
  font-weight: 600;
}

.billing-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.billing-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.billing-row span {
  color: var(--color-text-secondary, #6b7280);
}

.invoices-link {
  display: inline-block;
  margin-top: 16px;
  font-size: 14px;
  color: var(--color-primary, #3b82f6);
  text-decoration: none;
}

.invoices-link:hover {
  text-decoration: underline;
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
