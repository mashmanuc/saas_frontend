<script setup lang="ts">
// F21: Payout Form Component
import { ref, computed } from 'vue'
import { Banknote, AlertCircle } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
import type { Wallet } from '../../api/payments'

const props = defineProps<{
  wallet: Wallet
  isLoading?: boolean
}>()

const emit = defineEmits<{
  submit: [amount?: number]
  'edit-settings': []
}>()

const amount = ref<number | null>(null)

const minAmount = computed(() => props.wallet.payout_threshold)
const maxAmount = computed(() => props.wallet.balance)

const isValid = computed(() => {
  if (!amount.value) return true // Full withdrawal
  return amount.value >= minAmount.value && amount.value <= maxAmount.value
})

const hasPayoutMethod = computed(() => !!props.wallet.bank_account)

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: props.wallet.currency,
  }).format(amount / 100)
}

function maskIban(iban?: string): string {
  if (!iban) return ''
  return `${iban.slice(0, 4)}...${iban.slice(-4)}`
}

function setMaxAmount() {
  amount.value = maxAmount.value
}

function handleSubmit() {
  emit('submit', amount.value || undefined)
}
</script>

<template>
  <form class="payout-form" @submit.prevent="handleSubmit">
    <!-- No Payout Method Warning -->
    <div v-if="!hasPayoutMethod" class="warning-card">
      <AlertCircle :size="20" />
      <div>
        <strong>No payout method configured</strong>
        <p>Please add your bank details before requesting a payout.</p>
      </div>
      <Button variant="primary" @click="emit('edit-settings')">
        Add Bank Details
      </Button>
    </div>

    <template v-else>
      <!-- Amount Input -->
      <div class="form-section">
        <label>Withdrawal Amount</label>
        <div class="amount-input-wrapper">
          <input
            v-model.number="amount"
            type="number"
            class="amount-input"
            :min="minAmount / 100"
            :max="maxAmount / 100"
            :placeholder="`Min: ${formatCurrency(minAmount)}`"
            step="0.01"
          />
          <button type="button" class="max-btn" @click="setMaxAmount">
            Withdraw All
          </button>
        </div>
        <p class="help-text">
          Available: {{ formatCurrency(maxAmount) }}
        </p>
      </div>

      <!-- Payout Method -->
      <div class="form-section">
        <label>Payout Method</label>
        <div class="payout-method">
          <Banknote :size="24" />
          <div class="method-info">
            <strong>{{ wallet.bank_name }}</strong>
            <span>{{ maskIban(wallet.bank_account) }}</span>
          </div>
          <button type="button" class="edit-btn" @click="emit('edit-settings')">
            Edit
          </button>
        </div>
      </div>

      <!-- Info Alert -->
      <div class="info-alert">
        <AlertCircle :size="18" />
        <span>Payouts are processed within 1-3 business days.</span>
      </div>

      <!-- Submit -->
      <Button
        variant="primary"
        type="submit"
        fullWidth
        :disabled="!isValid || !wallet.can_withdraw"
        :loading="isLoading"
      >
        Request Withdrawal
      </Button>
    </template>
  </form>
</template>

<style scoped>
.payout-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.warning-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  border-radius: var(--radius-lg);
  text-align: center;
}

.warning-card svg {
  color: var(--warning-bg);
}

.warning-card strong {
  color: var(--warning-bg);
}

.warning-card p {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--warning-bg);
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.form-section label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.amount-input-wrapper {
  display: flex;
  gap: var(--space-xs);
}

.amount-input {
  flex: 1;
  padding: var(--space-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  background: var(--card-bg);
  color: var(--text-primary);
}

.amount-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.max-btn {
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--text-primary);
  cursor: pointer;
  white-space: nowrap;
}

.max-btn:hover {
  background: var(--border-color);
}

.help-text {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.payout-method {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.payout-method svg {
  color: var(--text-secondary);
}

.method-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.method-info strong {
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.method-info span {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-family: monospace;
}

.edit-btn {
  padding: var(--space-2xs) var(--space-sm);
  background: none;
  border: none;
  font-size: var(--text-sm);
  color: var(--accent);
  cursor: pointer;
}

.edit-btn:hover {
  text-decoration: underline;
}

.info-alert {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: color-mix(in srgb, var(--info-bg) 15%, transparent);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  color: var(--info-bg);
}
</style>
