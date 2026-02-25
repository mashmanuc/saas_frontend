/**
 * Staff Console API Client v0.67.0
 * 
 * API methods for staff/admin operations:
 * - User overview lookup
 * - Reports management
 * - Ban creation/lifting
 * - Billing cancellation
 */

import apiClient from '@/utils/apiClient'
import type {
  StaffUserOverview,
  StaffReport,
  StaffReportListParams,
  StaffReportListResponse,
  StaffReportResolvePayload,
  StaffCreateBanPayload,
  StaffLiftBanPayload,
  StaffCancelBillingPayload,
  StaffBan,
} from '@/types/staff'

const BASE_URL = '/v1/staff'

/**
 * Get user overview (trust, billing, activity)
 */
export async function getUserOverview(userId: string): Promise<StaffUserOverview> {
  return apiClient.get(`${BASE_URL}/users/${userId}/overview/`)
}

/**
 * List reports with optional filters
 */
export async function listReports(params?: StaffReportListParams): Promise<StaffReportListResponse> {
  return apiClient.get(`${BASE_URL}/reports/`, { params })
}

/**
 * Get single report details
 */
export async function getReport(id: string): Promise<StaffReport> {
  return apiClient.get(`${BASE_URL}/reports/${id}/`)
}

/**
 * Resolve a report (dismiss or actioned)
 */
export async function resolveReport(id: string, payload: StaffReportResolvePayload): Promise<StaffReport> {
  return apiClient.post(`${BASE_URL}/reports/${id}/resolve/`, payload)
}

/**
 * Create a ban
 */
export async function createBan(payload: StaffCreateBanPayload): Promise<StaffBan> {
  return apiClient.post(`${BASE_URL}/bans/`, payload)
}

/**
 * Lift a ban
 */
export async function liftBan(id: string, payload?: StaffLiftBanPayload): Promise<StaffBan> {
  return apiClient.post(`${BASE_URL}/bans/${id}/lift/`, payload || {})
}

/**
 * Cancel user billing/subscription
 */
export async function cancelBilling(userId: string, payload: StaffCancelBillingPayload): Promise<{ ok: boolean }> {
  return apiClient.post(`${BASE_URL}/billing/${userId}/cancel/`, payload)
}

/**
 * Manually verify user's email (staff action)
 */
export async function verifyEmail(userId: string): Promise<{ success: boolean; email?: string; reason?: string }> {
  return apiClient.post(`${BASE_URL}/users/${userId}/verify-email/`)
}

/**
 * Toggle user active/inactive status
 */
export async function toggleUserActive(userId: string): Promise<{ success: boolean; is_active: boolean; email: string }> {
  return apiClient.post(`${BASE_URL}/users/${userId}/toggle-active/`)
}

/**
 * Get audit log events for a specific user
 */
export async function getUserAuditLog(userId: string, params?: { limit?: number; offset?: number }): Promise<{
  results: AuditEvent[]
  count: number
  limit: number
  offset: number
}> {
  return apiClient.get(`${BASE_URL}/users/${userId}/audit-log/`, { params })
}

export interface AuditEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, any>
  created_at: string
}
