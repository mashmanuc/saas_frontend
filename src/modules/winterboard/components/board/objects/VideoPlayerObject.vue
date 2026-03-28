<template>
  <div
    class="video-object"
    :style="{ width: '100%', height: '100%' }"
  >
    <video
      ref="videoEl"
      :src="obj.src"
      :poster="obj.thumbnail || undefined"
      class="video-object__video"
      preload="metadata"
      controls
      controlslist="nodownload"
      playsinline
      @ended="onEnded"
      @loadedmetadata="onLoadedMeta"
      @error="onVideoError"
    />

    <!-- Fallback: показуємо якщо src пустий або відео не завантажилось -->
    <div v-if="!obj.src || hasError" class="video-object__fallback">
      <svg width="48" height="48" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="11" height="12" rx="2" fill="#3b82f6"/>
        <path d="M13 8l5-2.5v9L13 12V8z" fill="#3b82f6"/>
      </svg>
      <span v-if="hasError" class="video-object__error-text">
        {{ t('winterboard.video.loadError') }}
      </span>
    </div>

    <!-- Title bar -->
    <div v-if="obj.title" class="video-object__title">
      {{ obj.title }}
    </div>

    <!-- Sync overlay для classroom mode (WS) -->
    <div v-if="!isTutor && syncState.playing" class="video-object__sync-indicator">
      {{ t('winterboard.video.playing') }}
    </div>
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
const hasError = ref(false)

// ── State from WS sync ──────────────────────────────────────

const syncState = computed(() =>
  props.videoStates[props.obj.id] || { playing: false, position: 0, serverTimestamp: 0 }
)
const isPlaying = computed(() => syncState.value.playing)

// ── Sync video element with WS state (classroom mode) ───────

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
})

// ── Event handlers ──────────────────────────────────────────

function onEnded(): void {
  if (props.isTutor) {
    props.sendPause(props.obj.id)
  }
}

function onLoadedMeta(): void {
  hasError.value = false
}

function onVideoError(): void {
  hasError.value = true
}

// ── Local position tracking (for WS sync broadcast) ────────

let positionTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  positionTimer = setInterval(() => {
    if (videoEl.value && !videoEl.value.paused) {
      // Якщо tutor — broadcast position для студентів
      // (handled by parent via sendPlay/sendSeek)
    }
  }, 250)
})

onUnmounted(() => {
  if (positionTimer) clearInterval(positionTimer)
})

// ── Helpers ─────────────────────────────────────────────────

// Expose для зовнішнього контролю (classroom sync)
defineExpose({
  videoEl,
})
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
  height: 100%;
  object-fit: contain;
  background: #000;
  border-radius: 8px;
}
/* Приховати відео елемент якщо є fallback */
.video-object__video[src=""],
.video-object__video:not([src]) {
  display: none;
}
.video-object__fallback {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: #1e293b;
  color: #94a3b8;
  font-size: 13px;
}
.video-object__error-text {
  color: #f87171;
  font-size: 12px;
}
.video-object__title {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 6px 10px;
  background: linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}
.video-object:hover .video-object__title {
  opacity: 1;
}
.video-object__sync-indicator {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background: rgba(34, 197, 94, 0.8);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
  pointer-events: none;
}
</style>
