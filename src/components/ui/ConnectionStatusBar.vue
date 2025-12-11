<template>
  <Transition name="slide-down">
    <div
      v-if="showBar"
      class="connection-status-bar"
      :class="statusClass"
      role="alert"
      aria-live="polite"
    >
      <component :is="statusIcon" class="status-icon" :class="{ 'animate-spin': isReconnecting }" />
      <span class="status-text">{{ statusLabel }}</span>
      <button
        v-if="isFailed"
        type="button"
        class="retry-btn"
        @click="handleRetry"
      >
        {{ $t('common.retry') }}
      </button>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'
import { Loader2, WifiOff, AlertCircle } from 'lucide-vue-next'
import { useRealtimeStatus } from '../../composables/useRealtimeStatus'

const {
  isConnected,
  isReconnecting,
  isFailed,
  statusLabel,
  reconnect,
} = useRealtimeStatus({ showNotifications: false })

const showBar = computed(() => !isConnected.value)

const statusClass = computed(() => ({
  'connection-status-bar--reconnecting': isReconnecting.value,
  'connection-status-bar--failed': isFailed.value,
  'connection-status-bar--disconnected': !isReconnecting.value && !isFailed.value,
}))

const statusIcon = computed(() => {
  if (isReconnecting.value) return Loader2
  if (isFailed.value) return AlertCircle
  return WifiOff
})

const handleRetry = () => {
  reconnect()
}
</script>

<style scoped>
.connection-status-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.connection-status-bar--reconnecting {
  background: #fef3c7;
  color: #92400e;
}

.connection-status-bar--failed {
  background: #fee2e2;
  color: #991b1b;
}

.connection-status-bar--disconnected {
  background: #f3f4f6;
  color: #374151;
}

.status-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.status-text {
  flex: 0 1 auto;
}

.retry-btn {
  margin-left: 8px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  color: #991b1b;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid currentColor;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #fff;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-down-enter-from,
.slide-down-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

/* Dark theme */
:root[data-theme="dark"] .connection-status-bar--reconnecting {
  background: #78350f;
  color: #fef3c7;
}

:root[data-theme="dark"] .connection-status-bar--failed {
  background: #7f1d1d;
  color: #fee2e2;
}

:root[data-theme="dark"] .connection-status-bar--disconnected {
  background: #374151;
  color: #f3f4f6;
}

:root[data-theme="dark"] .retry-btn {
  color: #fee2e2;
  background: rgba(0, 0, 0, 0.3);
}
</style>
