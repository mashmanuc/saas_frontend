import apiClient from '@/utils/apiClient'

export interface ActivityFeedItem {
  id: string
  ts: number
  message: string
  action_link?: string
  severity?: string
  domain?: string
}

export interface ActivityFeedResponse {
  items: ActivityFeedItem[]
}

export interface TelemetryMetricsSeries {
  ts: number
  value: number
}

export interface TelemetryMetricsResponse {
  series: TelemetryMetricsSeries[]
  meta?: Record<string, any>
}

const operatorApi = {
  /**
   * Get activity feed with filters
   */
  async getActivityFeed(domain?: string, severity?: string): Promise<ActivityFeedResponse> {
    const params: Record<string, string> = {}
    if (domain) params.domain = domain
    if (severity) params.severity = severity
    
    const response = await apiClient.get('/v1/operator/activity-feed', { params })
    return response as unknown as ActivityFeedResponse
  },

  /**
   * Execute operator action
   */
  async executeAction(action: string, payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post(`/v1/operator/actions/${action}`, payload)
    return response
  },

  /**
   * Get telemetry metrics for domain
   */
  async getTelemetryMetrics(domain: string): Promise<TelemetryMetricsResponse> {
    const response = await apiClient.get(`/v1/telemetry/metrics/${domain}`)
    return response as unknown as TelemetryMetricsResponse
  },
}

export default operatorApi
