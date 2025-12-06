import { defineStore } from 'pinia'
import studentsApi from '../../tutor/api/studentsApi'

export const useDashboardStore = defineStore('dashboard', {
  state: () => ({
    tutorStudents: [],
    nextLessonAt: null,
    loading: false,
    error: null,
  }),

  actions: {
    async fetchTutorStudents(params = {}) {
      this.loading = true
      this.error = null

      try {
        const data = await studentsApi.getList(params)

        if (Array.isArray(data)) {
          this.tutorStudents = data
          this.nextLessonAt = null
        } else {
          this.tutorStudents = data?.results || []
          this.nextLessonAt = data?.next_lesson_at || null
        }
      } catch (error) {
        this.error = error?.response?.data?.detail || 'Не вдалося отримати список учнів.'
        throw error
      } finally {
        this.loading = false
      }
    },
  },
})
