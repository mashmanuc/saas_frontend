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
  start_datetime?: string
  end_datetime?: string
  status: 'available' | 'booked' | 'blocked'
  duration_minutes?: number
  created_at?: string
  updated_at?: string
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
    const response = await apiClient.get('/booking/settings/')
    return response as unknown as TutorSettings
  },

  async updateSettings(data: Partial<TutorSettings>): Promise<TutorSettings> {
    const response = await apiClient.patch('/booking/settings/', data)
    return response as unknown as TutorSettings
  },

  // Availability
  async getAvailability(): Promise<Availability[]> {
    const response = await apiClient.get('/booking/availability/')
    return response as unknown as Availability[]
  },

  async setAvailability(schedule: AvailabilityInput[]): Promise<void> {
    await apiClient.post('/booking/availability/', { schedule })
  },

  async deleteAvailability(id: number): Promise<void> {
    await apiClient.delete(`/booking/availability/${id}/`)
  },

  // Exceptions
  async getExceptions(start: string, end: string): Promise<DateException[]> {
    const response = await apiClient.get('/booking/exceptions/', {
      params: { start, end },
    })
    return response as unknown as DateException[]
  },

  async addException(data: ExceptionInput): Promise<DateException> {
    const response = await apiClient.post('/booking/exceptions/', data)
    return response as unknown as DateException
  },

  async deleteException(id: number): Promise<void> {
    await apiClient.delete(`/booking/exceptions/${id}/`)
  },

  // Slots
  async getSlots(tutorId: number, start: string, end: string): Promise<TimeSlot[]> {
    const response = await apiClient.get('/booking/slots/', {
      params: { tutor_id: tutorId, start, end },
    })
    return response as unknown as TimeSlot[]
  },

  async blockSlot(slotId: number, reason?: string): Promise<void> {
    await apiClient.post('/booking/slots/block/', {
      slot_id: slotId,
      reason,
    })
  },

  async unblockSlot(slotId: number): Promise<void> {
    await apiClient.post('/booking/slots/unblock/', { slot_id: slotId })
  },

  async createCustomSlot(data: CustomSlotInput): Promise<TimeSlot> {
    const response = await apiClient.post('/booking/slots/custom/', data)
    return response.data
  },

  async updateSlot(slotId: number, data: { start?: string; end?: string }): Promise<TimeSlot> {
    const response = await apiClient.patch(`/booking/slots/${slotId}/`, data)
    return response.data
  },

  async deleteSlot(slotId: number): Promise<void> {
    await apiClient.delete(`/booking/slots/${slotId}/`)
  },

  // Bookings
  async getBookings(params?: BookingListParams): Promise<PaginatedResponse<Booking>> {
    const response = await apiClient.get('/booking/bookings/', { params })
    return response as unknown as PaginatedResponse<Booking>
  },

  async getBooking(id: number): Promise<Booking> {
    const response = await apiClient.get(`/booking/bookings/${id}/`)
    return response as unknown as Booking
  },

  async createBooking(data: BookingInput): Promise<Booking> {
    const response = await apiClient.post('/booking/bookings/', data)
    return response as unknown as Booking
  },

  async confirmBooking(id: number): Promise<Booking> {
    const response = await apiClient.post(`/booking/bookings/${id}/confirm/`)
    return response as unknown as Booking
  },

  async cancelBooking(id: number, reason?: string): Promise<Booking> {
    const response = await apiClient.post(`/booking/bookings/${id}/cancel/`, {
      reason,
    })
    return response as unknown as Booking
  },

  async rescheduleBooking(
    id: number,
    newSlotId: number,
    reason?: string
  ): Promise<Booking> {
    const response = await apiClient.post(
      `/booking/bookings/${id}/reschedule/`,
      {
        new_slot_id: newSlotId,
        reason,
      }
    )
    return response as unknown as Booking
  },

  // Calendar
  async getCalendar(
    tutorId: number,
    month: number,
    year: number
  ): Promise<CalendarResponse> {
    const response = await apiClient.get('/booking/calendar/', {
      params: { tutor_id: tutorId, month, year },
    })
    return response as unknown as CalendarResponse
  },

  async createManualBooking(data: any, idempotencyKey: string): Promise<any> {
    const response = await apiClient.post('/api/bookings/manual/', data, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    })
    return response.data
  },

  async searchStudents(query: string): Promise<any[]> {
    const response = await apiClient.get('/api/v1/students/search', {
      params: { q: query },
    })
    return response.data.results || []
  },
}

export default bookingApi
