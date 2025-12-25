/**
 * Availability Types v0.49.5
 * Job tracking and slot generation types
 */

export interface AvailabilitySyncJob {
  id: number
  status: 'pending' | 'running' | 'success' | 'failed'
  slotsCreated: number
  slotsDeleted: number
  errorMessage: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  horizonDays: number
  timezone: string
}

export interface BulkAvailabilityResponse {
  message: string
  windows: AvailabilityWindow[]
  jobId: number
  jobStatus: 'pending' | 'running' | 'success' | 'failed'
}

export interface GenerateAvailabilityPayload {
  horizonDays?: number
}

export interface GenerateAvailabilityResponse {
  jobId: number
  status: 'pending' | 'running'
  message: string
}

export interface AvailabilityWindow {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  created_at: string
}

export interface WeeklySchedulePayload {
  schedule: {
    [dayOfWeek: string]: Array<{
      start_time: string
      end_time: string
    }>
  }
  timezone?: string
}

export interface TimeSlot {
  start_time: string
  end_time: string
}

export interface AvailabilityInput {
  day_of_week: number
  start_time: string
  end_time: string
}
