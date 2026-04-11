<!-- WB: Public replay player — Play/Pause/Seek + markers on timeline
     Ref: PHASE12_PLAN.md B2 / Phase 13 B1.2 -->
<template>
  <div class="public-replay-player" role="region" :aria-label="t('publicLesson.player.ariaLabel')">
    <!-- Timeline bar -->
    <div
      ref="timelineRef"
      class="public-replay-player__timeline"
      role="slider"
      :aria-label="t('publicLesson.player.timeline')"
      :aria-valuemin="0"
      :aria-valuemax="durationSeconds"
      :aria-valuenow="currentSeconds"
      tabindex="0"
      @click="onTimelineClick"
      @keydown.left.prevent="seekRelative(-5)"
      @keydown.right.prevent="seekRelative(5)"
    >
      <!-- Progress fill -->
      <div class="public-replay-player__progress" :style="{ width: progressPercent + '%' }" />

      <!-- Marker dots on timeline (colored by category) -->
      <div
        v-for="marker in markers"
        :key="marker.id"
        class="public-replay-player__marker-dot"
        :style="{ left: markerPercent(marker) + '%', background: categoryColor(marker.category) }"
        :title="marker.title"
        @click.stop="emit('seek', marker.lesson_time_seconds * 1000)"
      />

      <!-- Playhead -->
      <div class="public-replay-player__playhead" :style="{ left: progressPercent + '%' }" />
    </div>

    <!-- Controls row -->
    <div class="public-replay-player__controls">
      <!-- Step backward (HIGH 8: disabled at start) -->
      <button
        type="button"
        class="public-replay-player__step-btn"
        :aria-label="t('replay.stepBackward')"
        :disabled="(props.currentIndex ?? 0) <= 0"
        @click="emit('step-backward')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="3" width="2" height="10" rx="0.5" fill="currentColor"/>
          <path d="M13 3L6 8l7 5V3z" fill="currentColor"/>
        </svg>
      </button>

      <!-- Play / Pause -->
      <button
        type="button"
        class="public-replay-player__play-btn"
        :aria-label="isPlaying ? t('publicLesson.player.pause') : t('publicLesson.player.play')"
        @click="isPlaying ? emit('pause') : emit('play')"
      >
        <svg v-if="!isPlaying" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M4 2.5v13l11-6.5L4 2.5z" fill="currentColor"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect x="3" y="2" width="4" height="14" rx="1" fill="currentColor"/>
          <rect x="11" y="2" width="4" height="14" rx="1" fill="currentColor"/>
        </svg>
      </button>

      <!-- Step forward (HIGH 7: disabled at end) -->
      <button
        type="button"
        class="public-replay-player__step-btn"
        :aria-label="t('replay.stepForward')"
        :disabled="(props.currentIndex ?? 0) >= (props.totalOperations ?? 0)"
        @click="emit('step-forward')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 3l7 5-7 5V3z" fill="currentColor"/>
          <rect x="12" y="3" width="2" height="10" rx="0.5" fill="currentColor"/>
        </svg>
      </button>

      <span class="public-replay-player__time">
        {{ formatTime(currentSeconds) }} / {{ formatTime(durationSeconds) }}
      </span>

      <!-- Share moment button -->
      <button
        type="button"
        class="public-replay-player__share-moment"
        :title="t('winterboard.replay.shareMoment')"
        :aria-label="t('winterboard.replay.shareMoment')"
        @click="handleShareMoment"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="12" cy="4" r="2" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5.7 7l4.6-2M5.7 9l4.6 2" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>

      <!-- Speed selector -->
      <select
        v-model="speedModel"
        class="public-replay-player__speed"
        :aria-label="t('publicLesson.player.speed')"
        @change="emit('speed-change', Number(speedModel))"
      >
        <option value="0.5">0.5x</option>
        <option value="1">1x</option>
        <option value="2">2x</option>
        <option value="4">4x</option>
        <option value="10">10x</option>
      </select>
    </div>

    <!-- Share moment toast -->
    <Transition name="toast">
      <div
        v-if="showMomentToast"
        class="public-replay-player__toast"
        role="status"
        aria-live="polite"
      >
        {{ t('winterboard.replay.momentCopied') }}
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'

export interface ReplayMarker {
  id: string
  title: string
  lesson_time_seconds: number
  category?: string
}

const CATEGORY_COLORS: Record<string, string> = {
  theory: '#3b82f6',
  formula: '#8b5cf6',
  example: '#10b981',
  practice: '#f59e0b',
  solution: '#ef4444',
  custom: '#64748b',
}

