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

/**
 * Phase 2.3: Contact token balance
 */
export interface ContactBalanceDTO {
  balance: number
  user_id: number
}

/**
 * Phase 2.3: Contact ledger transaction
 */
export interface ContactLedgerItemDTO {
  id: number
  transaction_type: 'PURCHASE' | 'DEDUCTION' | 'REFUND'
  delta: number
  balance_after: number
  inquiry_id: string | null
  reason: string
  created_at: string
}

/**
 * Phase 2.3: Inquiry stats for tutor
 */
export interface InquiryStatsDTO {
  decline_streak: number
  is_blocked_by_decline_streak: boolean
  total_open_inquiries: number
}
