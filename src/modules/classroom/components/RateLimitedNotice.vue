<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  retryAfterSeconds?: number
  onRetry?: () => void
}>()

const { t } = useI18n()

const remainingSeconds = ref(props.retryAfterSeconds || 0)
let intervalId: ReturnType<typeof setInterval> | null = null

const formattedTime = computed(() => {
  const mins = Math.floor(remainingSeconds.value / 60)
  const secs = remainingSeconds.value % 60
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return `${secs}s`
})

const canRetry = computed(() => remainingSeconds.value <= 0)

function startCountdown() {
  if (intervalId) clearInterval(intervalId)
  
  intervalId = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--
    } else {
      if (intervalId) clearInterval(intervalId)
    }
  }, 1000)
}

function handleRetry() {
  if (canRetry.value && props.onRetry) {
    props.onRetry()
  }
}

onMounted(() => {
  if (remainingSeconds.value > 0) {
    startCountdown()
  }
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <div class="rate-limited-notice" data-test="rate-limited-notice">
    <div class="notice-content">
      <Clock :size="24" class="icon-clock" />
      <div class="notice-text">
        <p class="notice-title">{{ t('classroom.realtime.rateLimitedTitle') }}</p>
        <p class="notice-description">
          {{ t('classroom.realtime.rateLimitedDescription') }}
        </p>
        <p v-if="!canRetry" class="countdown-text">
          {{ t('classroom.realtime.rateLimitedRetryIn', { time: formattedTime }) }}
        </p>
      </div>
    </div>
    <button
      v-if="onRetry"
      type="button"
      class="retry-btn"
      :disabled="!canRetry"
      @click="handleRetry"
      data-test="rate-limited-retry-button"
    >
      <RefreshCw :size="16" />
      {{ canRetry ? t('classroom.realtime.rateLimitedRetry') : formattedTime }}
    </button>
  </div>
</template>

<style scoped>
.rate-limited-notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  background: var(--warning-bg, #fff3cd);
  border: 1px solid var(--warning-border, #ffc107);
  border-radius: var(--radius-md, 8px);
  margin: 1rem 0;
}

.notice-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
}

.icon-clock {
  color: var(--warning, #ff9800);
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.notice-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.notice-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.notice-description {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin: 0;
}

.countdown-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--warning);
  margin: 0;
}

.retry-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.retry-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.retry-btn:disabled {
  background: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.6;
}

.retry-btn:active:not(:disabled) {
  transform: scale(0.98);
}

@media (max-width: 640px) {
  .rate-limited-notice {
    flex-direction: column;
    align-items: stretch;
  }

  .retry-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
