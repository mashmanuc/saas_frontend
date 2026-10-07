<template>
  <!--
    Recording lifecycle UI — 4 states, semantically distinct.

    idle       → start a new cycle ("Записати урок")
    recording  → REC + timer + [Пауза | Завершити запис]
    paused     → paused indicator + [Продовжити | Завершити запис]
    finalized  → те саме, що idle: «Записати урок» (emit('start'))

    Семантика:
      - resume === same replay cycle (pause/resume не створюють новий Replay)
      - start з finalized === НОВИЙ запис з поточного стану дошки; попередній
        лишається в «Моїх записах» (INV-23 v3, рішення власника 2026-09-27:
        завершений запис дошку не блокує, новий — лише добровільно)
  -->
  <div class="wb-recording-banner" role="status" aria-live="polite">
    <!-- IDLE / FINALIZED → start (після завершення — новий запис з поточного стану) -->
    <template v-if="recordingState === 'idle' || recordingState === 'finalized'">
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--start"
        :title="t('winterboard.recording.startTitle')"
        :disabled="isLoading"
        @click="$emit('start')"
      >
        <span class="wb-recording-banner__dot wb-recording-banner__dot--idle" aria-hidden="true" />
        <span>{{ t('winterboard.recording.start') }}</span>
      </button>
    </template>

    <!-- RECORDING → REC + timer + Pause + Finalize -->
    <template v-else-if="recordingState === 'recording'">
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
        <span class="wb-recording-banner__pause-icon" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="2" y="1.5" width="2" height="7" rx="0.5" fill="currentColor"/>
            <rect x="6" y="1.5" width="2" height="7" rx="0.5" fill="currentColor"/>
          </svg>
        </span>
        <span>{{ t('winterboard.recording.pause') }}</span>
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

    <!-- PAUSED → indicator + Resume + Finalize -->
    <template v-else-if="recordingState === 'paused'">
      <span class="wb-recording-banner__dot wb-recording-banner__dot--paused" aria-hidden="true" />
      <span class="wb-recording-banner__text wb-recording-banner__text--paused">
        {{ t('winterboard.recording.pausedLabel') }}
      </span>
      <span class="wb-recording-banner__timer wb-recording-banner__timer--paused">
        {{ formattedDuration }}
      </span>
      <button
        type="button"
        class="wb-recording-banner__btn wb-recording-banner__btn--resume"
        :title="t('winterboard.recording.resumeTitle')"
        :disabled="isLoading"
        @click="$emit('resume')"
      >
        <span class="wb-recording-banner__dot wb-recording-banner__dot--active" aria-hidden="true" />
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

    <!-- Порожній запис не збережено (2026-10-07) — повідомлення під кнопкою -->
    <WBRecordingEmptyNotice v-if="emptyNotice" @dismiss="$emit('dismiss-empty-notice')" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RecordingState } from '../../api/replay'
import WBRecordingEmptyNotice from './WBRecordingEmptyNotice.vue'

const { t } = useI18n({ useScope: 'global' })

const props = defineProps<{
  recordingState: RecordingState
  isLoading?: boolean
  recordingStartedAt?: string | null
  /** Сервер не зберіг порожній запис — показати «Запис не збережено» під кнопкою. */
  emptyNotice?: boolean
}>()

defineEmits<{
  /** idle | finalized → start NEW recording cycle (new Replay on finalize) */
  start: []
  /** recording → paused (same cycle, no Replay created) */
  pause: []
  /** paused → recording (same cycle, no Replay created) */
  resume: []
  /** recording | paused → finalized (Replay created/finalized; порожній — не створюється) */
  finalize: []
  /** × на повідомленні «Запис не збережено» */
  'dismiss-empty-notice': []
}>()

// ── Timer (running під час recording, freezed на pause) ──
const elapsed = ref(0)
let timerInterval: ReturnType<typeof setInterval> | null = null

function startTimer(): void {
  stopTimer()
  if (props.recordingStartedAt) {
    elapsed.value = Math.floor(
      (Date.now() - new Date(props.recordingStartedAt).getTime()) / 1000,
    )
  }
  timerInterval = setInterval(() => {
    elapsed.value++
  }, 1000)
}

