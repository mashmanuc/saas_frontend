import { defineStore } from 'pinia'
import matchesApi from '../api/matchesApi'
import { trackEvent } from '@/utils/telemetry'

export const useMatchStore = defineStore('match', {
  state: () => ({
    matches: [],
    currentMatch: null,
    loading: false,
    error: null
  }),

  getters: {
    invitedMatches: (state) => state.matches.filter(m => m.status === 'invited'),
    activeMatches: (state) => state.matches.filter(m => m.status === 'active'),
    archivedMatches: (state) => state.matches.filter(m => m.status === 'archived')
  },

  actions: {
    async createMatch(tutorId, message = null) {
      this.loading = true
      this.error = null
      try {
        const data = await matchesApi.createMatch(tutorId, message)
        this.matches.push(data)
        trackEvent('match.requested', {
          match_id: data.match_id,
          tutor_id: tutorId,
          request_id: data.request_id
        })
        return data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('match.request_failed', {
          tutor_id: tutorId,
          error: this.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    async fetchMatches(params = {}) {
      this.loading = true
      this.error = null
      try {
        const data = await matchesApi.getMatches(params)
        this.matches = data.results || []
        return data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async acceptMatch(matchId) {
      this.loading = true
      this.error = null
      try {
        const data = await matchesApi.acceptMatch(matchId)
        const match = this.matches.find(m => m.match_id === matchId)
        if (match) {
          match.status = data.status
        }
        trackEvent('match.accepted', {
          match_id: matchId,
          request_id: data.request_id
        })
        return data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('match.accept_failed', {
          match_id: matchId,
          error: this.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    async declineMatch(matchId) {
      this.loading = true
      this.error = null
      try {
        const data = await matchesApi.declineMatch(matchId)
        const match = this.matches.find(m => m.match_id === matchId)
        if (match) {
          match.status = data.status
        }
        trackEvent('match.declined', {
          match_id: matchId,
          request_id: data.request_id
        })
        return data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('match.decline_failed', {
          match_id: matchId,
          error: this.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    async archiveMatch(matchId) {
      this.loading = true
      this.error = null
      try {
        const data = await matchesApi.archiveMatch(matchId)
        const match = this.matches.find(m => m.match_id === matchId)
        if (match) {
          match.status = data.status
        }
        trackEvent('match.archived', {
          match_id: matchId,
          request_id: data.request_id
        })
        return data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('match.archive_failed', {
          match_id: matchId,
          error: this.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    setCurrentMatch(match) {
      this.currentMatch = match
    },

    clearError() {
      this.error = null
    }
  }
})
