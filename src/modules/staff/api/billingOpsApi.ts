/**
 * Staff Billing Ops API Client (v0.79.0)
 * 
 * Provides staff access to billing operations:
 * - User billing snapshot
 * - Preview finalize (LiqPay manual finalize)
 * - Confirm finalize with audit
 * 
 * INVARIANTS:
 * - FE does NOT calculate pending_age_seconds (backend provides)
 * - FE does NOT decide can_finalize (backend provides)
 * - FE does NOT skip preview before confirm
 * - All operations require staff permission (billing_ops_finalize)
 * 
 * CONTRACT ALIGNMENT:
 * - GET /v1/staff/billing/users/{user_id}/snapshot/ -> UserBillingSnapshotDto
 * - POST /v1/staff/billing/liqpay/finalize/preview/ -> PreviewFinalizeDto
 * - POST /v1/staff/billing/liqpay/finalize/ -> ConfirmFinalizeDto
 */

import api from '@/utils/apiClient'

// ============================================================================
// DTOs (aligned with backend contracts)
// ============================================================================

export interface UserBillingSnapshotDto {
  user: {
    id: string
    email: string
    role: string
  }
  entitlement: {
    plan_code: string
    features: string[]
    expires_at: string | null
  }
  subscription: {
    status: string
    plan_code: string | null
    provider: string | null
    current_period_start: string | null
    current_period_end: string | null
    cancel_at_period_end: boolean
  }
  checkout_sessions: CheckoutSessionDto[]
}

export interface CheckoutSessionDto {
  id: string
  order_id: string
  status: string
  provider: string
  pending_plan_code: string | null
  pending_since: string | null
  pending_age_seconds: number | null
  created_at: string
  completed_at: string | null
}

export interface PreviewFinalizeDto {
  order_id: string
  can_finalize: boolean
  reason_required: boolean
  checkout_session: {
    id: string
    status: string
    provider: string
    pending_plan_code: string | null
    pending_since: string | null
    created_at: string
  } | null
  subscription_before: {
    status: string
    plan_code: string
    provider: string
    current_period_start: string | null
    current_period_end: string | null
  } | null
  entitlement_before: {
    plan_code: string
    features: string[]
  }
  plan_to_activate: string | null
  pending_age_seconds: number | null
  blocked_reason: string | null
}

export interface ConfirmFinalizeRequest {
  order_id: string
  reason: string
}

export interface ConfirmFinalizeDto {
  result: 'activated' | 'already_completed' | 'failed' | 'invalid_state' | 'not_found' | 'invalid_reason'
  order_id: string
  target_user_id: number | null
  plan_activated: string | null
  subscription_status: string
  entitlement_plan_code: string
  pending_age_seconds: number | null
}

export interface DomainError {
  code: string
  message: string
  details?: Record<string, any>
}

// ============================================================================
// API Methods
// ============================================================================

/**
 * Parse domain error from API response
 */
function parseDomainError(error: any): DomainError {
  if (error.response?.data?.error) {
    return error.response.data.error
  }
  if (error.response?.data?.detail) {
    return {
      code: 'api_error',
      message: error.response.data.detail,
      details: error.response?.data
    }
  }
  return {
    code: 'unknown_error',
    message: error.message || 'An unknown error occurred',
    details: {}
  }
}

/**
 * Get user billing snapshot for staff
 * 
 * Returns comprehensive billing state:
 * - User info
 * - Entitlement (plan, features, expires_at)
 * - Subscription (status, provider, period)
 * - Last 10 checkout sessions with pending_age_seconds
 * 
 * CONTRACT: GET /v1/staff/billing/users/{user_id}/snapshot/
 * Response: UserBillingSnapshotDto
 * 
 * @param userId - User ID to get snapshot for
 * @returns User billing snapshot
 * @throws DomainError if user not found or permission denied
 */
export async function getUserBillingSnapshot(userId: string | number): Promise<UserBillingSnapshotDto> {
  try {
    const response = await api.get(`/v1/staff/billing/users/${userId}/snapshot/`)
    return response.data
  } catch (error) {
    throw parseDomainError(error)
  }
}

/**
 * Preview finalize operation without changing state
 * 
 * Returns preview of what would happen if finalize is confirmed:
 * - can_finalize flag
 * - blocked_reason if cannot finalize
 * - plan_to_activate
 * - current state (subscription_before, entitlement_before)
 * - pending_age_seconds
 * 
 * CONTRACT: POST /v1/staff/billing/liqpay/finalize/preview/
 * Request: { order_id: string }
 * Response: PreviewFinalizeDto
 * 
 * @param orderId - LiqPay order_id to preview
 * @returns Preview result
 * @throws DomainError if order not found or permission denied
 */
export async function previewFinalize(orderId: string): Promise<PreviewFinalizeDto> {
  try {
    const response = await api.post('/v1/staff/billing/liqpay/finalize/preview/', {
      order_id: orderId
    })
    return response.data
  } catch (error) {
    throw parseDomainError(error)
  }
}

/**
 * Confirm finalize operation with audit
 * 
 * Executes manual finalize for LiqPay checkout session.
 * Creates audit record for every attempt.
 * Idempotent: repeated calls return already_completed.
 * 
 * CONTRACT: POST /v1/staff/billing/liqpay/finalize/
 * Request: { order_id: string, reason: string }
 * Response: ConfirmFinalizeDto
 * 
 * @param orderId - LiqPay order_id to finalize
 * @param reason - Staff reason for manual finalize (min 5 chars)
 * @returns Finalize result
 * @throws DomainError if validation fails or permission denied
 */
export async function confirmFinalize(orderId: string, reason: string): Promise<ConfirmFinalizeDto> {
  try {
    if (!reason || reason.trim().length < 5) {
      throw {
        response: {
          data: {
            error: {
              code: 'invalid_reason',
              message: 'Reason must be at least 5 characters',
              details: { min_length: 5 }
            }
          }
        }
      }
    }

    const response = await api.post('/v1/staff/billing/liqpay/finalize/', {
      order_id: orderId,
      reason: reason.trim()
    })
    return response.data
  } catch (error) {
    throw parseDomainError(error)
  }
}
