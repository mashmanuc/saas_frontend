import apiClient from '../utils/apiClient'

export const chatApi = {
  async fetchHistory({ lessonId, cursor } = {}) {
    const params = {}
    if (lessonId) params.lesson_id = lessonId
    if (cursor) params.cursor = cursor
    const response = await apiClient.get('/chat/history/', { params })
    return response?.data ?? response
  },

  async sendMessage(payload) {
    const response = await apiClient.post('/chat/messages/', payload)
    return response?.data ?? response
  },

  async editMessage(id, payload) {
    const response = await apiClient.patch(`/chat/messages/${id}/`, payload)
    return response?.data ?? response
  },

  async deleteMessage(id) {
    const response = await apiClient.delete(`/chat/messages/${id}/`)
    return response?.data ?? response
  },
}
