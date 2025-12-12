<script setup lang="ts">
// F26: Current Plan Component
import { computed } from 'vue'
import { Calendar, BookOpen, RefreshCw, X } from 'lucide-vue-next'
import type { Plan, Subscription } from '../../api/payments'

const props = defineProps<{
  subscription: Subscription
  plan: Plan
  lessonsRemaining: number | null
  lessonsUsed: number
  daysUntilRenewal: number | null
}>()

const emit = defineEmits<{
  'change-plan': []
  cancel: []
  reactivate: []
}>()

const isCancelling = computed(() => props.subscription.cancel_at_period_end)

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
  }).format(amount / 100)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'status-active'
    case 'past_due':
      return 'status-warning'
    case 'cancelled':
    case 'expired':
      return 'status-danger'
    default:
      return ''
  }
}
</script>

<template>
  <div class="current-plan">
    <div class="plan-header">
      <div class="plan-info">
        <h2>{{ plan.name }}</h2>
        <span :class="['plan-status', getStatusClass(subscription.status)]">
          {{ subscription.status }}
        </span>
      </div>
      <div class="plan-price">
        {{ formatCurrency(plan.price, plan.currency) }}
        <span class="interval">/ {{ plan.interval }}</span>
      </div>
    </div>

    <div class="plan-stats">
      <div class="stat-item">
        <BookOpen :size="20" />
        <div class="stat-content">
          <span class="stat-value">
            {{ lessonsUsed }} / {{ plan.lessons_per_month || '∞' }}
          </span>
          <span class="stat-label">Lessons used</span>
        </div>
      </div>

      <div class="stat-item">
        <Calendar :size="20" />
        <div class="stat-content">
          <span class="stat-value">{{ daysUntilRenewal }} days</span>
          <span class="stat-label">Until renewal</span>
        </div>
      </div>

      <div class="stat-item">
        <RefreshCw :size="20" />
        <div class="stat-content">
          <span class="stat-value">{{ formatDate(subscription.current_period_end) }}</span>
          <span class="stat-label">Next billing</span>
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div v-if="plan.lessons_per_month > 0" class="lessons-progress">
      <div class="progress-header">
        <span>Lessons this period</span>
        <span>{{ lessonsRemaining }} remaining</span>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${(lessonsUsed / plan.lessons_per_month) * 100}%` }"
        />
      </div>
    </div>

    <!-- Actions -->
    <div class="plan-actions">
      <button class="btn btn-outline" @click="emit('change-plan')">
        Change Plan
      </button>

      <button
        v-if="isCancelling"
        class="btn btn-success"
        @click="emit('reactivate')"
      >
        Reactivate
      </button>
      <button v-else class="btn btn-danger-outline" @click="emit('cancel')">
        Cancel Subscription
      </button>
    </div>
  </div>
</template>

<style scoped>
.current-plan {
  padding: 24px;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.plan-info h2 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
}

.plan-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-active {
  background: var(--color-success-light, #d1fae5);
  color: var(--color-success-dark, #065f46);
}

.status-warning {
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
}

.status-danger {
  background: var(--color-danger-light, #fee2e2);
  color: var(--color-danger-dark, #991b1b);
}

.plan-price {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.plan-price .interval {
  font-size: 14px;
  font-weight: 400;
  color: var(--color-text-secondary, #6b7280);
}

/* Stats */
.plan-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

@media (max-width: 640px) {
  .plan-stats {
    grid-template-columns: 1fr;
  }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 10px;
}

.stat-item svg {
  color: var(--color-primary, #3b82f6);
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

/* Progress */
.lessons-progress {
  margin-bottom: 24px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 13px;
  color: var(--color-text-secondary, #6b7280);
}

.progress-bar {
  height: 8px;
  background: var(--color-bg-tertiary, #e5e7eb);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary, #3b82f6);
  border-radius: 4px;
  transition: width 0.3s ease;
}

/* Actions */
.plan-actions {
  display: flex;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border, #e5e7eb);
}

.btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-outline {
  background: none;
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-text-primary, #111827);
}

.btn-outline:hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.btn-danger-outline {
  background: none;
  border: 1px solid var(--color-danger, #ef4444);
  color: var(--color-danger, #ef4444);
}

.btn-danger-outline:hover {
  background: var(--color-danger-light, #fee2e2);
}

.btn-success {
  background: var(--color-success, #10b981);
  border: none;
  color: white;
}

.btn-success:hover {
  background: var(--color-success-dark, #059669);
}
</style>
