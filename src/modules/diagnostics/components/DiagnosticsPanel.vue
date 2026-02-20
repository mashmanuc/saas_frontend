<template>
  <Teleport to="body">
    <Transition name="slide">
      <div
        v-if="isPanelOpen"
        class="diagnostics-panel fixed bottom-0 right-0 w-96 h-[60vh] bg-gray-900 border-l border-t border-gray-700 shadow-2xl z-[9999] flex flex-col"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
          <div class="flex items-center gap-2">
            <Bug class="w-5 h-5 text-primary-400" />
            <span class="font-semibold text-white">Diagnostics</span>
            <span class="text-xs text-gray-400">({{ logCounts.total }})</span>
          </div>

          <div class="flex items-center gap-2">
            <!-- Severity badges -->
            <span
              v-if="logCounts.error > 0"
              class="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full"
            >
              {{ logCounts.error }}
            </span>
            <span
              v-if="logCounts.warning > 0"
              class="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full"
            >
              {{ logCounts.warning }}
            </span>

            <!-- Actions -->
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              class="text-gray-400 hover:text-white"
              title="Clear logs"
              @click="clearLogs"
            >
              <Trash2 class="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              class="text-gray-400 hover:text-white"
              title="Close"
              @click="closePanel"
            >
              <X class="w-4 h-4" />
            </Button>
          </div>
        </div>

        <!-- Filters -->
        <div class="flex items-center gap-2 p-2 border-b border-gray-700 bg-gray-850">
          <select
            :value="filters.severity"
            class="input-sm bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1"
            @change="handleSeverityChange"
          >
            <option value="">All severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          <select
            :value="filters.service"
            class="input-sm bg-gray-800 text-white text-xs border border-gray-600 rounded px-2 py-1"
            @change="handleServiceChange"
          >
            <option value="">All services</option>
            <option value="webrtc">WebRTC</option>
            <option value="board">Board</option>
            <option value="classroom">Classroom</option>
          </select>
        </div>

        <!-- Logs list -->
        <div class="flex-1 overflow-y-auto">
          <div v-if="filteredLogs.length === 0" class="p-4 text-center text-gray-500">
            No logs yet
          </div>

          <LogItem
            v-for="log in filteredLogs"
            :key="log.id"
            :log="log"
          />
        </div>

        <!-- Summary -->
        <div class="p-2 border-t border-gray-700 bg-gray-800 text-xs text-gray-400">
          <div class="flex justify-between">
            <span>WebRTC: {{ webrtcErrorCount }}</span>
            <span>Board: {{ boardErrorCount }}</span>
            <span>WS: {{ wsErrorCount }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { Bug, Trash2, X } from 'lucide-vue-next'
import { useDiagnostics } from '../composables/useDiagnostics'
import LogItem from './LogItem.vue'
import Button from '@/ui/Button.vue'

const {
  filteredLogs,
  logCounts,
  isPanelOpen,
  filters,
  clearLogs,
  closePanel,
  togglePanel,
  setFilter,
} = useDiagnostics()

// Service-specific counts
const webrtcErrorCount = computed(() =>
  filteredLogs.value.filter((l) => (l.context?.service as string | undefined)?.includes('webrtc')).length
)
const boardErrorCount = computed(() =>
  filteredLogs.value.filter((l) => (l.context?.service as string | undefined)?.includes('board')).length
)
const wsErrorCount = computed(() =>
  filteredLogs.value.filter((l) => l.message?.includes('WebSocket')).length
)

function handleSeverityChange(e: Event): void {
  const target = e.target as HTMLSelectElement
  setFilter('severity', target.value || null)
}

function handleServiceChange(e: Event): void {
  const target = e.target as HTMLSelectElement
  setFilter('service', target.value || null)
}

// Keyboard shortcut: Ctrl+Shift+D
function handleKeydown(e: KeyboardEvent): void {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault()
    togglePanel()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.bg-gray-850 {
  background-color: #1f2937;
}
</style>
