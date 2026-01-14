<template>
  <div v-if="shouldShowPeriod" class="subscription-period">
    <div class="period-info">
      <span class="period-label">{{ $t('billing.period.label') }}</span>
      <span class="period-dates">
        {{ formattedPeriodStart }} — {{ formattedPeriodEnd }}
      </span>
    </div>
    <div v-if="daysRemaining !== null" class="period-remaining">
      <span class="remaining-label">{{ $t('billing.period.remaining') }}</span>
      <span class="remaining-value" :class="remainingClass">
        {{ daysRemaining }} {{ $t('billing.period.days') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBillingStore } from '../stores/billingStore'

/**
 * SubscriptionPeriod Component
 * 
 * v0.80.0 FE-80.4: Shows subscription period ONLY for active subscriptions
 * 
 * DoD:
 * - Shows period only when subscription.status === 'active'
 * - Does NOT show for pending/expired/canceled
 * - Formats dates in user locale
 * - Shows days remaining with color coding
 */

const billingStore = useBillingStore()

const subscription = computed(() => billingStore.subscription)

// FE-80.4: Show period ONLY for active subscriptions
const shouldShowPeriod = computed(() => {
  return subscription.value?.status === 'active' && 
         subscription.value?.current_period_end !== null
})

const periodEnd = computed(() => {
  if (!subscription.value?.current_period_end) return null
  return new Date(subscription.value.current_period_end)
})

const periodStart = computed(() => {
  // Fallback: calculate start as 30 days before end
  if (!periodEnd.value) return null
  const start = new Date(periodEnd.value)
  start.setDate(start.getDate() - 30)
  return start
})

const formattedPeriodStart = computed(() => {
  if (!periodStart.value) return ''
  return periodStart.value.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
})

const formattedPeriodEnd = computed(() => {
  if (!periodEnd.value) return ''
  return periodEnd.value.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
})

const daysRemaining = computed(() => {
  if (!periodEnd.value) return null
  const now = new Date()
  const diff = periodEnd.value.getTime() - now.getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const remainingClass = computed(() => {
  if (daysRemaining.value === null) return ''
  if (daysRemaining.value <= 3) return 'remaining-critical'
  if (daysRemaining.value <= 7) return 'remaining-warning'
  return 'remaining-ok'
})
</script>

<style scoped>
.subscription-period {
  padding: 12px 16px;
  background: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.period-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.period-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.period-dates {
  font-size: 0.875rem;
  color: var(--color-text);
  font-weight: 600;
}

.period-remaining {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid var(--color-border-soft);
}

.remaining-label {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
}

.remaining-value {
  font-size: 0.8125rem;
  font-weight: 600;
}

.remaining-ok {
  color: var(--color-success);
}

.remaining-warning {
  color: var(--color-warning);
}

.remaining-critical {
  color: var(--color-error);
}
</style>
