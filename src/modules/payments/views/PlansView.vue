<script setup lang="ts">
// F10: Plans View
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { Check, Sparkles } from 'lucide-vue-next'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import { usePaymentStore } from '../stores/paymentStore'
import type { Plan } from '../api/payments'
import PlanCard from '../components/subscription/PlanCard.vue'
import PlanComparison from '../components/subscription/PlanComparison.vue'

const router = useRouter()
const subscriptionStore = useSubscriptionStore()
const paymentStore = usePaymentStore()

const {
  plans,
  sortedPlans,
  currentSubscription,
  currentPlan,
  hasActiveSubscription,
  isLoading,
  error,
} = storeToRefs(subscriptionStore)

const showComparison = ref(false)
const selectedPlan = ref<Plan | null>(null)
const isProcessing = ref(false)

onMounted(async () => {
  await Promise.all([
    subscriptionStore.loadPlans(),
    subscriptionStore.loadCurrentSubscription(),
    paymentStore.loadPaymentMethods(),
  ])
})

const canChangePlan = computed(() => {
  if (!hasActiveSubscription.value) return true
  return currentSubscription.value?.status !== 'past_due'
})

async function handleSelectPlan(plan: Plan) {
  if (!canChangePlan.value) return

  selectedPlan.value = plan

  if (hasActiveSubscription.value) {
    // Change plan
    if (confirm(`Change to ${plan.name} plan?`)) {
      isProcessing.value = true
      try {
        await subscriptionStore.changePlan(plan.id)
        router.push('/subscription')
      } catch (e) {
        console.error('Plan change failed:', e)
      } finally {
        isProcessing.value = false
      }
    }
  } else {
    // New subscription - go to checkout
    router.push({
      path: '/checkout',
      query: {
        type: 'subscription',
        plan: plan.id.toString(),
        amount: plan.price.toString(),
        currency: plan.currency,
      },
    })
  }
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}
</script>

<template>
  <div class="plans-view">
    <header class="view-header">
      <div class="header-content">
        <Sparkles :size="32" class="header-icon" />
        <h1>Choose Your Plan</h1>
        <p class="subtitle">
          Unlock premium features and save on your lessons
        </p>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading && plans.length === 0" class="loading-state">
      <div class="spinner" />
    </div>

    <!-- Plans Grid -->
    <div v-else class="plans-grid">
      <PlanCard
        v-for="plan in sortedPlans"
        :key="plan.id"
        :plan="plan"
        :is-current="currentPlan?.id === plan.id"
        :has-subscription="hasActiveSubscription"
        :disabled="isProcessing"
        @select="handleSelectPlan"
      />
    </div>

    <!-- Comparison Toggle -->
    <div class="comparison-toggle">
      <button @click="showComparison = !showComparison">
        {{ showComparison ? 'Hide' : 'Show' }} detailed comparison
      </button>
    </div>

    <!-- Plan Comparison -->
    <PlanComparison
      v-if="showComparison"
      :plans="sortedPlans"
      :current-plan-id="currentPlan?.id"
    />

    <!-- FAQ Section -->
    <section class="faq-section">
      <h2>Frequently Asked Questions</h2>

      <div class="faq-list">
        <details class="faq-item">
          <summary>Can I cancel anytime?</summary>
          <p>
            Yes, you can cancel your subscription at any time. You'll continue
            to have access until the end of your billing period.
          </p>
        </details>

        <details class="faq-item">
          <summary>What happens to unused lessons?</summary>
          <p>
            Unused lessons don't roll over to the next month. We recommend
            choosing a plan that matches your learning schedule.
          </p>
        </details>

        <details class="faq-item">
          <summary>Can I change my plan?</summary>
          <p>
            Yes, you can upgrade or downgrade your plan at any time. Changes
            take effect at the start of your next billing period.
          </p>
        </details>

        <details class="faq-item">
          <summary>Is there a free trial?</summary>
          <p>
            New users get a 7-day free trial on any plan. You won't be charged
            until the trial ends.
          </p>
        </details>
      </div>
    </section>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.plans-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px 16px 64px;
}

.view-header {
  text-align: center;
  margin-bottom: 48px;
}

.header-content {
  max-width: 600px;
  margin: 0 auto;
}

.header-icon {
  color: var(--color-primary, #3b82f6);
  margin-bottom: 16px;
}

.view-header h1 {
  margin: 0 0 8px;
  font-size: 36px;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  font-size: 18px;
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

/* Plans Grid */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 24px;
  max-width: 900px;
  margin: 0 auto;
}

/* Comparison Toggle */
.comparison-toggle {
  text-align: center;
  margin-top: 32px;
}

.comparison-toggle button {
  padding: 0;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-primary, #3b82f6);
  cursor: pointer;
}

.comparison-toggle button:hover {
  text-decoration: underline;
}

/* FAQ Section */
.faq-section {
  margin-top: 64px;
  max-width: 700px;
  margin-left: auto;
  margin-right: auto;
}

.faq-section h2 {
  margin: 0 0 24px;
  font-size: 24px;
  font-weight: 600;
  text-align: center;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-item {
  padding: 16px 20px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
}

.faq-item summary {
  font-weight: 500;
  cursor: pointer;
  list-style: none;
}

.faq-item summary::-webkit-details-marker {
  display: none;
}

.faq-item summary::before {
  content: '+';
  margin-right: 12px;
  font-weight: 400;
}

.faq-item[open] summary::before {
  content: '−';
}

.faq-item p {
  margin: 12px 0 0;
  padding-left: 24px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.6;
}

/* Error */
.error-message {
  margin-top: 16px;
  padding: 12px;
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
  border-radius: 8px;
  font-size: 14px;
  text-align: center;
}
</style>
