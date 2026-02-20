<template>
  <div class="reconnect-view">
    <div class="reconnect-view__content">
      <!-- Spinner -->
      <div class="reconnect-view__spinner">
        <div class="spinner"></div>
      </div>

      <!-- Status -->
      <h2 class="reconnect-view__title">
        {{ $t('classroom.reconnect.title') }}
      </h2>
      
      <p class="reconnect-view__message">
        {{ statusMessage }}
      </p>

      <!-- Progress -->
      <div class="reconnect-view__progress">
        <div class="progress-bar">
          <div 
            class="progress-bar__fill" 
            :style="{ width: `${progress}%` }"
          ></div>
        </div>
        <span class="progress-text">
          {{ $t('classroom.reconnect.attempt', { current: attempt, max: maxAttempts }) }}
        </span>
      </div>

      <!-- Actions -->
      <div class="reconnect-view__actions">
        <Button variant="primary" @click="handleRetry" :disabled="isRetrying">
          {{ $t('common.retry') }}
        </Button>
        <Button variant="ghost" @click="handleLeave">
          {{ $t('classroom.reconnect.leave') }}
        </Button>
      </div>

      <!-- Tips -->
      <div class="reconnect-view__tips">
        <p>{{ $t('classroom.reconnect.tips.title') }}</p>
        <ul>
          <li>{{ $t('classroom.reconnect.tips.checkConnection') }}</li>
          <li>{{ $t('classroom.reconnect.tips.refreshPage') }}</li>
          <li>{{ $t('classroom.reconnect.tips.contactSupport') }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'

const { t } = useI18n()

const emit = defineEmits<{
  retry: []
  leave: []
}>()

// State
const attempt = ref(1)
const maxAttempts = ref(5)
const isRetrying = ref(false)
const countdown = ref(0)

// Computed
const progress = computed(() => (attempt.value / maxAttempts.value) * 100)

const statusMessage = computed(() => {
  if (isRetrying.value) {
    return t('classroom.reconnect.connecting')
  }
  if (countdown.value > 0) {
    return t('classroom.reconnect.retryIn', { seconds: countdown.value })
  }
  return t('classroom.reconnect.connectionLost')
})

// Auto-retry timer
let retryTimer: number | null = null
let countdownTimer: number | null = null

onMounted(() => {
  startCountdown()
})

onUnmounted(() => {
  if (retryTimer) clearTimeout(retryTimer)
  if (countdownTimer) clearInterval(countdownTimer)
})

function startCountdown(): void {
  countdown.value = 5

  countdownTimer = window.setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownTimer) clearInterval(countdownTimer)
      handleRetry()
    }
  }, 1000)
}

async function handleRetry(): Promise<void> {
  if (isRetrying.value) return
  if (countdownTimer) clearInterval(countdownTimer)

  isRetrying.value = true

  try {
    emit('retry')
    // Wait for parent to handle
    await new Promise((resolve) => setTimeout(resolve, 2000))
  } finally {
    isRetrying.value = false
    attempt.value++

    if (attempt.value <= maxAttempts.value) {
      startCountdown()
    }
  }
}

function handleLeave(): void {
  if (retryTimer) clearTimeout(retryTimer)
  if (countdownTimer) clearInterval(countdownTimer)
  emit('leave')
}
</script>

<style scoped>
.reconnect-view {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.reconnect-view__content {
  text-align: center;
  padding: 2rem;
  background: var(--color-bg-secondary);
  border-radius: 16px;
  max-width: 400px;
  width: 90%;
}

.reconnect-view__spinner {
  margin-bottom: 1.5rem;
}

.spinner {
  width: 48px;
  height: 48px;
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

.reconnect-view__title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary);
}

.reconnect-view__message {
  color: var(--color-text-secondary);
  margin-bottom: 1.5rem;
}

.reconnect-view__progress {
  margin-bottom: 1.5rem;
}

.progress-bar {
  height: 4px;
  background: var(--color-bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 0.5rem;
}

.progress-bar__fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

.reconnect-view__actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.reconnect-view__tips {
  text-align: left;
  padding: 1rem;
  background: var(--color-bg-tertiary);
  border-radius: 8px;
  font-size: 0.875rem;
}

.reconnect-view__tips p {
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--color-text-primary);
}

.reconnect-view__tips ul {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--color-text-secondary);
}

.reconnect-view__tips li {
  margin-bottom: 0.25rem;
}
</style>
