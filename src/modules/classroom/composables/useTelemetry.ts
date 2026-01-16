/**
 * Telemetry composable for whiteboard realtime metrics (v0.87.0)
 * Sends periodic telemetry data to backend for observability
 */

import { ref, onMounted, onUnmounted } from 'vue'
import { useWhiteboardStore } from '../stores/whiteboardStore'

const TELEMETRY_INTERVAL_MS = 15000 // 15 seconds

interface TelemetryData {
  reconnect_count: number
  pending_ops_count: number
  avg_ack_latency_ms: number
  last_resync_duration_ms: number
  client_ts: number
  workspace_id?: string
}

export function useTelemetry() {
  const store = useWhiteboardStore()
  const telemetryTimer = ref<number | null>(null)
  
  // Telemetry metrics
  const reconnectCount = ref(0)
  const ackLatencies = ref<number[]>([])
  const lastResyncDuration = ref(0)

  /**
   * Send telemetry data to backend
   */
  async function sendTelemetry(): Promise<void> {
    if (!store.workspaceId) return

    // Calculate average ack latency
    const avgAckLatency = ackLatencies.value.length > 0
      ? ackLatencies.value.reduce((sum, val) => sum + val, 0) / ackLatencies.value.length
      : 0

    const payload: TelemetryData = {
      reconnect_count: reconnectCount.value,
      pending_ops_count: store.pendingOps.size,
      avg_ack_latency_ms: Math.round(avgAckLatency),
      last_resync_duration_ms: lastResyncDuration.value,
      client_ts: Date.now(),
      workspace_id: store.workspaceId
    }

    try {
      const response = await fetch('/api/v1/whiteboard/telemetry/realtime/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      })

      if (!response.ok && response.status !== 202) {
        console.warn('[Telemetry] Failed to send telemetry:', response.status)
      }

      // Reset latency buffer after send
      ackLatencies.value = []
    } catch (err) {
      console.error('[Telemetry] Error sending telemetry:', err)
    }
  }

  /**
   * Record reconnection event
   */
  function recordReconnect(): void {
    reconnectCount.value++
  }

  /**
   * Record operation acknowledgment latency
   */
  function recordAckLatency(latencyMs: number): void {
    ackLatencies.value.push(latencyMs)
    
    // Keep buffer size reasonable (last 50 samples)
    if (ackLatencies.value.length > 50) {
      ackLatencies.value = ackLatencies.value.slice(-50)
    }
  }

  /**
   * Record resync duration
   */
  function recordResyncDuration(durationMs: number): void {
    lastResyncDuration.value = durationMs
  }

  /**
   * Start telemetry tick
   */
  function startTelemetry(): void {
    if (telemetryTimer.value !== null) return

    telemetryTimer.value = window.setInterval(() => {
      sendTelemetry()
    }, TELEMETRY_INTERVAL_MS)

    console.log('[Telemetry] Started telemetry tick (15s interval)')
  }

  /**
   * Stop telemetry tick
   */
  function stopTelemetry(): void {
    if (telemetryTimer.value !== null) {
      clearInterval(telemetryTimer.value)
      telemetryTimer.value = null
      console.log('[Telemetry] Stopped telemetry tick')
    }
  }

  /**
   * Reset telemetry metrics
   */
  function resetMetrics(): void {
    reconnectCount.value = 0
    ackLatencies.value = []
    lastResyncDuration.value = 0
  }

  // Auto-start on mount, stop on unmount
  onMounted(() => {
    startTelemetry()
  })

  onUnmounted(() => {
    stopTelemetry()
  })

  return {
    // Metrics
    reconnectCount,
    avgAckLatency: () => {
      return ackLatencies.value.length > 0
        ? ackLatencies.value.reduce((sum, val) => sum + val, 0) / ackLatencies.value.length
        : 0
    },
    lastResyncDuration,
    
    // Actions
    sendTelemetry,
    recordReconnect,
    recordAckLatency,
    recordResyncDuration,
    startTelemetry,
    stopTelemetry,
    resetMetrics
  }
}