function stopTimer(): void {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function resetTimer(): void {
  stopTimer()
  elapsed.value = 0
}

watch(
  () => props.recordingState,
  (state) => {
    if (state === 'recording') {
      startTimer()
    } else if (state === 'paused') {
      // freeze timer на поточному значенні (не reset)
      stopTimer()
    } else {
      // idle / finalized — reset
      resetTimer()
    }
  },
  { immediate: true },
)

onUnmounted(() => stopTimer())

const formattedDuration = computed(() => {
  const m = Math.floor(elapsed.value / 60)
  const s = elapsed.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})
</script>

<style scoped>
.wb-recording-banner {
  position: relative; /* якір для «Запис не збережено» */
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
  transition: background 0.15s, box-shadow 0.15s, border-color 0.15s;
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

.wb-recording-banner__btn--pause {
  background: rgba(245, 158, 11, 0.1);
  color: #b45309;
  border-color: rgba(245, 158, 11, 0.3);
}
.wb-recording-banner__btn--pause:hover:not(:disabled) {
  background: rgba(245, 158, 11, 0.18);
}

.wb-recording-banner__btn--resume {
  background: rgba(16, 185, 129, 0.12);
  color: #047857;
  border-color: rgba(16, 185, 129, 0.35);
}
.wb-recording-banner__btn--resume:hover:not(:disabled) {
  background: rgba(16, 185, 129, 0.22);
}

.wb-recording-banner__btn--finalize {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border-color: rgba(239, 68, 68, 0.3);
}
.wb-recording-banner__btn--finalize:hover:not(:disabled) {
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

.wb-recording-banner__dot--paused {
  background: #f59e0b;
}

.wb-recording-banner__stop-icon {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: currentColor;
  border-radius: 1px;
  flex-shrink: 0;
}

.wb-recording-banner__pause-icon {
  display: inline-flex;
  width: 10px;
  height: 10px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wb-recording-banner__text {
  color: #ef4444;
  letter-spacing: 0.02em;
}

.wb-recording-banner__text--paused {
  color: #b45309;
}

.wb-recording-banner__timer {
  color: #ef4444;
  font-variant-numeric: tabular-nums;
  min-width: 36px;
}

.wb-recording-banner__timer--paused {
  color: #b45309;
}

@keyframes wb-rec-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

:root[data-theme='dark'] .wb-recording-banner__btn--start {
  background: rgba(55, 65, 81, 0.9);
  color: #e5e7eb;
  border-color: #4b5563;
}

:root[data-theme='dark'] .wb-recording-banner__btn--start:hover:not(:disabled) {
  background: #374151;
}

/* ── Темна тема (Б-156, фаза 2): ті самі селектори, що вище, — кольори токенами теми.
   Згенеровано з правил цього файлу; світла й класична не змінюються. ── */
[data-theme="dark"] .wb-recording-banner__btn--start {
  background: var(--color-surface);
  color: var(--color-text);
  border-color: var(--color-border-strong);
}
[data-theme="dark"] .wb-recording-banner__btn--start:hover:not(:disabled) {
  background: var(--color-border);
}
[data-theme="dark"] .wb-recording-banner__btn--pause {
  color: var(--color-warning);
  border-color: var(--color-warning);
}
[data-theme="dark"] .wb-recording-banner__btn--resume {
  color: var(--color-success);
  border-color: var(--color-success);
}
[data-theme="dark"] .wb-recording-banner__btn--finalize {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
[data-theme="dark"] .wb-recording-banner__dot--idle {
  background: var(--color-border-strong);
}
[data-theme="dark"] .wb-recording-banner__dot--active {
  background: var(--color-danger);
}
[data-theme="dark"] .wb-recording-banner__dot--paused {
  background: var(--color-warning);
}
[data-theme="dark"] .wb-recording-banner__text {
  color: var(--color-danger);
}
[data-theme="dark"] .wb-recording-banner__text--paused {
  color: var(--color-warning);
}
[data-theme="dark"] .wb-recording-banner__timer {
  color: var(--color-danger);
}
[data-theme="dark"] .wb-recording-banner__timer--paused {
  color: var(--color-warning);
}
</style>
