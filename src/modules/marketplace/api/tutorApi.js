import apiClient from '@/utils/apiClient'

export default {
  async getTutorProfile(slug) {
    const response = await apiClient.get(`/api/v1/marketplace/tutors/${slug}/profile`)
    return response.data
  },

  async updateMyProfile(data) {
    const response = await apiClient.put('/api/v1/tutors/me/profile', data)
    return response.data
  },

  async getMyProfileSnapshot() {
    const response = await apiClient.get('/api/v1/tutors/me/profile/snapshot')
    return response.data
  },

  async searchTutors(params = {}) {
    const response = await apiClient.get('/api/v1/marketplace/search', { params })
    return response.data
  }
}
