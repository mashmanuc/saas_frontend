<template>
  <div class="lesson-replay h-screen flex flex-col bg-gray-900">
    <!-- Header -->
    <header class="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
      <div class="flex items-center gap-4">
        <router-link
          :to="`/classroom/${sessionId}/summary`"
          class="text-gray-400 hover:text-white"
        >
          <ArrowLeft class="w-5 h-5" />
        </router-link>
        <div>
          <h1 class="text-lg font-semibold text-white">Перегляд запису</h1>
          <p class="text-sm text-gray-400">Сесія: {{ sessionId }}</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <router-link
          :to="`/classroom/${sessionId}/history`"
          class="btn btn-secondary"
        >
          <History class="w-4 h-4 mr-2" />
          Історія
        </router-link>
      </div>
    </header>

    <!-- Loading -->
    <div v-if="replayEngine.isLoading.value" class="flex-1 flex items-center justify-center">
      <Loader2 class="w-12 h-12 text-primary-500 animate-spin" />
    </div>

    <!-- Error -->
    <div v-else-if="replayEngine.error.value" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <AlertCircle class="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p class="text-gray-400 mb-4">{{ replayEngine.error.value }}</p>
        <button class="btn btn-primary" @click="loadReplay">
          Спробувати знову
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <template v-else>
      <div class="flex-1 flex">
        <!-- Board Area -->
        <div class="flex-1 relative">
          <div ref="boardContainer" class="absolute inset-0 bg-gray-950">
            <!-- Board will be rendered here -->
            <div class="w-full h-full flex items-center justify-center text-gray-600">
              <Pencil class="w-16 h-16 opacity-30" />
            </div>
          </div>
        </div>

        <!-- Timeline Sidebar -->
        <div class="w-80 border-l border-gray-700">
          <TimelinePanel
            :session-id="sessionId"
            :current-time-ms="replayEngine.currentTimeMs.value"
            @seek="handleSeek"
            @event-select="handleEventSelect"
          />
        </div>
      </div>

      <!-- Replay Timeline -->
      <div class="px-4 py-2 bg-gray-800 border-t border-gray-700">
        <ReplayTimeline
          :current-time-ms="replayEngine.currentTimeMs.value"
          :duration="replayEngine.duration.value"
          :events="replayEngine.events.value"
          :snapshots="replayEngine.snapshots.value"
          @seek="handleSeek"
        />
      </div>

      <!-- Controls -->
      <ReplayControls
        :engine="replayEngine"
        @fullscreen="toggleFullscreen"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, Loader2, AlertCircle, History, Pencil } from 'lucide-vue-next'
import { ReplayEngine } from '../replay/ReplayEngine'
import ReplayControls from '../replay/ReplayControls.vue'
import ReplayTimeline from '../replay/ReplayTimeline.vue'
import TimelinePanel from '../timeline/TimelinePanel.vue'

const route = useRoute()
const sessionId = route.params.sessionId as string

const boardContainer = ref<HTMLElement | null>(null)
const replayEngine = new ReplayEngine(sessionId)

async function loadReplay(): Promise<void> {
  await replayEngine.load()
}

function handleSeek(timeMs: number): void {
  replayEngine.seek(timeMs)
}

function handleEventSelect(event: { timestamp_ms: number }): void {
  replayEngine.seek(event.timestamp_ms)
}

async function toggleFullscreen(): Promise<void> {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else {
      await document.exitFullscreen()
    }
  } catch (error) {
    console.error('[LessonReplay] Fullscreen error:', error)
  }
}

onMounted(() => {
  loadReplay()
})

onUnmounted(() => {
  replayEngine.destroy()
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
  text-decoration: none;
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
