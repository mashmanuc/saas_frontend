/**
 * Billing API client for v0.64.0
 * Handles subscription checkout, billing status, and cancellation
 */

import axios from 'axios'
import type { BillingMeDTO, CheckoutResponseDTO } from '@/types/billing'

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

export default {
  startCheckout,
  getBillingMe,
  cancelSubscription
}
