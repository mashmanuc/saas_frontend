import apiClient from '../utils/apiClient'

const lessonsApi = {
  listMyLessons(params = {}) {
    return apiClient.get('/lessons/my/', { params })
  },
  getLesson(id) {
    return apiClient.get(`/lessons/${id}/`)
  },
  createLesson(payload) {
    return apiClient.post('/lessons/', payload)
  },
  rescheduleLesson(id, payload) {
    return apiClient.patch(`/lessons/${id}/reschedule/`, payload)
  },
  cancelLesson(id, payload = {}) {
    return apiClient.post(`/lessons/${id}/cancel/`, payload)
  },
}

export default lessonsApi
