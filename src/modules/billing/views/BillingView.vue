<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Header -->
    <div class="mb-8">
      <Heading :level="1" class="mb-2">
        {{ $t('billing.title') }}
      </Heading>
      <p class="text-muted">
        {{ $t('billing.subtitle') }}
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="billingStore.isLoading && !billingStore.me" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
    </div>

    <!-- Error State -->
    <Card v-else-if="billingStore.lastError" class="p-6 text-center">
      <p class="text-danger mb-4">{{ billingStore.lastError.message }}</p>
      <Button variant="secondary" @click="billingStore.fetchMe()">
        {{ $t('common.retry') }}
      </Button>
    </Card>

    <!-- Billing Content -->
    <div v-else class="space-y-6">
      <!-- v0.78.0: TTL Expired Warning -->
      <Card v-if="showExpiredWarning" class="p-4 bg-yellow-50 border-yellow-200">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-yellow-900">
              {{ $t('billing.pendingPlan.expiredTitle') }}
            </p>
            <p class="text-xs text-yellow-700 mt-1">
              {{ $t('billing.pendingPlan.expiredDescription') }}
            </p>
          </div>
          <div class="flex-shrink-0">
            <Button 
              variant="secondary" 
              size="sm"
              :disabled="isRefreshing"
              @click="handleManualRefresh"
            >
              {{ isRefreshing ? $t('billing.loading') : $t('billing.actions.refreshStatus') }}
            </Button>
          </div>
        </div>
      </Card>

      <!-- v0.78.0: Pending Plan Banner with Auto-refresh -->
      <Card v-if="billingStore.hasPendingPlan" class="p-4 bg-blue-50 border-blue-200">
        <div class="flex items-start gap-3">
          <div class="flex-shrink-0 mt-0.5">
            <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-blue-900">
              {{ $t('billing.pendingPlan.title', { plan: billingStore.pendingPlanCode }) }}
            </p>
            <p class="text-xs text-blue-700 mt-1">
              {{ $t('billing.pendingPlan.description') }}
            </p>
            <!-- v0.78.0: Manual refresh hint after auto-refresh stops -->
            <p v-if="autoRefreshStopped" class="text-xs text-blue-600 mt-2 font-medium">
              {{ $t('billing.pendingPlan.manualRefreshHint') }}
            </p>
          </div>
          <div class="flex-shrink-0">
            <Button 
              variant="secondary" 
              size="sm"
              :disabled="isRefreshing"
              @click="handleManualRefresh"
            >
              {{ isRefreshing ? $t('billing.loading') : $t('billing.actions.refreshStatus') }}
            </Button>
          </div>
        </div>
      </Card>

      <!-- Current Plan Card -->
      <Card class="p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <p class="text-sm text-muted mb-1">{{ $t('billing.currentPlan') }}</p>
            <h2 class="text-3xl font-bold">{{ billingStore.displayPlanCode }}</h2>
            <p v-if="billingStore.hasPendingPlan" class="text-xs text-muted mt-1">
              {{ $t('billing.currentlyActive') }}: {{ billingStore.currentPlanCode }}
            </p>
          </div>
          <Button variant="primary" @click="goToPlans">
            {{ $t('billing.viewPlans') }}
          </Button>
        </div>

        <!-- Subscription Status -->
        <div v-if="billingStore.subscription" class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">{{ $t('billing.status') }}:</span>
            <span
              class="px-2 py-1 text-xs font-semibold rounded-full"
              :class="getStatusClass(billingStore.subscription.status)"
            >
              {{ $t(`billing.statuses.${billingStore.subscription.status}`) }}
            </span>
          </div>

          <div v-if="billingStore.subscription.current_period_end" class="text-sm">
            <span class="text-muted">{{ $t('billing.renewsOn') }}:</span>
            <span class="font-medium ml-1">{{ formatDate(billingStore.subscription.current_period_end) }}</span>
          </div>

          <div v-if="billingStore.me?.subscription?.provider" class="text-sm">
            <span class="text-muted">{{ $t('billing.provider') }}:</span>
            <span class="font-medium ml-1 capitalize">{{ billingStore.me.subscription.provider }}</span>
          </div>

          <div v-if="billingStore.subscription.cancel_at_period_end" class="p-3 bg-warning-light border border-warning rounded-lg">
            <p class="text-sm text-warning-dark">
              {{ $t('billing.cancelScheduled') }}
            </p>
          </div>
        </div>

        <!-- No Subscription -->
        <div v-else class="text-sm text-muted">
          {{ $t('billing.noActiveSubscription') }}
        </div>
      </Card>

      <!-- Features Card -->
      <Card class="p-6">
        <h3 class="text-lg font-semibold mb-4">{{ $t('billing.yourFeatures') }}</h3>
        <ul v-if="billingStore.entitlement?.features.length" class="space-y-2">
          <li v-for="feature in billingStore.entitlement.features" :key="feature" class="flex items-start gap-2">
            <Check :size="20" class="text-accent flex-shrink-0 mt-0.5" />
            <span class="text-sm">{{ $t(`billing.features.${feature}`) }}</span>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">
          {{ $t('billing.basicFeaturesOnly') }}
        </p>
      </Card>

      <!-- Actions Card -->
      <Card v-if="billingStore.subscription?.status === 'active'" class="p-6">
        <h3 class="text-lg font-semibold mb-4">{{ $t('billing.manageSubscription') }}</h3>
        
        <div class="space-y-4">
          <!-- Cancel Subscription -->
          <div v-if="!billingStore.subscription.cancel_at_period_end">
            <p class="text-sm text-muted mb-3">
              {{ $t('billing.cancelDescription') }}
            </p>
            <Button
              variant="danger"
              :disabled="isCanceling || billingStore.isLoadingAction"
              @click="handleCancel"
            >
              {{ isCanceling || billingStore.isLoadingAction ? $t('billing.canceling') : $t('billing.cancelSubscription') }}
            </Button>
          </div>

          <!-- Canceled Info -->
          <div v-else>
            <p class="text-sm text-muted">
              {{ $t('billing.cancelScheduled') }}
            </p>
          </div>
        </div>

        <!-- Action Error -->
        <div v-if="actionError" class="mt-4 p-3 bg-danger-light border border-danger rounded-lg">
          <p class="text-sm text-danger">{{ actionError }}</p>
        </div>

        <!-- Action Success -->
        <div v-if="actionSuccess" class="mt-4 p-3 bg-success-light border border-success rounded-lg">
          <p class="text-sm text-success-dark">{{ actionSuccess }}</p>
        </div>
      </Card>

      <!-- Billing History (Placeholder) -->
      <Card class="p-6">
        <h3 class="text-lg font-semibold mb-4">{{ $t('billing.history') }}</h3>
        <p class="text-sm text-muted">
          {{ $t('billing.historyComingSoon') }}
        </p>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Billing View (v0.72.0)
 * 
 * Shows current subscription status and allows management:
 * - View current plan
 * - View subscription status
 * - View entitlements (features)
 * - Cancel subscription
 * - Resume canceled subscription
 * 
 * INVARIANTS:
 * - All data comes from backend via billingStore
 * - After cancel/resume, automatically refetches billing/me
 * - No hardcoded feature logic
 */

