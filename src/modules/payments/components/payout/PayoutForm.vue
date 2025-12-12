<script setup lang="ts">
// F21: Payout Form Component
import { ref, computed } from 'vue'
import { Banknote, AlertCircle } from 'lucide-vue-next'
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
      <button type="button" class="btn btn-primary" @click="emit('edit-settings')">
        Add Bank Details
      </button>
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
      <button
        type="submit"
        class="submit-btn"
        :disabled="!isValid || isLoading || !wallet.can_withdraw"
      >
        {{ isLoading ? 'Processing...' : 'Request Withdrawal' }}
      </button>
    </template>
  </form>
</template>

<style scoped>
.payout-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* Warning Card */
.warning-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px;
  background: var(--color-warning-light, #fef3c7);
  border-radius: 12px;
  text-align: center;
}

.warning-card svg {
  color: var(--color-warning-dark, #92400e);
}

.warning-card strong {
  color: var(--color-warning-dark, #92400e);
}

.warning-card p {
  margin: 0;
  font-size: 14px;
  color: var(--color-warning-dark, #92400e);
}

/* Form Section */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-section label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.amount-input-wrapper {
  display: flex;
  gap: 8px;
}

.amount-input {
  flex: 1;
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 16px;
}

.amount-input:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.max-btn {
  padding: 12px 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  white-space: nowrap;
}

.max-btn:hover {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.help-text {
  margin: 0;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

/* Payout Method */
.payout-method {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
}

.payout-method svg {
  color: var(--color-text-secondary, #6b7280);
}

.method-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.method-info strong {
  font-size: 14px;
  color: var(--color-text-primary, #111827);
}

.method-info span {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  font-family: monospace;
}

.edit-btn {
  padding: 6px 12px;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-primary, #3b82f6);
  cursor: pointer;
}

.edit-btn:hover {
  text-decoration: underline;
}

/* Info Alert */
.info-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: var(--color-info-light, #dbeafe);
  border-radius: 8px;
  font-size: 14px;
  color: var(--color-info-dark, #1e40af);
}

/* Submit Button */
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

/* Buttons */
.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
}
</style>
