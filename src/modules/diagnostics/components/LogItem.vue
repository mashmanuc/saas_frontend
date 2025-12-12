<template>
  <div
    :class="[
      'log-item p-2 border-b border-gray-800 hover:bg-gray-800 cursor-pointer',
      isExpanded && 'bg-gray-800'
    ]"
    @click="isExpanded = !isExpanded"
  >
    <!-- Header -->
    <div class="flex items-start gap-2">
      <!-- Severity icon -->
      <component
        :is="severityIcon"
        :class="['w-4 h-4 mt-0.5 flex-shrink-0', severityColor]"
      />

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="text-sm text-white truncate">
          {{ log.message }}
        </div>
        <div class="text-xs text-gray-500 mt-0.5">
          {{ formatTime(log.timestamp) }}
          <span v-if="log.context?.service" class="ml-2 text-gray-600">
            {{ log.context.service }}
          </span>
        </div>
      </div>

      <!-- Expand icon -->
      <ChevronDown
        :class="[
          'w-4 h-4 text-gray-500 transition-transform',
          isExpanded && 'rotate-180'
        ]"
      />
    </div>

    <!-- Expanded content -->
    <div v-if="isExpanded" class="mt-2 pl-6">
      <!-- Stack trace -->
      <div v-if="log.stack" class="mb-2">
        <div class="text-xs text-gray-500 mb-1">Stack:</div>
        <pre class="text-xs text-gray-400 bg-gray-900 p-2 rounded overflow-x-auto max-h-32">{{ log.stack }}</pre>
      </div>

      <!-- Context -->
      <div v-if="log.context && Object.keys(log.context).length > 0">
        <div class="text-xs text-gray-500 mb-1">Context:</div>
        <pre class="text-xs text-gray-400 bg-gray-900 p-2 rounded overflow-x-auto max-h-32">{{ JSON.stringify(log.context, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { AlertCircle, AlertTriangle, Info, ChevronDown } from 'lucide-vue-next'
import type { LocalLogEntry } from '../types'

interface Props {
  log: LocalLogEntry
}

const props = defineProps<Props>()
const isExpanded = ref(false)

const severityIcon = computed(() => {
  switch (props.log.severity) {
    case 'error':
      return AlertCircle
    case 'warning':
      return AlertTriangle
    default:
      return Info
  }
})

const severityColor = computed(() => {
  switch (props.log.severity) {
    case 'error':
      return 'text-red-500'
    case 'warning':
      return 'text-yellow-500'
    default:
      return 'text-blue-500'
  }
})

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString()
}
</script>
