/**
 * Billing API client for v0.64.0
 * Handles subscription checkout, billing status, and cancellation
 */

import axios from 'axios'
import type { 
  BillingMeDTO, 
  CheckoutResponseDTO,
  ContactBalanceDTO,
  ContactLedgerItemDTO,
  InquiryStatsDTO
} from '@/types/billing'

const BASE_URL = '/api/v1/billing'

/**
 * Start checkout session for subscription upgrade
 * @param plan - Plan type to upgrade to (default: 'PRO')
 * @returns Checkout URL to redirect user to
 */
export async function startCheckout(plan: string = 'PRO'): Promise<CheckoutResponseDTO> {
  const response = await axios.post<CheckoutResponseDTO>(`${BASE_URL}/checkout/`, { plan })
  return response.data
}

/**
 * Get current user's billing status
 * @returns Billing status including subscription state and period end
 */
export async function getBillingMe(): Promise<BillingMeDTO> {
  const response = await axios.get<BillingMeDTO>(`${BASE_URL}/me/`)
  return response.data
}

/**
 * Cancel subscription
 * @param atPeriodEnd - If true, cancel at period end; if false, cancel immediately
 */
export async function cancelSubscription(atPeriodEnd: boolean = true): Promise<void> {
  await axios.post(`${BASE_URL}/cancel/`, { at_period_end: atPeriodEnd })
}

/**
 * Phase 2.3: Get contact token balance for authenticated tutor
 * @returns Current balance and user ID
 */
export async function getContactBalance(): Promise<ContactBalanceDTO> {
  const response = await axios.get<ContactBalanceDTO>(`${BASE_URL}/contacts/balance/`)
  return response.data
}

/**
 * Phase 2.3: Get contact ledger history with pagination
 * SSOT: limit+offset pagination (no cursor/infinite-scroll)
 * @param limit - Number of records (1-200, default 50)
 * @param offset - Number of records to skip (default 0)
 * @returns List of ledger transactions, newest first
 */
export async function getContactLedger(
  limit: number = 50,
  offset: number = 0
): Promise<ContactLedgerItemDTO[]> {
  const response = await axios.get<ContactLedgerItemDTO[]>(
    `${BASE_URL}/contacts/ledger/`,
    { params: { limit, offset } }
  )
  return response.data
}

/**
 * Phase 2.3: Get inquiry stats for authenticated tutor
 * @returns Decline streak, blocking status, and open inquiries count
 */
export async function getInquiryStats(): Promise<InquiryStatsDTO> {
  const response = await axios.get<InquiryStatsDTO>('/api/v1/inquiries/stats/')
  return response.data
}

export default {
  startCheckout,
  getBillingMe,
  cancelSubscription,
  getContactBalance,
  getContactLedger,
  getInquiryStats
}
