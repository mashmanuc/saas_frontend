import apiClient from '../utils/apiClient'

export const notificationsApi = {
  async list(cursor = null) {
    const params = cursor ? { cursor } : undefined
    return apiClient.get('/notifications/', { params })
  },

  async markRead(id) {
    if (!id) return null
    return apiClient.post(`/notifications/${id}/read/`, {})
  },
}
