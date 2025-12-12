<script setup lang="ts">
// F12: Payment Form (Stripe Elements)
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { Lock } from 'lucide-vue-next'

const props = defineProps<{
  clientSecret: string
  loading?: boolean
}>()

const emit = defineEmits<{
  success: [paymentIntentId: string]
  error: [message: string]
}>()

const cardElementRef = ref<HTMLElement | null>(null)
const cardError = ref('')
const isCardComplete = ref(false)
const saveCard = ref(false)
const isSubmitting = ref(false)

// Stripe instances
let stripe: any = null
let elements: any = null
let cardElement: any = null

onMounted(async () => {
  if (!props.clientSecret) return

  try {
    // Dynamically load Stripe
    const stripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY
    if (!stripeKey) {
      console.warn('Stripe public key not configured')
      return
    }

    // @ts-ignore
    const { loadStripe } = await import('@stripe/stripe-js')
    stripe = await loadStripe(stripeKey)

    if (!stripe) {
      emit('error', 'Failed to load Stripe')
      return
    }

    // Create Elements
    elements = stripe.elements({
      clientSecret: props.clientSecret,
    })

    // Create Card Element
    cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#111827',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          '::placeholder': {
            color: '#9ca3af',
          },
        },
        invalid: {
          color: '#ef4444',
        },
      },
    })

    if (cardElementRef.value) {
      cardElement.mount(cardElementRef.value)

      cardElement.on('change', (event: any) => {
        cardError.value = event.error?.message || ''
        isCardComplete.value = event.complete
      })
    }
  } catch (e: any) {
    console.error('Stripe initialization error:', e)
    emit('error', 'Failed to initialize payment form')
  }
})

onUnmounted(() => {
  cardElement?.destroy()
})

watch(
  () => props.clientSecret,
  async (newSecret) => {
    if (newSecret && elements) {
      elements.update({ clientSecret: newSecret })
    }
  }
)

async function handleSubmit() {
  if (!stripe || !cardElement || !isCardComplete.value) return

  isSubmitting.value = true
  cardError.value = ''

  try {
    const { error, paymentIntent } = await stripe.confirmCardPayment(
      props.clientSecret,
      {
        payment_method: {
          card: cardElement,
        },
        setup_future_usage: saveCard.value ? 'off_session' : undefined,
      }
    )

    if (error) {
      cardError.value = error.message || 'Payment failed'
      emit('error', error.message || 'Payment failed')
    } else if (paymentIntent?.status === 'succeeded') {
      emit('success', paymentIntent.id)
    } else if (paymentIntent?.status === 'requires_action') {
      // 3D Secure or other action required - Stripe handles this
      emit('error', 'Additional authentication required')
    }
  } catch (e: any) {
    cardError.value = e.message || 'Payment failed'
    emit('error', e.message || 'Payment failed')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <form class="payment-form" @submit.prevent="handleSubmit">
    <div class="form-row">
      <label>Card Details</label>
      <div ref="cardElementRef" class="card-element" />
      <p v-if="cardError" class="error-text">{{ cardError }}</p>
    </div>

    <div class="form-row checkbox-row">
      <label class="checkbox-label">
        <input type="checkbox" v-model="saveCard" />
        <span>Save card for future payments</span>
      </label>
    </div>

    <button
      type="submit"
      class="submit-btn"
      :disabled="!isCardComplete || isSubmitting || loading"
    >
      {{ isSubmitting || loading ? 'Processing...' : 'Pay Now' }}
    </button>

    <p class="secure-notice">
      <Lock :size="14" />
      <span>Your payment is secured by Stripe</span>
    </p>
  </form>
</template>

<style scoped>
.payment-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-row label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.card-element {
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  background: var(--color-bg-primary, white);
  transition: border-color 0.15s;
}

.card-element:focus-within {
  border-color: var(--color-primary, #3b82f6);
}

.error-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-danger, #ef4444);
}

.checkbox-row {
  flex-direction: row;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 400;
}

.checkbox-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary, #3b82f6);
}

.submit-btn {
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

.submit-btn:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.secure-notice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}
</style>
