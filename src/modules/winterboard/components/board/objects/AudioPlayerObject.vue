<template>
  <div
    class="audio-object"
    :style="{ width: obj.w + 'px' }"
  >
    <div class="audio-object__header">
      <span class="audio-object__icon">🎵</span>
      <span class="audio-object__title">{{ obj.title || t('winterboard.audio.untitled') }}</span>
    </div>

    <!-- Tutor: full HTML5 audio controls -->
    <audio
      v-if="isTutor"
      ref="audioEl"
      :src="obj.src"
      controls
      preload="metadata"
      class="audio-object__player"
    />

    <!-- Student: read-only view (Zoom transmits audio) -->
    <div v-else class="audio-object__readonly">
      <span class="audio-object__status">🎵 {{ t('winterboard.audio.listening') }}</span>
      <span v-if="obj.duration" class="audio-object__duration">
        {{ formatDuration(obj.duration) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBAudioAsset } from '../../../types/mediaObjects'

defineProps<{
  obj: WBAudioAsset
  isTutor: boolean
}>()

const { t } = useI18n()
const audioEl = ref<HTMLAudioElement>()

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>

<style scoped>
.audio-object {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  min-width: 240px;
}
.audio-object__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: #f8fafc;
  border-bottom: 1px solid #f1f5f9;
}
.audio-object__icon {
  font-size: 16px;
  flex-shrink: 0;
}
.audio-object__title {
  font-size: 12px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.audio-object__player {
  width: 100%;
  height: 40px;
  display: block;
}
.audio-object__readonly {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  font-size: 12px;
  color: #64748b;
}
.audio-object__duration {
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}
</style>
