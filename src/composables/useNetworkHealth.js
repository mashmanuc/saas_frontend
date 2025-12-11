/**
 * Network Health Monitor Composable — v0.15.0
 * Моніторинг стану мережі та з'єднання
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { realtimeService } from '../services/realtime'

/**
 * Configuration
 */
const CONFIG = {
  pingIntervalMs: 5000,
  pingTimeoutMs: 3000,
  historySize: 60,
  packetLossThreshold: 0.1, // 10%
  latencyWarningMs: 500,
  latencyCriticalMs: 1000,
}

/**
 * Network health status enum
 */
export const NETWORK_STATUS = {
  EXCELLENT: 'excellent',
  GOOD: 'good',
  FAIR: 'fair',
  POOR: 'poor',
  OFFLINE: 'offline',
}

/**
 * Calculate network status based on metrics
 */
function calculateStatus(latency, packetLoss, isOnline) {
  if (!isOnline) return NETWORK_STATUS.OFFLINE
  if (packetLoss > 0.2) return NETWORK_STATUS.POOR
  if (latency > CONFIG.latencyCriticalMs || packetLoss > 0.1) return NETWORK_STATUS.POOR
  if (latency > CONFIG.latencyWarningMs || packetLoss > 0.05) return NETWORK_STATUS.FAIR
  if (latency > 200) return NETWORK_STATUS.GOOD
  return NETWORK_STATUS.EXCELLENT
}

/**
 * Network Health Monitor composable
 */
export function useNetworkHealth() {
  // State
  const isOnline = ref(navigator.onLine)
  const latency = ref(0)
  const latencyHistory = ref([])
  const packetsSent = ref(0)
  const packetsReceived = ref(0)
  const reconnectAttempts = ref(0)
  const lastPingTime = ref(null)
  const wsStatus = ref('disconnected')
  
  // Computed
  const packetLoss = computed(() => {
    if (packetsSent.value === 0) return 0
    return 1 - (packetsReceived.value / packetsSent.value)
  })
  
  const averageLatency = computed(() => {
    if (latencyHistory.value.length === 0) return 0
    const sum = latencyHistory.value.reduce((a, b) => a + b, 0)
    return Math.round(sum / latencyHistory.value.length)
  })
  
  const minLatency = computed(() => {
    if (latencyHistory.value.length === 0) return 0
    return Math.min(...latencyHistory.value)
  })
  
  const maxLatency = computed(() => {
    if (latencyHistory.value.length === 0) return 0
    return Math.max(...latencyHistory.value)
  })
  
  const jitter = computed(() => {
    if (latencyHistory.value.length < 2) return 0
    let totalDiff = 0
    for (let i = 1; i < latencyHistory.value.length; i++) {
      totalDiff += Math.abs(latencyHistory.value[i] - latencyHistory.value[i - 1])
    }
    return Math.round(totalDiff / (latencyHistory.value.length - 1))
  })
  
  const status = computed(() => {
    return calculateStatus(latency.value, packetLoss.value, isOnline.value)
  })
  
  const statusLabel = computed(() => {
    const labels = {
      [NETWORK_STATUS.EXCELLENT]: 'Відмінно',
      [NETWORK_STATUS.GOOD]: 'Добре',
      [NETWORK_STATUS.FAIR]: 'Задовільно',
      [NETWORK_STATUS.POOR]: 'Погано',
      [NETWORK_STATUS.OFFLINE]: 'Офлайн',
    }
    return labels[status.value] || 'Невідомо'
  })
  
  const hasPacketLossWarning = computed(() => {
    return packetLoss.value > CONFIG.packetLossThreshold
  })
  
  const hasLatencyWarning = computed(() => {
    return latency.value > CONFIG.latencyWarningMs
  })
  
  // Methods
  let pingInterval = null
  let pingTimeout = null
  let pendingPing = null
  
  const sendPing = () => {
    if (!isOnline.value || wsStatus.value !== 'open') return
    
    const startTime = performance.now()
    packetsSent.value++
    
    // Clear previous timeout
    if (pingTimeout) {
      clearTimeout(pingTimeout)
    }
    
    pendingPing = {
      startTime,
      id: packetsSent.value,
    }
    
    // Send ping via WS
    try {
      realtimeService.send({
        type: 'ping',
        id: pendingPing.id,
        timestamp: Date.now(),
      })
    } catch (error) {
      console.warn('[networkHealth] ping send failed:', error)
    }
    
    // Set timeout for packet loss
    pingTimeout = setTimeout(() => {
      if (pendingPing && pendingPing.id === packetsSent.value) {
        // Ping timed out - packet lost
        pendingPing = null
      }
    }, CONFIG.pingTimeoutMs)
  }
  
  const handlePong = (data) => {
    if (!pendingPing) return
    
    const endTime = performance.now()
    const roundTrip = Math.round(endTime - pendingPing.startTime)
    
    packetsReceived.value++
    latency.value = roundTrip
    lastPingTime.value = Date.now()
    
    // Add to history
    latencyHistory.value.push(roundTrip)
    if (latencyHistory.value.length > CONFIG.historySize) {
      latencyHistory.value.shift()
    }
    
    pendingPing = null
    
    if (pingTimeout) {
      clearTimeout(pingTimeout)
      pingTimeout = null
    }
  }
  
  const startMonitoring = () => {
    if (pingInterval) return
    
    pingInterval = setInterval(sendPing, CONFIG.pingIntervalMs)
    sendPing() // Initial ping
  }
  
  const stopMonitoring = () => {
    if (pingInterval) {
      clearInterval(pingInterval)
      pingInterval = null
    }
    if (pingTimeout) {
      clearTimeout(pingTimeout)
      pingTimeout = null
    }
  }
  
  const reset = () => {
    latency.value = 0
    latencyHistory.value = []
    packetsSent.value = 0
    packetsReceived.value = 0
    reconnectAttempts.value = 0
    pendingPing = null
  }
  
  // Event handlers
  const handleOnline = () => {
    isOnline.value = true
  }
  
  const handleOffline = () => {
    isOnline.value = false
    stopMonitoring()
  }
  
  const handleWsStatus = (newStatus) => {
    wsStatus.value = newStatus
    
    if (newStatus === 'open') {
      startMonitoring()
    } else if (newStatus === 'reconnecting') {
      reconnectAttempts.value++
    } else if (newStatus === 'closed') {
      stopMonitoring()
    }
  }
  
  // Lifecycle
  let unsubscribeStatus = null
  let unsubscribePong = null
  
  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Subscribe to WS events
    unsubscribeStatus = realtimeService.on('status', handleWsStatus)
    unsubscribePong = realtimeService.on('pong', handlePong)
    
    // Start if already connected
    if (realtimeService.status === 'open') {
      wsStatus.value = 'open'
      startMonitoring()
    }
  })
  
  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    
    unsubscribeStatus?.()
    unsubscribePong?.()
    
    stopMonitoring()
  })
  
  return {
    // State
    isOnline,
    latency,
    latencyHistory,
    packetLoss,
    reconnectAttempts,
    wsStatus,
    lastPingTime,
    
    // Computed
    averageLatency,
    minLatency,
    maxLatency,
    jitter,
    status,
    statusLabel,
    hasPacketLossWarning,
    hasLatencyWarning,
    
    // Methods
    startMonitoring,
    stopMonitoring,
    reset,
    sendPing,
  }
}

export default useNetworkHealth
