import { defineStore } from 'pinia'
import {
  getTutorClassrooms,
  getClassroomDetails,
  createClassroom as apiCreateClassroom,
  deleteClassroom as apiDeleteClassroom,
  addStudentToClassroom as apiAddStudent,
  removeStudentFromClassroom as apiRemoveStudent,
  getAvailableStudents as apiGetAvailableStudents,
} from '../../../api/classrooms'
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

    // доступні учні для додавання
    availableStudents: [],
    availableStudentsLoading: false,
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

    async createClassroom(payload) {
      const data = await apiCreateClassroom(payload)
      await this.loadClassrooms()
      return data
    },

    async deleteClassroom(classroomId) {
      await apiDeleteClassroom(classroomId)
      this.currentClassroom = null
      this.currentError = null
      this.currentErrorCode = null
      await this.loadClassrooms()
    },

    async loadAvailableStudents(classroomId, q = '') {
      this.availableStudentsLoading = true
      try {
        const data = await apiGetAvailableStudents(classroomId, q)
        this.availableStudents = data?.results || []
      } catch (e) {
        this.availableStudents = []
      } finally {
        this.availableStudentsLoading = false
      }
    },

    async addStudent(classroomId, studentId) {
      const data = await apiAddStudent(classroomId, studentId)
      // Оновлюємо поточний клас та список
      if (this.currentClassroom?.id === classroomId) {
        await this.loadClassroomById(classroomId)
      }
      await this.loadClassrooms()
      return data
    },

    async removeStudent(classroomId, userId) {
      await apiRemoveStudent(classroomId, userId)
      if (this.currentClassroom?.id === classroomId) {
        await this.loadClassroomById(classroomId)
      }
      await this.loadClassrooms()
    },
  },
})

