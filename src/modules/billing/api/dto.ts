/**
 * Billing API DTOs (v0.74.0)
 * 
 * Type definitions for billing API contracts.
 * Aligned with Backend v0.74 specification.
 */

/**
 * Payment provider type
 */
export type PaymentProvider = 'liqpay' | 'stripe' | 'none'

/**
 * Subscription status enum
 */
export type SubscriptionStatus = 
  | 'none'
  | 'active' 
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete'
  | 'trialing'
  | 'unpaid'

/**
 * Plan price structure
 */
export interface PriceDto {
  amount: number
  currency: string
}

/**
 * Plan DTO from backend
 */
export interface PlanDto {
  code: string
  title: string
  price: PriceDto
  interval: string | null
  features: string[]
  is_active: boolean
  sort_order: number
}

/**
 * Plans list response
 */
export interface PlansResponse {
  plans: PlanDto[]
}

/**
 * Subscription DTO
 */
export interface SubscriptionDto {
  status: SubscriptionStatus
  provider: PaymentProvider | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
}

/**
 * Entitlement DTO
 */
export interface EntitlementDto {
  plan_code: string
  features: string[]
  expires_at: string | null
}

/**
 * Billing Me response (unified snapshot v0.76.3)
 * 
 * v0.80.0: Extended with pending_age_seconds, last_checkout info
 */
export interface BillingMeDto {
  subscription: SubscriptionDto
  entitlement: EntitlementDto
  pending_plan_code: string | null
  pending_since: string | null
  display_plan_code: string
  subscription_status: string
  // v0.80.0 BE-80.1 additions
  plan: string
  expires_at: string | null
  is_active: boolean
  pending_age_seconds: number | null
  last_checkout_order_id: string | null
  last_checkout_created_at: string | null
}

/**
 * Checkout form fields for POST submission
 */
export interface CheckoutFormFields {
  data: string
  signature: string
  [key: string]: string
}

/**
 * Checkout details structure
 */
export interface CheckoutDetails {
  method: 'POST'
  url: string
  form_fields: CheckoutFormFields
}

/**
 * Checkout response from backend
 * 
 * LiqPay: includes checkout.method, checkout.url, checkout.form_fields
 * Stripe: includes checkout_url
 */
export interface CheckoutResponse {
  provider: PaymentProvider
  session_id: string
  checkout?: CheckoutDetails
  checkout_url?: string
}

/**
 * Checkout request payload
 * 
 * Backend expects: { plan: "PRO" | "BUSINESS" }
 */
export interface CheckoutRequest {
  plan: string
}

/**
 * Cancel subscription request
 */
export interface CancelRequest {
  at_period_end: boolean
}

/**
 * Cancel/Resume response
 */
export interface CancelResponse {
  status: string
  message: string
}

/**
 * Domain error structure
 */
export interface DomainError {
  code: string
  message: string
  details?: Record<string, any>
}

/**
 * API error response wrapper
 */
export interface ApiErrorResponse {
  error: DomainError
}

/**
 * Known billing error codes
 */
export const BillingErrorCodes = {
  SUBSCRIPTION_REQUIRED: 'subscription_required',
  LIMIT_EXCEEDED: 'limit_exceeded',
  CHECKOUT_NOT_ALLOWED: 'checkout_not_allowed',
  INVALID_PLAN: 'invalid_plan',
  ALREADY_SUBSCRIBED: 'already_subscribed',
} as const

export type BillingErrorCode = typeof BillingErrorCodes[keyof typeof BillingErrorCodes]
