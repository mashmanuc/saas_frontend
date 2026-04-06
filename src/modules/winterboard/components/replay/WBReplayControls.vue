<template>
  <div class="wb-replay-controls" :class="`wb-replay-controls--${state}`">
    <!-- Loading -->
    <div v-if="isLoading" class="wb-replay-controls__loading">
      {{ t('replay.loading', 'Loading replay…') }}
    </div>

    <template v-else>
      <!-- Progress bar / timeline -->
      <div class="wb-replay-controls__timeline">
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
        <span class="wb-replay-controls__counter">
          {{ currentIndex }} / {{ totalOperations }}
        </span>
      </div>

      <!-- Play controls -->
      <div class="wb-replay-controls__buttons">
        <button
          class="wb-replay-controls__btn"
          :disabled="state === 'idle'"
          :aria-label="t('replay.stop')"
          data-testid="replay-stop"
          @click="onStop"
        >
          ⏹
        </button>

        <button
          class="wb-replay-controls__btn wb-replay-controls__btn--primary"
          :aria-label="state === 'playing' ? t('replay.pause') : t('replay.play')"
          data-testid="replay-play-pause"
          @click="onPlayPause"
        >
          {{ state === 'playing' ? '⏸' : '▶' }}
        </button>

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
      </div>

      <!-- Status label when ended -->
      <div v-if="state === 'ended'" class="wb-replay-controls__ended">
        {{ t('replay.replayEnded') }}
      </div>

      <!-- Error -->
      <div v-if="error" class="wb-replay-controls__error" data-testid="replay-error">
        {{ error }}
      </div>
    </template>

    <!-- Exit replay button — always visible -->
    <button
      class="wb-replay-controls__exit"
      :aria-label="t('replay.exit')"
      data-testid="replay-exit"
      @click="$emit('exit')"
    >
      {{ t('replay.exitReplay') }}
    </button>
  </div>
</template>

<script setup lang="ts">
// A12 Part 2: WBReplayControls — timeline slider + playback controls
// Ref: DAY18_AGENT-A.md
// Zone: AGENT-A (components/replay/)

import { ref, onMounted, onBeforeUnmount } from 'vue'
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
}>()

const emit = defineEmits<{
  exit: []
  operation: [op: BoardOperation]
}>()

const { t } = useI18n({ useScope: 'global' })

const currentSpeed = ref<ReplaySpeed>(1)
const isSeeking = ref(false)

const {
  state,
  currentIndex,
  totalOperations,
  isLoading,
  error,
  loadTimeline,
  play,
  pause,
  stop,
  setSpeed,
  seekTo,
  seekToWithSnapshot,
  destroy,
} = useReplay(props.sessionId)

onMounted(async () => {
  await loadTimeline((op) => {
    emit('operation', op)
  })
})

onBeforeUnmount(() => {
  destroy()
})

// ─── Handlers ─────────────────────────────────────────────────────────────────

function onPlayPause(): void {
  if (state.value === 'playing') {
    pause()
  } else {
    play()
  }
}

function onStop(): void {
  stop()
}

async function onSeek(event: Event): Promise<void> {
  const idx = parseInt((event.target as HTMLInputElement).value, 10)
  // REPLAY-INV-4: якщо є loadState/clearState — використовуємо seekToWithSnapshot (O(1))
  // інакше fallback на базовий seekTo (тільки переміщує pointer, не перебудовує стан)
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

function onSpeedChange(event: Event): void {
  const val = parseFloat((event.target as HTMLSelectElement).value) as ReplaySpeed
  currentSpeed.value = val
  setSpeed(val)
}
</script>

<style scoped>
.wb-replay-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.85);
  color: white;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1000;
  /* Touch-friendly height */
  min-height: 56px;
  backdrop-filter: blur(4px);
}

.wb-replay-controls__loading {
  flex: 1;
  text-align: center;
  opacity: 0.7;
  font-size: 14px;
}

.wb-replay-controls__timeline {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-replay-controls__slider {
  flex: 1;
  accent-color: var(--primary, #6366f1);
  height: 4px;
  cursor: pointer;
}

.wb-replay-controls__counter {
  font-size: 12px;
  opacity: 0.7;
  white-space: nowrap;
  min-width: 60px;
  text-align: right;
}

.wb-replay-controls__buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-replay-controls__btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  min-height: 36px;
  min-width: 36px;
  transition: background 0.15s;
}

.wb-replay-controls__btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.wb-replay-controls__btn:disabled {
  opacity: 0.38;
  pointer-events: none;
}

.wb-replay-controls__btn--primary {
  background: var(--primary, #6366f1);
  border-color: transparent;
  padding: 6px 20px;
}

.wb-replay-controls__btn--primary:hover {
  background: var(--primary-hover, #4f46e5);
}

.wb-replay-controls__speed {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

.wb-replay-controls__exit {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: rgba(255, 255, 255, 0.7);
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s;
}

.wb-replay-controls__exit:hover {
  color: white;
  border-color: rgba(255, 255, 255, 0.6);
}

.wb-replay-controls__ended {
  font-size: 13px;
  color: #86efac;
  white-space: nowrap;
}

.wb-replay-controls__error {
  color: #f87171;
  font-size: 13px;
  white-space: nowrap;
}
</style>
