<script setup lang="ts">
// F13: Payment Summary Component
import { computed } from 'vue'
import { ShoppingCart, Calendar, User } from 'lucide-vue-next'

const props = defineProps<{
  booking?: {
    id: number
    booking_id: string
    tutor_name: string
    subject: string
    date: string
  } | null
  amount: number
  currency: string
}>()

const formattedAmount = computed(() =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: props.currency,
  }).format(props.amount / 100)
)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="payment-summary">
    <h3>Order Summary</h3>

    <!-- Booking Details -->
    <div v-if="booking" class="booking-details">
      <div class="detail-row">
        <User :size="18" />
        <div>
          <span class="label">Tutor</span>
          <span class="value">{{ booking.tutor_name }}</span>
        </div>
      </div>

      <div class="detail-row">
        <ShoppingCart :size="18" />
        <div>
          <span class="label">Subject</span>
          <span class="value">{{ booking.subject }}</span>
        </div>
      </div>

      <div class="detail-row">
        <Calendar :size="18" />
        <div>
          <span class="label">Date & Time</span>
          <span class="value">{{ formatDate(booking.date) }}</span>
        </div>
      </div>
    </div>

    <!-- Generic Summary -->
    <div v-else class="generic-summary">
      <ShoppingCart :size="24" />
      <p>Payment for services</p>
    </div>

    <!-- Total -->
    <div class="total-section">
      <div class="total-row">
        <span>Subtotal</span>
        <span>{{ formattedAmount }}</span>
      </div>
      <div class="total-row total">
        <span>Total</span>
        <span class="total-amount">{{ formattedAmount }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.payment-summary {
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.payment-summary h3 {
  margin: 0 0 20px;
  font-size: 16px;
  font-weight: 600;
}

/* Booking Details */
.booking-details {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.detail-row svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-text-secondary, #6b7280);
}

.detail-row > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.label {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.value {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

/* Generic Summary */
.generic-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-secondary, #6b7280);
}

.generic-summary p {
  margin: 0;
  font-size: 14px;
}

/* Total Section */
.total-section {
  padding-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.total-row {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.total-row.total {
  padding-top: 12px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.total-amount {
  font-size: 20px;
}
</style>
