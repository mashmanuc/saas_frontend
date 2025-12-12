<template>
  <div class="summary-participants bg-gray-800 rounded-xl p-6">
    <h3 class="text-lg font-semibold text-white mb-4">Учасники</h3>

    <div class="space-y-4">
      <div
        v-for="participant in participants"
        :key="participant.id"
        class="flex items-center gap-4 p-3 bg-gray-700/50 rounded-lg"
      >
        <!-- Avatar -->
        <div
          :class="[
            'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
            participant.role === 'host' ? 'bg-primary-600' : 'bg-gray-600'
          ]"
        >
          {{ getInitials(participant.name) }}
        </div>

        <!-- Info -->
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="font-medium text-white">{{ participant.name }}</span>
            <span
              v-if="participant.role === 'host'"
              class="px-2 py-0.5 bg-primary-600/20 text-primary-400 text-xs rounded"
            >
              Ведучий
            </span>
          </div>
          <div class="text-sm text-gray-400 mt-0.5">
            {{ formatTime(participant.joined_at) }}
            <span v-if="participant.left_at">
              — {{ formatTime(participant.left_at) }}
            </span>
          </div>
        </div>

        <!-- Duration -->
        <div class="text-right">
          <div class="text-sm text-gray-400">Час участі</div>
          <div class="font-medium text-white">
            {{ formatDuration(participant.duration_ms) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="participants.length === 0" class="text-center py-8 text-gray-500">
      <Users class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>Немає даних про учасників</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Users } from 'lucide-vue-next'

interface Participant {
  id: number
  name: string
  role: string
  joined_at: string
  left_at: string | null
  duration_ms: number
}

interface Props {
  participants: Participant[]
}

defineProps<Props>()

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
</script>
