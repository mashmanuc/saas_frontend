<script setup lang="ts">
// F25: Plan Comparison Component
import { Check, X } from 'lucide-vue-next'
import type { Plan } from '../../api/payments'

const props = defineProps<{
  plans: Plan[]
  currentPlanId?: number
}>()

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

// Common features to compare
const comparisonFeatures = [
  { key: 'lessons', label: 'Lessons per month' },
  { key: 'priority_support', label: 'Priority support' },
  { key: 'video_recordings', label: 'Video recordings' },
  { key: 'progress_tracking', label: 'Progress tracking' },
  { key: 'tutor_matching', label: 'AI tutor matching' },
  { key: 'group_lessons', label: 'Group lessons' },
]

function hasFeature(plan: Plan, featureKey: string): boolean | string {
  if (featureKey === 'lessons') {
    return plan.lessons_per_month === 0 ? 'Unlimited' : `${plan.lessons_per_month}`
  }
  return plan.features.some((f) =>
    f.toLowerCase().includes(featureKey.replace('_', ' '))
  )
}
</script>

<template>
  <div class="plan-comparison">
    <table>
      <thead>
        <tr>
          <th class="feature-col">Feature</th>
          <th
            v-for="plan in plans"
            :key="plan.id"
            :class="['plan-col', { current: plan.id === currentPlanId }]"
          >
            <span class="plan-name">{{ plan.name }}</span>
            <span class="plan-price">
              {{ formatCurrency(plan.price, plan.currency) }}/{{ plan.interval }}
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="feature in comparisonFeatures" :key="feature.key">
          <td class="feature-label">{{ feature.label }}</td>
          <td
            v-for="plan in plans"
            :key="plan.id"
            :class="{ current: plan.id === currentPlanId }"
          >
            <template v-if="typeof hasFeature(plan, feature.key) === 'string'">
              <span class="feature-value">{{ hasFeature(plan, feature.key) }}</span>
            </template>
            <template v-else-if="hasFeature(plan, feature.key)">
              <Check :size="18" class="check-icon" />
            </template>
            <template v-else>
              <X :size="18" class="x-icon" />
            </template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.plan-comparison {
  margin-top: 32px;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--color-border, #e5e7eb);
}

thead {
  background: var(--color-bg-secondary, #f5f5f5);
}

th,
td {
  padding: 16px;
  text-align: center;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

th.feature-col,
td.feature-label {
  text-align: left;
  font-weight: 500;
}

th.plan-col {
  min-width: 140px;
}

th.plan-col.current,
td.current {
  background: var(--color-primary-light, #eff6ff);
}

.plan-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.plan-price {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--color-text-secondary, #6b7280);
}

.feature-label {
  font-size: 14px;
  color: var(--color-text-primary, #111827);
}

.feature-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.check-icon {
  color: var(--color-success, #10b981);
}

.x-icon {
  color: var(--color-text-tertiary, #9ca3af);
}

tbody tr:last-child td {
  border-bottom: none;
}
</style>
