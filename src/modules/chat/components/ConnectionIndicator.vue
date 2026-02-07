<template>
  <div class="connection-indicator" :class="statusClass">
    <div class="indicator-dot" :class="{ pulse: isConnecting }" />
    <span class="status-text">{{ statusText }}</span>
    <button
      v-if="showRetry"
      class="retry-btn"
      @click="handleRetry"
      :disabled="isConnecting"
    >
      {{ isConnecting ? $t('chat.connecting') : $t('chat.retry') }}
    </button>
    <div v-if="hasQueuedMessages" class="queue-badge">
      {{ queuedCount }}
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  status: {
    type: String,
    default: 'connected', // 'connected' | 'connecting' | 'reconnecting' | 'polling' | 'offline'
    validator: (value) => ['connected', 'connecting', 'reconnecting', 'polling', 'offline'].includes(value)
  },
  transport: {
    type: String,
    default: 'websocket' // 'websocket' | 'polling'
  },
  queuedCount: {
    type: Number,
    default: 0
  },
  isConnecting: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['retry'])

const statusClass = computed(() => ({
  'status-connected': props.status === 'connected',
  'status-connecting': props.status === 'connecting',
  'status-reconnecting': props.status === 'reconnecting',
  'status-polling': props.status === 'polling',
  'status-offline': props.status === 'offline'
}))

const statusText = computed(() => {
  switch (props.status) {
    case 'connected':
      return props.transport === 'polling'
        ? t('chat.status.pollingMode')
        : t('chat.status.connected')
    case 'connecting':
      return t('chat.status.connecting')
    case 'reconnecting':
      return t('chat.status.reconnecting')
    case 'polling':
      return t('chat.status.pollingMode')
    case 'offline':
      return t('chat.status.offline')
    default:
      return t('chat.status.unknown')
  }
})

const showRetry = computed(() => {
  return props.status === 'offline' || props.status === 'reconnecting'
})

const hasQueuedMessages = computed(() => {
  return props.queuedCount > 0 && (props.status === 'offline' || props.status === 'polling')
})

function handleRetry() {
  emit('retry')
}
</script>

<style scoped>
.connection-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  transition: background-color 0.3s ease;
}

.indicator-dot.pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Status: Connected */
.status-connected {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}
.status-connected .indicator-dot {
  background: #22c55e;
}

/* Status: Connecting */
.status-connecting {
  background: rgba(59, 130, 246, 0.1);
  color: #2563eb;
}
.status-connecting .indicator-dot {
  background: #3b82f6;
}

/* Status: Reconnecting */
.status-reconnecting {
  background: rgba(245, 158, 11, 0.1);
  color: #d97706;
}
.status-reconnecting .indicator-dot {
  background: #f59e0b;
}

/* Status: Polling */
.status-polling {
  background: rgba(139, 92, 246, 0.1);
  color: #7c3aed;
}
.status-polling .indicator-dot {
  background: #8b5cf6;
}

/* Status: Offline */
.status-offline {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}
.status-offline .indicator-dot {
  background: #ef4444;
}

.status-text {
  white-space: nowrap;
}

.retry-btn {
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.05);
  border: none;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover:not(:disabled) {
  background: rgba(0, 0, 0, 0.1);
}

.retry-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.queue-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: #ef4444;
  color: white;
  border-radius: 9px;
  font-size: 10px;
  font-weight: 600;
}
</style>
