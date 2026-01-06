import apiClient from '@/utils/apiClient'

export default {
  async getMessages(matchId, params = {}) {
    const response = await apiClient.get(`/v1/matches/${matchId}/messages`, { params })
    return response.data
  },

  async sendMessage(matchId, data) {
    const response = await apiClient.post(`/v1/matches/${matchId}/messages`, data)
    return response.data
  },

  async requestAttachmentUpload(data) {
    const response = await apiClient.post('/v1/uploads/match-attachment', data)
    return response.data
  }
}
