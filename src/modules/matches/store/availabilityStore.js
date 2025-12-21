import { defineStore } from 'pinia'
import availabilityApi from '../api/availabilityApi'
import { trackEvent } from '@/utils/telemetry'

export const useAvailabilityStore = defineStore('availability', {
  state: () => ({
    myAvailability: null,
    tutorAvailability: {},
    loading: false,
    error: null
  }),

  actions: {
    async updateMyAvailability(data) {
      this.loading = true
      this.error = null
      try {
        const result = await availabilityApi.updateAvailability(data)
        this.myAvailability = data
        trackEvent('availability.updated', {
          weekly_slots: data.weekly_template?.length || 0,
          overrides: data.overrides?.length || 0,
          blackout_dates: data.blackout_dates?.length || 0,
          updated_at: result.updated_at
        })
        return result
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('availability.update_failed', {
          error: this.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    async fetchTutorAvailability(slug, params = {}) {
      this.loading = true
      this.error = null
      try {
        const data = await availabilityApi.getTutorAvailability(slug, params)
        this.tutorAvailability[slug] = data
        trackEvent('availability.fetch', {
          tutor_slug: slug,
          week_start: params.week_start,
          timezone: params.timezone,
          slots_count: data.slots?.length || 0
        })
        return data
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    clearError() {
      this.error = null
    }
  }
})
