<template>
  <div class="media-controls">
    <button
      class="media-btn"
      :class="{ 'media-btn--off': !audioEnabled }"
      :title="audioEnabled ? 'Mute' : 'Unmute'"
      @click="$emit('toggle-audio')"
    >
      {{ audioEnabled ? '🎤' : '🔇' }}
    </button>
    <button
      class="media-btn"
      :class="{ 'media-btn--off': !videoEnabled }"
      :title="videoEnabled ? 'Stop Video' : 'Start Video'"
      @click="$emit('toggle-video')"
    >
      {{ videoEnabled ? '📹' : '📷' }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  videoEnabled: boolean
  audioEnabled: boolean
}>()

defineEmits<{
  'toggle-video': []
  'toggle-audio': []
}>()
</script>
