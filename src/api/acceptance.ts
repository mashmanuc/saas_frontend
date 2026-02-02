import { apiClient } from './client'
import type { AcceptAvailability, AcceptInquiryRequest, AcceptInquiryResponse } from '@/types/acceptance'

/**
 * Get accept availability for current tutor.
 * 
 * SSOT Section 7: GET /api/tutor/accept-availability/
 * 
 * @returns Accept availability with grace token if can_accept=true
 */
export async function getAcceptAvailability(): Promise<AcceptAvailability> {
  const response = await apiClient.get<AcceptAvailability>('/api/tutor/accept-availability/')
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
    `/api/inquiries/${inquiryId}/accept/`,
    payload
  )
  
  return response
}
