<template>
  <div class="solo-video-preview" v-if="stream || showPlaceholder">
    <video
      v-if="stream"
      ref="videoRef"
      autoplay
      muted
      playsinline
    />
    <div v-else class="solo-video-preview__placeholder">
      <span>📷</span>
    </div>
    <div class="solo-video-preview__controls">
      <MediaControls
        :video-enabled="videoEnabled"
        :audio-enabled="audioEnabled"
        @toggle-video="$emit('toggle-video')"
        @toggle-audio="$emit('toggle-audio')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import MediaControls from './MediaControls.vue'

const props = defineProps<{
  stream: MediaStream | null
  videoEnabled: boolean
  audioEnabled: boolean
  showPlaceholder?: boolean
}>()

defineEmits<{
  'toggle-video': []
  'toggle-audio': []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)

watch(
  () => props.stream,
  (newStream) => {
    if (videoRef.value && newStream) {
      videoRef.value.srcObject = newStream
    }
  }
)

onMounted(() => {
  if (videoRef.value && props.stream) {
    videoRef.value.srcObject = props.stream
  }
})
</script>

<style scoped>
.solo-video-preview__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--solo-video-bg);
  color: var(--solo-text-muted);
  font-size: 2rem;
}
</style>
