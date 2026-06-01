<template>
  <div class="wb-classroom-recording" role="status" aria-live="polite">
    <!-- IDLE → start NEW cycle (нічого ще не записувалось) -->
    <template v-if="recordingState === 'idle'">
      <button
        type="button"
        class="wb-classroom-recording__btn wb-classroom-recording__btn--start"
        :title="t('winterboard.recording.startTitle')"
        :disabled="isLoading"
        @click="$emit('start')"
      >
        <span class="wb-classroom-recording__dot wb-classroom-recording__dot--idle" aria-hidden="true" />
        <span>{{ t('winterboard.recording.start') }}</span>
      </button>
    </template>

    <!-- FINALIZED → "Запис завершено" badge + "Новий запис" (з confirmation у parent) -->
    <template v-else-if="recordingState === 'finalized'">
      <div class="wb-classroom-recording__frozen" :title="t('winterboard.recording.frozenHint')">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1v14M1 8h14M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>{{ t('winterboard.recording.frozen') }}</span>
      </div>
      <button
        type="button"
        class="wb-classroom-recording__btn wb-classroom-recording__btn--restart"
        :title="t('winterboard.recording.restartTitle')"
        :disabled="isLoading"
        @click="$emit('restart')"
      >
        <span class="wb-classroom-recording__dot wb-classroom-recording__dot--idle" aria-hidden="true" />
        <span>{{ t('winterboard.recording.restart') }}</span>
      </button>
    </template>

    <!-- RECORDING → REC + Pause -->
    <template v-else-if="recordingState === 'recording'">
      <span class="wb-classroom-recording__dot wb-classroom-recording__dot--active" aria-hidden="true" />
      <span class="wb-classroom-recording__text">REC</span>
      <span class="wb-classroom-recording__timer">{{ formattedDuration }}</span>
      <button
        type="button"
        class="wb-classroom-recording__btn wb-classroom-recording__btn--pause"
        :title="t('winterboard.recording.pauseTitle')"
        :disabled="isLoading"
        @click="$emit('pause')"
      >
        <span class="wb-classroom-recording__pause-icon" aria-hidden="true" />
        <span>{{ t('winterboard.recording.pause') }}</span>
      </button>
    </template>

    <!-- PAUSED → Resume + Finalize -->
    <template v-else-if="recordingState === 'paused'">
      <span class="wb-classroom-recording__dot wb-classroom-recording__dot--paused" aria-hidden="true" />
      <span class="wb-classroom-recording__text wb-classroom-recording__text--paused">
        {{ t('winterboard.recording.pausedLabel') }}
      </span>
      <span class="wb-classroom-recording__timer">{{ formattedDuration }}</span>
      <button
        type="button"
        class="wb-classroom-recording__btn wb-classroom-recording__btn--resume"
        :title="t('winterboard.recording.resumeTitle')"
        :disabled="isLoading"
        @click="$emit('resume')"
      >
        <span class="wb-classroom-recording__resume-icon" aria-hidden="true">▶</span>
        <span>{{ t('winterboard.recording.resume') }}</span>
      </button>
      <button
        type="button"
        class="wb-classroom-recording__btn wb-classroom-recording__btn--finalize"
        :title="t('winterboard.recording.finalizeTitle')"
        :disabled="isLoading"
        @click="$emit('finalize')"
      >
        <span class="wb-classroom-recording__stop-icon" aria-hidden="true" />
        <span>{{ t('winterboard.recording.finalize') }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecordingState } from '../../api/replay'

const { t } = useI18n({ useScope: 'global' })

const props = defineProps<{
  recordingState: RecordingState
  recordingStartedAt: string | null
  isLoading?: boolean
}>()

defineEmits<{
  /** idle → start NEW recording cycle (new Replay on finalize) */
  start: []
  /** recording → paused (same cycle, no Replay created) */
  pause: []
  /** paused → recording (same cycle, no Replay created) */
  resume: []
  /** recording | paused → finalized (Replay created/finalized) */
  finalize: []
  /** finalized → start a NEW cycle (BE archives previous Replay).
   *  Parent повинен показати confirmation modal перед викликом API. */
  restart: []
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
  timerInterval = setInterval(() => { elapsed.value++ }, 1000)
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

watch(() => props.recordingState, (state) => {
  if (state === 'recording') {
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
.wb-classroom-recording {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.wb-classroom-recording__btn {
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

.wb-classroom-recording__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wb-classroom-recording__btn--start,
.wb-classroom-recording__btn--restart {
  background: rgba(255, 255, 255, 0.9);
  color: #374151;
  border-color: #d1d5db;
}

.wb-classroom-recording__btn--start:hover:not(:disabled),
.wb-classroom-recording__btn--restart:hover:not(:disabled) {
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.wb-classroom-recording__btn--pause {
  background: rgba(245, 158, 11, 0.1);
  color: #b45309;
  border-color: rgba(245, 158, 11, 0.4);
}

.wb-classroom-recording__btn--pause:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.18);
}

.wb-classroom-recording__btn--resume {
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
  border-color: rgba(34, 197, 94, 0.35);
}

.wb-classroom-recording__btn--resume:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.18);
}

.wb-classroom-recording__btn--finalize {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.3);
}

.wb-classroom-recording__btn--finalize:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

.wb-classroom-recording__dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.wb-classroom-recording__dot--idle {
  background: #9ca3af;
}

.wb-classroom-recording__dot--active {
  background: #ef4444;
  animation: wb-classroom-rec-blink 1s ease-in-out infinite;
}

.wb-classroom-recording__dot--paused {
  background: #f59e0b;
}

.wb-classroom-recording__pause-icon {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-left: 2px solid currentColor;
  border-right: 2px solid currentColor;
  flex-shrink: 0;
}

.wb-classroom-recording__resume-icon {
  display: inline-block;
  font-size: 0.7rem;
  line-height: 1;
  flex-shrink: 0;
}

.wb-classroom-recording__stop-icon {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: #dc2626;
  border-radius: 1px;
  flex-shrink: 0;
}

.wb-classroom-recording__text {
  color: #ef4444;
  letter-spacing: 0.02em;
}

.wb-classroom-recording__text--paused {
  color: #b45309;
}

.wb-classroom-recording__timer {
  color: #ef4444;
  font-variant-numeric: tabular-nums;
  min-width: 36px;
}

.wb-classroom-recording__frozen {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #6b7280;
  font-size: 0.7rem;
}

@keyframes wb-classroom-rec-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

:root[data-theme='dark'] .wb-classroom-recording__btn--start,
:root[data-theme='dark'] .wb-classroom-recording__btn--restart {
  background: rgba(55, 65, 81, 0.9);
  color: #e5e7eb;
  border-color: #4b5563;
}

:root[data-theme='dark'] .wb-classroom-recording__btn--start:hover:not(:disabled),
:root[data-theme='dark'] .wb-classroom-recording__btn--restart:hover:not(:disabled) {
  background: #374151;
}

:root[data-theme='dark'] .wb-classroom-recording__frozen {
  color: #9ca3af;
}
</style>
