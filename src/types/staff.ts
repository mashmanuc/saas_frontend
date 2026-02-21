/**
 * Staff Console Types v0.67.0
 * 
 * Types for staff/admin operations: user overview, reports, bans, billing
 */

export enum BanScope {
  CONTACTS = 'CONTACTS',
  PLATFORM = 'PLATFORM',
  MESSAGING = 'MESSAGING'
}

export enum ReportStatus {
  OPEN = 'OPEN',
  DISMISSED = 'DISMISSED',
  ACTIONED = 'ACTIONED'
}

export enum BillingCancelMode {
  AT_PERIOD_END = 'at_period_end',
  IMMEDIATE = 'immediate'
}

export interface StaffUser {
  id: string
  role: string
  email: string
  first_name?: string
  last_name?: string
  is_active?: boolean
  created_at: string
}

export interface StaffBan {
  id: string
  scope: BanScope
  ends_at: string | null
  reason: string
  status: 'ACTIVE' | 'LIFTED'
  created_at: string
  lifted_at?: string | null
}

export interface StaffTrustInfo {
  bans: StaffBan[]
  blocks_count: number
  reports_open_count: number
}

export interface StaffBillingInfo {
  plan: string | null
  subscription_status: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

export interface StaffActivityInfo {
  inquiries_count_30d: number
  contacts_unlocked_30d: number
}

export interface StaffUserOverview {
  user: StaffUser
  trust: StaffTrustInfo
  billing: StaffBillingInfo
  activity: StaffActivityInfo
}

export interface StaffReport {
  id: string
  reporter_id: string
  reporter_name?: string
  target_id: string
  target_name?: string
  target_type: string
  category: string
  details: string | null
  status: ReportStatus
  created_at: string
  resolved_at?: string | null
  resolved_by?: string | null
  resolution_note?: string | null
}

export interface StaffReportListParams {
  status?: ReportStatus
  limit?: number
  offset?: number
}

export interface StaffReportResolvePayload {
  status: 'DISMISSED' | 'ACTIONED'
  note?: string
}

export interface StaffCreateBanPayload {
  user_id: string
  scope: BanScope
  ends_at?: string | null
  reason: string
}

export interface StaffLiftBanPayload {
  reason?: string
}

export interface StaffCancelBillingPayload {
  mode: BillingCancelMode
  reason?: string
}

export interface StaffReportListResponse {
  reports: StaffReport[]
  total: number
}
