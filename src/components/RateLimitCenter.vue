<template>
  <Transition name="modal">
    <div v-if="show" class="rate-limit-overlay">
      <div class="rate-limit-content">
        <div class="rate-limit-icon">
          <Clock :size="32" />
        </div>
        <h2 class="rate-limit-title">{{ $t('common.rateLimit.title') }}</h2>
        <p class="rate-limit-message">{{ $t('common.rateLimit.message') }}</p>
        
        <div class="countdown-container">
          <div class="countdown-ring">
            <svg class="countdown-svg" viewBox="0 0 100 100">
              <circle
                class="countdown-bg"
                cx="50"
                cy="50"
                r="45"
              />
              <circle
                class="countdown-progress"
                cx="50"
                cy="50"
                r="45"
                :style="{ strokeDashoffset: progressOffset }"
              />
            </svg>
            <div class="countdown-text">
              <span class="countdown-number">{{ remainingSeconds }}</span>
              <span class="countdown-label">{{ $t('common.rateLimit.seconds') }}</span>
            </div>
          </div>
        </div>

        <p v-if="requestId" class="request-id">Request ID: {{ requestId }}</p>

        <button
          type="button"
          class="retry-btn"
          :disabled="remainingSeconds > 0"
          @click="handleRetry"
        >
          {{ remainingSeconds > 0 ? $t('common.rateLimit.waiting') : $t('common.rateLimit.tryNow') }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Clock } from 'lucide-vue-next'
import { trackEvent } from '@/utils/telemetryAgent'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  retryAfterSeconds: {
    type: Number,
    default: 60,
  },
  requestId: {
    type: String,
    default: '',
  },
  onRetry: {
    type: Function,
    default: () => {},
  },
  onClose: {
    type: Function,
    default: () => {},
  },
})

const { t } = useI18n()

const remainingSeconds = ref(0)
let countdownInterval = null

const progressOffset = computed(() => {
  if (props.retryAfterSeconds === 0) return 283
  const progress = remainingSeconds.value / props.retryAfterSeconds
  return 283 * progress
})

function startCountdown() {
  stopCountdown()
  remainingSeconds.value = props.retryAfterSeconds
  
  countdownInterval = setInterval(() => {
    if (remainingSeconds.value > 0) {
      remainingSeconds.value--
    } else {
      stopCountdown()
      trackEvent('rate_limit_recovered', {
        retry_after_seconds: props.retryAfterSeconds,
        request_id: props.requestId,
      })
    }
  }, 1000)
}

function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

function handleRetry() {
  if (remainingSeconds.value > 0) return
  
  stopCountdown()
  if (props.onRetry) props.onRetry()
  if (props.onClose) props.onClose()
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    startCountdown()
    trackEvent('rate_limit_hit', {
      retry_after_seconds: props.retryAfterSeconds,
      request_id: props.requestId,
    })
  } else {
    stopCountdown()
  }
})

onUnmounted(() => {
  stopCountdown()
})
</script>

<style scoped>
.rate-limit-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.rate-limit-content {
  background: var(--surface-card);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 400px;
  width: 100%;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;
}

.rate-limit-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: var(--warning-bg, #fef3c7);
  color: var(--warning, #f59e0b);
  border-radius: 50%;
}

.rate-limit-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.rate-limit-message {
  font-size: 0.9375rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

.countdown-container {
  width: 100%;
  display: flex;
  justify-content: center;
  padding: 1rem 0;
}

.countdown-ring {
  position: relative;
  width: 150px;
  height: 150px;
}

.countdown-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.countdown-bg {
  fill: none;
  stroke: var(--surface-secondary);
  stroke-width: 8;
}

.countdown-progress {
  fill: none;
  stroke: var(--primary);
  stroke-width: 8;
  stroke-linecap: round;
  stroke-dasharray: 283;
  transition: stroke-dashoffset 1s linear;
}

.countdown-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.countdown-number {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--primary);
  line-height: 1;
}

.countdown-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.request-id {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-family: monospace;
  margin: 0;
  opacity: 0.8;
}

.retry-btn {
  padding: 0.75rem 2rem;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.retry-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .rate-limit-content,
.modal-leave-active .rate-limit-content {
  transition: transform 0.3s ease;
}

.modal-enter-from .rate-limit-content,
.modal-leave-to .rate-limit-content {
  transform: scale(0.9);
}
</style>
