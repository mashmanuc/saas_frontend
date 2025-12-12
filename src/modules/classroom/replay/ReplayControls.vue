<template>
  <div class="replay-controls bg-gray-800 rounded-lg p-4">
    <div class="flex items-center gap-4">
      <!-- Skip backward -->
      <button
        class="p-2 text-gray-400 hover:text-white transition-colors"
        title="Назад 10 сек"
        @click="engine.skipBackward(10)"
      >
        <SkipBack class="w-5 h-5" />
      </button>

      <!-- Play/Pause -->
      <button
        class="w-12 h-12 rounded-full bg-primary-600 hover:bg-primary-500 flex items-center justify-center transition-colors"
        @click="engine.toggle()"
      >
        <Pause v-if="isPlaying" class="w-6 h-6 text-white" />
        <Play v-else class="w-6 h-6 text-white ml-1" />
      </button>

      <!-- Skip forward -->
      <button
        class="p-2 text-gray-400 hover:text-white transition-colors"
        title="Вперед 10 сек"
        @click="engine.skipForward(10)"
      >
        <SkipForward class="w-5 h-5" />
      </button>

      <!-- Time display -->
      <div class="text-white font-mono text-sm min-w-[100px]">
        {{ formatTime(currentTimeMs) }} / {{ formatTime(duration) }}
      </div>

      <!-- Progress bar -->
      <div class="flex-1 relative">
        <input
          type="range"
          :value="currentTimeMs"
          :max="duration"
          class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
          @input="handleSeek"
        />
      </div>

      <!-- Speed selector -->
      <select
        :value="speed"
        class="input w-20 text-sm"
        @change="handleSpeedChange"
      >
        <option value="0.25">0.25x</option>
        <option value="0.5">0.5x</option>
        <option value="1">1x</option>
        <option value="1.5">1.5x</option>
        <option value="2">2x</option>
        <option value="4">4x</option>
      </select>

      <!-- Fullscreen -->
      <button
        class="p-2 text-gray-400 hover:text-white transition-colors"
        title="Повноекранний режим"
        @click="$emit('fullscreen')"
      >
        <Maximize class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Play, Pause, SkipBack, SkipForward, Maximize } from 'lucide-vue-next'
import type { ReplayEngine } from './ReplayEngine'

interface Props {
  engine: ReplayEngine
}

const props = defineProps<Props>()
defineEmits<{
  (e: 'fullscreen'): void
}>()

const isPlaying = computed(() => props.engine.isPlaying.value)
const currentTimeMs = computed(() => props.engine.currentTimeMs.value)
const duration = computed(() => props.engine.duration.value)
const speed = computed(() => props.engine.speed.value)

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function handleSeek(e: Event): void {
  const target = e.target as HTMLInputElement
  props.engine.seek(parseInt(target.value))
}

function handleSpeedChange(e: Event): void {
  const target = e.target as HTMLSelectElement
  props.engine.setSpeed(parseFloat(target.value))
}
</script>

<style scoped>
.input {
  background: var(--color-bg-secondary, #374151);
  border: 1px solid var(--color-border, #4b5563);
  border-radius: 8px;
  padding: 6px 10px;
  color: white;
}

.slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-primary, #3b82f6);
  cursor: pointer;
}

.slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-primary, #3b82f6);
  cursor: pointer;
  border: none;
}
</style>
