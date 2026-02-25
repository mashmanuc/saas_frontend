/**
 * Staff Profile Moderation API
 * 
 * Endpoints for managing tutor profile moderation (approve/reject).
 * Uses existing marketplace admin endpoints.
 */
import apiClient from '@/utils/apiClient'

const BASE_URL = '/v1/marketplace'

export interface AdminProfile {
  id: number
  user_id: number
  user_email: string
  first_name: string
  last_name: string
  status: string
  subjects: string[]
  created_at: string
  updated_at: string
}

export interface AdminProfileListResponse {
  results: AdminProfile[]
  count: number
}

export interface RejectProfilePayload {
  reason: string
}

/**
 * List all tutor profiles for moderation
 */
export async function getAdminProfiles(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<AdminProfile[]> {
  const res = await apiClient.get(`${BASE_URL}/admin/marketplace/profiles/`, { params })
  return Array.isArray(res) ? res : (res.results || [])
}

/**
 * Approve a tutor profile
 */
export async function approveProfile(profileId: number): Promise<{ status: string }> {
  return apiClient.post(`${BASE_URL}/admin/marketplace/profiles/${profileId}/approve/`)
}

/**
 * Reject a tutor profile with reason
 */
export async function rejectProfile(profileId: number, payload: RejectProfilePayload): Promise<{ status: string }> {
  return apiClient.post(`${BASE_URL}/admin/marketplace/profiles/${profileId}/reject/`, payload)
}

export default {
  getAdminProfiles,
  approveProfile,
  rejectProfile,
}
