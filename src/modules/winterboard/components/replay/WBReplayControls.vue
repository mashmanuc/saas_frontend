<template>
  <div class="wb-replay-controls" :class="`wb-replay-controls--${state}`">
    <!-- Loading -->
    <div v-if="isLoading" class="wb-replay-controls__loading">
      {{ t('replay.loading', 'Завантаження відтворення…') }}
    </div>

    <!-- Error with Retry -->
    <div v-else-if="error" class="wb-replay-controls__error-block">
      <span class="wb-replay-controls__error" data-testid="replay-error">{{ error }}</span>
      <button
        class="wb-replay-controls__retry"
        data-testid="replay-retry"
        @click="onRetry"
      >
        ↻ {{ t('replay.retry', 'Повторити') }}
      </button>
    </div>

    <template v-else>
      <!-- Play / pause -->
      <button
        class="wb-replay-controls__play"
        :aria-label="state === 'playing' ? t('replay.pause') : t('replay.play')"
        data-testid="replay-play-pause"
        @click="onPlayPause"
      >
        <span v-if="state === 'playing'" aria-hidden="true">⏸</span>
        <span v-else aria-hidden="true">▶</span>
      </button>

      <!-- Time -->
      <span class="wb-replay-controls__time" data-testid="replay-time">
        {{ formatTime(currentTimeMs) }} / {{ formatTime(totalDurationMs) }}
      </span>

      <!-- Progress slider with chapter markers -->
      <div class="wb-replay-controls__timeline" :style="progressStyle">
        <!-- Phase C.2: comment points (yellow) — окремий шар під chapters -->
        <button
          v-for="cp in (commentPoints || [])"
          :key="`cmt-${cp.id}`"
          type="button"
          class="wb-replay-controls__comment-dot"
          :style="{ left: `${cp.percent}%` }"
          :title="cp.text"
          :aria-label="cp.text"
          @click.stop="onCommentClick(cp.operation_index)"
        />
        <!-- A.2.5: chapter ticks (lesson markers) -->
        <button
          v-for="m in chapters"
          :key="m.id"
          type="button"
          class="wb-replay-controls__chapter"
          :class="{ 'wb-replay-controls__chapter--active': activeMarkerId === m.id }"
          :style="{ left: `${m.percent}%` }"
          :title="m.title"
          :aria-label="m.title"
          @click.stop="onChapterClick(m.operation_index)"
        />
        <input
          type="range"
          class="wb-replay-controls__slider"
          :min="0"
          :max="totalOperations"
          :value="currentIndex"
          :aria-label="t('replay.timeline')"
          data-testid="replay-slider"
          @input="onSeek"
        />
      </div>

      <!-- Speed -->
      <select
        class="wb-replay-controls__speed"
        :value="currentSpeed"
        :aria-label="t('replay.speed')"
        data-testid="replay-speed"
        @change="onSpeedChange"
      >
        <option value="0.5">0.5×</option>
        <option value="1">1×</option>
        <option value="2">2×</option>
        <option value="4">4×</option>
      </select>

      <!-- Status when ended -->
      <span v-if="state === 'ended'" class="wb-replay-controls__ended">
        {{ t('replay.replayEnded') }}
      </span>

    </template>

    <!-- Exit replay button -->
    <button
      class="wb-replay-controls__exit"
      :aria-label="t('replay.exit')"
      data-testid="replay-exit"
      @click="$emit('exit')"
    >
      ✕ {{ t('replay.exitReplay') }}
    </button>
  </div>
</template>

<script setup lang="ts">
// A.2.4 + A.2.2: WBReplayControls — YouTube-like timeline + light theme via global tokens.
//
// Зміни проти попередньої версії:
//  – світла тема (CSS variables --color-surface / --color-border / --color-primary), не dark
//  – компактний row: ▶ | MM:SS / MM:SS | прогрес-бар (заповнений) | швидкість | exit
//  – реальний час (MM:SS) з timestamp ops, а не індекс/total
//  – швидкості 0.5× / 1× / 1.5× / 2× (як на YouTube)

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useReplay } from '../../composables/useReplay'
import type { BoardOperation } from '../../types/replay'
import type { ReplaySpeed } from '../../engine/WBReplayEngine'