import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Check } from 'lucide-vue-next'
import { useBillingStore } from '../stores/billingStore'
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
import Heading from '@/ui/Heading.vue'
import type { SubscriptionStatus } from '../api/billingApi'

const router = useRouter()
const { t } = useI18n()
const billingStore = useBillingStore()

const isCanceling = ref(false)
const isResuming = ref(false)
const actionError = ref<string | null>(null)
const actionSuccess = ref<string | null>(null)

// v0.78.0: Auto-refresh state
const isRefreshing = ref(false)
const autoRefreshStopped = ref(false)
let autoRefreshTimer: ReturnType<typeof setInterval> | null = null
let autoRefreshStartTime: number | null = null
const AUTO_REFRESH_INTERVAL = 30000 // 30 seconds
const AUTO_REFRESH_MAX_DURATION = 600000 // 10 minutes

// v0.78.0: TTL expired state
const hadPendingPlan = ref(false)
const showExpiredWarning = ref(false)
const expiredWarningDismissed = ref(false)

onMounted(async () => {
  try {
    await billingStore.fetchMe()
    // Start auto-refresh if pending plan exists
    if (billingStore.hasPendingPlan) {
      startAutoRefresh()
    }
  } catch (err) {
    console.error('Failed to load billing data:', err)
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})

// Watch for pending plan changes to start/stop auto-refresh
watch(() => billingStore.hasPendingPlan, (hasPending, hadPending) => {
  if (hasPending && !autoRefreshTimer) {
    startAutoRefresh()
    hadPendingPlan.value = true
  } else if (!hasPending) {
    stopAutoRefresh()
    
    // v0.78.0: Check if TTL expired (pending disappeared but entitlement still FREE)
    if (hadPendingPlan.value && billingStore.currentPlanCode === 'FREE' && !expiredWarningDismissed.value) {
      showExpiredWarning.value = true
      // Auto-hide after 30 seconds
      setTimeout(() => {
        showExpiredWarning.value = false
      }, 30000)
    }
  }
})

// Track initial pending state
watch(() => billingStore.hasPendingPlan, (hasPending) => {
  if (hasPending) {
    hadPendingPlan.value = true
  }
}, { immediate: true })

function startAutoRefresh() {
  if (autoRefreshTimer) return // Already running
  
  autoRefreshStartTime = Date.now()
  autoRefreshStopped.value = false
  
  autoRefreshTimer = setInterval(async () => {
    // Check if max duration exceeded
    if (autoRefreshStartTime && Date.now() - autoRefreshStartTime >= AUTO_REFRESH_MAX_DURATION) {
      stopAutoRefresh()
      autoRefreshStopped.value = true
      return
    }
    
    // Auto-refresh
    try {
      await billingStore.fetchMe()
    } catch (err) {
      console.error('Auto-refresh failed:', err)
    }
  }, AUTO_REFRESH_INTERVAL)
}

function stopAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer)
    autoRefreshTimer = null
    autoRefreshStartTime = null
  }
}

