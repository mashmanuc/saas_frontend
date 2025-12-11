import apiClient from '../utils/apiClient'

export const boardApi = {
  async fetchSnapshot(lessonId) {
    if (!lessonId) return { strokes: [] }
    const response = await apiClient.get(`/board/lessons/${lessonId}/snapshot/`)
    return response?.data ?? response ?? { strokes: [] }
  },

  async saveSnapshot(lessonId, payload) {
    if (!lessonId) return null
    const response = await apiClient.post(`/board/lessons/${lessonId}/snapshot/`, payload)
    return response?.data ?? response
  },
}
