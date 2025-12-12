<script setup lang="ts">
// F16: Welcome Step Component
import { useI18n } from 'vue-i18n'
import { Sparkles } from 'lucide-vue-next'
import type { OnboardingStep } from '../../api/onboarding'

defineProps<{
  step: OnboardingStep | null
}>()

defineEmits<{
  complete: []
  skip: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="welcome-step">
    <div class="welcome-icon">
      <Sparkles :size="48" />
    </div>

    <h1 class="welcome-title">{{ t('onboarding.welcome.title') }}</h1>
    <p class="welcome-subtitle">{{ t('onboarding.welcome.subtitle') }}</p>

    <div class="welcome-features">
      <div class="feature-item">
        <span class="feature-icon">📚</span>
        <span>{{ t('onboarding.welcome.feature1') }}</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">👨‍🏫</span>
        <span>{{ t('onboarding.welcome.feature2') }}</span>
      </div>
      <div class="feature-item">
        <span class="feature-icon">📈</span>
        <span>{{ t('onboarding.welcome.feature3') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-step {
  text-align: center;
  max-width: 500px;
  margin: 0 auto;
  padding: 40px;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.welcome-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, var(--color-primary, #3b82f6) 0%, var(--color-primary-dark, #2563eb) 100%);
  border-radius: 20px;
  color: white;
}

.welcome-title {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.welcome-subtitle {
  margin: 0 0 32px;
  font-size: 16px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.6;
}

.welcome-features {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 10px;
}

.feature-icon {
  font-size: 24px;
}

.feature-item span:last-child {
  font-size: 14px;
  color: var(--color-text-primary, #111827);
}
</style>
