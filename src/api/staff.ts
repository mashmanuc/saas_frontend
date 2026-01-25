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
