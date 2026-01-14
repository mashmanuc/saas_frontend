<template>
  <div v-if="show" class="checkout-locked-alert">
    <div class="alert-icon">⚠️</div>
    <div class="alert-content">
      <h3 class="alert-title">{{ $t('billing.checkout.locked.title') }}</h3>
      <p class="alert-message">{{ $t('billing.checkout.locked.message') }}</p>
      
      <div v-if="existingCheckout" class="existing-info">
        <div class="info-row">
          <span class="info-label">{{ $t('billing.checkout.locked.plan') }}</span>
          <span class="info-value">{{ existingCheckout.plan_code }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('billing.checkout.locked.orderId') }}</span>
          <span class="info-value">{{ existingCheckout.order_id }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('billing.checkout.locked.pendingSince') }}</span>
          <span class="info-value">{{ formattedPendingSince }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">{{ $t('billing.checkout.locked.age') }}</span>
          <span class="info-value">{{ pendingAgeText }}</span>
        </div>
      </div>

      <div class="alert-actions">
        <button @click="handleRefresh" class="btn-refresh">
          {{ $t('billing.checkout.locked.refresh') }}
        </button>
        <button @click="handleClose" class="btn-close">
          {{ $t('billing.checkout.locked.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * CheckoutLockedAlert Component
 * 
 * v0.80.0 FE-80.2: Shows alert when checkout is locked (409 response)
 * 
 * DoD:
 * - Shows existing checkout details (order_id, plan, age)
 * - Provides refresh action to check status
 * - Auto-dismissible
 */

interface ExistingCheckout {
  order_id: string
  plan_code: string
  pending_since: string
  pending_age_seconds: number
}

interface Props {
  show: boolean
  existingCheckout?: ExistingCheckout | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
  close: []
}>()

const formattedPendingSince = computed(() => {
  if (!props.existingCheckout?.pending_since) return ''
  const date = new Date(props.existingCheckout.pending_since)
  return date.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
})

const pendingAgeText = computed(() => {
  if (!props.existingCheckout?.pending_age_seconds) return ''
  const seconds = props.existingCheckout.pending_age_seconds
  const minutes = Math.floor(seconds / 60)
  
  if (minutes < 1) return `${seconds} сек`
  if (minutes < 60) return `${minutes} хв`
  
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours} год ${remainingMinutes} хв`
})

function handleRefresh() {
  emit('refresh')
}

function handleClose() {
  emit('close')
}
</script>

<style scoped>
.checkout-locked-alert {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--color-warning-soft);
  border: 1px solid var(--color-warning);
  border-radius: 12px;
  margin-bottom: 20px;
}

.alert-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
}

.alert-title {
  margin: 0 0 8px 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
}

.alert-message {
  margin: 0 0 16px 0;
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.existing-info {
  background: var(--color-background);
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.info-row:not(:last-child) {
  border-bottom: 1px solid var(--color-border-soft);
}

.info-label {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.info-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text);
  font-family: monospace;
}

.alert-actions {
  display: flex;
  gap: 12px;
}

.btn-refresh,
.btn-close {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-refresh {
  background: var(--color-primary);
  color: white;
}

.btn-refresh:hover {
  background: var(--color-primary-dark);
}

.btn-close {
  background: var(--color-background-soft);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.btn-close:hover {
  background: var(--color-background-mute);
}
</style>
