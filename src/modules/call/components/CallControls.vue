<script setup lang="ts">
import { Mic, MicOff, Video, VideoOff, PhoneOff, Settings } from 'lucide-vue-next'

interface Props {
  audioMuted: boolean
  videoMuted: boolean
  quality: '240p' | '480p' | '720p'
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggle-audio'): void
  (e: 'toggle-video'): void
  (e: 'change-quality', quality: '240p' | '480p' | '720p'): void
  (e: 'end-call'): void
}>()

const qualityOptions: Array<{ value: '240p' | '480p' | '720p'; label: string }> = [
  { value: '240p', label: 'Low (240p)' },
  { value: '480p', label: 'Medium (480p)' },
  { value: '720p', label: 'High (720p)' },
]
</script>

<template>
  <div class="call-controls">
    <button
      class="control-btn"
      :class="{ active: !audioMuted }"
      title="Toggle Microphone (M)"
      @click="emit('toggle-audio')"
    >
      <MicOff v-if="audioMuted" :size="24" />
      <Mic v-else :size="24" />
    </button>

    <button
      class="control-btn"
      :class="{ active: !videoMuted }"
      title="Toggle Camera (V)"
      @click="emit('toggle-video')"
    >
      <VideoOff v-if="videoMuted" :size="24" />
      <Video v-else :size="24" />
    </button>

    <div class="quality-selector">
      <button class="control-btn" title="Video Quality">
        <Settings :size="24" />
      </button>
      <div class="quality-dropdown">
        <button
          v-for="opt in qualityOptions"
          :key="opt.value"
          class="quality-option"
          :class="{ selected: quality === opt.value }"
          @click="emit('change-quality', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <button
      class="control-btn danger"
      title="End Call (Esc)"
      @click="emit('end-call')"
    >
      <PhoneOff :size="24" />
    </button>
  </div>
</template>

<style scoped>
.call-controls {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.4);
}

.control-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, transform 0.1s;
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.control-btn:active {
  transform: scale(0.95);
}

.control-btn.active {
  background: #22c55e;
}

.control-btn.danger {
  background: #ef4444;
}

.control-btn.danger:hover {
  background: #dc2626;
}

.quality-selector {
  position: relative;
}

.quality-dropdown {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1a1a2e;
  border-radius: 8px;
  padding: 0.5rem;
  display: none;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 140px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.quality-selector:hover .quality-dropdown {
  display: flex;
}

.quality-option {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  color: white;
  cursor: pointer;
  text-align: left;
  border-radius: 4px;
}

.quality-option:hover {
  background: rgba(255, 255, 255, 0.1);
}

.quality-option.selected {
  background: #e94560;
}
</style>
