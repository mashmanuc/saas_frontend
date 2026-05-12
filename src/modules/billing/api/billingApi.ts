/**
 * Billing API Client (v0.74.0)
 * 
 * Source of truth for billing data:
 * - Plans
 * - Subscription status
 * - Entitlements
 * 
 * INVARIANTS:
 * - FE does NOT calculate limits, features, or access
 * - FE ONLY reads from backend snapshots
 * - FE does NOT generate payment provider URLs or signatures
 * - FE submits checkout forms with data from backend
 * 
 * CONTRACT ALIGNMENT:
 * - GET /v1/billing/plans/ -> { plans: PlanDto[] }
 * - GET /v1/billing/me/ -> { subscription: SubscriptionDto, entitlement: EntitlementDto }
 * - POST /v1/billing/checkout/ -> CheckoutResponse (LiqPay/Stripe)
 * - POST /v1/billing/cancel/ -> CancelResponse
 */

import { apiClient } from '@/utils/apiClient'
import type {
  PlansResponse,
  BillingMeDto,
  CheckoutRequest,
  CheckoutResponse,
  CancelRequest,
  CancelResponse,
  DomainError,
  ApiErrorResponse
} from './dto'

// Re-export DTOs for convenience
export type {
  PlanDto,
  PlansResponse,
  SubscriptionDto,
  EntitlementDto,
  BillingMeDto,
  CheckoutRequest,
  CheckoutResponse,
  CheckoutFormFields,
  CheckoutDetails,
  CancelRequest,
  CancelResponse,
  DomainError,
  ApiErrorResponse,
  PaymentProvider,
  SubscriptionStatus
} from './dto'

export { BillingErrorCodes } from './dto'

/**
 * Parse domain error from API response
 */
function parseDomainError(error: any): DomainError {
  if (error.response?.data?.error) {
    return error.response.data.error
  }
  return {
    code: 'unknown_error',
    message: error.message || 'An unknown error occurred',
    details: {}
  }
}

/**
 * Get current user's billing status
 * 
 * Returns snapshot of:
 * - Subscription (status, provider, period)
 * - Entitlement (plan_code, features, expires_at)
 * 
 * CONTRACT: GET /v1/billing/me/
 * Response: { subscription: SubscriptionDto, entitlement: EntitlementDto }
 */
export async function getMe(): Promise<BillingMeDto> {
  try {
    return await apiClient.get<BillingMeDto>('/v1/billing/me/') as unknown as BillingMeDto
  } catch (error) {
    throw parseDomainError(error)
  }
}

/**
 * Get all available billing plans
 * 
 * Returns list of plans from backend.
 * FE does NOT hardcode plans.
 * 
 * CONTRACT: GET /v1/billing/plans/
 * Response: { plans: PlanDto[] }
 */
export async function getPlans(): Promise<PlansResponse> {
  try {
    return await apiClient.get<PlansResponse>('/v1/billing/plans/') as unknown as PlansResponse
  } catch (error) {
    throw parseDomainError(error)
  }
}

/**
 * Initiate checkout for a plan
 * 
 * Backend returns checkout details with provider, session_id.
 * - LiqPay: includes checkout.method, checkout.url, checkout.form_fields
 * - Stripe: includes checkout_url
 * 
 * FE does NOT generate URLs or signatures.
 * FE submits the form with provided data.
 * 
 * CONTRACT: POST /v1/billing/checkout/
 * Request: { plan: string }
 * Response: CheckoutResponse
 * 
 * @param planCode - Plan identifier (e.g., "PRO", "BUSINESS")
 * @returns Checkout response with provider and submission details
 */
export async function startCheckout(planCode: string): Promise<CheckoutResponse> {
  try {
    if (!planCode) {
      throw new Error('Plan code is required for checkout')
    }

    const normalizedPlan = planCode.trim().toUpperCase()

    const payload: CheckoutRequest = { plan: normalizedPlan }
    return await apiClient.post<CheckoutResponse>(
      '/v1/billing/checkout/',
      payload
    ) as unknown as CheckoutResponse
  } catch (error) {
    throw parseDomainError(error)
  }
}

/**
 * Trial eligibility for current user (Sprint 2 §4.1).
 *
 * Backend поверне:
 *   - eligible: true → можна показати TrialActivationModal
 *   - eligible: false з reason: "already_used" | "active_subscription" | "<other>"
 */
export interface TrialEligibilityDto {
  eligible: boolean
  trial_used: boolean
  reason: 'already_used' | 'active_subscription' | string | null
}

export async function getTrialEligibility(): Promise<TrialEligibilityDto> {
  try {
    return await apiClient.get<TrialEligibilityDto>('/v1/billing/trial/eligibility/') as unknown as TrialEligibilityDto
  } catch (error) {
    throw parseDomainError(error)
  }
}

/**
 * Start a trial subscription (PRO/BUSINESS, 14 днів).
 *
 * Backend контракт: POST /v1/billing/trial/start/ {plan: "PRO"|"BUSINESS"}.
 */
export interface TrialStartResponseDto {
  message: string
  subscription: {
    id: string
    plan: string
    status: string
    trial_start: string
    trial_end: string
    trial_duration_days: number
    trial_contacts: number
  }
}

export async function startTrial(plan: 'PRO' | 'BUSINESS' = 'PRO'): Promise<TrialStartResponseDto> {
  try {
    return await apiClient.post<TrialStartResponseDto>(
      '/v1/billing/trial/start/',
      { plan },
    ) as unknown as TrialStartResponseDto
  } catch (error) {
    throw parseDomainError(error)
  }
}

/**
 * Cancel current subscription
 * 
 * CONTRACT: POST /v1/billing/cancel/
 * Request: { at_period_end: boolean }
 * Response: { status: string, message: string }
 * 
 * @param atPeriodEnd - If true, cancel at end of billing period. If false, cancel immediately.
 * @returns Cancellation status
 */
export async function cancelSubscription(atPeriodEnd: boolean = true): Promise<CancelResponse> {
  try {
    const payload: CancelRequest = { at_period_end: atPeriodEnd }
    return await apiClient.post<CancelResponse>(
      '/v1/billing/cancel/',
      payload
    ) as unknown as CancelResponse
  } catch (error) {
    throw parseDomainError(error)
  }
}
