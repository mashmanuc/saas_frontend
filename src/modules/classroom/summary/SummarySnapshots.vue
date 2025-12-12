<template>
  <div class="summary-snapshots bg-gray-800 rounded-xl p-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-white">Знімки дошки</h3>
      <span class="text-sm text-gray-400">{{ snapshots.length }} знімків</span>
    </div>

    <!-- Snapshot Grid -->
    <div v-if="snapshots.length > 0" class="grid grid-cols-2 md:grid-cols-3 gap-4">
      <div
        v-for="snapshot in snapshots"
        :key="snapshot.version"
        class="snapshot-card rounded-lg overflow-hidden border border-gray-700 hover:border-gray-500 transition-colors cursor-pointer"
        @click="$emit('select', snapshot)"
      >
        <!-- Thumbnail -->
        <div class="aspect-video bg-gray-900 relative">
          <img
            v-if="snapshot.thumbnail_url"
            :src="snapshot.thumbnail_url"
            :alt="`Версія ${snapshot.version}`"
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <FileImage class="w-8 h-8 text-gray-600" />
          </div>

          <!-- Type badge -->
          <span
            :class="[
              'absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium',
              snapshot.snapshot_type === 'manual'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-600 text-gray-200'
            ]"
          >
            {{ snapshot.snapshot_type === 'manual' ? 'Ручний' : 'Авто' }}
          </span>
        </div>

        <!-- Info -->
        <div class="p-3">
          <div class="text-sm font-medium text-white">
            Версія {{ snapshot.version }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            {{ formatDate(snapshot.created_at) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-8 text-gray-500">
      <History class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>Немає збережених знімків</p>
    </div>

    <!-- View all link -->
    <div v-if="snapshots.length > 6" class="mt-4 text-center">
      <router-link
        :to="`/classroom/${sessionId}/history`"
        class="text-primary-400 hover:text-primary-300 text-sm"
      >
        Переглянути всі знімки →
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FileImage, History } from 'lucide-vue-next'
import type { SnapshotResponse } from '../api/classroom'

interface Props {
  snapshots: SnapshotResponse[]
  sessionId: string
}

defineProps<Props>()
defineEmits<{
  (e: 'select', snapshot: SnapshotResponse): void
}>()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>
