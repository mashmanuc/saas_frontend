/**
 * Tutor Settings API
 * 
 * v0.55.7.3 - Lesson links management
 */

import type { AxiosResponse } from 'axios'
import api from '@/utils/apiClient'

export interface LessonLinkProvider {
  provider: 'platform' | 'zoom' | 'meet' | 'custom'
  url: string | null
}

export interface TutorLessonLinksResponse {
  primary: LessonLinkProvider
  backup: LessonLinkProvider | null
  effective_primary: LessonLinkProvider
  updated_at: string
}

export interface TutorLessonLinksPatchPayload {
  primary?: LessonLinkProvider
  backup?: LessonLinkProvider | null
  updated_at?: string
}

type LessonLinksResponseShape = TutorLessonLinksResponse | AxiosResponse<TutorLessonLinksResponse>

const unwrapResponse = (response: LessonLinksResponseShape): TutorLessonLinksResponse =>
  (response && 'data' in response ? response.data : response) as TutorLessonLinksResponse

export const tutorSettingsApi = {
  /**
   * Get tutor lesson links configuration
   * GET /api/v1/tutors/me/lesson-links/
   */
  async getLessonLinks(): Promise<TutorLessonLinksResponse> {
    const response = (await api.get('/v1/tutors/me/lesson-links/')) as LessonLinksResponseShape
    return unwrapResponse(response)
  },

  /**
   * Update tutor lesson links configuration
   * PATCH /api/v1/tutors/me/lesson-links/
   */
  async patchLessonLinks(
    payload: TutorLessonLinksPatchPayload
  ): Promise<TutorLessonLinksResponse> {
    const response = (await api.patch('/v1/tutors/me/lesson-links/', payload)) as LessonLinksResponseShape
    return unwrapResponse(response)
  }
}
