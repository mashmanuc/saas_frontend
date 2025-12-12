<script setup lang="ts">
import { computed } from 'vue'
import { Cloud, CloudOff, Check, Loader2, AlertCircle } from 'lucide-vue-next'
import type { SyncStatus } from '@/core/board/types'

interface Props {
  syncStatus: SyncStatus
  isOffline: boolean
  zoom: number
  selectionCount: number
}

const props = defineProps<Props>()

const statusIcon = computed(() => {
  if (props.isOffline) return CloudOff
  switch (props.syncStatus) {
    case 'synced':
      return Check
    case 'syncing':
      return Loader2
    case 'pending':
      return Cloud
    case 'error':
      return AlertCircle
    default:
      return Cloud
  }
})

const statusText = computed(() => {
  if (props.isOffline) return 'Offline'
  switch (props.syncStatus) {
    case 'synced':
      return 'Saved'
    case 'syncing':
      return 'Saving...'
    case 'pending':
      return 'Pending'
    case 'error':
      return 'Error'
    default:
      return ''
  }
})

const statusClass = computed(() => {
  if (props.isOffline) return 'offline'
  return props.syncStatus
})
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <div class="sync-status" :class="statusClass">
        <component
          :is="statusIcon"
          :size="14"
          :class="{ spinning: syncStatus === 'syncing' }"
        />
        <span>{{ statusText }}</span>
      </div>
    </div>

    <div class="status-center">
      <span v-if="selectionCount > 0" class="selection-info">
        {{ selectionCount }} object{{ selectionCount > 1 ? 's' : '' }} selected
      </span>
    </div>

    <div class="status-right">
      <span class="zoom-info">{{ Math.round(zoom * 100) }}%</span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 1rem;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  font-size: 0.75rem;
  color: #666;
}

.status-left,
.status-center,
.status-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-center {
  flex: 1;
  justify-content: center;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.sync-status.synced {
  color: #22c55e;
}

.sync-status.syncing {
  color: #3b82f6;
}

.sync-status.pending {
  color: #f59e0b;
}

.sync-status.error {
  color: #ef4444;
}

.sync-status.offline {
  color: #6b7280;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.selection-info {
  color: #3b82f6;
}

.zoom-info {
  font-weight: 500;
}
</style>
