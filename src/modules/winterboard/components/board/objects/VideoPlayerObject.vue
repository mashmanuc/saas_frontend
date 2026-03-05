<template>
  <div
    class="video-object"
    :style="{ width: obj.w + 'px', height: obj.h + 'px' }"
  >
    <video
      ref="videoEl"
      :src="obj.src"
      :poster="obj.thumbnail || undefined"
      class="video-object__video"
      preload="metadata"
      @ended="onEnded"
    />

    <div class="video-object__controls">
      <!-- Tutor: play/pause button -->
      <button
        v-if="isTutor"
        type="button"
        class="video-object__btn"
        :aria-label="isPlaying ? t('winterboard.video.pause') : t('winterboard.video.play')"
        @click="toggle"
      >
        {{ isPlaying ? '⏸' : '▶️' }}
      </button>

      <!-- Student: status only -->
      <span v-else class="video-object__status">
        {{ isPlaying ? t('winterboard.video.playing') : t('winterboard.video.paused') }}
      </span>

      <!-- Position display -->
      <span v-if="obj.duration" class="video-object__time">
        {{ formatTime(currentPosition) }} / {{ formatTime(obj.duration) }}
      </span>
    </div>

    <!-- Tutor: seek bar -->
    <input
      v-if="isTutor && obj.duration"
      type="range"
      class="video-object__seek"
      :min="0"
      :max="obj.duration"
      :step="0.5"
      :value="currentPosition"
      @input="onSeek"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBVideoAsset } from '../../../types/mediaObjects'
import type { VideoSyncState } from '../../../composables/useMediaSync'

const props = defineProps<{
  obj: WBVideoAsset
  isTutor: boolean
  videoStates: Readonly<Record<string, VideoSyncState>>
  sendPlay: (objectId: string, position?: number) => void
  sendPause: (objectId: string) => void
  sendSeek: (objectId: string, position: number) => void
}>()

const { t } = useI18n()
const videoEl = ref<HTMLVideoElement>()

// ── State from WS sync ──────────────────────────────────────

const syncState = computed(() =>
  props.videoStates[props.obj.id] || { playing: false, position: 0, serverTimestamp: 0 }
)
const isPlaying = computed(() => syncState.value.playing)
const currentPosition = ref(0)

// ── Sync video element with WS state ────────────────────────

watch(isPlaying, (playing) => {
  const el = videoEl.value
  if (!el) return
  if (playing) {
    el.play().catch(() => {})
  } else {
    el.pause()
  }
})

watch(() => syncState.value.position, (pos) => {
  const el = videoEl.value
  if (!el) return
  if (Math.abs(el.currentTime - pos) > 0.5) {
    el.currentTime = pos
  }
  currentPosition.value = pos
})

// ── Local position tracking ─────────────────────────────────

let positionTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  positionTimer = setInterval(() => {
    if (videoEl.value && isPlaying.value) {
      currentPosition.value = videoEl.value.currentTime
    }
  }, 250)
})

onUnmounted(() => {
  if (positionTimer) clearInterval(positionTimer)
})

// ── Tutor actions ───────────────────────────────────────────

function toggle(): void {
  if (isPlaying.value) {
    props.sendPause(props.obj.id)
  } else {
    props.sendPlay(props.obj.id, videoEl.value?.currentTime ?? 0)
  }
}

function onSeek(event: Event): void {
  const value = parseFloat((event.target as HTMLInputElement).value)
  props.sendSeek(props.obj.id, value)
}

function onEnded(): void {
  if (props.isTutor) {
    props.sendPause(props.obj.id)
  }
}

// ── Helpers ─────────────────────────────────────────────────

function formatTime(seconds: number | undefined): string {
  if (!seconds) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
.video-object {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}
.video-object__video {
  width: 100%;
  flex: 1;
  object-fit: contain;
  background: #000;
}
.video-object__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
}
.video-object__btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
}
.video-object__status {
  font-size: 11px;
  color: #94a3b8;
}
.video-object__time {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  color: #cbd5e1;
  font-size: 11px;
}
.video-object__seek {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: #374151;
  outline: none;
  cursor: pointer;
}
.video-object__seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #3b82f6;
}
</style>
