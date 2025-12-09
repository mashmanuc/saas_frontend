import { defineStore } from 'pinia'
import relationsApi from '../api/relations'
import { notifyError, notifySuccess } from '../utils/notify'
import { i18n } from '../i18n'

const translate = (key, params) => {
  try {
    return i18n.global?.t?.(key, params) ?? key
  } catch (error) {
    if (import.meta.env?.DEV) {
      console.warn('i18n translate failed for key:', key, error)
    }
    return key
  }
}

export const useRelationsStore = defineStore('relations', {
  state: () => ({
    studentRelations: [],
    studentLoading: false,
    studentError: null,
    tutorRelations: [],
    tutorLoading: false,
    tutorError: null,
    tutorFilter: 'all',
  }),

  getters: {
    invitedStudentRelations: (state) => state.studentRelations.filter((rel) => rel.status === 'invited'),
    activeStudentRelations: (state) => state.studentRelations.filter((rel) => rel.status === 'active'),
    invitedTutorRelations: (state) => state.tutorRelations.filter((rel) => rel.status === 'invited'),
    activeTutorRelations: (state) => state.tutorRelations.filter((rel) => rel.status === 'active'),
    filteredTutorRelations: (state) => {
      if (state.tutorFilter === 'invited') {
        return state.tutorRelations.filter((rel) => rel.status === 'invited')
      }
      if (state.tutorFilter === 'active') {
        return state.tutorRelations.filter((rel) => rel.status === 'active')
      }
      return state.tutorRelations
    },
  },

  actions: {
    setTutorFilter(value) {
      this.tutorFilter = value
    },

    async fetchStudentRelations(params = {}) {
      this.studentLoading = true
      this.studentError = null

      try {
        const data = await relationsApi.getStudentRelations(params)
        this.studentRelations = Array.isArray(data) ? data : data?.results || []
      } catch (error) {
        this.studentError = error?.response?.data?.detail || 'Не вдалося отримати звʼязки студента.'
        throw error
      } finally {
        this.studentLoading = false
      }
    },

    async fetchTutorRelations(params = {}) {
      this.tutorLoading = true
      this.tutorError = null

      try {
        const data = await relationsApi.getTutorRelations(params)
        this.tutorRelations = Array.isArray(data) ? data : data?.results || []
      } catch (error) {
        this.tutorError = error?.response?.data?.detail || 'Не вдалося отримати звʼязки тьютора.'
        throw error
      } finally {
        this.tutorLoading = false
      }
    },

    async acceptRelation(id) {
      try {
        await relationsApi.acceptRelation(id)
        notifySuccess(translate('relations.actions.acceptSuccess'))
      } catch (error) {
        notifyError(error?.response?.data?.detail || translate('relations.actions.acceptError'))
        throw error
      } finally {
        await this.fetchStudentRelations().catch(() => {})
        await this.fetchTutorRelations().catch(() => {})
      }
    },

    async declineRelation(id) {
      try {
        await relationsApi.declineRelation(id)
        notifySuccess(translate('relations.actions.declineSuccess'))
      } catch (error) {
        notifyError(error?.response?.data?.detail || translate('relations.actions.declineError'))
        throw error
      } finally {
        await this.fetchStudentRelations().catch(() => {})
        await this.fetchTutorRelations().catch(() => {})
      }
    },

    async resendRelation(id) {
      try {
        await relationsApi.resendRelation(id)
        notifySuccess(translate('relations.actions.resendSuccess'))
      } catch (error) {
        notifyError(error?.response?.data?.detail || translate('relations.actions.resendError'))
        throw error
      }
    },
  },
})
