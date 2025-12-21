import api from '../../../utils/apiClient'

const operatorApi = {
  getTelemetryMetrics(domain, params = {}) {
    return api.get(`/v1/telemetry/metrics/${domain}`, { params })
  },

  getActivityFeed(params = {}) {
    return api.get('/v1/operator/activity-feed', { params })
  },

  executeAction(action, payload = {}, idempotencyKey = null) {
    const headers = {}
    if (idempotencyKey) {
      headers['X-Idempotency-Key'] = idempotencyKey
    }
    return api.post(`/v1/operator/actions/${action}`, payload, { headers })
  },

  getHealth() {
    return api.get('/v1/operator/health/')
  },

  getRealtimeHealth() {
    return api.get('/v1/realtime/health')
  },
}

export default operatorApi
