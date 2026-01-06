import apiClient from '@/utils/apiClient'

export default {
  async updateAvailability(data) {
    const response = await apiClient.put('/v1/tutors/me/availability', data)
    return response.data
  },

  async getTutorAvailability(slug, params = {}) {
    const response = await apiClient.get(`/v1/tutors/${slug}/availability`, { params })
    return response.data
  }
}
