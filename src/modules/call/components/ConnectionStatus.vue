<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ConnectionState, QualityMetrics } from '@/core/webrtc/types'

interface Props {
  state: ConnectionState
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'
  metrics: QualityMetrics | null
}

const props = defineProps<Props>()

const showDetails = ref(false)

const statusColor = computed(() => {
  switch (props.state) {
    case 'connected':
      return props.quality === 'excellent' || props.quality === 'good'
        ? '#22c55e'
        : props.quality === 'fair'
          ? '#eab308'
          : '#ef4444'
    case 'connecting':
    case 'initializing':
    case 'reconnecting':
      return '#eab308'
    case 'failed':
    case 'ended':
      return '#ef4444'
    default:
      return '#6b7280'
  }
})

const statusText = computed(() => {
  switch (props.state) {
    case 'connected':
      return `Connected (${props.quality})`
    case 'connecting':
      return 'Connecting...'
    case 'initializing':
      return 'Initializing...'
    case 'reconnecting':
      return 'Reconnecting...'
    case 'failed':
      return 'Connection Failed'
    case 'ended':
      return 'Call Ended'
    default:
      return 'Idle'
  }
})
</script>

<template>
  <div
    class="connection-status"
    :class="state"
    @click="showDetails = !showDetails"
  >
    <span class="status-dot" :style="{ backgroundColor: statusColor }" />
    <span class="status-text">{{ statusText }}</span>

    <div v-if="showDetails && metrics" class="quality-details">
      <div>RTT: {{ metrics.rtt.toFixed(0) }}ms</div>
      <div>Packet Loss: {{ metrics.packetLoss.toFixed(1) }}%</div>
      <div>Resolution: {{ metrics.videoResolution }}</div>
      <div>Video Bitrate: {{ (metrics.videoBitrate / 1000).toFixed(0) }} kbps</div>
    </div>
  </div>
</template>

<style scoped>
.connection-status {
  position: absolute;
  top: 1rem;
  left: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  color: white;
  font-size: 0.875rem;
  cursor: pointer;
  z-index: 20;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.quality-details {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.5rem;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 8px;
  font-size: 0.75rem;
  white-space: nowrap;
}

.quality-details div {
  margin-bottom: 0.25rem;
}

.quality-details div:last-child {
  margin-bottom: 0;
}
</style>
