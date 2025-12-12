<script setup lang="ts">
// F19: First Action Step Component
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Search, Shield, ArrowRight } from 'lucide-vue-next'
import type { OnboardingStep } from '../../api/onboarding'

const props = defineProps<{
  step: OnboardingStep | null
  userType?: 'student' | 'tutor'
}>()

defineEmits<{
  complete: []
  skip: []
}>()

const router = useRouter()
const { t } = useI18n()

const isStudent = computed(() => props.userType === 'student')

function handleAction() {
  if (isStudent.value) {
    router.push('/tutors')
  } else {
    router.push('/verification')
  }
}
</script>

<template>
  <div class="first-action-step">
    <div class="action-icon">
      <Search v-if="isStudent" :size="48" />
      <Shield v-else :size="48" />
    </div>

    <h2 class="action-title">
      {{ isStudent ? t('onboarding.firstAction.student.title') : t('onboarding.firstAction.tutor.title') }}
    </h2>

    <p class="action-description">
      {{ isStudent ? t('onboarding.firstAction.student.description') : t('onboarding.firstAction.tutor.description') }}
    </p>

    <button class="action-button" @click="handleAction">
      {{ isStudent ? t('onboarding.firstAction.student.cta') : t('onboarding.firstAction.tutor.cta') }}
      <ArrowRight :size="18" />
    </button>

    <p class="action-hint">
      {{ isStudent ? t('onboarding.firstAction.student.hint') : t('onboarding.firstAction.tutor.hint') }}
    </p>
  </div>
</template>

<style scoped>
.first-action-step {
  text-align: center;
  max-width: 450px;
  margin: 0 auto;
  padding: 48px 40px;
  background: var(--color-bg-primary, white);
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.action-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, var(--color-primary, #3b82f6) 0%, var(--color-primary-dark, #2563eb) 100%);
  border-radius: 24px;
  color: white;
}

.action-title {
  margin: 0 0 12px;
  font-size: 26px;
  font-weight: 700;
  color: var(--color-text-primary, #111827);
}

.action-description {
  margin: 0 0 32px;
  font-size: 15px;
  color: var(--color-text-secondary, #6b7280);
  line-height: 1.6;
}

.action-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 16px 32px;
  background: var(--color-primary, #3b82f6);
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: all 0.15s;
}

.action-button:hover {
  background: var(--color-primary-dark, #2563eb);
  transform: translateY(-1px);
}

.action-hint {
  margin: 24px 0 0;
  font-size: 13px;
  color: var(--color-text-tertiary, #9ca3af);
}
</style>
