import apiClient from '@/utils/apiClient'

export interface CascadeMetrics {
  status: 'healthy' | 'degraded' | 'critical'
  status_ts: number
  metrics: {
    auth_refresh: { success: number; fail: number }
    ws_reconnect: { total: number; unique_sessions: number; by_type: Record<string, number> }
    auth_death: { count: number }
    recording_stop_failed: { count: number; fallback_used: number }
    recording_auto_stopped: { count: number }
  }
  series: {
    auth_refresh_fail_rate: Array<{ ts: number; value: number }>
    ws_reconnect: Array<{ ts: number; value: number }>
    auth_death: Array<{ ts: number; value: number }>
    recording_failures: Array<{ ts: number; value: number }>
    recording_auto_stopped: Array<{ ts: number; value: number }>
  }
  bucket_seconds: number
  window_seconds: number
  timestamp: string
}

export async function getCascadeMetrics(hours = 1): Promise<CascadeMetrics> {
  return apiClient.get('/v1/operator/health/cascade-metrics/', {
    params: { hours },
    meta: { skipLoader: true },
  })
}
