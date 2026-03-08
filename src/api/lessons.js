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
  /**
   * Клонує урок у новий DRAFT.
   * @param {number} id - id вихідного уроку
   * @param {object} overrides - опціональні перевизначення:
   *   student_id {number} — інший учень (якщо не передати — той самий)
   *   start      {string} — ISO 8601 datetime нового уроку
   *   end        {string} — ISO 8601 datetime завершення
   */
  cloneLesson(id, overrides = {}) {
    return apiClient.post(`/lessons/${id}/clone/`, overrides)
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
