<template>
  <div class="billing-view">
    <div class="billing-container">
      <div class="billing-header">
        <h1>{{ $t('billing.title') }}</h1>
        <p class="billing-subtitle">{{ $t('billing.subtitle') }}</p>
      </div>

      <div v-if="isLoading" class="loading-state">
        <div class="spinner"></div>
        <p>{{ $t('billing.loading') }}</p>
      </div>

      <div v-else class="billing-content">
        <div class="current-plan-card">
          <h2>{{ $t('billing.currentPlan') }}</h2>
          <div class="plan-badge" :class="`plan-${plan.toLowerCase()}`">
            {{ plan }}
          </div>
          
          <div v-if="isPro" class="subscription-details">
            <div class="detail-row">
              <span class="detail-label">{{ $t('billing.status') }}:</span>
              <span class="detail-value" :class="`status-${subscriptionStatus}`">
                {{ getSubscriptionStatusLabel(subscriptionStatus) }}
              </span>
            </div>
            
            <div v-if="currentPeriodEnd" class="detail-row">
              <span class="detail-label">{{ $t('billing.periodEnd') }}:</span>
              <span class="detail-value">{{ formatDate(currentPeriodEnd) }}</span>
            </div>
            
            <div v-if="cancelAtPeriodEnd" class="detail-row">
              <span class="detail-label warning">{{ $t('billing.willCancelAt') }}</span>
            </div>
          </div>
        </div>

        <div class="action-card">
          <h2>{{ $t('billing.manageSubscription') }}</h2>
          
          <div v-if="isFree" class="upgrade-section">
            <p>{{ $t('billing.upgradeDescription') }}</p>
            <button 
              class="btn btn-primary btn-large"
              @click="handleUpgrade"
              :disabled="billingStore.isLoading"
              data-testid="upgrade-button"
            >
              {{ billingStore.isLoading ? $t('billing.processing') : $t('billing.upgradeToPro') }}
            </button>
          </div>
          
          <div v-else-if="isPro && subscriptionStatus === 'active' && !cancelAtPeriodEnd" class="cancel-section">
            <p>{{ $t('billing.cancelDescription') }}</p>
            <button 
              class="btn btn-secondary"
              @click="handleCancel"
              :disabled="billingStore.isLoading"
              data-testid="cancel-button"
            >
              {{ billingStore.isLoading ? $t('billing.processing') : $t('billing.cancelAtPeriodEnd') }}
            </button>
          </div>
          
          <div v-else-if="cancelAtPeriodEnd" class="reactivate-section">
            <p>{{ $t('billing.reactivateDescription') }}</p>
          </div>
        </div>

        <div class="info-card">
          <h3>{{ $t('billing.needHelp') }}</h3>
          <p>{{ $t('billing.contactSupport') }}</p>
        </div>

        <NotificationPreferences />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useEntitlementsStore } from '@/stores/entitlementsStore'
import { useBillingStore } from '@/modules/billing/stores/billingStore'
import { useI18n } from 'vue-i18n'
import NotificationPreferences from '@/components/Notifications/NotificationPreferences.vue'

const { t } = useI18n()
const entitlementsStore = useEntitlementsStore()
const billingStore = useBillingStore()

const isLoading = ref(true)

const plan = computed(() => entitlementsStore.plan)
const expiresAt = computed(() => entitlementsStore.expiresAt)
const subscriptionStatus = computed(() => billingStore.subscription?.status || 'none')
const currentPeriodEnd = computed(() => billingStore.subscription?.current_period_end || null)
const cancelAtPeriodEnd = computed(() => billingStore.subscription?.cancel_at_period_end || false)
const isFree = computed(() => entitlementsStore.isFree)
const isPro = computed(() => entitlementsStore.isPro)

function getSubscriptionStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'active':
      return t('billing.statuses.active')
    case 'canceled':
      return t('billing.statuses.canceled')
    case 'past_due':
      return t('billing.statuses.past_due')
    case 'trialing':
      return t('billing.statuses.trialing')
    default:
      return status ? status : ''
  }
}

onMounted(async () => {
  try {
    await Promise.all([
      entitlementsStore.loadEntitlements(),
      billingStore.fetchMe()
    ])
  } catch (err) {
    console.error('Failed to load billing data:', err)
  } finally {
    isLoading.value = false
  }
})

async function handleUpgrade() {
  try {
    await billingStore.startCheckout('PRO')
  } catch (err) {
    console.error('Failed to start checkout:', err)
  }
}

async function handleCancel() {
  if (!confirm(t('billing.cancelConfirm'))) {
    return
  }
  
  try {
    await billingStore.cancelSubscription(true)
  } catch (err) {
    console.error('Failed to cancel subscription:', err)
  }
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('uk-UA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date)
}
</script>

<style scoped>
.billing-view {
  min-height: 100vh;
  background-color: #f9fafb;
  padding: 2rem 1rem;
}

.billing-container {
  max-width: 800px;
  margin: 0 auto;
}

.billing-header {
  text-align: center;
  margin-bottom: 3rem;
}

.billing-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.billing-subtitle {
  font-size: 1.125rem;
  color: #6b7280;
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 0;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.billing-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.current-plan-card,
.coming-soon-card,
.info-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.current-plan-card h2,
.coming-soon-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
}

.plan-badge {
  display: inline-block;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.plan-free {
  background-color: #e5e7eb;
  color: #374151;
}

.plan-pro {
  background-color: #dbeafe;
  color: #1e40af;
}

.plan-business {
  background-color: #fef3c7;
  color: #92400e;
}

.expiry-info {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
}

.coming-soon-card {
  text-align: center;
}

.coming-soon-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.coming-soon-card p {
  font-size: 1.125rem;
  color: #6b7280;
  margin: 0 0 1.5rem 0;
}

.features-list {
  list-style: none;
  padding: 0;
  margin: 0;
  text-align: left;
  max-width: 400px;
  margin: 0 auto;
}

.features-list li {
  padding: 0.75rem 0;
  border-bottom: 1px solid #e5e7eb;
  color: #374151;
}

.features-list li:last-child {
  border-bottom: none;
}

.features-list li::before {
  content: '✓';
  color: #10b981;
  font-weight: bold;
  margin-right: 0.75rem;
}

.info-card h3 {
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 0.5rem 0;
}

.info-card p {
  color: #6b7280;
  margin: 0;
}

.action-card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.action-card h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #111827;
  margin: 0 0 1rem 0;
}

.upgrade-section,
.cancel-section,
.reactivate-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.upgrade-section p,
.cancel-section p,
.reactivate-section p {
  color: #6b7280;
  margin: 0;
}

.btn {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-large {
  padding: 1rem 2rem;
  font-size: 1.125rem;
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e5e7eb;
}

.subscription-details {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
}

.detail-label {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
}

.detail-label.warning {
  color: #f59e0b;
}

.detail-value {
  font-size: 0.875rem;
  color: #111827;
  font-weight: 600;
}

.status-active {
  color: #10b981;
}

.status-canceled {
  color: #ef4444;
}

.status-past_due {
  color: #f59e0b;
}

.status-trialing {
  color: #3b82f6;
}
</style>
