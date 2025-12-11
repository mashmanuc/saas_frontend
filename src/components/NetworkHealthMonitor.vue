<template>
  <div class="network-health-monitor" :class="`status-${status}`">
    <!-- Compact view (default) -->
    <div v-if="!expanded" class="compact-view" @click="expanded = true">
      <div class="status-indicator" :class="`indicator-${status}`">
        <span class="status-dot" />
      </div>
      <span class="latency-text">{{ latency }}ms</span>
      <button 
        type="button" 
        class="expand-btn"
        :aria-label="$t('network.expand')"
      >
        <ChevronDown class="icon" />
      </button>
    </div>
    
    <!-- Expanded view -->
    <div v-else class="expanded-view">
      <div class="header">
        <h4 class="title">{{ $t('network.title') }}</h4>
        <button 
          type="button" 
          class="collapse-btn"
          @click="expanded = false"
          :aria-label="$t('network.collapse')"
        >
          <X class="icon" />
        </button>
      </div>
      
      <!-- Status -->
      <div class="status-row">
        <span class="label">{{ $t('network.status') }}:</span>
        <span class="value" :class="`status-${status}`">
          {{ statusLabel }}
        </span>
      </div>
      
      <!-- Ping Graph -->
      <div class="ping-graph">
        <div class="graph-header">
          <span class="label">{{ $t('network.latency') }}</span>
          <span class="current">{{ latency }}ms</span>
        </div>
        <div class="graph-container">
          <svg 
            class="graph-svg" 
            viewBox="0 0 240 60" 
            preserveAspectRatio="none"
          >
            <polyline
              :points="graphPoints"
              fill="none"
              :stroke="graphColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <div class="graph-labels">
            <span>{{ minLatency }}ms</span>
            <span>{{ maxLatency }}ms</span>
          </div>
        </div>
      </div>
      
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat">
          <span class="stat-label">{{ $t('network.avg') }}</span>
          <span class="stat-value">{{ averageLatency }}ms</span>
        </div>
        <div class="stat">
          <span class="stat-label">{{ $t('network.jitter') }}</span>
          <span class="stat-value">{{ jitter }}ms</span>
        </div>
        <div class="stat">
          <span class="stat-label">{{ $t('network.packetLoss') }}</span>
          <span class="stat-value" :class="{ warning: hasPacketLossWarning }">
            {{ (packetLoss * 100).toFixed(1) }}%
          </span>
        </div>
        <div class="stat">
          <span class="stat-label">{{ $t('network.reconnects') }}</span>
          <span class="stat-value">{{ reconnectAttempts }}</span>
        </div>
      </div>
      
      <!-- Warnings -->
      <div v-if="hasPacketLossWarning || hasLatencyWarning" class="warnings">
        <div v-if="hasPacketLossWarning" class="warning-item">
          <AlertTriangle class="warning-icon" />
          <span>{{ $t('network.warnings.packetLoss') }}</span>
        </div>
        <div v-if="hasLatencyWarning" class="warning-item">
          <AlertTriangle class="warning-icon" />
          <span>{{ $t('network.warnings.highLatency') }}</span>
        </div>
      </div>
      
      <!-- Connection Status -->
      <div class="connection-status">
        <div class="ws-status" :class="`ws-${wsStatus}`">
          <Wifi v-if="wsStatus === 'open'" class="ws-icon" />
          <WifiOff v-else class="ws-icon" />
          <span>{{ wsStatusLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * NetworkHealthMonitor Component — v0.15.0
 * UI компонент для моніторингу стану мережі
 */

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, X, AlertTriangle, Wifi, WifiOff } from 'lucide-vue-next'
import { useNetworkHealth, NETWORK_STATUS } from '../composables/useNetworkHealth'

const { t } = useI18n()

const expanded = ref(false)

const {
  isOnline,
  latency,
  latencyHistory,
  packetLoss,
  reconnectAttempts,
  wsStatus,
  averageLatency,
  minLatency,
  maxLatency,
  jitter,
  status,
  statusLabel,
  hasPacketLossWarning,
  hasLatencyWarning,
} = useNetworkHealth()

// Graph points calculation
const graphPoints = computed(() => {
  if (latencyHistory.value.length === 0) return '0,30'
  
  const width = 240
  const height = 60
  const padding = 5
  const graphHeight = height - padding * 2
  
  const max = Math.max(...latencyHistory.value, 100)
  const min = Math.min(...latencyHistory.value, 0)
  const range = max - min || 1
  
  const points = latencyHistory.value.map((value, index) => {
    const x = (index / (latencyHistory.value.length - 1 || 1)) * width
    const y = padding + graphHeight - ((value - min) / range) * graphHeight
    return `${x},${y}`
  })
  
  return points.join(' ')
})

const graphColor = computed(() => {
  switch (status.value) {
    case NETWORK_STATUS.EXCELLENT:
      return '#10b981' // green
    case NETWORK_STATUS.GOOD:
      return '#22c55e' // light green
    case NETWORK_STATUS.FAIR:
      return '#f59e0b' // yellow
    case NETWORK_STATUS.POOR:
      return '#ef4444' // red
    default:
      return '#6b7280' // gray
  }
})

const wsStatusLabel = computed(() => {
  const labels = {
    open: t('network.wsStatus.connected'),
    connecting: t('network.wsStatus.connecting'),
    reconnecting: t('network.wsStatus.reconnecting'),
    closed: t('network.wsStatus.disconnected'),
  }
  return labels[wsStatus.value] || wsStatus.value
})
</script>

<style scoped>
.network-health-monitor {
  font-size: 12px;
  background: var(--bg-secondary, #f9fafb);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e5e7eb);
  overflow: hidden;
}

/* Compact View */
.compact-view {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.2s;
}

.compact-view:hover {
  background: var(--bg-hover, #f3f4f6);
}

.status-indicator {
  display: flex;
  align-items: center;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.indicator-excellent .status-dot { background: #10b981; }
.indicator-good .status-dot { background: #22c55e; }
.indicator-fair .status-dot { background: #f59e0b; }
.indicator-poor .status-dot { background: #ef4444; }
.indicator-offline .status-dot { background: #6b7280; animation: none; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.latency-text {
  color: var(--text-secondary, #6b7280);
  font-variant-numeric: tabular-nums;
}

.expand-btn,
.collapse-btn {
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--text-muted, #9ca3af);
  display: flex;
  align-items: center;
}

.icon {
  width: 14px;
  height: 14px;
}

/* Expanded View */
.expanded-view {
  padding: 12px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title {
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: var(--text-primary, #111827);
}

.status-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.label {
  color: var(--text-secondary, #6b7280);
}

.value {
  font-weight: 500;
}

.status-excellent { color: #10b981; }
.status-good { color: #22c55e; }
.status-fair { color: #f59e0b; }
.status-poor { color: #ef4444; }
.status-offline { color: #6b7280; }

/* Ping Graph */
.ping-graph {
  margin-bottom: 12px;
}

.graph-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.current {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.graph-container {
  position: relative;
  background: var(--bg-tertiary, #f3f4f6);
  border-radius: 4px;
  padding: 4px;
}

.graph-svg {
  width: 100%;
  height: 60px;
}

.graph-labels {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-muted, #9ca3af);
  margin-top: 2px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  color: var(--text-muted, #9ca3af);
  text-transform: uppercase;
}

.stat-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stat-value.warning {
  color: #ef4444;
}

/* Warnings */
.warnings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.warning-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #fef3c7;
  border-radius: 4px;
  color: #92400e;
  font-size: 11px;
}

.warning-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* Connection Status */
.connection-status {
  border-top: 1px solid var(--border-color, #e5e7eb);
  padding-top: 8px;
}

.ws-status {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ws-icon {
  width: 14px;
  height: 14px;
}

.ws-open { color: #10b981; }
.ws-connecting,
.ws-reconnecting { color: #f59e0b; }
.ws-closed { color: #ef4444; }

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .network-health-monitor {
    background: var(--bg-secondary-dark, #1f2937);
    border-color: var(--border-color-dark, #374151);
  }
  
  .warning-item {
    background: #78350f;
    color: #fef3c7;
  }
}
</style>
