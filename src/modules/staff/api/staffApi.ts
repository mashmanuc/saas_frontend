/**
 * Staff API v0.89.0
 * 
 * DOMAIN-01: Staff Control Plane — Tutor Activity Table + Exemptions
 * 
 * API methods for staff operations.
 */

import apiClient from '@/utils/apiClient'

export interface TutorActivityListItem {
  tutor_id: number
  user_id: number
  email: string
  full_name: string
  activity_status: 'OK' | 'WARNING' | 'RESTRICTED' | 'EXEMPTED'
  eligible: boolean
  responses_this_month: number
  last_response_at: string | null
  exemption_until: string | null
  exemption_reason: string | null
  updated_at: string
}

export interface TutorActivityListResponse {
  count: number
  results: TutorActivityListItem[]
}

export interface GrantExemptionRequest {
  until: string
  reason: string
}

export interface RevokeExemptionRequest {
  reason: string
}

const staffApi = {
  /**
   * Get list of tutors with activity status
   * GET /api/v1/staff/tutors/activity-list
   * 
   * v0.89.0 DOMAIN-01: Added query/status filters
   */
  async getTutorActivityList(params?: {
    limit?: number
    offset?: number
    query?: string
    status?: 'OK' | 'WARNING' | 'RESTRICTED' | 'EXEMPTED'
  }): Promise<TutorActivityListResponse> {
    const response = await apiClient.get('/v1/staff/tutors/activity-list/', {
      params,
    })
    return response as unknown as TutorActivityListResponse
  },

  /**
   * Grant activity exemption to tutor
   * POST /api/v1/staff/tutors/{id}/grant-exemption
   * 
   * v0.89.0 DOMAIN-01: Updated to use 'until' datetime instead of 'month'
   */
  async grantExemption(
    tutorId: number,
    data: GrantExemptionRequest
  ): Promise<void> {
    await apiClient.post(`/v1/staff/tutors/${tutorId}/grant-exemption/`, data)
  },

  /**
   * Revoke activity exemption from tutor
   * POST /api/v1/staff/tutors/{id}/revoke-exemption
   * 
   * v0.89.0 DOMAIN-01: New endpoint
   */
  async revokeExemption(
    tutorId: number,
    data: RevokeExemptionRequest
  ): Promise<void> {
    await apiClient.post(`/v1/staff/tutors/${tutorId}/revoke-exemption/`, data)
  },
}

export default staffApi