const props = defineProps<{
  sessionId: string  // UUID
  /** REPLAY-INV-4: для seekToWithSnapshot — гідратує store зі snapshot board_state */
  loadState?: (boardState: Record<string, unknown>) => void
  /** REPLAY-INV-4: для seekToWithSnapshot — очищає store перед replay-from-zero */
  clearState?: () => void
  /** Phase C.2: точки коментарів на timeline (жовті), окремо від chapters (сині). */
  commentPoints?: ReadonlyArray<{ id: string; operation_index: number; percent: number; text: string }>
}>()

const emit = defineEmits<{
  exit: []
  operation: [op: BoardOperation]
  // INV-T: snapshot стану на момент start_recording (фон/асети до старту запису)
  startState: [state: { pages?: unknown[]; currentPageIndex?: number }]
  // Phase C: батько синхронізує currentOpIndex без polling
  tick: [payload: { index: number; total: number }]
}>()

const { t } = useI18n({ useScope: 'global' })

const currentSpeed = ref<ReplaySpeed>(1)
const isSeeking = ref(false)

const {
  state,
  currentIndex,
  totalOperations,
  currentTimeMs,
  totalDurationMs,
  isLoading,
  error,
  retryCount,
  loadTimeline,
  retryLoad,
  play,
  pause,
  stop: _stop,
  setSpeed,
  seekTo,
  seekToWithSnapshot,
  markers,
  activeMarkerId,
  loadMarkers,
  destroy,
} = useReplay(props.sessionId)

void _stop // reserved

// Phase C: emit tick on every index change → батько не потребує polling
watch(
  () => [currentIndex.value, totalOperations.value] as const,
  ([index, total]) => {
    emit('tick', { index, total })
  },
)

onMounted(async () => {
  await loadTimeline(
    (op) => { emit('operation', op) },
    (state) => { emit('startState', state) },
  )
  // A.2.5: chapters
  await loadMarkers()
})

onBeforeUnmount(() => {
  destroy()
})

// ─── Progress fill (CSS var on slider container) ─────────────────────────────

// A.2.5: chapters list with percent positions
const chapters = computed(() => {
  const total = totalOperations.value || 1
  return markers.value.map((m) => ({
    id: m.id,
    title: m.title || `Chapter`,
    operation_index: m.operation_index,
    percent: Math.max(0, Math.min(100, (m.operation_index / total) * 100)),
  }))
})

function onChapterClick(idx: number): void {
  if (props.loadState && props.clearState) {
    void seekToWithSnapshot(idx, props.loadState, props.clearState)
  } else {
    seekTo(idx)
  }
}

// Phase C.3: клік по жовтій точці коментаря → seek
function onCommentClick(idx: number): void {
  if (props.loadState && props.clearState) {
    void seekToWithSnapshot(idx, props.loadState, props.clearState)
  } else {
    seekTo(idx)
  }
}

// Phase C.3: parent (WBSoloRoom) може викликати seek через ref.current.jumpTo(idx)
defineExpose({
  jumpTo: (idx: number) => {
    onCommentClick(idx)
  },
  getCurrentIndex: () => currentIndex.value,
  getTotalOperations: () => totalOperations.value,
})

const progressStyle = computed(() => {
  const total = totalOperations.value || 1
  const pct = Math.max(0, Math.min(100, (currentIndex.value / total) * 100))
  return { '--wb-replay-progress': `${pct}%` } as Record<string, string>
})

// ─── Handlers ─────────────────────────────────────────────────────────────────

function onPlayPause(): void {
  if (state.value === 'playing') {
    pause()
  } else {
    play()
  }
}

async function onSeek(event: Event): Promise<void> {
  const idx = parseInt((event.target as HTMLInputElement).value, 10)
  if (props.loadState && props.clearState && !isSeeking.value) {
    isSeeking.value = true
    try {
      await seekToWithSnapshot(idx, props.loadState, props.clearState)
    } finally {
      isSeeking.value = false
    }
  } else {
    seekTo(idx)
  }
}

async function onRetry(): Promise<void> {
  await retryLoad()
  if (!error.value) {
    await loadMarkers()
  }
}

