<template>
  <!-- Plan v2.3 (2026-05-05): 3-state UI per recording_state enum.
       IDLE/FINALIZED:
         - empty canvas + idle → single "Записати урок" (continue mode default)
         - canvas з контентом OR finalized → 2 buttons (continue|new) для choice
       RECORDING → Pause button + REC + timer.
       PAUSED → Resume + Finalize buttons.
       UI source of truth = recordingState prop + hasBoardContent. NO derived flags. -->
  <div class="wb-recording-banner" role="status" aria-live="polite">
    <!-- IDLE на empty canvas → single button (modes equivalent на empty) -->
    <template
      v-if="recordingState === 'idle' && !hasBoardContent"
    >
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--start"
        :title="t('winterboard.recording.startTitle')"
        :disabled="isLoading"
        @click="$emit('start', 'continue')"
      >
        <span class="wb-recording-banner__dot wb-recording-banner__dot--idle" aria-hidden="true" />
        <span>{{ t('winterboard.recording.start') }}</span>
      </button>
    </template>

    <!-- IDLE+content OR FINALIZED → 2 explicit buttons (continue|new з фоном/без) -->
    <template
      v-else-if="recordingState === 'idle' || recordingState === 'finalized'"
    >
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--start"
        :title="t('winterboard.recording.startContinueTitle')"
        :disabled="isLoading"
        @click="$emit('start', 'continue')"
      >
        <span class="wb-recording-banner__dot wb-recording-banner__dot--idle" aria-hidden="true" />
        <span>{{ t('winterboard.recording.startContinue') }}</span>
      </button>
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--start-new"
        :title="t('winterboard.recording.startNewTitle')"
        :disabled="isLoading"
        @click="$emit('start', 'new')"
      >
        <span class="wb-recording-banner__dot wb-recording-banner__dot--idle" aria-hidden="true" />
        <span>{{ t('winterboard.recording.startNew') }}</span>
      </button>
      <!-- Supplementary frozen badge (FINALIZED state — попередній replay є) -->
      <div
        v-if="recordingState === 'finalized'"
        class="wb-recording-banner__frozen"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1v14M1 8h14M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span>{{ t('winterboard.recording.frozen') }}</span>
      </div>
    </template>

    <!-- RECORDING: REC indicator + Pause button -->
    <template v-if="recordingState === 'recording'">
      <span class="wb-recording-banner__dot wb-recording-banner__dot--active" aria-hidden="true" />
      <span class="wb-recording-banner__text">REC</span>
      <span class="wb-recording-banner__timer">{{ formattedDuration }}</span>
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--pause"
        :title="t('winterboard.recording.pauseTitle')"
        :disabled="isLoading"
        @click="$emit('pause')"
      >
        <span class="wb-recording-banner__pause-icon" aria-hidden="true" />
        <span>{{ t('winterboard.recording.pause') }}</span>
      </button>
    </template>

    <!-- PAUSED: PAUSED indicator + Resume + Finalize buttons -->
    <template v-if="recordingState === 'paused'">
      <span class="wb-recording-banner__dot wb-recording-banner__dot--paused" aria-hidden="true" />
      <span class="wb-recording-banner__text wb-recording-banner__text--paused">PAUSED</span>
      <span class="wb-recording-banner__timer">{{ formattedDuration }}</span>
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--resume"
        :title="t('winterboard.recording.resumeTitle')"
        :disabled="isLoading"
        @click="$emit('resume')"
      >
        <span class="wb-recording-banner__resume-icon" aria-hidden="true">▶</span>
        <span>{{ t('winterboard.recording.resume') }}</span>
      </button>
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--finalize"
        :title="t('winterboard.recording.finalizeTitle')"
        :disabled="isLoading"
        @click="$emit('finalize')"
      >
        <span class="wb-recording-banner__stop-icon" aria-hidden="true" />
        <span>{{ t('winterboard.recording.finalize') }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecordingMode, RecordingState } from '../../api/replay'

const { t } = useI18n({ useScope: 'global' })

const props = defineProps<{
  /** Plan v2.3: server-authoritative recording_state. UI derives all visibility from this. */
  recordingState: RecordingState
  /**
   * 2026-05-05 issue #1: на truly empty canvas (no strokes/assets/etc.)
   * показуємо single "Записати урок" — modes equivalent на empty.
   * 2 кнопки (continue + new) тільки коли є контент → user має вибір.
   */
  hasBoardContent?: boolean
  isLoading?: boolean
  recordingStartedAt?: string | null
}>()

defineEmits<{
  /** IDLE/FINALIZED → start (continue|new). */
  start: [mode: RecordingMode]
  /** RECORDING → pause (PAUSED). */
  pause: []
  /** PAUSED → resume (RECORDING). Mode echo'd as 'continue', BE preserves start_state. */
  resume: []
  /** RECORDING|PAUSED → finalize (creates Replay). */
  finalize: []
}>()

// Compute boolean isRecording for timer logic.
const isRecording = computed(
  () => props.recordingState === 'recording' || props.recordingState === 'paused'
)

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

// Plan v2.3: timer ticks during 'recording' state. PAUSED stops timer але
// preserves elapsed (timer continues on resume з recordingStartedAt anchor).
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

/* "Новий запис" — accent border щоб візуально відрізнити від CONTINUE */
.wb-recording-banner__btn--start-new {
  background: rgba(59, 130, 246, 0.05);
  color: #1d4ed8;
  border-color: rgba(59, 130, 246, 0.3);
}

.wb-recording-banner__btn--start-new:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.1);
  box-shadow: 0 1px 3px rgba(59, 130, 246, 0.15);
}

.wb-recording-banner__btn--stop,
.wb-recording-banner__btn--finalize {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.3);
}

.wb-recording-banner__btn--stop:hover:not(:disabled),
.wb-recording-banner__btn--finalize:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

/* Plan v2.3: PAUSE button — amber щоб відрізнити від finalize destructive red */
.wb-recording-banner__btn--pause {
  background: rgba(245, 158, 11, 0.1);
  color: #b45309;
  border-color: rgba(245, 158, 11, 0.4);
}

.wb-recording-banner__btn--pause:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.18);
}

/* Resume = green accent */
.wb-recording-banner__btn--resume {
  background: rgba(34, 197, 94, 0.1);
  color: #15803d;
  border-color: rgba(34, 197, 94, 0.35);
}

.wb-recording-banner__btn--resume:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.18);
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

/* Plan v2.3: PAUSED state — solid amber dot (не blinking) */
.wb-recording-banner__dot--paused {
  background: #f59e0b;
}

/* Pause icon — two vertical bars */
.wb-recording-banner__pause-icon {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-left: 2px solid currentColor;
  border-right: 2px solid currentColor;
  flex-shrink: 0;
}

/* Resume icon — play arrow ▶ inline */
.wb-recording-banner__resume-icon {
  display: inline-block;
  font-size: 0.7rem;
  line-height: 1;
  flex-shrink: 0;
}

.wb-recording-banner__text--paused {
  color: #b45309;
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
