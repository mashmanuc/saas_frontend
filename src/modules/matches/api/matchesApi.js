import apiClient from '@/utils/apiClient'

export default {
  async createMatch(tutorId, message = null) {
    const response = await apiClient.post('/v1/matches/', {
      tutor_id: tutorId,
      message
    })
    return response.data
  },

  async getMatches(params = {}) {
    const response = await apiClient.get('/v1/matches/', { params })
    return response.data
  },

  async acceptMatch(matchId) {
    const response = await apiClient.post(`/v1/matches/${matchId}/accept`)
    return response.data
  },

  async declineMatch(matchId) {
    const response = await apiClient.post(`/v1/matches/${matchId}/decline`)
    return response.data
  },

  async archiveMatch(matchId) {
    const response = await apiClient.post(`/v1/matches/${matchId}/archive`)
    return response.data
  }
}
