<template>
  <div class="room-loader">
    <div class="room-loader__content">
      <!-- Spinner -->
      <div class="room-loader__spinner">
        <div class="spinner"></div>
      </div>

      <!-- Status -->
      <h2 class="room-loader__title">
        {{ $t('classroom.loader.connecting') }}
      </h2>

      <p class="room-loader__message">
        {{ currentStatus }}
      </p>

      <!-- Progress steps -->
      <div class="room-loader__steps">
        <div
          v-for="(step, index) in steps"
          :key="step.id"
          class="step"
          :class="{
            'step--completed': index < currentStep,
            'step--active': index === currentStep,
          }"
        >
          <span class="step__icon">
            {{ index < currentStep ? '✓' : step.icon }}
          </span>
          <span class="step__label">{{ $t(`classroom.loader.${step.id}`) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// Steps
const steps = [
  { id: 'connecting', icon: '🔗' },
  { id: 'authenticating', icon: '🔐' },
  { id: 'loadingBoard', icon: '📋' },
  { id: 'joiningRoom', icon: '🚪' },
]

const currentStep = ref(0)

// Computed
const currentStatus = computed(() => {
  if (currentStep.value < steps.length) {
    return t(`classroom.loader.${steps[currentStep.value].id}Status`)
  }
  return t('classroom.loader.ready')
})

// Simulate progress
onMounted(() => {
  const interval = setInterval(() => {
    if (currentStep.value < steps.length - 1) {
      currentStep.value++
    } else {
      clearInterval(interval)
    }
  }, 800)
})
</script>

<style scoped>
.room-loader {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  z-index: 1000;
}

.room-loader__content {
  text-align: center;
  max-width: 400px;
  padding: 2rem;
}

.room-loader__spinner {
  margin-bottom: 2rem;
}

.spinner {
  width: 64px;
  height: 64px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.room-loader__title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary);
}

.room-loader__message {
  color: var(--color-text-secondary);
  margin-bottom: 2rem;
}

.room-loader__steps {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.step {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 8px;
  opacity: 0.5;
  transition: all 0.3s;
}

.step--completed {
  opacity: 1;
}

.step--active {
  opacity: 1;
  background: var(--color-bg-secondary);
}

.step__icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border-radius: 50%;
  font-size: 1rem;
}

.step--completed .step__icon {
  background: var(--color-success);
  color: white;
}

.step--active .step__icon {
  background: var(--color-primary);
  color: white;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.step__label {
  font-size: 0.875rem;
  color: var(--color-text-primary);
}
</style>
