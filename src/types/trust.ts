/**
 * Trust & Safety Types v0.66.0
 * 
 * TypeScript types for trust & safety features:
 * - User blocks
 * - User reports
 * - Ban status
 * - Trust status
 */

/**
 * User block entity
 */
export interface UserBlock {
  id: string
  blocked_user_id: number
  blocked_user_email: string
  reason: string
  created_at: string
}

/**
 * Request payload for blocking a user
 */
export interface BlockUserRequest {
  user_id: number
  reason?: string
}

/**
 * Request payload for unblocking a user
 */
export interface UnblockUserRequest {
  user_id: number
}

/**
 * Response for block/unblock operations
 */
export interface BlockResponse {
  ok: boolean
}

/**
 * List of user blocks
 */
export interface BlocksListResponse {
  blocks: UserBlock[]
}

/**
 * Report target types
 */
export enum ReportTargetType {
  INQUIRY = 'INQUIRY',
  RELATION = 'RELATION',
  MESSAGE = 'MESSAGE',
  PROFILE = 'PROFILE',
  PAYMENT = 'PAYMENT',
}

/**
 * Report categories
 */
export enum ReportCategory {
  SPAM = 'SPAM',
  HARASSMENT = 'HARASSMENT',
  FRAUD = 'FRAUD',
  INAPPROPRIATE = 'INAPPROPRIATE',
  OTHER = 'OTHER',
}

/**
 * Report status
 */
export enum ReportStatus {
  OPEN = 'OPEN',
  REVIEWED = 'REVIEWED',
  DISMISSED = 'DISMISSED',
  ACTIONED = 'ACTIONED',
}

/**
 * User report entity
 */
export interface UserReport {
  id: string
  target_type: ReportTargetType
  target_id: string | null
  category: ReportCategory
  details: string
  status: ReportStatus
  created_at: string
}

/**
 * Request payload for creating a report
 */
export interface CreateReportRequest {
  target_type: ReportTargetType
  target_id?: string | null
  category: ReportCategory
  details: string
}

/**
 * Response for report creation
 */
export interface CreateReportResponse {
  ok: boolean
  report_id: string
}

/**
 * List of user reports
 */
export interface ReportsListResponse {
  reports: UserReport[]
}

/**
 * Ban scope
 */
export enum BanScope {
  ALL = 'ALL',
  INQUIRIES = 'INQUIRIES',
  BILLING = 'BILLING',
  CHAT = 'CHAT',
  CONTACTS = 'CONTACTS',
}

/**
 * Active ban information
 */
export interface ActiveBan {
  scope: BanScope
  ends_at: string | null
  reason: string
}

/**
 * Ban status response
 */
export interface BanStatusResponse {
  bans: ActiveBan[]
}

/**
 * Trust status (aggregated)
 */
export interface TrustStatus {
  blocks: UserBlock[]
  bans: ActiveBan[]
  is_blocked_by_any: boolean
  has_active_bans: boolean
}
