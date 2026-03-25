/**
 * TutorInvite Types
 * 
 * Типи для системи tutor invites (invite-based student onboarding)
 */

/**
 * Статус invite
 */
export type InviteStatus = 'active' | 'used' | 'expired' | 'cancelled'

/**
 * Tutor info для invite (public)
 */
export interface InviteTutorInfo {
  id: string
  full_name: string
  first_name: string
  avatar_url?: string
  subjects?: string[]
}

/**
 * Invite DTO
 */
export interface InviteDTO {
  public_id: string
  token: string
  status: InviteStatus
  created_at: string
  expires_at: string
  opened_at?: string
  opened_count?: number
  used_at?: string
  invite_url: string
  is_expired: boolean
  is_active: boolean
  cost_contacts: number
  tutor_info?: InviteTutorInfo
}

/**
 * Create invite response
 */
export interface CreateInviteResponse extends InviteDTO {}

/**
 * Invite detail response
 */
export interface InviteDetailResponse extends InviteDTO {}

/**
 * Accept invite response
 */
export interface AcceptInviteResponse extends InviteDTO {}

/**
 * Invites list response
 */
export interface InvitesListResponse {
  results: InviteDTO[]
  count: number
}

/**
 * Invite filters
 */
export interface InviteFilters {
  status?: InviteStatus
}

/**
 * Structured error codes from backend
 */
export type InviteErrorCode =
  | 'NOT_TUTOR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MAX_ACTIVE_INVITES'
  | 'INVITE_NOT_FOUND'
  | 'INVITE_EXPIRED'
  | 'INVITE_ALREADY_USED'
  | 'INVITE_CANCELLED'
  | 'INVITE_NOT_ACTIVE'
  | 'SELF_INVITE_FORBIDDEN'
  | 'INSUFFICIENT_CONTACTS'
  | 'NOT_OWNER'
  | 'UNKNOWN'

/**
 * API error response
 */
export interface InviteErrorResponse {
  error: string
  code: InviteErrorCode
  [key: string]: any
}
