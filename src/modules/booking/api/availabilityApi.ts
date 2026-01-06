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

export interface TutorAvailabilityFull {
  tutor_slug: string
  timezone: string
  week_start: string
  slots: TimeSlot[]
  summary: AvailabilitySummary
}

export interface TemplateSlot {
  weekday: number
  start_time: string
  end_time: string
}

export interface ApplyTemplateResponse {
  job_id: string
  eta_seconds: number
}

export interface JobStatus {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  progress?: number
  error?: string
  result?: any
}

export interface AvailabilityTemplate {
  id: number
  tutor_id: number
  weekly_slots: Array<{weekday: number, start: string, end: string}>
  timezone: string
  version: number
  last_generation_job_id: string | null
  updated_at: string
}

export interface GenerationJob {
  job_id: string
  status: 'queued' | 'running' | 'done' | 'failed'
  slots_created: number
  slots_deleted: number
  error_message: string | null
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
      const { data } = await apiClient.get(`/v1/tutors/${slug}/availability`, {
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
        `/v1/marketplace/tutors/${slug}/availability-summary`
      )
      return data
    }, 'getTutorAvailabilitySummary')
  },

  async updateAvailability(schedule: any[]): Promise<any> {
    const { data } = await apiClient.post('/booking/availability/bulk/', {
      schedule
    })
    return data
  },

  async blockSlot(slotId: number, reason?: string): Promise<any> {
    const { data } = await apiClient.post('/booking/slots/block/', {
      slot_id: slotId,
      reason
    })
    return data
  },

  async getTutorAvailabilityFull(slug: string, params?: { week_start?: string; timezone?: string }): Promise<TutorAvailabilityFull> {
    const { data } = await apiClient.get(`/v1/availability/tutors/${slug}`, { params })
    return data
  },

  async createTemplate(slots: TemplateSlot[]): Promise<{ template_id: number; version: number }> {
    const { data } = await apiClient.post('/v1/availability/templates', slots)
    return data
  },

  async applyTemplate(): Promise<ApplyTemplateResponse> {
    const { data } = await apiClient.post('/v1/availability/templates/apply')
    return data
  },

  async getJobStatus(jobId: string): Promise<JobStatus> {
    const { data } = await apiClient.get(`/v1/availability/jobs/${jobId}`)
    return data
  },

  async createSlot(slotData: { date: string; start_time: string; end_time: string }): Promise<TimeSlot> {
    const { data } = await apiClient.post('/v1/availability/slots', slotData)
    return data
  },

  async deleteSlot(slotId: number): Promise<void> {
    await apiClient.delete(`/v1/availability/slots/${slotId}`)
  },

  async blockSlotV2(slotId: number, reason?: string): Promise<void> {
    await apiClient.post(`/v1/availability/slots/${slotId}/block`, { reason })
  },

  async bulkApply(data: { changes: any[] }): Promise<any> {
    const response = await apiClient.post('/booking/availability/bulk', data)
    return response.data
  },

  async getTemplate(): Promise<AvailabilityTemplate | null> {
    try {
      const response = await apiClient.get('/v1/booking/availability/template/')
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  async saveTemplate(data: {
    weekly_slots: Array<{weekday: number, start: string, end: string}>
    timezone: string
    auto_generate: boolean
  }): Promise<AvailabilityTemplate> {
    try {
      const response = await apiClient.put('/v1/booking/availability/template/', data)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        const response = await apiClient.post('/v1/booking/availability/template/', data)
        return response.data
      }
      throw error
    }
  },

  async deleteTemplate(): Promise<void> {
    await apiClient.delete('/v1/booking/availability/template/')
  },

  async getGenerationJobStatus(jobId: string): Promise<GenerationJob> {
    const response = await apiClient.get(`/v1/booking/availability/jobs/${jobId}/`)
    return response.data
  },
}

export default availabilityApi
