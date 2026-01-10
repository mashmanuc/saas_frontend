/**
 * Staff Console API Client v0.67.0
 * 
 * API methods for staff/admin operations:
 * - User overview lookup
 * - Reports management
 * - Ban creation/lifting
 * - Billing cancellation
 */

import axios from 'axios'
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

const BASE_URL = '/api/v1/staff'

/**
 * Get user overview (trust, billing, activity)
 */
export async function getUserOverview(userId: string): Promise<StaffUserOverview> {
  const response = await axios.get<StaffUserOverview>(`${BASE_URL}/users/${userId}/overview/`)
  return response.data
}

/**
 * List reports with optional filters
 */
export async function listReports(params?: StaffReportListParams): Promise<StaffReportListResponse> {
  const response = await axios.get<StaffReportListResponse>(`${BASE_URL}/reports/`, { params })
  return response.data
}

/**
 * Get single report details
 */
export async function getReport(id: string): Promise<StaffReport> {
  const response = await axios.get<StaffReport>(`${BASE_URL}/reports/${id}/`)
  return response.data
}

/**
 * Resolve a report (dismiss or actioned)
 */
export async function resolveReport(id: string, payload: StaffReportResolvePayload): Promise<StaffReport> {
  const response = await axios.post<StaffReport>(`${BASE_URL}/reports/${id}/resolve/`, payload)
  return response.data
}

/**
 * Create a ban
 */
export async function createBan(payload: StaffCreateBanPayload): Promise<StaffBan> {
  const response = await axios.post<StaffBan>(`${BASE_URL}/bans/`, payload)
  return response.data
}

/**
 * Lift a ban
 */
export async function liftBan(id: string, payload?: StaffLiftBanPayload): Promise<StaffBan> {
  const response = await axios.post<StaffBan>(`${BASE_URL}/bans/${id}/lift/`, payload || {})
  return response.data
}

/**
 * Cancel user billing/subscription
 */
export async function cancelBilling(userId: string, payload: StaffCancelBillingPayload): Promise<{ ok: boolean }> {
  const response = await axios.post<{ ok: boolean }>(`${BASE_URL}/billing/${userId}/cancel/`, payload)
  return response.data
}
