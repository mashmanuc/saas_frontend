<script setup lang="ts">
// F22: Payout Settings Component
import { ref, onMounted } from 'vue'
import { Banknote, Building } from 'lucide-vue-next'
import type { Wallet, PayoutSettings } from '../../api/payments'

const props = defineProps<{
  wallet: Wallet
  isLoading?: boolean
}>()

const emit = defineEmits<{
  submit: [settings: PayoutSettings]
}>()

const form = ref<PayoutSettings>({
  payout_method: 'bank',
  bank_name: '',
  bank_account: '',
  bank_holder_name: '',
  auto_payout_enabled: false,
})

const methodOptions = [
  { value: 'bank', label: 'Bank Transfer' },
]

onMounted(() => {
  // Pre-fill from wallet
  form.value = {
    payout_method: props.wallet.payout_method || 'bank',
    bank_name: props.wallet.bank_name || '',
    bank_account: props.wallet.bank_account || '',
    bank_holder_name: props.wallet.bank_holder_name || '',
    auto_payout_enabled: props.wallet.auto_payout_enabled || false,
  }
})

function handleSubmit() {
  emit('submit', form.value)
}
</script>

<template>
  <form class="payout-settings" @submit.prevent="handleSubmit">
    <h3>
      <Building :size="20" />
      Payout Settings
    </h3>

    <!-- Payout Method -->
    <div class="form-section">
      <label>Payout Method</label>
      <select v-model="form.payout_method">
        <option v-for="opt in methodOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <!-- Bank Details -->
    <template v-if="form.payout_method === 'bank'">
      <div class="form-section">
        <label>Bank Name</label>
        <input
          v-model="form.bank_name"
          type="text"
          placeholder="e.g., ПриватБанк"
          required
        />
      </div>

      <div class="form-section">
        <label>IBAN</label>
        <input
          v-model="form.bank_account"
          type="text"
          placeholder="UA..."
          required
        />
        <p class="help-text">Your Ukrainian IBAN number</p>
      </div>

      <div class="form-section">
        <label>Account Holder Name</label>
        <input
          v-model="form.bank_holder_name"
          type="text"
          placeholder="Full name as on bank account"
          required
        />
      </div>
    </template>

    <!-- Auto Payout -->
    <div class="form-section checkbox-section">
      <label class="checkbox-label">
        <input type="checkbox" v-model="form.auto_payout_enabled" />
        <span>Enable automatic monthly payouts</span>
      </label>
      <p class="help-text">
        Automatically withdraw your balance at the end of each month
      </p>
    </div>

    <!-- Submit -->
    <button type="submit" class="submit-btn" :disabled="isLoading">
      {{ isLoading ? 'Saving...' : 'Save Settings' }}
    </button>
  </form>
</template>

<style scoped>
.payout-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.payout-settings h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
}

.payout-settings h3 svg {
  color: var(--color-primary, #3b82f6);
}

/* Form Section */
.form-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-section label {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.form-section input[type='text'],
.form-section select {
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
}

.form-section input:focus,
.form-section select:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
}

.help-text {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

/* Checkbox */
.checkbox-section {
  padding-top: 8px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-weight: 400 !important;
}

.checkbox-label input[type='checkbox'] {
  width: 18px;
  height: 18px;
  accent-color: var(--color-primary, #3b82f6);
}

/* Submit Button */
.submit-btn {
  padding: 14px 24px;
  margin-top: 8px;
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
</style>
