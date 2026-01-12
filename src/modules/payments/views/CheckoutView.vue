<script setup lang="ts">
// F5: Checkout View
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { ArrowLeft, Lock } from 'lucide-vue-next'
import { usePaymentStore } from '../stores/paymentStore'
import PaymentSummary from '../components/checkout/PaymentSummary.vue'
import PaymentMethods from '../components/checkout/PaymentMethods.vue'
import PaymentForm from '../components/checkout/PaymentForm.vue'
import PaymentSuccess from '../components/checkout/PaymentSuccess.vue'

const route = useRoute()
const router = useRouter()
const store = usePaymentStore()

const { paymentMethods, clientSecret, checkoutInProgress, error } = storeToRefs(store)

// Local state
const booking = ref<any>(null)
const amount = ref(0)
const currency = ref('UAH')
const selectedMethodId = ref<number | null>(null)
const showNewCardForm = ref(false)
const isProcessing = ref(false)
const paymentComplete = ref(false)
const completedPayment = ref<any>(null)

const canPay = computed(() => {
  if (showNewCardForm.value || !paymentMethods.value.length) {
    return !!clientSecret.value
  }
  return !!selectedMethodId.value
})

onMounted(async () => {
  // Parse route params
  const bookingId = route.query.booking ? Number(route.query.booking) : undefined
  amount.value = route.query.amount ? Number(route.query.amount) : 0
  currency.value = (route.query.currency as string) || 'UAH'

  // Load payment methods
  await store.loadPaymentMethods()

  // Auto-select default method
  if (store.defaultPaymentMethod) {
    selectedMethodId.value = store.defaultPaymentMethod.id
  }

  // Create payment intent
  if (amount.value > 0) {
    await store.initiatePayment({
      amount: amount.value,
      payment_type: 'lesson',
      booking_id: bookingId,
      currency: currency.value,
    })
  }
})

onUnmounted(() => {
  store.resetCheckout()
})

async function handlePaymentSuccess(paymentIntentId: string) {
  isProcessing.value = true

  try {
    completedPayment.value = await store.confirmPayment(paymentIntentId)
    paymentComplete.value = true
  } catch (e) {
    console.error('Payment confirmation failed:', e)
  } finally {
    isProcessing.value = false
  }
}

function handlePaymentError(errorMessage: string) {
  console.error('Payment error:', errorMessage)
}

async function payWithSavedMethod() {
  if (!selectedMethodId.value || !clientSecret.value) return

  isProcessing.value = true
  // Note: For saved methods, Stripe handles this differently
  // This would need Stripe.js integration for confirmCardPayment with saved method
  isProcessing.value = false
}

function handleComplete() {
  const redirectTo = route.query.redirect as string
  if (redirectTo) {
    router.push(redirectTo)
  } else {
    router.push('/calendar')
  }
}

function goBack() {
  router.back()
}

function formatCurrency(amount: number, curr: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: curr,
  }).format(amount / 100)
}
</script>

<template>
  <div class="checkout-view">
    <!-- Header -->
    <header class="view-header">
      <button class="back-btn" @click="goBack">
        <ArrowLeft :size="20" />
      </button>
      <h1>Checkout</h1>
    </header>

    <div class="checkout-container">
      <!-- Order Summary -->
      <aside class="summary-section">
        <PaymentSummary
          :booking="booking"
          :amount="amount"
          :currency="currency"
        />
      </aside>

      <!-- Payment Section -->
      <main class="payment-section">
        <h2>Payment Method</h2>

        <!-- Saved Methods -->
        <PaymentMethods
          v-if="paymentMethods.length && !showNewCardForm"
          :methods="paymentMethods"
          v-model="selectedMethodId"
          @add-new="showNewCardForm = true"
        />

        <!-- Stripe Elements Form -->
        <PaymentForm
          v-if="showNewCardForm || !paymentMethods.length"
          :client-secret="clientSecret || ''"
          :loading="isProcessing"
          @success="handlePaymentSuccess"
          @error="handlePaymentError"
        />

        <!-- Pay Button (for saved method) -->
        <button
          v-if="selectedMethodId && !showNewCardForm"
          class="pay-button"
          :disabled="isProcessing || !canPay"
          @click="payWithSavedMethod"
        >
          {{ isProcessing ? 'Processing...' : `Pay ${formatCurrency(amount, currency)}` }}
        </button>

        <!-- Back to saved methods -->
        <button
          v-if="showNewCardForm && paymentMethods.length"
          class="link-btn"
          @click="showNewCardForm = false"
        >
          Use saved payment method
        </button>

        <!-- Security Notice -->
        <div class="secure-notice">
          <Lock :size="14" />
          <span>Secured by Stripe. We never store your card details.</span>
        </div>
      </main>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <!-- Success Modal -->
    <PaymentSuccess
      v-if="paymentComplete"
      :payment="completedPayment"
      @close="handleComplete"
    />
  </div>
</template>

<style scoped>
.checkout-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 16px;
}

.view-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 32px;
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
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.checkout-container {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 32px;
}

@media (max-width: 768px) {
  .checkout-container {
    grid-template-columns: 1fr;
  }

  .summary-section {
    order: -1;
  }
}

.summary-section {
  position: sticky;
  top: 24px;
  height: fit-content;
}

.payment-section {
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.payment-section h2 {
  margin: 0 0 24px;
  font-size: 18px;
  font-weight: 600;
}

.pay-button {
  width: 100%;
  padding: 14px 24px;
  margin-top: 24px;
  background: var(--color-primary, #3b82f6);
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.15s;
}

.pay-button:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.pay-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.link-btn {
  display: block;
  width: 100%;
  margin-top: 16px;
  padding: 0;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-primary, #3b82f6);
  text-align: center;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

.secure-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 24px;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.error-message {
  margin-top: 16px;
  padding: 12px;
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger, #ef4444);
  border-radius: 8px;
  font-size: 14px;
}
</style>
