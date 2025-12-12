<script setup lang="ts">
// F15: Payment Success Component
import { computed } from 'vue'
import { CheckCircle, ArrowRight } from 'lucide-vue-next'
import type { Payment } from '../../api/payments'

const props = defineProps<{
  payment: Payment | null
}>()

const emit = defineEmits<{
  close: []
}>()

const formattedAmount = computed(() => {
  if (!props.payment) return ''
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: props.payment.currency,
  }).format(props.payment.amount / 100)
})
</script>

<template>
  <Teleport to="body">
    <div class="success-overlay">
      <div class="success-modal">
        <div class="success-icon">
          <CheckCircle :size="64" />
        </div>

        <h2>Payment Successful!</h2>
        <p class="success-message">
          Your payment of <strong>{{ formattedAmount }}</strong> has been processed successfully.
        </p>

        <div v-if="payment" class="payment-details">
          <div class="detail-row">
            <span>Transaction ID</span>
            <span class="mono">{{ payment.uuid.slice(0, 8) }}</span>
          </div>
          <div class="detail-row">
            <span>Description</span>
            <span>{{ payment.description }}</span>
          </div>
        </div>

        <button class="continue-btn" @click="emit('close')">
          Continue
          <ArrowRight :size="18" />
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.success-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
}

.success-modal {
  width: 100%;
  max-width: 400px;
  margin: 16px;
  padding: 40px 32px;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  text-align: center;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}

.success-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
  color: var(--color-success, #10b981);
}

.success-modal h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.success-message {
  margin: 0 0 24px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.success-message strong {
  color: var(--color-text-primary, #111827);
}

.payment-details {
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  margin-bottom: 24px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.detail-row + .detail-row {
  margin-top: 8px;
}

.detail-row span:first-child {
  color: var(--color-text-secondary, #6b7280);
}

.detail-row span:last-child {
  color: var(--color-text-primary, #111827);
  font-weight: 500;
}

.mono {
  font-family: monospace;
}

.continue-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px 24px;
  background: var(--color-primary, #3b82f6);
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.15s;
}

.continue-btn:hover {
  background: var(--color-primary-dark, #2563eb);
}
</style>
