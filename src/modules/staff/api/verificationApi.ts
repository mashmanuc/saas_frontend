/**
 * Staff Verification API
 * 
 * Endpoints for managing tutor verification (KYC documents review).
 * Uses existing marketplace + trust admin endpoints.
 */
import apiClient from '@/utils/apiClient'

const MARKETPLACE_URL = '/v1/marketplace'
const TRUST_URL = '/v1/trust'

export interface VerificationItem {
  id: number
  user_id: number
  user_email: string
  first_name: string
  last_name: string
  verification_type: string
  status: string
  submitted_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  documents: string[]
  notes: string | null
}

export interface ReviewVerificationPayload {
  status: 'APPROVED' | 'REJECTED'
  notes?: string
}

/**
 * List marketplace verifications for review
 */
export async function getMarketplaceVerifications(params?: {
  status?: string
}): Promise<VerificationItem[]> {
  const res = await apiClient.get(`${MARKETPLACE_URL}/admin/marketplace/verifications/`, { params })
  return Array.isArray(res) ? res : (res.results || [])
}

/**
 * Review a marketplace verification (approve/reject)
 */
export async function reviewMarketplaceVerification(
  verificationId: number,
  payload: ReviewVerificationPayload
): Promise<{ status: string }> {
  return apiClient.post(
    `${MARKETPLACE_URL}/admin/marketplace/verifications/${verificationId}/review/`,
    payload
  )
}

/**
 * List trust/KYC pending verifications
 */
export async function getTrustVerifications(): Promise<VerificationItem[]> {
  const res = await apiClient.get(`${TRUST_URL}/admin/verification/pending/`)
  return Array.isArray(res) ? res : (res.results || [])
}

/**
 * Approve trust/KYC verification
 */
export async function approveTrustVerification(verificationId: number): Promise<{ status: string }> {
  return apiClient.post(`${TRUST_URL}/admin/verification/${verificationId}/approve/`)
}

/**
 * Reject trust/KYC verification
 */
export async function rejectTrustVerification(
  verificationId: number,
  payload: { reason: string }
): Promise<{ status: string }> {
  return apiClient.post(`${TRUST_URL}/admin/verification/${verificationId}/reject/`, payload)
}

export default {
  getMarketplaceVerifications,
  reviewMarketplaceVerification,
  getTrustVerifications,
  approveTrustVerification,
  rejectTrustVerification,
}
