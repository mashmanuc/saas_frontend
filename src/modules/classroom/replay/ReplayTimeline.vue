<template>
  <div class="replay-timeline relative h-16 bg-gray-900 rounded-lg overflow-hidden">
    <!-- Background grid -->
    <div class="absolute inset-0 grid-pattern opacity-20" />

    <!-- Event density visualization -->
    <div class="absolute inset-0 flex items-end">
      <div
        v-for="(bucket, i) in buckets"
        :key="i"
        class="flex-1 bg-primary-600 opacity-50 transition-all"
        :style="{ height: `${bucket.density * 100}%` }"
      />
    </div>

    <!-- Markers -->
    <ReplayMarkers
      :markers="markers"
      :duration="duration"
      @click="handleMarkerClick"
    />

    <!-- Playhead -->
    <div
      class="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
      :style="{ left: `${progress}%` }"
    >
      <div class="absolute -top-1 -left-1.5 w-3 h-3 bg-white rounded-full" />
    </div>

    <!-- Click to seek -->
    <div
      class="absolute inset-0 cursor-pointer z-10"
      @click="handleClick"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ReplayMarkers from './ReplayMarkers.vue'
import type { ReplayEvent } from './ReplayEngine'

interface Props {
  currentTimeMs: number
  duration: number
  events: ReplayEvent[]
  snapshots: { version: number; t: number }[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'seek', timeMs: number): void
}>()

const progress = computed(() =>
  props.duration > 0 ? (props.currentTimeMs / props.duration) * 100 : 0
)

// Create density buckets for visualization
const buckets = computed(() => {
  const numBuckets = 100
  if (props.duration === 0) return Array(numBuckets).fill({ density: 0 })

  const bucketSize = props.duration / numBuckets
  const result = Array(numBuckets).fill(0)

  for (const event of props.events) {
    const bucketIndex = Math.min(
      Math.floor(event.t / bucketSize),
      numBuckets - 1
    )
    result[bucketIndex]++
  }

  const maxCount = Math.max(...result, 1)
  return result.map((count) => ({ density: count / maxCount }))
})

// Create markers for important events
const markers = computed(() => {
  const result: { t: number; type: string; label: string }[] = []

  // Add snapshot markers
  for (const snapshot of props.snapshots) {
    result.push({
      t: snapshot.t,
      type: 'snapshot',
      label: `v${snapshot.version}`,
    })
  }

  // Add join/leave markers
  for (const event of props.events) {
    if (event.type === 'participant_join') {
      result.push({
        t: event.t,
        type: 'participant_join',
        label: 'Приєднався',
      })
    } else if (event.type === 'participant_leave') {
      result.push({
        t: event.t,
        type: 'participant_leave',
        label: 'Вийшов',
      })
    } else if (event.type === 'session_start') {
      result.push({
        t: event.t,
        type: 'session_start',
        label: 'Старт',
      })
    } else if (event.type === 'session_end') {
      result.push({
        t: event.t,
        type: 'session_end',
        label: 'Кінець',
      })
    }
  }

  return result
})

function handleClick(e: MouseEvent): void {
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  const timeMs = percent * props.duration
  emit('seek', timeMs)
}

function handleMarkerClick(marker: { t: number }): void {
  emit('seek', marker.t)
}
</script>

<style scoped>
.grid-pattern {
  background-image: linear-gradient(
    to right,
    rgba(255, 255, 255, 0.1) 1px,
    transparent 1px
  );
  background-size: 10% 100%;
}
</style>
