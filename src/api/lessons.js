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

  // ── Classroom Entry: Lesson-first ──

  /**
   * Тьютор починає урок: створює WBSession + status → IN_PROGRESS.
   * @param {number} id - lesson ID
   * @returns {{ lesson_id, session_id, room_url, status }}
   */
  startSession(id) {
    return apiClient.post(`/v1/lessons/${id}/start-session/`)
  },

  /**
   * Студент приєднується до уроку (або тьютор повертається).
   * @param {number} id - lesson ID
   * @returns {{ lesson_id, session_id, room_url, role }}
   */
  joinLesson(id) {
    return apiClient.post(`/v1/lessons/${id}/join/`)
  },

  /**
   * Список активних уроків (для Classroom Hub).
   * @param {object} params - { status?, student_id? }
   * @returns {{ results: ActiveLesson[] }}
   */
  getActiveLessons(params = {}, { silent = false } = {}) {
    return apiClient.get('/v1/lessons/my/active/', {
      params,
      meta: silent ? { skipLoader: true } : undefined,
    })
  },

  /**
   * Швидкий старт уроку: створює Lesson + WBSession + IN_PROGRESS за один виклик.
   * Використовує TutorStudentRelation замість ClassroomMembership.
   * @param {{ student_id: number, start?: string, end?: string }} payload
   * @returns {{ lesson_id, session_id, room_url, status }}
   */
  quickStart(payload) {
    return apiClient.post('/v1/lessons/quick-start/', payload)
  },

  // ── Phase 39: Notes API + Materials API ──

  /**
   * Отримує приватні нотатки тьютора до уроку.
   * @param {number} id - lesson ID
   * @returns {Promise<{ notes_text: string, updated_at: string|null }>}
   */
  getNotes(id) {
    return apiClient.get(`/v1/lessons/${id}/notes/`)
  },

  /**
   * Зберігає приватні нотатки тьютора з concurrency control.
   * @param {number} id - lesson ID
   * @param {string} notesText - текст нотаток
   * @param {string|null} lastUpdatedAt - timestamp для conflict detection
   * @returns {Promise<{ notes_text: string, updated_at: string }>}
   */
  saveNotes(id, notesText, lastUpdatedAt = null) {
    const payload = { notes_text: notesText }
    if (lastUpdatedAt) payload.last_updated_at = lastUpdatedAt
    return apiClient.patch(`/v1/lessons/${id}/notes/`, payload)
  },

  /**
   * Отримує список матеріалів уроку.
   * @param {number} id - lesson ID
   * @returns {Promise<{ results: Array<{id, title, content_type, thumbnail_url}> }>}
   */
  getMaterials(id) {
    return apiClient.get(`/v1/lessons/${id}/materials/`)
  },

  /**
   * Видаляє матеріал з уроку (тільки M2M link, не ContentItem).
   * @param {number} lessonId - lesson ID
   * @param {number} contentItemId - content item ID
   * @returns {Promise<void>}
   */
  removeMaterial(lessonId, contentItemId) {
    return apiClient.delete(`/v1/lessons/${lessonId}/materials/${contentItemId}/`)
  },
}

export default lessonsApi
