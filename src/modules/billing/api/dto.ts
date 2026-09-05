/**
 * Billing API DTOs (v0.74.0)
 * 
 * Type definitions for billing API contracts.
 * Aligned with Backend v0.74 specification.
 */

/**
 * Payment provider type
 */
export type PaymentProvider = 'liqpay' | 'stripe' | 'plata' | 'paddle' | 'none'

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

/** Технічні ліміти плану (PLAN V2 Option A). Значення: int = cap, null = безліміт. */
export interface PlanLimits {
  [key: string]: number | null
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
  is_featured?: boolean
  sort_order: number
  // PLAN V2 Option A (2026-06-23): limits = технічна частина (FE авто-генерує
  // характеристики картки через planLimitFeatures.ts); description(_uk) = опис тарифу.
  limits?: PlanLimits
  description?: string
  description_uk?: string
  /** Ф4 (2026-07-27): staff «НАЗВА (UA)» — тепер віддається публічним API */
  title_uk?: string
}

/**
 * Plans list response
 */
export interface PlansResponse {
  plans: PlanDto[]
  /** Ринок покупця (UA/INTL), 2026-09-03. */
  market?: string
  /**
   * PR-1 білінгу (2026-09-04): BILLING_SALES_ENABLED на сервері. false →
   * вітрина схована, checkout заблокований сервером (403 SALES_DISABLED).
   * Fail-closed з 2026-09-05: лише явне true вмикає вітрину на FE; відсутнє
   * поле (старий BE) трактується як «продаж вимкнено».
   */
  sales_enabled?: boolean
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
  /** PR-1 (2026-09-04): продаж вимкнено (BILLING_SALES_ENABLED=False). */
  SALES_DISABLED: 'sales_disabled',
  /** PR-1 (2026-09-04): PRO-USD при чинному PRO — той самий tier, 409 з BE. */
  ALREADY_SUBSCRIBED_SAME_TIER: 'already_subscribed_same_tier',
} as const

export type BillingErrorCode = typeof BillingErrorCodes[keyof typeof BillingErrorCodes]

/**
 * §5З Крок 2/3 (2026-07-27): рядок історії платежів.
 * Джерело — BE `billing.Payment`; суми — РЕАЛЬНО сплачені (снапшот на момент
 * оплати), тому зміна ціни плану в Staff не переписує минуле.
 */
export interface PaymentHistoryItemDto {
  date: string
  amount: string
  currency: string
  status: 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'REQUIRES_ACTION'
  provider: string
  plan_code: string | null
}

export interface PaymentHistoryResponse {
  results: PaymentHistoryItemDto[]
  count: number
}
