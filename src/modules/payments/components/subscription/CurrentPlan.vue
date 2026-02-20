<script setup lang="ts">
// F26: Current Plan Component
import { computed } from 'vue'
import { Calendar, BookOpen, RefreshCw } from 'lucide-vue-next'
import Button from '@/ui/Button.vue'
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
      <Button variant="outline" @click="emit('change-plan')">
        Change Plan
      </Button>

      <Button
        v-if="isCancelling"
        variant="primary"
        @click="emit('reactivate')"
      >
        Reactivate
      </Button>
      <Button v-else variant="danger" @click="emit('cancel')">
        Cancel Subscription
      </Button>
    </div>
  </div>
</template>

<style scoped>
.current-plan {
  padding: var(--space-lg);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
}

.plan-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-lg);
}

.plan-info h2 {
  margin: 0 0 var(--space-xs);
  font-size: var(--text-2xl);
  font-weight: 700;
}

.plan-status {
  padding: var(--space-2xs) var(--space-sm);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  text-transform: capitalize;
}

.status-active {
  background: color-mix(in srgb, var(--success-bg) 15%, transparent);
  color: var(--success-bg);
}

.status-warning {
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  color: var(--warning-bg);
}

.status-danger {
  background: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  color: var(--danger-bg);
}

.plan-price {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
}

.plan-price .interval {
  font-size: var(--text-sm);
  font-weight: 400;
  color: var(--text-secondary);
}

.plan-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
}

@media (max-width: 640px) {
  .plan-stats {
    grid-template-columns: 1fr;
  }
}

.stat-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.stat-item svg {
  color: var(--accent);
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-value {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--text-primary);
}

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.lessons-progress {
  margin-bottom: var(--space-lg);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}

.progress-bar {
  height: 8px;
  background: var(--border-color);
  border-radius: var(--radius-xs);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: var(--radius-xs);
  transition: width var(--transition-base);
}

.plan-actions {
  display: flex;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--border-color);
}
</style>
