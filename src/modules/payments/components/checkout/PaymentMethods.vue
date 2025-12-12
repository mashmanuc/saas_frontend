<script setup lang="ts">
// F14: Payment Methods Component
import { computed } from 'vue'
import { CreditCard, Plus, Check } from 'lucide-vue-next'
import type { PaymentMethod } from '../../api/payments'

const props = defineProps<{
  methods: PaymentMethod[]
  modelValue: number | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  'add-new': []
}>()

function selectMethod(id: number) {
  emit('update:modelValue', id)
}

function getCardIcon(brand: string): string {
  const icons: Record<string, string> = {
    visa: '💳',
    mastercard: '💳',
    amex: '💳',
  }
  return icons[brand.toLowerCase()] || '💳'
}

function formatExpiry(month: number, year: number): string {
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`
}
</script>

<template>
  <div class="payment-methods">
    <p class="section-label">Saved Cards</p>

    <div class="methods-list">
      <button
        v-for="method in methods"
        :key="method.id"
        :class="['method-item', { selected: modelValue === method.id }]"
        @click="selectMethod(method.id)"
      >
        <div class="method-icon">
          <CreditCard :size="20" />
        </div>

        <div class="method-info">
          <span class="card-brand">{{ method.card_brand }}</span>
          <span class="card-number">•••• {{ method.card_last4 }}</span>
        </div>

        <span class="card-expiry">
          {{ formatExpiry(method.card_exp_month, method.card_exp_year) }}
        </span>

        <div v-if="method.is_default" class="default-badge">Default</div>

        <div v-if="modelValue === method.id" class="check-icon">
          <Check :size="18" />
        </div>
      </button>
    </div>

    <button class="add-new-btn" @click="emit('add-new')">
      <Plus :size="18" />
      <span>Add new card</span>
    </button>
  </div>
</template>

<style scoped>
.payment-methods {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
}

.methods-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.method-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  background: var(--color-bg-primary, white);
  border: 2px solid var(--color-border, #e5e7eb);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.method-item:hover {
  border-color: var(--color-primary-light, #93c5fd);
}

.method-item.selected {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-light, #eff6ff);
}

.method-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  color: var(--color-text-secondary, #6b7280);
}

.method-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-brand {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
  text-transform: capitalize;
}

.card-number {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
  font-family: monospace;
}

.card-expiry {
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.default-badge {
  padding: 2px 8px;
  background: var(--color-success-light, #d1fae5);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: var(--color-success-dark, #065f46);
}

.check-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--color-primary, #3b82f6);
  border-radius: 50%;
  color: white;
}

.add-new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: none;
  border: 2px dashed var(--color-border, #d1d5db);
  border-radius: 10px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.add-new-btn:hover {
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}
</style>
