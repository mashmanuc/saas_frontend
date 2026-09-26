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

// ── 2026-09-26: з якого пристрою входив користувач і які помилки мав ──────────
// Власник перед стартом реклами: «з якого гаджета зайшов вчитель і які помилки
// в нього вийшли». Дані — `UserSession` і `diagnostics_frontend_error` /
// `telemetry_events` на бекенді (apps/staff/api/user_insight_views.py).

export interface StaffDeviceInfo {
  kind: 'phone' | 'tablet' | 'computer' | 'bot' | 'unknown'
  os: string
  browser: string
  model: string
}

export interface StaffUserSession {
  id: string
  created_at: string | null
  last_active_at: string | null
  revoked_at: string | null
  revocation_reason: string
  /** ended — відкликано; expired — довше за строк refresh без руху; open — не завершена */
  status: 'open' | 'ended' | 'expired'
  device: StaffDeviceInfo
  country: string
  user_agent: string
}

export interface StaffFrontendErrorItem {
  id: number
  timestamp: string
  severity: 'info' | 'warning' | 'error'
  message: string
  page: string
  browser: string
  platform: string
  app_version: string
  component: string
  resource_url: string
  device_kind: string
  /** Розбір бекенда з сирого UA; null для записів, що прийшли до 2026-09-26 */
  device: StaffDeviceInfo | null
}

export interface StaffFailureEvent {
  id: number
  timestamp: string
  event_type: string
  details: Record<string, string | number | boolean | null>
}

export interface StaffUserErrorsResponse {
  frontend: StaffFrontendErrorItem[]
  frontend_count: number
  events: StaffFailureEvent[]
  events_count: number
}

export async function getUserSessions(
  userId: string,
  params?: { limit?: number },
): Promise<{ results: StaffUserSession[]; count: number }> {
  return apiClient.get(`${BASE_URL}/users/${userId}/sessions/`, { params })
}

export async function getUserErrors(userId: string, params?: { limit?: number }): Promise<StaffUserErrorsResponse> {
  return apiClient.get(`${BASE_URL}/users/${userId}/errors/`, { params })
}
