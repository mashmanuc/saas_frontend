/**
 * Staff API v0.88.3
 * 
 * API methods for staff operations.
 */

import apiClient from '@/utils/apiClient'

export interface TutorActivityListItem {
  tutor_id: number
  email: string
  plan_code: string
  current_month: string
  activity_required: boolean
  required_count: number
  activity_count: number
  meets_requirement: boolean
  has_exemption: boolean
  last_activity_at: string | null
}

export interface TutorActivityListResponse {
  count: number
  results: TutorActivityListItem[]
}

export interface GrantExemptionRequest {
  month: string
  reason: string
}

const staffApi = {
  /**
   * Get list of tutors with activity status
   * GET /api/v1/staff/tutors/activity-list
   */
  async getTutorActivityList(params?: {
    month?: string
    limit?: number
    offset?: number
  }): Promise<TutorActivityListResponse> {
    const response = await apiClient.get('/v1/staff/tutors/activity-list/', {
      params,
    })
    return response as unknown as TutorActivityListResponse
  },

  /**
   * Grant activity exemption to tutor
   * POST /api/v1/staff/tutors/{id}/grant-activity-exemption
   */
  async grantActivityExemption(
    tutorId: number,
    data: GrantExemptionRequest
  ): Promise<void> {
    await apiClient.post(`/v1/staff/tutors/${tutorId}/grant-activity-exemption/`, data)
  },
}

export default staffApi
