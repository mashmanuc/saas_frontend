import { apiClient } from './client'
import type { AcceptAvailability, AcceptInquiryRequest, AcceptInquiryResponse } from '@/types/acceptance'

/**
 * Get accept availability for current tutor.
 *
 * SSOT Section 7: GET /api/tutor/accept-availability/
 * BE route: apps/acceptance/api/urls.py:13 (unversioned, included via path('api/', ...))
 *
 * PR-FE-3 (2026-04-26): Removed double `/api/` prefix — apiClient baseURL is already
 * `/api`, so literal `/api/...` resulted in `/api/api/tutor/...` (404).
 *
 * @returns Accept availability with grace token if can_accept=true
 */
export async function getAcceptAvailability(): Promise<AcceptAvailability> {
  const response = await apiClient.get<AcceptAvailability>('/tutor/accept-availability/')
  return response
}

/**
 * Accept inquiry.
 * 
 * SSOT Section 6: POST /api/inquiries/:id/accept/
 * 
 * Backend decides whether to use onboarding or billing.
 * Frontend just passes grace_token if available.
 * 
 * @param inquiryId - Inquiry ID
 * @param graceToken - Optional grace token from getAcceptAvailability()
 */
export async function acceptInquiry(
  inquiryId: string,
  graceToken?: string
): Promise<AcceptInquiryResponse> {
  const payload: AcceptInquiryRequest = {}
  
  if (graceToken) {
    payload.grace_token = graceToken
  }
  
  const response = await apiClient.post<AcceptInquiryResponse>(
    `/api/v1/inquiries/${inquiryId}/accept/`,
    payload
  )
  
  return response
}
