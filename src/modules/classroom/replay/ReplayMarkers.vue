<template>
  <div class="replay-markers absolute inset-0 pointer-events-none">
    <div
      v-for="(marker, i) in markers"
      :key="i"
      class="absolute top-0 bottom-0 pointer-events-auto cursor-pointer group"
      :style="{ left: `${(marker.t / duration) * 100}%` }"
      @click="$emit('click', marker)"
    >
      <!-- Marker line -->
      <div :class="['w-0.5 h-full', markerColor(marker.type)]" />

      <!-- Marker icon -->
      <div
        :class="[
          'absolute top-1 -left-2 w-4 h-4 rounded-full flex items-center justify-center',
          markerBg(marker.type)
        ]"
      >
        <component :is="markerIcon(marker.type)" class="w-2.5 h-2.5 text-white" />
      </div>

      <!-- Tooltip -->
      <div
        class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-30"
      >
        <div class="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
          {{ marker.label }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Save, UserPlus, UserMinus, Play, Square, Camera } from 'lucide-vue-next'

interface Marker {
  t: number
  type: string
  label: string
}

interface Props {
  markers: Marker[]
  duration: number
}

defineProps<Props>()
defineEmits<{
  (e: 'click', marker: Marker): void
}>()

function markerColor(type: string): string {
  switch (type) {
    case 'snapshot':
      return 'bg-blue-500'
    case 'participant_join':
      return 'bg-green-500'
    case 'participant_leave':
      return 'bg-red-500'
    case 'session_start':
      return 'bg-green-500'
    case 'session_end':
      return 'bg-red-500'
    default:
      return 'bg-gray-500'
  }
}

function markerBg(type: string): string {
  switch (type) {
    case 'snapshot':
      return 'bg-blue-600'
    case 'participant_join':
      return 'bg-green-600'
    case 'participant_leave':
      return 'bg-red-600'
    case 'session_start':
      return 'bg-green-600'
    case 'session_end':
      return 'bg-red-600'
    default:
      return 'bg-gray-600'
  }
}

function markerIcon(type: string) {
  switch (type) {
    case 'snapshot':
      return Save
    case 'participant_join':
      return UserPlus
    case 'participant_leave':
      return UserMinus
    case 'session_start':
      return Play
    case 'session_end':
      return Square
    default:
      return Camera
  }
}
</script>
