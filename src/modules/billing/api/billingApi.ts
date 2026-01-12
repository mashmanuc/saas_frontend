/**
 * Billing API Client (v0.73.0)
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
 */

import { apiClient } from '@/utils/apiClient'

/**
 * Plan interval types
 */
export type PlanInterval = 'month' | 'year' | null

/**
 * Subscription status
 */
export type SubscriptionStatus = 
  | 'active' 
  | 'canceled' 
  | 'past_due' 
  | 'unpaid' 
  | 'incomplete'
  | 'trialing'

/**
 * Feature flags available in plans
 */
export type FeatureFlag = 
  | 'CONTACT_UNLOCK'
  | 'UNLIMITED_INQUIRIES'
  | 'PRIORITY_SUPPORT'
  | 'ADVANCED_ANALYTICS'

/**
 * Billing plan structure from backend
 */
export interface BillingPlan {
  id: number
  name: string
  slug: string
  description: string
  price: number
  price_decimal: string
  currency: string
  interval: string
  lessons_per_month: number
  features: string[]
  is_active: boolean
  is_featured: boolean
  display_order: number
}

/**
 * Current subscription info
 */
export interface Subscription {
  status: SubscriptionStatus
  current_period_end: string
  cancel_at_period_end?: boolean
  canceled_at?: string
  provider?: PaymentProvider
}

/**
 * User entitlements (what user can do)
 */
export interface Entitlements {
  features: FeatureFlag[]
  expires_at: string | null
}

/**
 * Current billing status snapshot (unified)
 */
export interface BillingMe {
  plan: string
  subscription: Subscription | null
  entitlements: Entitlements
}

/**
 * Checkout request payload
 */
export interface CheckoutRequest {
  plan: string
}

/**
 * Payment provider type
 */
export type PaymentProvider = 'liqpay' | 'stripe' | 'none'

/**
 * Checkout form fields for POST submission
 */
export interface CheckoutFormFields {
  data: string
  signature: string
  [key: string]: string
}

/**
 * Checkout details for form submission
 */
export interface CheckoutDetails {
  method: 'POST'
  url: string
  form_fields: CheckoutFormFields
}

/**
 * Checkout response from backend (v0.73 - LiqPay)
 */
export interface CheckoutResponse {
  provider: PaymentProvider
  session_id: string
  checkout: CheckoutDetails
}

/**
 * Cancel subscription request
 */
export interface CancelRequest {
  at_period_end: boolean
}

/**
 * Cancel subscription response
 */
export interface CancelResponse {
  status: string
  message: string
}

/**
 * Get current user's billing status
 * 
 * Returns snapshot of:
 * - Current plan
 * - Subscription status
 * - Entitlements (features user has access to)
 */
export async function getMe(): Promise<BillingMe> {
  const response = await apiClient.get<BillingMe>('/api/v1/billing/me/')
  return response.data
}

/**
 * Get all available billing plans
 * 
 * Returns list of plans from backend.
 * FE does NOT hardcode plans.
 */
export async function getPlans(): Promise<BillingPlan[]> {
  const response = await apiClient.get<BillingPlan[]>('/api/v1/billing/plans/')
  return response.data
}

/**
 * Initiate checkout for a plan
 * 
 * Backend returns checkout details with provider, session_id, and form fields.
 * FE does NOT generate URLs or signatures.
 * FE submits the form with provided data.
 * 
 * @param planCode - Plan identifier (e.g., "PRO", "FREE")
 * @returns Checkout response with provider and form submission details
 */
export async function checkout(planCode: string): Promise<CheckoutResponse> {
  const response = await apiClient.post<CheckoutResponse>(
    '/api/v1/billing/checkout/',
    { plan_code: planCode }
  )
  return response.data
}

/**
 * Cancel current subscription
 * 
 * @param atPeriodEnd - If true, cancel at end of billing period. If false, cancel immediately.
 * @returns Cancellation status
 */
export async function cancel(atPeriodEnd: boolean = true): Promise<CancelResponse> {
  const response = await apiClient.post<CancelResponse>(
    '/api/v1/billing/cancel/',
    { at_period_end: atPeriodEnd }
  )
  return response.data
}

/**
 * Resume a canceled subscription (if still in grace period)
 */
export async function resume(): Promise<CancelResponse> {
  const response = await apiClient.post<CancelResponse>('/api/v1/billing/resume/')
  return response.data
}
