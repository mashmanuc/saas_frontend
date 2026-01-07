import { defineStore } from 'pinia'
import relationsApi from '../api/relations'
import { notifyError, notifySuccess, notifyWarning, notifyInfo } from '../utils/notify'
import { i18n } from '../i18n'

function normalizeTutorRelationsResponse(response) {
  // legacy: { results, cursor, has_more, summary }
  // new:    { relations: { results, cursor, has_more }, counters, recent_actions, filters }

  const relationsBlock = response?.relations ?? response ?? {}

  const isArrayPayload = Array.isArray(relationsBlock)
  const hasResultsArray = Array.isArray(relationsBlock?.results)

  if (!isArrayPayload && !hasResultsArray && import.meta.env?.DEV) {
    console.warn('[relationsStore] Unexpected tutor relations payload shape', response)
  }

  const results = isArrayPayload ? relationsBlock : hasResultsArray ? relationsBlock.results : []

  const cursor =
    typeof relationsBlock.cursor === 'string' || relationsBlock.cursor === null
      ? relationsBlock.cursor
      : null

  const hasMore = typeof relationsBlock.has_more === 'boolean' ? relationsBlock.has_more : false

  const summary = response?.counters ?? relationsBlock?.summary ?? null

  return {
    results,
    cursor,
    hasMore,
    summary,
    recentActions: response?.recent_actions ?? null,
    filters: response?.filters ?? null,
  }
}

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
    tutorSummary: null,
    tutorCursor: null,
    tutorHasMore: false,
    tutorLoading: false,
    tutorLoadingMore: false,
    tutorBulkLoading: false,
    tutorError: null,
    tutorErrorCode: null,
    tutorFilter: 'all',
    tutorSelectedIds: [],
  }),

  getters: {
    invitedStudentRelations: (state) => state.studentRelations.filter((rel) => rel.status === 'invited'),
    activeStudentRelations: (state) => state.studentRelations.filter((rel) => rel.status === 'active'),
    filteredTutorRelations: (state) => state.tutorRelations,
    selectedTutorRelations(state) {
      return state.tutorRelations.filter((relation) => state.tutorSelectedIds.includes(relation.id))
    },
    selectedTutorCount() {
      return this.selectedTutorRelations.length
    },
    selectedInvitedCount() {
      return this.selectedTutorRelations.filter((relation) => relation.status === 'invited').length
    },
    canBulkAccept() {
      return this.selectedInvitedCount > 0
    },
    canBulkArchive() {
      return this.selectedTutorRelations.length > 0
    },
    isTutorSelected: (state) => (relationId) => state.tutorSelectedIds.includes(relationId),
  },

  actions: {
    async setTutorFilter(value) {
      if (this.tutorFilter === value) return
      this.tutorFilter = value
      this.tutorCursor = null
      this.tutorHasMore = false
      this.tutorRelations = []
      this.clearTutorSelection()
      await this.fetchTutorRelations()
    },
    toggleTutorSelection(id) {
      if (this.tutorSelectedIds.includes(id)) {
        this.tutorSelectedIds = this.tutorSelectedIds.filter((selectedId) => selectedId !== id)
      } else {
        this.tutorSelectedIds = [...this.tutorSelectedIds, id]
      }
    },
    selectAllCurrentTutorRelations() {
      this.tutorSelectedIds = this.tutorRelations.map((relation) => relation.id)
    },
    clearTutorSelection() {
      this.tutorSelectedIds = []
    },
    pruneTutorSelection() {
      const availableIds = new Set(this.tutorRelations.map((relation) => relation.id))
      this.tutorSelectedIds = this.tutorSelectedIds.filter((id) => availableIds.has(id))
    },

    async fetchStudentRelations(params = {}) {
      this.studentLoading = true
      this.studentError = null

      try {
        const data = await relationsApi.getStudentRelations(params)
        this.studentRelations = Array.isArray(data) ? data : data?.results || []
      } catch (error) {
        const status = error?.response?.status
        if (status === 404) {
          this.studentRelations = []
          this.studentError = null
          return
        }
        this.studentError = error?.response?.data?.detail || 'Не вдалося отримати звʼязки студента.'
        throw error
      } finally {
        this.studentLoading = false
      }
    },

    async fetchTutorRelations({ cursor = null, append = false } = {}) {
      if (append && !this.tutorHasMore) {
        return
      }

      if (append) {
        this.tutorLoadingMore = true
      } else {
        this.tutorLoading = true
      }

      this.tutorError = null
      this.tutorErrorCode = null

      try {
        const params = { status: this.tutorFilter }
        if (cursor) {
          params.cursor = cursor
        }
        const response = await relationsApi.getTutorRelations(params)
        const normalized = normalizeTutorRelationsResponse(response)
        const results = normalized.results
        if (append) {
          this.tutorRelations = [...this.tutorRelations, ...results]
        } else {
          this.tutorRelations = results
        }

        this.tutorCursor = normalized.cursor
        this.tutorHasMore = normalized.hasMore
        this.tutorSummary = normalized.summary
        this.pruneTutorSelection()
      } catch (error) {
        const status = error?.response?.status
        if (!error?.response) {
          this.tutorErrorCode = 'offline'
          this.tutorError = translate('relations.errors.offline')
        } else if (status === 429) {
          this.tutorErrorCode = 'rate-limit'
          this.tutorError = translate('relations.errors.rateLimit')
        } else {
          this.tutorErrorCode = 'backend'
          this.tutorError = error?.response?.data?.detail || translate('relations.errors.loadTutor')
        }
        throw error
      } finally {
        this.tutorLoading = false
        this.tutorLoadingMore = false
      }
    },

    async loadMoreTutorRelations() {
      if (!this.tutorCursor || this.tutorLoadingMore) return
      await this.fetchTutorRelations({ cursor: this.tutorCursor, append: true })
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
      } finally {
        await this.fetchTutorRelations().catch(() => {})
      }
    },

    async bulkAcceptSelectedTutorRelations() {
      const ids = this.selectedTutorRelations.filter((relation) => relation.status === 'invited').map((relation) => relation.id)
      if (!ids.length) {
        notifyWarning(translate('relations.bulk.noInvited'))
        return
      }

      this.tutorBulkLoading = true
      try {
        const result = await relationsApi.bulkAcceptTutorRelations(ids)
        this.handleBulkResult('accept', result)
        this.clearTutorSelection()
        await this.fetchTutorRelations().catch(() => {})
        await this.fetchStudentRelations().catch(() => {})
      } catch (error) {
        notifyError(error?.response?.data?.detail || translate('relations.bulk.genericError'))
        throw error
      } finally {
        this.tutorBulkLoading = false
      }
    },

    async bulkArchiveSelectedTutorRelations() {
      if (!this.selectedTutorRelations.length) {
        notifyWarning(translate('relations.bulk.emptySelection'))
        return
      }

      this.tutorBulkLoading = true
      try {
        const result = await relationsApi.bulkArchiveTutorRelations(this.tutorSelectedIds)
        this.handleBulkResult('archive', result)
        this.clearTutorSelection()
        await this.fetchTutorRelations().catch(() => {})
      } catch (error) {
        notifyError(error?.response?.data?.detail || translate('relations.bulk.genericError'))
        throw error
      }
      finally {
        this.tutorBulkLoading = false
      }
    },

    handleBulkResult(type, result = {}) {
      const processedCount = Array.isArray(result?.processed) ? result.processed.length : 0
      const failedCount = Array.isArray(result?.failed) ? result.failed.length : 0

      if (processedCount) {
        notifySuccess(
          translate(`relations.bulk.${type}Success`, {
            count: processedCount,
          }),
        )
      }

      if (failedCount) {
        notifyWarning(
          translate('relations.bulk.partialFailure', {
            failed: failedCount,
          }),
        )
      }

      if (!processedCount && !failedCount) {
        notifyInfo(translate('relations.bulk.noChanges'))
      }
    },
  },
})
