<script setup lang="ts">
// F30: Welcome Banner Component
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { X, ArrowRight } from 'lucide-vue-next'
import { useOnboardingStore } from '../../stores/onboardingStore'
import Button from '@/ui/Button.vue'

const props = defineProps<{
  userName?: string
}>()

const router = useRouter()
const { t } = useI18n()
const store = useOnboardingStore()

const { progressPercentage, shouldShowOnboarding } = storeToRefs(store)

const shouldShow = computed(
  () => shouldShowOnboarding.value && progressPercentage.value < 100
)

function continueOnboarding() {
  router.push('/onboarding')
}

function dismiss() {
  store.dismiss()
}
</script>

<template>
  <Transition name="banner">
    <div v-if="shouldShow" class="welcome-banner">
      <div class="banner-content">
        <h2>
          {{ t('onboarding.welcomeBack', { name: userName || t('common.there') }) }}
        </h2>
        <p>
          {{ t('onboarding.continueSetup', { percentage: progressPercentage }) }}
        </p>
      </div>

      <div class="banner-progress">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progressPercentage}%` }" />
        </div>
        <span class="progress-label">{{ progressPercentage }}%</span>
      </div>

      <div class="banner-actions">
        <Button variant="secondary" @click="continueOnboarding">
          {{ t('onboarding.continue') }}
          <ArrowRight :size="16" />
        </Button>
        <Button variant="ghost" class="btn-later" @click="dismiss">
          {{ t('common.later') }}
        </Button>
      </div>

      <Button variant="ghost" size="sm" iconOnly class="banner-close" @click="dismiss">
        <X :size="18" />
      </Button>
    </div>
  </Transition>
</template>

<style scoped>
.welcome-banner {
  position: relative;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px 24px;
  background: linear-gradient(135deg, var(--color-primary, #3b82f6) 0%, var(--color-primary-dark, #2563eb) 100%);
  border-radius: 12px;
  color: white;
}

.banner-content {
  flex: 1;
}

.banner-content h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
}

.banner-content p {
  margin: 0;
  font-size: 14px;
  opacity: 0.9;
}

.banner-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 120px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: white;
  border-radius: 3px;
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 14px;
  font-weight: 600;
}

.banner-actions {
  display: flex;
  gap: 12px;
}

.btn-later {
  color: white;
}

.banner-close {
  position: absolute;
  top: 8px;
  right: 8px;
  color: rgba(255, 255, 255, 0.7);
}

/* Responsive */
@media (max-width: 768px) {
  .welcome-banner {
    flex-direction: column;
    align-items: stretch;
    text-align: center;
  }

  .banner-progress {
    justify-content: center;
  }

  .banner-actions {
    justify-content: center;
  }
}

/* Transition */
.banner-enter-active,
.banner-leave-active {
  transition: all 0.3s ease;
}

.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
