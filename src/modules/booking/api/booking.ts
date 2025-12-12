// F1: Booking API Client
import apiClient from '@/utils/apiClient'

// Types
export interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  photo?: string
}

export interface TutorSettings {
  timezone: string
  default_lesson_duration: number
  buffer_before: number
  buffer_after: number
  min_booking_notice: number
  max_booking_advance: number
  auto_accept: boolean
  cancellation_policy: 'flexible' | 'moderate' | 'strict'
  email_notifications: boolean
  push_notifications: boolean
}

export interface TimeSlot {
  id: number
  date: string
  start_time: string
  end_time: string
  start_datetime: string
  end_datetime: string
  status: 'available' | 'booked' | 'blocked'
  duration_minutes: number
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'rescheduled'

// v0.24.2: Classroom session reference in booking
export interface ClassroomSessionRef {
  uuid: string
  status: 'scheduled' | 'waiting' | 'active' | 'paused' | 'completed' | 'terminated'
}

export interface Booking {
  id: number
  booking_id: string
  student: User
  tutor: User
  time_slot: TimeSlot
  subject: string
  lesson_type: 'trial' | 'regular' | 'package'
  status: BookingStatus
  student_notes: string
  tutor_notes?: string
  price: number
  currency: string
  classroom_id?: string
  classroom_session?: ClassroomSessionRef // v0.24.2
  created_at: string
  updated_at: string
  cancelled_at?: string
  cancelled_by?: 'student' | 'tutor'
  cancellation_reason?: string
}

export interface Availability {
  id: number
  day_of_week: number // 0-6 (Sunday-Saturday)
  start_time: string
  end_time: string
}

export interface AvailabilityInput {
  day_of_week: number
  start_time: string
  end_time: string
}

export interface DateException {
  id: number
  date: string
  exception_type: 'unavailable' | 'custom_hours'
  start_time?: string
  end_time?: string
  reason?: string
}

export interface ExceptionInput {
  date: string
  exception_type: 'unavailable' | 'custom_hours'
  start_time?: string
  end_time?: string
  reason?: string
}

export interface CustomSlotInput {
  date: string
  start_time: string
  end_time: string
}

export interface BookingInput {
  tutor_id: number
  slot_id: number
  subject: string
  lesson_type: 'trial' | 'regular' | 'package'
  student_notes?: string
}

export interface BookingListParams {
  status?: BookingStatus
  role?: 'student' | 'tutor'
  start_date?: string
  end_date?: string
  page?: number
  page_size?: number
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CalendarDay {
  date: string
  slots_count: number
  available_count: number
  booked_count: number
  has_bookings: boolean
}

export interface CalendarResponse {
  month: number
  year: number
  days: CalendarDay[]
}

// API Client
export const bookingApi = {
  // Settings
  async getSettings(): Promise<TutorSettings> {
    const response = await apiClient.get('/api/v1/booking/settings/')
    return response
  },

  async updateSettings(data: Partial<TutorSettings>): Promise<TutorSettings> {
    const response = await apiClient.patch('/api/v1/booking/settings/', data)
    return response
  },

  // Availability
  async getAvailability(): Promise<Availability[]> {
    const response = await apiClient.get('/api/v1/booking/availability/')
    return response
  },

  async setAvailability(schedule: AvailabilityInput[]): Promise<void> {
    await apiClient.post('/api/v1/booking/availability/', { schedule })
  },

  async deleteAvailability(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/booking/availability/${id}/`)
  },

  // Exceptions
  async getExceptions(start: string, end: string): Promise<DateException[]> {
    const response = await apiClient.get('/api/v1/booking/exceptions/', {
      params: { start, end },
    })
    return response
  },

  async addException(data: ExceptionInput): Promise<DateException> {
    const response = await apiClient.post('/api/v1/booking/exceptions/', data)
    return response
  },

  async deleteException(id: number): Promise<void> {
    await apiClient.delete(`/api/v1/booking/exceptions/${id}/`)
  },

  // Slots
  async getSlots(tutorId: number, start: string, end: string): Promise<TimeSlot[]> {
    const response = await apiClient.get('/api/v1/booking/slots/', {
      params: { tutor_id: tutorId, start, end },
    })
    return response
  },

  async blockSlot(slotId: number, reason?: string): Promise<void> {
    await apiClient.post('/api/v1/booking/slots/block/', {
      slot_id: slotId,
      reason,
    })
  },

  async unblockSlot(slotId: number): Promise<void> {
    await apiClient.post('/api/v1/booking/slots/unblock/', { slot_id: slotId })
  },

  async createCustomSlot(data: CustomSlotInput): Promise<TimeSlot> {
    const response = await apiClient.post('/api/v1/booking/slots/custom/', data)
    return response
  },

  // Bookings
  async getBookings(params?: BookingListParams): Promise<PaginatedResponse<Booking>> {
    const response = await apiClient.get('/api/v1/booking/bookings/', { params })
    return response
  },

  async getBooking(id: number): Promise<Booking> {
    const response = await apiClient.get(`/api/v1/booking/bookings/${id}/`)
    return response
  },

  async createBooking(data: BookingInput): Promise<Booking> {
    const response = await apiClient.post('/api/v1/booking/bookings/', data)
    return response
  },

  async confirmBooking(id: number): Promise<Booking> {
    const response = await apiClient.post(`/api/v1/booking/bookings/${id}/confirm/`)
    return response
  },

  async cancelBooking(id: number, reason?: string): Promise<Booking> {
    const response = await apiClient.post(`/api/v1/booking/bookings/${id}/cancel/`, {
      reason,
    })
    return response
  },

  async rescheduleBooking(
    id: number,
    newSlotId: number,
    reason?: string
  ): Promise<Booking> {
    const response = await apiClient.post(
      `/api/v1/booking/bookings/${id}/reschedule/`,
      {
        new_slot_id: newSlotId,
        reason,
      }
    )
    return response
  },

  // Calendar
  async getCalendar(
    tutorId: number,
    month: number,
    year: number
  ): Promise<CalendarResponse> {
    const response = await apiClient.get('/api/v1/booking/calendar/', {
      params: { tutor_id: tutorId, month, year },
    })
    return response
  },
}

export default bookingApi
