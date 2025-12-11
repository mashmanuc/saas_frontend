<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { MicOff } from 'lucide-vue-next'

interface Props {
  stream: MediaStream | null
  muted: boolean
  videoOff: boolean
  label: string
  main?: boolean
  local?: boolean
  quality?: 'excellent' | 'good' | 'fair' | 'poor'
}

const props = withDefaults(defineProps<Props>(), {
  main: false,
  local: false,
  quality: undefined,
})

const videoEl = ref<HTMLVideoElement | null>(null)

watch(
  () => props.stream,
  (stream) => {
    if (videoEl.value && stream) {
      videoEl.value.srcObject = stream
    }
  },
  { immediate: true }
)

onMounted(() => {
  if (videoEl.value && props.stream) {
    videoEl.value.srcObject = props.stream
  }
})

const qualityColor: Record<string, string> = {
  excellent: '#22c55e',
  good: '#84cc16',
  fair: '#eab308',
  poor: '#ef4444',
}
</script>

<template>
  <div
    class="video-tile"
    :class="{ main, local, 'video-off': videoOff }"
  >
    <video
      ref="videoEl"
      :muted="local"
      autoplay
      playsinline
    />

    <div v-if="videoOff" class="video-off-overlay">
      <div class="avatar">{{ label.charAt(0).toUpperCase() }}</div>
    </div>

    <div class="video-label">
      <span>{{ label }}</span>
      <MicOff v-if="muted" class="muted-icon" :size="16" />
    </div>

    <div
      v-if="main && quality"
      class="quality-indicator"
      :style="{ backgroundColor: qualityColor[quality] }"
    />
  </div>
</template>

<style scoped>
.video-tile {
  position: relative;
  background: #16213e;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-tile.main {
  grid-column: 1;
}

.video-tile.local {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  width: 200px;
  height: 150px;
  z-index: 10;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

@media (min-width: 768px) {
  .video-tile.local {
    position: relative;
    bottom: auto;
    right: auto;
    width: auto;
    height: auto;
    border: none;
  }
}

.video-tile video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-off-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0f3460;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #e94560;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 600;
  color: white;
}

.video-label {
  position: absolute;
  bottom: 0.5rem;
  left: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 4px;
  color: white;
  font-size: 0.875rem;
}

.muted-icon {
  color: #ef4444;
}

.quality-indicator {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
</style>
