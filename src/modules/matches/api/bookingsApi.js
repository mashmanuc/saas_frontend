import apiClient from '@/utils/apiClient'

export default {
  async createTrialRequest(matchId, data) {
    const response = await apiClient.post(`/v1/matches/${matchId}/trial-request`, data)
    return response.data
  },

  async confirmBooking(bookingId, data) {
    const response = await apiClient.post(`/v1/bookings/${bookingId}/confirm`, data)
    return response.data
  },

  async cancelBooking(bookingId, data) {
    const response = await apiClient.post(`/v1/bookings/${bookingId}/cancel`, data)
    return response.data
  },

  async getBooking(bookingId) {
    const response = await apiClient.get(`/v1/bookings/${bookingId}`)
    return response.data
  }
}
