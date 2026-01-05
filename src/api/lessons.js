import apiClient from '../utils/apiClient'

const lessonsApi = {
  listMyLessons(params = {}) {
    return apiClient
      .get('/lessons/', { params })
      .catch((err) => {
        const status = err?.response?.status
        if (status === 404) {
          return apiClient.get('/lessons/my/', { params })
        }
        throw err
      })
  },
  getLesson(id) {
    return apiClient
      .get(`/lessons/${id}/`)
      .catch((err) => {
        const status = err?.response?.status
        if (status === 404) {
          return apiClient.get(`/lessons/${id}/`)
        }
        throw err
      })
  },
  getLessonRoom(id) {
    return apiClient.get(`/lessons/${id}/room/`)
  },
  createLesson(payload) {
    return apiClient
      .post('/lessons/', payload)
      .catch((err) => {
        const status = err?.response?.status
        if (status === 404) {
          return apiClient.post('/lessons/', payload)
        }
        throw err
      })
  },
  rescheduleLesson(id, payload) {
    return apiClient
      .patch(`/lessons/${id}/reschedule/`, payload)
      .catch((err) => {
        const status = err?.response?.status
        if (status === 404) {
          return apiClient.patch(`/lessons/${id}/reschedule/`, payload)
        }
        throw err
      })
  },
  cancelLesson(id, payload = {}) {
    return apiClient
      .post(`/lessons/${id}/cancel/`, payload)
      .catch((err) => {
        const status = err?.response?.status
        if (status === 404) {
          return apiClient.post(`/lessons/${id}/cancel/`, payload)
        }
        throw err
      })
  },
  createInvite(id) {
    return apiClient.post(`/lessons/${id}/invite/`)
  },
  resolveInvite(token) {
    return apiClient
      .get(`/lesson-invites/${token}/resolve/`)
      .then((res) => res?.data ?? res)
  },
}

export default lessonsApi
