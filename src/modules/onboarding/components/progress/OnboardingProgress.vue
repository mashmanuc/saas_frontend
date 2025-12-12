<script setup lang="ts">
// F21: Onboarding Progress Component
import type { OnboardingStep } from '../../api/onboarding'
import StepIndicator from './StepIndicator.vue'
import ProgressBar from './ProgressBar.vue'

const props = defineProps<{
  steps: OnboardingStep[]
  currentIndex: number
  percentage: number
}>()

function getStepStatus(step: OnboardingStep, index: number): 'completed' | 'current' | 'pending' | 'skipped' {
  if (index < props.currentIndex) return 'completed'
  if (index === props.currentIndex) return 'current'
  return 'pending'
}
</script>

<template>
  <div class="onboarding-progress">
    <div class="progress-steps">
      <StepIndicator
        v-for="(step, index) in steps"
        :key="step.slug"
        :step="step"
        :index="index"
        :status="getStepStatus(step, index)"
        :is-current="index === currentIndex"
      />
    </div>

    <ProgressBar :value="percentage" />
  </div>
</template>

<style scoped>
.onboarding-progress {
  max-width: 600px;
  margin: 0 auto 32px;
}

.progress-steps {
  display: flex;
  justify-content: space-between;
  margin-bottom: 16px;
}
</style>