const props = defineProps<{
  currentSeconds: number
  durationSeconds: number
  isPlaying: boolean
  currentIndex?: number
  totalOperations?: number
  markers?: ReplayMarker[]
  speed?: number
}>()

const emit = defineEmits<{
  'play': []
  'pause': []
  'seek': [timeMs: number]
  'speed-change': [speed: number]
  'step-forward': []
  'step-backward': []
  'share-moment': [seconds: number]
}>()

const { t } = useI18n()
const timelineRef = ref<HTMLElement | null>(null)
const speedModel = ref(String(props.speed ?? 1))

const progressPercent = computed(() => {
  if (!props.durationSeconds) return 0
  return Math.min(100, (props.currentSeconds / props.durationSeconds) * 100)
})

function categoryColor(cat?: string): string {
  if (!cat) return '#f59e0b'
  return CATEGORY_COLORS[cat] ?? '#94a3b8'
}

function markerPercent(marker: ReplayMarker): number {
  if (!props.durationSeconds) return 0
  return Math.min(100, (marker.lesson_time_seconds / props.durationSeconds) * 100)
}

function onTimelineClick(e: MouseEvent): void {
  const el = timelineRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0) return  // HIGH 14: guard zero-width timeline
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  emit('seek', Math.round(ratio * props.durationSeconds * 1000))
}

function seekRelative(delta: number): void {
  const next = Math.max(0, Math.min(props.durationSeconds, props.currentSeconds + delta))
  emit('seek', next * 1000)
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// A3.1: Share moment — copy URL with ?t= to clipboard
const showMomentToast = ref(false)

function handleShareMoment(): void {
  const seconds = Math.floor(props.currentSeconds)
  const url = new URL(window.location.href)
  url.searchParams.set('t', String(seconds))

  navigator.clipboard.writeText(url.toString()).then(() => {
    showMomentToast.value = true
    setTimeout(() => { showMomentToast.value = false }, 2500)
  }).catch(() => {
    const input = document.createElement('input')
    input.value = url.toString()
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    showMomentToast.value = true
    setTimeout(() => { showMomentToast.value = false }, 2500)
  })

  emit('share-moment', seconds)
}
</script>

<style scoped>
.public-replay-player {
  position: relative;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px 20px;
}

.public-replay-player__timeline {
  position: relative;
  height: 8px;
  background: #e2e8f0;
  border-radius: 4px;
  cursor: pointer;
  margin-bottom: 12px;
}

.public-replay-player__progress {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--wb-brand, #047857);
  border-radius: 4px;
  transition: width 0.1s linear;
  pointer-events: none;
}

.public-replay-player__playhead {
  position: absolute;
  top: -4px;
  width: 16px;
  height: 16px;
  background: var(--wb-brand, #047857);
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transform: translateX(-50%);
  pointer-events: none;
  transition: left 0.1s linear;
}

.public-replay-player__marker-dot {
  position: absolute;
  top: -2px;
  width: 12px;
  height: 12px;
  background: #f59e0b;
  border: 2px solid #ffffff;
  border-radius: 50%;
  transform: translateX(-50%);
  cursor: pointer;
  z-index: 2;
  transition: transform 0.12s;
}

.public-replay-player__marker-dot:hover {
  transform: translateX(-50%) scale(1.3);
}

.public-replay-player__controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.public-replay-player__play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--wb-brand, #047857);
  color: #ffffff;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.12s;
  flex-shrink: 0;
}

.public-replay-player__play-btn:hover {
  background: var(--wb-primary-hover, #065f46);
}

.public-replay-player__step-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background: transparent;
  color: #64748b;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.12s;
  flex-shrink: 0;
}

.public-replay-player__step-btn:hover:not(:disabled) {
  color: var(--wb-brand, #047857);
  border-color: var(--wb-brand, #047857);
  background: rgba(4, 120, 87, 0.05);
}

.public-replay-player__step-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.public-replay-player__time {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  font-variant-numeric: tabular-nums;
}

.public-replay-player__speed {
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  background: #ffffff;
  cursor: pointer;
}

.public-replay-player__share-moment {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 6px;
  background: var(--wb-surface-alt, #f3f4f6);
  color: var(--wb-text-muted, #6b7280);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.public-replay-player__share-moment:hover {
  background: var(--wb-primary, #2563eb);
  color: #fff;
}

.public-replay-player__toast {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.375rem 0.75rem;
  background: var(--wb-success-bg, #065f46);
  color: #fff;
  border-radius: 6px;
  font-size: 0.75rem;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

@media (max-width: 640px) {
  .public-replay-player {
    padding: 12px 14px;
  }

  .public-replay-player__speed {
    font-size: 16px; /* prevent iOS zoom */
  }
}
</style>
