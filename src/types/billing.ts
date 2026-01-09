/**
 * Billing types for v0.64.0
 * Defines subscription billing status and checkout flow
 */

/**
 * Billing status DTO from backend
 */
export interface BillingMeDTO {
  subscription_status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none'
  current_period_end: string | null
  cancel_at_period_end: boolean
}

/**
 * Checkout response DTO
 */
export interface CheckoutResponseDTO {
  checkout_url: string
}

/**
 * Normalized billing state
 */
export interface BillingStatus {
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'trialing' | 'none'
  currentPeriodEnd: Date | null
  cancelAtPeriodEnd: boolean
}
