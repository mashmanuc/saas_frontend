<template>
  <div class="lesson-summary min-h-screen bg-gray-900 py-8">
    <div class="max-w-6xl mx-auto px-4">
      <!-- Header -->
      <div class="mb-8">
        <router-link
          to="/dashboard"
          class="text-primary-400 hover:text-primary-300 flex items-center gap-2 mb-4"
        >
          <ArrowLeft class="w-4 h-4" />
          Назад до панелі
        </router-link>

        <h1 class="text-3xl font-bold text-white">Підсумок уроку</h1>
        <p v-if="summary" class="text-gray-400 mt-2">
          {{ formatDate(summary.session.started_at) }}
        </p>
      </div>

      <!-- Loading -->
      <div v-if="isLoading" class="flex justify-center py-12">
        <Loader2 class="w-8 h-8 text-primary-500 animate-spin" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-center py-12">
        <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p class="text-gray-400">{{ error }}</p>
        <button class="btn btn-primary mt-4" @click="loadSummary">
          Спробувати знову
        </button>
      </div>

      <template v-else-if="summary">
        <!-- Stats Grid -->
        <div class="mb-8">
          <SummaryStats :stats="summary.stats" :session="summary.session" />
        </div>

        <!-- Main Content -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Left: Participants -->
          <div class="lg:col-span-1">
            <SummaryParticipants :participants="summary.participants" />
          </div>

          <!-- Right: Snapshots & Actions -->
          <div class="lg:col-span-2 space-y-8">
            <!-- Replay Button -->
            <div class="bg-gray-800 rounded-xl p-6">
              <h3 class="text-lg font-semibold text-white mb-4">
                Переглянути запис
              </h3>
              <p class="text-gray-400 mb-4">
                Перегляньте весь урок, щоб повторити пройдений матеріал.
              </p>
              <router-link
                :to="`/classroom/${sessionId}/replay`"
                class="btn btn-primary inline-flex items-center"
              >
                <Play class="w-5 h-5 mr-2" />
                Переглянути запис
              </router-link>
            </div>

            <!-- Snapshots -->
            <SummarySnapshots
              :snapshots="summary.snapshots"
              :session-id="sessionId"
              @select="handleSnapshotSelect"
            />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Loader2, Play, AlertCircle } from 'lucide-vue-next'
import { classroomApi, type SessionSummaryResponse, type SnapshotResponse } from '../api/classroom'
import SummaryStats from './SummaryStats.vue'
import SummaryParticipants from './SummaryParticipants.vue'
import SummarySnapshots from './SummarySnapshots.vue'

const route = useRoute()
const router = useRouter()
const sessionId = route.params.sessionId as string

const summary = ref<SessionSummaryResponse | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadSummary(): Promise<void> {
  isLoading.value = true
  error.value = null

  try {
    summary.value = await classroomApi.getSummary(sessionId)
  } catch (err) {
    error.value = 'Не вдалося завантажити підсумок уроку'
    console.error('[LessonSummary] Load failed:', err)
  } finally {
    isLoading.value = false
  }
}

function handleSnapshotSelect(snapshot: SnapshotResponse): void {
  router.push(`/classroom/${sessionId}/history?version=${snapshot.version}`)
}

onMounted(() => {
  loadSummary()
})
</script>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  text-decoration: none;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
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
