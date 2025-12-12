<template>
  <div class="snapshot-viewer">
    <div class="flex items-center justify-between mb-4">
      <h3 class="text-lg font-semibold text-white">Історія дошки</h3>
      <span class="text-sm text-gray-400">{{ snapshots.length }} версій</span>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-12">
      <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
    </div>

    <!-- Empty state -->
    <div v-else-if="snapshots.length === 0" class="text-center py-12 text-gray-500">
      <History class="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>Немає збережених версій</p>
    </div>

    <!-- Snapshot Grid -->
    <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="snapshot in snapshots"
        :key="snapshot.version"
        :class="[
          'snapshot-card rounded-lg overflow-hidden cursor-pointer transition-all',
          'border-2',
          selectedVersion === snapshot.version
            ? 'border-primary-500'
            : 'border-gray-700 hover:border-gray-500'
        ]"
        @click="selectSnapshot(snapshot)"
      >
        <!-- Thumbnail -->
        <div class="aspect-video bg-gray-800 relative">
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
        <div class="p-3 bg-gray-800">
          <div class="text-sm font-medium text-white">
            Версія {{ snapshot.version }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            {{ formatDate(snapshot.created_at) }}
          </div>
          <div class="text-xs text-gray-500">
            {{ formatSize(snapshot.size_bytes) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Selected Snapshot Actions -->
    <div v-if="selectedSnapshot" class="mt-6 p-4 bg-gray-800 rounded-lg">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h4 class="font-medium text-white">
            Версія {{ selectedSnapshot.version }}
          </h4>
          <p class="text-sm text-gray-400">
            Створено: {{ selectedSnapshot.created_by?.name || 'Система' }}
          </p>
        </div>

        <div class="flex gap-2 flex-wrap">
          <button
            class="btn btn-secondary"
            @click="$emit('compare', selectedSnapshot)"
          >
            <GitCompare class="w-4 h-4 mr-2" />
            Порівняти
          </button>
          <SnapshotExport
            :session-id="sessionId"
            :version="selectedSnapshot.version"
          />
          <button
            v-if="canRestore"
            class="btn btn-primary"
            @click="$emit('restore', selectedSnapshot.version)"
          >
            <RotateCcw class="w-4 h-4 mr-2" />
            Відновити
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FileImage, GitCompare, RotateCcw, Loader2, History } from 'lucide-vue-next'
import { classroomApi } from '../api/classroom'
import SnapshotExport from './SnapshotExport.vue'

interface Props {
  sessionId: string
  canRestore?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canRestore: false,
})

const emit = defineEmits<{
  (e: 'select', snapshot: Snapshot): void
  (e: 'compare', snapshot: Snapshot): void
  (e: 'restore', version: number): void
}>()

interface Snapshot {
  version: number
  snapshot_type: string
  created_at: string
  created_by: { id: number; name: string } | null
  size_bytes: number
  thumbnail_url: string | null
}

const snapshots = ref<Snapshot[]>([])
const selectedVersion = ref<number | null>(null)
const isLoading = ref(true)

const selectedSnapshot = computed(() =>
  snapshots.value.find((s) => s.version === selectedVersion.value)
)

function selectSnapshot(snapshot: Snapshot): void {
  selectedVersion.value = snapshot.version
  emit('select', snapshot)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('uk-UA')
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

onMounted(async () => {
  try {
    const response = await classroomApi.getSnapshots(props.sessionId)
    snapshots.value = response.snapshots
  } catch (error) {
    console.error('[SnapshotViewer] Failed to load snapshots:', error)
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
}

.btn-secondary {
  background: var(--color-bg-secondary, #374151);
  color: white;
}

.btn-secondary:hover {
  background: var(--color-bg-tertiary, #4b5563);
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
