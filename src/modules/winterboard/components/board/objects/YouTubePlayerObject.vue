<template>
  <div
    class="wb-youtube-player"
    :style="{ width: obj.w + 'px', height: obj.h + 'px' }"
  >
    <iframe
      v-if="videoId"
      :src="embedUrl"
      width="100%"
      height="100%"
      frameborder="0"
      allow="autoplay; encrypted-media; fullscreen"
      allowfullscreen
      loading="lazy"
      class="wb-youtube-player__iframe"
    />
    <div v-else class="wb-youtube-player__error">
      <svg width="32" height="32" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="2" y="4" width="16" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
        <path d="M8 8l5 3-5 3V8z" fill="currentColor"/>
      </svg>
      <span>{{ t('winterboard.youtube.invalidUrl') }}</span>
    </div>
    <!-- Title bar -->
    <div v-if="obj.title" class="wb-youtube-player__title">
      {{ obj.title }}
    </div>
  </div>
</template>

<script setup lang="ts">
// YouTubePlayerObject — renders YouTube embed iframe on the board
// Ref: DAY2_AGENT_B.md B3.1
// Zone: AGENT-B (components/board/objects/YouTubePlayerObject.vue)

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { parseYouTubeVideoId, getYouTubeEmbedUrl } from '../../../utils/youtubeParser'

// ─── Types ──────────────────────────────────────────────────────────────────
// WBAsset.type='youtube_player' will be added by Agent A in Day 3.
// Until then, use a local interface extension.

export interface WBYouTubeAsset {
  id: string
  type: 'youtube_player'
  src: string
  youtubeUrl: string
  x: number
  y: number
  w: number
  h: number
  title?: string
  locked?: boolean
  lockedBy?: string
  zIndex?: number
}

const props = defineProps<{
  obj: WBYouTubeAsset
  isTutor: boolean
}>()

const { t } = useI18n({ useScope: 'global' })

// ─── Computed ───────────────────────────────────────────────────────────────

const videoId = computed(() => parseYouTubeVideoId(props.obj.youtubeUrl))
const embedUrl = computed(() => videoId.value ? getYouTubeEmbedUrl(videoId.value) : '')
</script>

<style scoped>
.wb-youtube-player {
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.wb-youtube-player__iframe {
  border: none;
  flex: 1;
}

.wb-youtube-player__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  color: #94a3b8;
  font-size: 13px;
  background: #1e293b;
}

.wb-youtube-player__title {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
</style>
