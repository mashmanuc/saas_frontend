import apiClient from '@/utils/apiClient'
import { useErrorRecovery } from '@/composables/useErrorRecovery'

export interface AvailabilityParams {
  week_start: string
  timezone?: string
  duration?: number
}

export interface TimeSlot {
  id: number
  date: string
  start_time: string
  end_time: string
  start_datetime: string
  end_datetime: string
  duration_minutes: number
  status: 'available' | 'booked' | 'blocked'
}

export interface AvailabilityResponse {
  tutor_slug: string
  week_start: string
  timezone: string
  slots: TimeSlot[]
  summary: {
    total_slots: number
    available_slots: number
    earliest_available: string | null
  }
}

export interface AvailabilitySummary {
  has_availability: boolean
  next_available_slot: string | null
  weekly_hours: number
  response_time_hours: number
  timezone: string
  updated_at: string
}

export const availabilityApi = {
  async getTutorAvailability(
    slug: string,
    params: AvailabilityParams
  ): Promise<AvailabilityResponse> {
    const { executeWithRetry } = useErrorRecovery({
      maxRetries: 2,
      retryDelay: 1000
    })
    
    return executeWithRetry(async () => {
      const { data } = await apiClient.get(`/api/v1/tutors/${slug}/availability`, {
        params
      })
      return data
    }, 'getTutorAvailability')
  },

  async getTutorAvailabilitySummary(slug: string): Promise<AvailabilitySummary> {
    const { executeWithRetry } = useErrorRecovery({
      maxRetries: 2,
      retryDelay: 1000
    })
    
    return executeWithRetry(async () => {
      const { data } = await apiClient.get(
        `/api/v1/marketplace/tutors/${slug}/availability-summary`
      )
      return data
    }, 'getTutorAvailabilitySummary')
  },

  async updateAvailability(schedule: any[]): Promise<any> {
    const { data } = await apiClient.post('/api/v1/booking/availability/bulk/', {
      schedule
    })
    return data
  },

  async blockSlot(slotId: number, reason?: string): Promise<any> {
    const { data } = await apiClient.post('/api/v1/booking/slots/block/', {
      slot_id: slotId,
      reason
    })
    return data
  }
}

export default availabilityApi
