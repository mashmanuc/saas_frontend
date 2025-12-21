<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Wifi, WifiOff, AlertCircle } from 'lucide-vue-next'
import { useRealtimeStore } from '@/stores/realtimeStore'

const { t } = useI18n()
const realtime = useRealtimeStore()

const statusIcon = computed(() => {
  switch (realtime.status) {
    case 'connected':
      return Wifi
    case 'connecting':
      return Wifi
    case 'disconnected':
    case 'error':
    case 'offline':
      return WifiOff
    default:
      return AlertCircle
  }
})

const statusColor = computed(() => {
  switch (realtime.status) {
    case 'connected':
      return 'var(--success, #10b981)'
    case 'connecting':
      return 'var(--warning, #f59e0b)'
    case 'disconnected':
    case 'error':
    case 'offline':
      return 'var(--danger, #dc2626)'
    default:
      return 'var(--text-secondary)'
  }
})

const statusText = computed(() => {
  switch (realtime.status) {
    case 'connected':
      return t('classroom.realtime.statusConnected')
    case 'connecting':
      return t('classroom.realtime.statusConnecting')
    case 'disconnected':
      return t('classroom.realtime.statusDisconnected')
    case 'error':
      return t('classroom.realtime.statusError')
    case 'offline':
      return t('classroom.realtime.statusOffline')
    default:
      return t('classroom.realtime.statusDisconnected')
  }
})

const showWidget = computed(() => {
  return realtime.status !== 'connected'
})

const lastPingText = computed(() => {
  if (!realtime.lastHeartbeat) return ''
  const now = Date.now()
  const diff = now - realtime.lastHeartbeat
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ago`
})
</script>

<template>
  <Transition name="slide-down">
    <div v-if="showWidget" class="ws-health-widget" :style="{ borderColor: statusColor }">
      <component :is="statusIcon" :size="16" :style="{ color: statusColor }" />
      <span class="status-text">{{ statusText }}</span>
      <span v-if="lastPingText" class="ping-text">{{ lastPingText }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.ws-health-widget {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--surface-card);
  border: 2px solid;
  border-radius: var(--radius-md, 8px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  font-size: 0.875rem;
}

.status-text {
  font-weight: 500;
  color: var(--text-primary);
}

.ping-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  transform: translateY(-100%);
  opacity: 0;
}

.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}
</style>
