<script setup lang="ts">
// F22: Step Indicator Component
import { Check, X } from 'lucide-vue-next'
import type { OnboardingStep } from '../../api/onboarding'

defineProps<{
  step: OnboardingStep
  index: number
  status: 'completed' | 'current' | 'pending' | 'skipped'
  isCurrent: boolean
}>()
</script>

<template>
  <div :class="['step-indicator', status, { current: isCurrent }]">
    <div class="indicator-circle">
      <Check v-if="status === 'completed'" :size="16" />
      <X v-else-if="status === 'skipped'" :size="16" />
      <span v-else>{{ index + 1 }}</span>
    </div>
    <span class="indicator-label">{{ step.title }}</span>
  </div>
</template>

<style scoped>
.step-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.indicator-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

/* Pending */
.step-indicator.pending .indicator-circle {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-secondary, #6b7280);
}

/* Current */
.step-indicator.current .indicator-circle {
  background: var(--color-primary, #3b82f6);
  color: white;
  box-shadow: 0 0 0 4px var(--color-primary-light, #eff6ff);
}

/* Completed */
.step-indicator.completed .indicator-circle {
  background: var(--color-success, #10b981);
  color: white;
}

/* Skipped */
.step-indicator.skipped .indicator-circle {
  background: var(--color-bg-tertiary, #e5e7eb);
  color: var(--color-text-secondary, #6b7280);
}

.indicator-label {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
  text-align: center;
  max-width: 80px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.step-indicator.current .indicator-label {
  color: var(--color-text-primary, #111827);
  font-weight: 500;
}

.step-indicator.completed .indicator-label {
  color: var(--color-success, #10b981);
}

@media (max-width: 640px) {
  .indicator-label {
    display: none;
  }
}
</style>
