<template>
  <div class="summary-stats grid grid-cols-2 md:grid-cols-4 gap-4">
    <!-- Duration -->
    <div class="stat-card bg-gray-800 rounded-xl p-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
          <Clock class="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <p class="text-sm text-gray-400">Тривалість</p>
          <p class="text-xl font-semibold text-white">{{ formatDuration(session.duration_ms) }}</p>
        </div>
      </div>
    </div>

    <!-- Events -->
    <div class="stat-card bg-gray-800 rounded-xl p-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
          <Activity class="w-5 h-5 text-green-400" />
        </div>
        <div>
          <p class="text-sm text-gray-400">Подій</p>
          <p class="text-xl font-semibold text-white">{{ stats.total_events }}</p>
        </div>
      </div>
    </div>

    <!-- Board Events -->
    <div class="stat-card bg-gray-800 rounded-xl p-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center">
          <Pencil class="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <p class="text-sm text-gray-400">Дії на дошці</p>
          <p class="text-xl font-semibold text-white">{{ stats.board_events }}</p>
        </div>
      </div>
    </div>

    <!-- Snapshots -->
    <div class="stat-card bg-gray-800 rounded-xl p-4">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center">
          <Save class="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <p class="text-sm text-gray-400">Знімків</p>
          <p class="text-xl font-semibold text-white">{{ stats.snapshot_count }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Clock, Activity, Pencil, Save } from 'lucide-vue-next'

interface Props {
  stats: {
    total_events: number
    board_events: number
    participant_count: number
    snapshot_count: number
  }
  session: {
    duration_ms: number
  }
}

defineProps<Props>()

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
</script>
