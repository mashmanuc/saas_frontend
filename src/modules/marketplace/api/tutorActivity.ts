/**
 * Tutor Activity API v0.93.0
 */

import apiClient from '@/utils/apiClient'

export interface TutorActivityStatus {
  activity_status: 'ACTIVE' | 'INACTIVE_SOFT'
  activity_reason: string
  eligible: boolean
  reactions_count: number
  exemption_until: string | null
  exemption_reason: string | null
  current_month: string
}

const tutorActivityApi = {
  /**
   * Get current tutor's activity status
   * GET /api/v1/tutor/activity-status
   * 
   * v0.93.0: Returns activity status for ActivityStatusBanner
   */
  async getMyActivityStatus(): Promise<TutorActivityStatus> {
    const response = await apiClient.get('/v1/tutor/activity-status/')
    return response as unknown as TutorActivityStatus
  },
}

export default tutorActivityApi