async function handleManualRefresh() {
  isRefreshing.value = true
  try {
    await billingStore.fetchMe()
  } catch (err) {
    console.error('Manual refresh failed:', err)
  } finally {
    isRefreshing.value = false
  }
}

function getStatusClass(status: SubscriptionStatus): string {
  const classes: Record<SubscriptionStatus, string> = {
    none: 'bg-gray-100 text-gray-800',
    active: 'bg-success-light text-success-dark',
    canceled: 'bg-warning-light text-warning-dark',
    past_due: 'bg-danger-light text-danger',
    unpaid: 'bg-danger-light text-danger',
    incomplete: 'bg-warning-light text-warning-dark',
    trialing: 'bg-blue-100 text-blue-800',
    expired: 'bg-gray-100 text-gray-800',
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return new Intl.DateTimeFormat('uk-UA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date)
  } catch {
    return dateStr
  }
}

function goToPlans() {
  router.push('/billing/plans')
}

async function handleCancel() {
  if (!confirm(t('billing.cancelConfirm'))) return

  isCanceling.value = true
  actionError.value = null
  actionSuccess.value = null

  try {
    await billingStore.cancel(true) // Cancel at period end
    actionSuccess.value = t('billing.cancelSuccess')
    
    // Success message will auto-hide after 5 seconds
    setTimeout(() => {
      actionSuccess.value = null
    }, 5000)
  } catch (err: any) {
    console.error('Cancel failed:', err)
    actionError.value = err.message || t('billing.cancelError')
  } finally {
    isCanceling.value = false
  }
}
</script>
