import { defineStore } from 'pinia'
import bookingsApi from '../api/bookingsApi'
import { trackEvent } from '@/utils/telemetry'

export const useBookingStore = defineStore('booking', {
  state: () => ({
    bookings: {},
    currentBooking: null,
    loading: false,
    error: null
  }),

  actions: {
    async createTrialRequest(matchId, data) {
      this.loading = true
      this.error = null
      try {
        const booking = await bookingsApi.createTrialRequest(matchId, data)
        this.bookings[booking.booking_id] = booking
        trackEvent('booking.created', {
          match_id: matchId,
          booking_id: booking.booking_id,
          slot_start: data.slot_start,
          slot_end: data.slot_end,
          request_id: booking.request_id
        })
        return booking
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('booking.create_failed', {
          match_id: matchId,
          error: this.error,
          error_code: err.response?.data?.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    async confirmBooking(bookingId, data) {
      this.loading = true
      this.error = null
      try {
        const booking = await bookingsApi.confirmBooking(bookingId, data)
        this.bookings[bookingId] = booking
        trackEvent('booking.confirmed', {
          booking_id: bookingId,
          request_id: booking.request_id
        })
        return booking
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('booking.confirm_failed', {
          booking_id: bookingId,
          error: this.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    async cancelBooking(bookingId, reason) {
      this.loading = true
      this.error = null
      try {
        const booking = await bookingsApi.cancelBooking(bookingId, { reason })
        this.bookings[bookingId] = booking
        trackEvent('booking.canceled', {
          booking_id: bookingId,
          reason,
          request_id: booking.request_id
        })
        return booking
      } catch (err) {
        this.error = err.response?.data?.message || err.message
        trackEvent('booking.cancel_failed', {
          booking_id: bookingId,
          error: this.error,
          request_id: err.response?.data?.request_id
        })
        throw err
      } finally {
        this.loading = false
      }
    },

    async fetchBooking(bookingId) {
      this.loading = true
      this.error = null
      try {
        const booking = await bookingsApi.getBooking(bookingId)
        this.bookings[bookingId] = booking
        this.currentBooking = booking
        return booking
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
