import { defineStore } from 'pinia'
import { getTutorClassrooms, getClassroomDetails } from '../../../api/classrooms'
import { notifyError } from '../../../utils/notify'

export const useClassroomStore = defineStore('classrooms', {
  state: () => ({
    // список класів
    items: [],
    loading: false,
    error: null,

    // поточний клас для детального перегляду
    currentClassroom: null,
    currentLoading: false,
    currentError: null,
    currentErrorCode: null,
  }),
  actions: {
    async loadClassrooms() {
      this.loading = true
      this.error = null

      try {
        const data = await getTutorClassrooms()
        this.items = data
      } catch (e) {
        const status = e?.response?.status

        if (status === 401) {
          window.location.href = '/auth/login'
          return
        }

        if (status === 500) {
          notifyError('Помилка сервера')
        }

        this.error = e?.response?.data?.detail || 'Failed to load classrooms'
      } finally {
        this.loading = false
      }
    },

    async refreshClassrooms() {
      await this.loadClassrooms()
    },

    // тимчасовий псевдонім для зворотної сумісності з існуючими викликами
    async fetchClassrooms() {
      await this.loadClassrooms()
    },

    async loadClassroomById(id) {
      if (!id) return

      this.currentLoading = true
      this.currentError = null
      this.currentErrorCode = null

      try {
        const data = await getClassroomDetails(id)
        this.currentClassroom = data
      } catch (e) {
        const status = e?.response?.status || null
        this.currentErrorCode = status
        this.currentError = e?.response?.data?.detail || 'Failed to load classroom'
      } finally {
        this.currentLoading = false
      }
    },
  },
})

