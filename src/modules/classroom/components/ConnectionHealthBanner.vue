<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { WifiOff, Wifi, AlertCircle, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  status: 'connected' | 'connecting' | 'disconnected' | 'error'
  offline?: boolean
  wsUrl?: string | null
  lastError?: string | null
}>()

const { t } = useI18n()

const statusColor = computed(() => {
  if (props.offline) return 'var(--danger, #dc2626)'
  switch (props.status) {
    case 'connected':
      return 'var(--success, #16a34a)'
    case 'connecting':
      return 'var(--warning, #f59e0b)'
    case 'error':
      return 'var(--danger, #dc2626)'
    default:
      return 'var(--text-muted, #6b7280)'
  }
})

const statusIcon = computed(() => {
  if (props.offline) return WifiOff
  switch (props.status) {
    case 'connected':
      return Wifi
    case 'connecting':
      return Loader2
    case 'error':
      return AlertCircle
    default:
      return WifiOff
  }
})

const statusText = computed(() => {
  if (props.offline) return t('classroom.realtime.statusOffline')
  switch (props.status) {
    case 'connected':
      return t('classroom.realtime.statusConnected')
    case 'connecting':
      return t('classroom.realtime.statusConnecting')
    case 'error':
      return t('classroom.realtime.statusError')
    default:
      return t('classroom.realtime.statusDisconnected')
  }
})

const showBanner = computed(() => {
  return props.status !== 'connected' || props.offline
})
</script>

<template>
  <Transition name="slide-down">
    <div
      v-if="showBanner"
      class="connection-health-banner"
      :class="`status-${status}`"
      data-test="connection-health-banner"
    >
      <div class="banner-content">
        <component
          :is="statusIcon"
          :size="20"
          :class="{ 'animate-spin': status === 'connecting' }"
          class="status-icon"
          :style="{ color: statusColor }"
        />
        <div class="banner-text">
          <p class="status-text" :style="{ color: statusColor }">
            {{ statusText }}
          </p>
          <p v-if="lastError" class="error-text">
            {{ lastError }}
          </p>
          <p v-if="wsUrl && status === 'error'" class="ws-url-text">
            {{ t('classroom.realtime.gatewayUrl') }}: {{ wsUrl }}
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.connection-health-banner {
  position: sticky;
  top: 0;
  z-index: 100;
  padding: 0.75rem 1rem;
  background: var(--surface-card);
  border-bottom: 2px solid var(--border-color);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.banner-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  max-width: 1200px;
  margin: 0 auto;
}

.status-icon {
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.status-text {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.error-text {
  font-size: 0.75rem;
  color: var(--text-secondary);
  margin: 0;
}

.ws-url-text {
  font-size: 0.75rem;
  color: var(--text-muted);
  font-family: monospace;
  margin: 0;
}

.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s ease;
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-100%);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-100%);
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