function onSpeedChange(event: Event): void {
  const val = parseFloat((event.target as HTMLSelectElement).value) as ReplaySpeed
  currentSpeed.value = val
  setSpeed(val)
}

function formatTime(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<style scoped>
/* A.2.2: світла тема через глобальні токени з ui/tokens; fallback на безпечні значення. */
.wb-replay-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #0f172a);
  border-top: 1px solid var(--color-border, #e2e8f0);
  box-shadow: 0 -2px 12px rgba(15, 23, 42, 0.06);
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  z-index: 1000;
  min-height: 56px;
}

.wb-replay-controls__loading {
  flex: 1;
  text-align: center;
  opacity: 0.7;
  font-size: 14px;
}

.wb-replay-controls__play {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  background: var(--color-primary, #6366f1);
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
.wb-replay-controls__play:hover {
  background: var(--color-primary-hover, #4f46e5);
}

.wb-replay-controls__time {
  font-variant-numeric: tabular-nums;
  font-size: 13px;
  color: var(--color-text-muted, #64748b);
  white-space: nowrap;
  min-width: 88px;
}

/* Прогрес-бар: заповнена частина зліва (через CSS var --wb-replay-progress) */
.wb-replay-controls__timeline {
  flex: 1;
  position: relative;
  height: 24px;
  display: flex;
  align-items: center;
}
.wb-replay-controls__timeline::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border, #e2e8f0);
}
.wb-replay-controls__timeline::after {
  content: '';
  position: absolute;
  left: 0;
  width: var(--wb-replay-progress, 0%);
  height: 4px;
  border-radius: 2px;
  background: var(--color-primary, #6366f1);
  transition: width 0.1s linear;
  pointer-events: none;
}
/* A.2.5: chapter ticks (lesson markers) */
.wb-replay-controls__chapter {
  position: absolute;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  border-radius: 50%;
  background: var(--color-warning, #f59e0b);
  border: 2px solid var(--color-surface, #ffffff);
  transform: translateY(-50%);
  cursor: pointer;
  padding: 0;
  z-index: 2;
  transition: transform 0.15s;
}
.wb-replay-controls__chapter:hover {
  transform: translateY(-50%) scale(1.3);
}
.wb-replay-controls__chapter--active {
  background: var(--color-primary, #6366f1);
}
/* Phase C.2: comment points — жовті точки, окремо від chapter (оранжевих). */
.wb-replay-controls__comment-dot {
  position: absolute;
  top: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: #facc15;
  border: 2px solid var(--color-surface, #ffffff);
  transform: translateY(50%);
  cursor: pointer;
  padding: 0;
  z-index: 2;
  transition: transform 0.15s;
}
.wb-replay-controls__comment-dot:hover {
  transform: translateY(50%) scale(1.4);
}

.wb-replay-controls__slider {
  position: relative;
  width: 100%;
  height: 24px;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
  z-index: 1;
}
.wb-replay-controls__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary, #6366f1);
  border: 2px solid #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.2);
  cursor: pointer;
}
.wb-replay-controls__slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary, #6366f1);
  border: 2px solid #ffffff;
  cursor: pointer;
}

.wb-replay-controls__speed {
  background: var(--color-surface-alt, #f1f5f9);
  border: 1px solid var(--color-border, #e2e8f0);
  color: var(--color-text, #0f172a);
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.wb-replay-controls__exit {
  background: transparent;
  border: 1px solid var(--color-border, #e2e8f0);
  color: var(--color-text-muted, #64748b);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.wb-replay-controls__exit:hover {
  color: var(--color-text, #0f172a);
  border-color: var(--color-text-muted, #94a3b8);
  background: var(--color-surface-alt, #f1f5f9);
}

.wb-replay-controls__ended {
  font-size: 13px;
  color: var(--color-success, #16a34a);
  white-space: nowrap;
}

.wb-replay-controls__error {
  color: var(--color-danger, #dc2626);
  font-size: 13px;
}

.wb-replay-controls__error-block {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-replay-controls__retry {
  background: var(--color-primary, #6366f1);
  color: #ffffff;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.wb-replay-controls__retry:hover {
  background: var(--color-primary-hover, #4f46e5);
}
</style>
