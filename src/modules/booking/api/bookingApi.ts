import apiClient from '@/utils/apiClient'

export interface TrialBookingRequest {
  slot_id: number
  subject: string
  student_notes?: string
}

export interface Booking {
  booking_id: string
  status: 'pending' | 'confirmed' | 'cancelled_student' | 'cancelled_tutor'
  time_slot: {
    id: number
    date: string
    start_time: string
    end_time: string
    start_datetime: string
    end_datetime: string
  }
  tutor: {
    id: number
    name: string
    slug: string
    avatar?: string
  }
  student: {
    id: number
    name: string
    avatar?: string
  }
  subject: string
  student_notes?: string
  tutor_notes?: string
  created_at: string
  confirmed_at?: string
  cancelled_at?: string
  cancellation_reason?: string
  request_id: string
}

export interface BookingConfirmRequest {
  tutor_notes?: string
}

export interface BookingCancelRequest {
  reason: string
}

export const bookingApi = {
  async createTrialBooking(
    matchId: string,
    data: TrialBookingRequest
  ): Promise<Booking> {
    const { data: response } = await apiClient.post(
      `/api/v1/matches/${matchId}/trial-request`,
      data
    )
    return response
  },

  async confirmBooking(
    bookingId: string,
    data: BookingConfirmRequest
  ): Promise<Booking> {
    const { data: response } = await apiClient.post(
      `/api/v1/bookings/${bookingId}/confirm`,
      data
    )
    return response
  },

  async cancelBooking(
    bookingId: string,
    data: BookingCancelRequest
  ): Promise<Booking> {
    const { data: response } = await apiClient.post(
      `/api/v1/bookings/${bookingId}/cancel`,
      data
    )
    return response
  }
}

export default bookingApi
