<script setup lang="ts">
// F24: Plan Card Component
import { Check, Star } from 'lucide-vue-next'
import type { Plan } from '../../api/payments'

const props = defineProps<{
  plan: Plan
  isCurrent?: boolean
  hasSubscription?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [plan: Plan]
}>()

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

function getIntervalLabel(interval: string): string {
  const labels: Record<string, string> = {
    monthly: 'month',
    quarterly: 'quarter',
    yearly: 'year',
  }
  return labels[interval] || interval
}
</script>

<template>
  <div :class="['plan-card', { featured: plan.is_featured, current: isCurrent }]">
    <!-- Featured Badge -->
    <div v-if="plan.is_featured" class="featured-badge">
      <Star :size="14" />
      Most Popular
    </div>

    <!-- Current Badge -->
    <div v-if="isCurrent" class="current-badge">Current Plan</div>

    <!-- Plan Header -->
    <h3 class="plan-name">{{ plan.name }}</h3>
    <p class="plan-description">{{ plan.description }}</p>

    <!-- Price -->
    <div class="plan-price">
      <span class="amount">{{ formatCurrency(plan.price, plan.currency) }}</span>
      <span class="interval">/ {{ getIntervalLabel(plan.interval) }}</span>
    </div>

    <!-- Features -->
    <ul class="plan-features">
      <li v-if="plan.lessons_per_month > 0">
        <Check :size="18" />
        <span>{{ plan.lessons_per_month }} lessons per month</span>
      </li>
      <li v-else>
        <Check :size="18" />
        <span>Unlimited lessons</span>
      </li>
      <li v-for="feature in plan.features" :key="feature">
        <Check :size="18" />
        <span>{{ feature }}</span>
      </li>
    </ul>

    <!-- Action Button -->
    <button
      v-if="!isCurrent"
      :class="['select-btn', { primary: plan.is_featured }]"
      :disabled="disabled"
      @click="emit('select', plan)"
    >
      {{ hasSubscription ? 'Switch Plan' : 'Get Started' }}
    </button>

    <div v-else class="current-label">
      <Check :size="18" />
      Your Current Plan
    </div>
  </div>
</template>

<style scoped>
.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 28px;
  background: var(--color-bg-primary, white);
  border: 2px solid var(--color-border, #e5e7eb);
  border-radius: 16px;
  transition: all 0.2s;
}

.plan-card:hover {
  border-color: var(--color-primary-light, #93c5fd);
}

.plan-card.featured {
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
}

.plan-card.current {
  border-color: var(--color-success, #10b981);
}

/* Badges */
.featured-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--color-primary, #3b82f6);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

.current-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 14px;
  background: var(--color-success, #10b981);
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: white;
}

/* Plan Header */
.plan-name {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.plan-description {
  margin: 0 0 20px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.5;
}

/* Price */
.plan-price {
  margin-bottom: 24px;
}

.amount {
  font-size: 36px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.interval {
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

/* Features */
.plan-features {
  flex: 1;
  list-style: none;
  margin: 0 0 24px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-features li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  color: var(--color-text-primary, #111827);
}

.plan-features li svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--color-success, #10b981);
}

/* Action Button */
.select-btn {
  width: 100%;
  padding: 14px 24px;
  background: var(--color-bg-secondary, #f5f5f5);
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  cursor: pointer;
  transition: all 0.15s;
}

.select-btn:hover:not(:disabled) {
  background: var(--color-bg-tertiary, #e5e7eb);
}

.select-btn.primary {
  background: var(--color-primary, #3b82f6);
  border-color: var(--color-primary, #3b82f6);
  color: white;
}

.select-btn.primary:hover:not(:disabled) {
  background: var(--color-primary-dark, #2563eb);
}

.select-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Current Label */
.current-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  background: var(--color-success-light, #d1fae5);
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-success-dark, #065f46);
}
</style>
