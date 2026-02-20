<template>
  <div class="lesson-history min-h-screen bg-gray-900 py-8">
    <div class="max-w-6xl mx-auto px-4">
      <!-- Header -->
      <div class="mb-8">
        <router-link
          :to="`/classroom/${sessionId}/summary`"
          class="text-primary-400 hover:text-primary-300 flex items-center gap-2 mb-4"
        >
          <ArrowLeft class="w-4 h-4" />
          Назад до підсумку
        </router-link>

        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white">Історія дошки</h1>
            <p class="text-gray-400 mt-2">Сесія: {{ sessionId }}</p>
          </div>

          <div class="flex gap-2">
            <button
              :class="[
                'btn',
                viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'
              ]"
              @click="viewMode = 'grid'"
            >
              <Grid class="w-4 h-4" />
            </button>
            <button
              :class="[
                'btn',
                viewMode === 'compare' ? 'btn-primary' : 'btn-secondary'
              ]"
              @click="viewMode = 'compare'"
            >
              <GitCompare class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Grid View -->
      <div v-if="viewMode === 'grid'">
        <SnapshotViewer
          :session-id="sessionId"
          :can-restore="false"
          @select="handleSnapshotSelect"
          @compare="handleCompare"
        />
      </div>

      <!-- Compare View -->
      <div v-else-if="viewMode === 'compare' && snapshots.length >= 2">
        <SnapshotDiff
          :session-id="sessionId"
          :snapshots="snapshots"
          :initial-version-a="selectedVersionA"
          :initial-version-b="selectedVersionB"
        />
      </div>

      <!-- Not enough snapshots for compare -->
      <div v-else-if="viewMode === 'compare'" class="text-center py-12 text-gray-500">
        <GitCompare class="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Потрібно мінімум 2 знімки для порівняння</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Grid, GitCompare } from 'lucide-vue-next'
import { classroomApi, type SnapshotResponse } from '../api/classroom'
import SnapshotViewer from '../history/SnapshotViewer.vue'
import SnapshotDiff from '../history/SnapshotDiff.vue'

const route = useRoute()
const sessionId = route.params.sessionId as string

const viewMode = ref<'grid' | 'compare'>('grid')
const snapshots = ref<SnapshotResponse[]>([])
const selectedVersionA = ref<number | undefined>(undefined)
const selectedVersionB = ref<number | undefined>(undefined)

function handleSnapshotSelect(snapshot: SnapshotResponse): void {
  console.log('[LessonHistory] Selected snapshot:', snapshot.version)
}

function handleCompare(snapshot: SnapshotResponse): void {
  viewMode.value = 'compare'
  selectedVersionA.value = snapshot.version

  // Find next version for comparison
  const currentIndex = snapshots.value.findIndex((s) => s.version === snapshot.version)
  if (currentIndex < snapshots.value.length - 1) {
    selectedVersionB.value = snapshots.value[currentIndex + 1].version
  } else if (currentIndex > 0) {
    selectedVersionB.value = snapshots.value[currentIndex - 1].version
  }
}

onMounted(async () => {
  try {
    const response = await classroomApi.getSnapshots(sessionId)
    snapshots.value = response.snapshots

    // Set initial versions from query params
    const versionParam = route.query.version
    if (versionParam) {
      selectedVersionA.value = parseInt(versionParam as string)
    }
  } catch (error) {
    console.error('[LessonHistory] Failed to load snapshots:', error)
  }
})
</script>

<style scoped>
/* Button styles provided by @/ui/Button.vue scoped CSS */
</style>
