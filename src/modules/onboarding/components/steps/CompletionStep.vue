<script setup lang="ts">
// F20: Completion Step Component
import { useI18n } from 'vue-i18n'
import { CheckCircle, ArrowRight } from 'lucide-vue-next'
import type { OnboardingStep } from '../../api/onboarding'
import Button from '@/ui/Button.vue'

defineProps<{
  step: OnboardingStep | null
  completedSteps?: number
  totalSteps?: number
}>()

const emit = defineEmits<{
  complete: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="completion-step">
    <div class="celebration-animation">
      <div class="confetti">🎉</div>
      <div class="check-icon">
        <CheckCircle :size="64" />
      </div>
    </div>

    <h2 class="completion-title">{{ t('onboarding.completion.title') }}</h2>
    <p class="completion-message">{{ t('onboarding.completion.message') }}</p>

    <div v-if="completedSteps && totalSteps" class="completion-stats">
      <div class="stat">
        <span class="stat-value">{{ completedSteps }}</span>
        <span class="stat-label">{{ t('onboarding.completion.stepsCompleted') }}</span>
      </div>
      <div class="stat-divider" />
      <div class="stat">
        <span class="stat-value">100%</span>
        <span class="stat-label">{{ t('onboarding.completion.profileComplete') }}</span>
      </div>
    </div>

    <Button variant="primary" @click="emit('complete')">
      {{ t('onboarding.completion.goToDashboard') }}
      <ArrowRight :size="18" />
    </Button>
  </div>
</template>

<style scoped>
.completion-step {
  text-align: center;
  max-width: 450px;
  margin: 0 auto;
  padding: 48px 40px;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.celebration-animation {
  position: relative;
  margin-bottom: 24px;
}

.confetti {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 48px;
  animation: bounce 1s ease infinite;
}

@keyframes bounce {
  0%, 100% {
    transform: translateX(-50%) translateY(0);
  }
  50% {
    transform: translateX(-50%) translateY(-10px);
  }
}

.check-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  margin: 0 auto;
  background: var(--color-success-light, #d1fae5);
  border-radius: 50%;
  color: var(--color-success, #10b981);
}

.completion-title {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.completion-message {
  margin: 0 0 32px;
  font-size: 15px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.6;
}

.completion-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
  padding: 20px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary, #3b82f6);
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-secondary, #6b7280);
}

.stat-divider {
  width: 1px;
  height: 40px;
  background: var(--color-border, #e5e7eb);
}

</style>
