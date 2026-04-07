<template>
  <!-- A.1: Manual Recording Control — start/stop + REC indicator with timer -->
  <div class="wb-recording-banner" role="status" aria-live="polite">
    <!-- Стан: не записується, можна почати -->
    <button
      v-if="!isRecording && !isFrozen"
      type="button"
      class="wb-recording-banner__btn wb-recording-banner__btn--start"
      :title="t('winterboard.recording.startTitle')"
      :disabled="isLoading"
      @click="$emit('start')"
    >
      <span class="wb-recording-banner__dot wb-recording-banner__dot--idle" aria-hidden="true" />
      <span>{{ t('winterboard.recording.start') }}</span>
    </button>

    <!-- Стан: запис активний -->
    <template v-if="isRecording">
      <span class="wb-recording-banner__dot wb-recording-banner__dot--active" aria-hidden="true" />
      <span class="wb-recording-banner__text">REC</span>
      <span class="wb-recording-banner__timer">{{ formattedDuration }}</span>
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--stop"
        :disabled="isLoading"
        @click="$emit('stop')"
      >
        <span class="wb-recording-banner__stop-icon" aria-hidden="true" />
        <span>{{ t('winterboard.recording.stop') }}</span>
      </button>
    </template>

    <!-- Стан: запис завершено (frozen) -->
    <div v-if="isFrozen && !isRecording" class="wb-recording-banner__frozen">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 1v14M1 8h14M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span>{{ t('winterboard.recording.frozen') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })

const props = defineProps<{
  isRecording: boolean
  isFrozen: boolean
  isLoading?: boolean
  recordingStartedAt?: string | null
}>()

defineEmits<{
  start: []
  stop: []
}>()

// ── Timer ──
const elapsed = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

function startTimer() {
  stopTimer()
  elapsed.value = 0
  if (props.recordingStartedAt) {
    elapsed.value = Math.floor((Date.now() - new Date(props.recordingStartedAt).getTime()) / 1000)
  }
  timerInterval = setInterval(() => {
    elapsed.value++
  }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

watch(() => props.isRecording, (recording) => {
  if (recording) {
    startTimer()
  } else {
    stopTimer()
  }
}, { immediate: true })

onUnmounted(() => stopTimer())

const formattedDuration = computed(() => {
  const m = Math.floor(elapsed.value / 60)
  const s = elapsed.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})
</script>

<style scoped>
.wb-recording-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.wb-recording-banner__btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
  border: 1px solid;
}

.wb-recording-banner__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wb-recording-banner__btn--start {
  background: rgba(255, 255, 255, 0.9);
  color: #374151;
  border-color: #d1d5db;
}

.wb-recording-banner__btn--start:hover:not(:disabled) {
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.wb-recording-banner__btn--stop {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.3);
}

.wb-recording-banner__btn--stop:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

.wb-recording-banner__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wb-recording-banner__dot--idle {
  background: #9ca3af;
}

.wb-recording-banner__dot--active {
  background: #ef4444;
  animation: wb-rec-blink 1s ease-in-out infinite;
}

.wb-recording-banner__stop-icon {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #dc2626;
  border-radius: 1px;
  flex-shrink: 0;
}

.wb-recording-banner__text {
  color: #ef4444;
  letter-spacing: 0.02em;
}

.wb-recording-banner__timer {
  color: #ef4444;
  font-variant-numeric: tabular-nums;
  min-width: 36px;
}

.wb-recording-banner__frozen {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6b7280;
  font-size: 0.7rem;
}

@keyframes wb-rec-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

/* Dark mode support */
:root[data-theme='dark'] .wb-recording-banner__btn--start {
  background: rgba(55, 65, 81, 0.9);
  color: #e5e7eb;
  border-color: #4b5563;
}

:root[data-theme='dark'] .wb-recording-banner__btn--start:hover:not(:disabled) {
  background: #374151;
}

:root[data-theme='dark'] .wb-recording-banner__frozen {
  color: #9ca3af;
}
</style>
