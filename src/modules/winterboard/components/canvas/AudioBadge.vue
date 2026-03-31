<template>
  <div
    class="wb-audio-badge-icon"
    :class="{
      'wb-audio-badge-icon--playing': state === 'playing',
      'wb-audio-badge-icon--recording': state === 'recording',
      'wb-audio-badge-icon--uploading': state === 'uploading',
    }"
    :title="badgeTitle"
    @click.stop="emit('click')"
  >
    <template v-if="state === 'recording'">
      <span class="wb-audio-badge-icon__dot wb-audio-badge-icon__dot--pulse" />
    </template>
    <template v-else-if="state === 'uploading'">
      ⬆️
    </template>
    <template v-else-if="state === 'playing'">
      🔊
    </template>
    <template v-else>
      🔈
    </template>
  </div>
</template>

<script setup lang="ts">
// WB: AudioBadge — small 24×24 icon on top-right corner of objects with audio.
// Container layer uses pointer-events: none — only this icon is clickable.
// Ref: OBJECT_AUDIO_PLAN.md §5.3

import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface Props {
  audioUrl: string
  isTutor: boolean
  objectId: string
  state: 'idle' | 'recording' | 'playing' | 'uploading'
}

const props = defineProps<Props>()

const emit = defineEmits<{
  click: []
}>()

const { t } = useI18n()

const badgeTitle = computed(() => {
  switch (props.state) {
    case 'recording': return t('winterboard.objectAudio.record')
    case 'uploading': return t('winterboard.objectAudio.uploading')
    case 'playing': return t('winterboard.objectAudio.pause')
    default: return t('winterboard.objectAudio.play')
  }
})
</script>

<style scoped>
.wb-audio-badge-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  pointer-events: auto;
  font-size: 14px;
  transition: transform 0.15s, box-shadow 0.15s;
  user-select: none;
}

.wb-audio-badge-icon:hover {
  transform: scale(1.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.wb-audio-badge-icon--playing {
  background: rgba(59, 130, 246, 0.15);
}

.wb-audio-badge-icon--recording {
  background: rgba(239, 68, 68, 0.15);
}

.wb-audio-badge-icon--uploading {
  background: rgba(59, 130, 246, 0.1);
}

/* Recording pulse dot */
.wb-audio-badge-icon__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
}

.wb-audio-badge-icon__dot--pulse {
  animation: badge-pulse 1s ease-in-out infinite;
}

@keyframes badge-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}
</style>
