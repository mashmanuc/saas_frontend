<script setup lang="ts">
// F15: Onboarding Step Component
import type { OnboardingStep } from '../../api/onboarding'

defineProps<{
  step: OnboardingStep | null
}>()
</script>

<template>
  <div class="onboarding-step">
    <div v-if="step?.illustration" class="step-illustration">
      <img :src="step.illustration" :alt="step.title" />
    </div>

    <div class="step-content">
      <div v-if="step?.icon" class="step-icon">
        {{ step.icon }}
      </div>

      <h2 class="step-title">{{ step?.title }}</h2>
      <p class="step-description">{{ step?.description }}</p>

      <slot />
    </div>
  </div>
</template>

<style scoped>
.onboarding-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 500px;
  margin: 0 auto;
  padding: 32px;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.step-illustration {
  margin-bottom: 24px;
}

.step-illustration img {
  max-width: 200px;
  height: auto;
}

.step-content {
  text-align: center;
  width: 100%;
}

.step-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  background: var(--color-primary-light, #eff6ff);
  border-radius: 14px;
  font-size: 24px;
}

.step-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.step-description {
  margin: 0 0 24px;
  font-size: 15px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.6;
}
</style>
