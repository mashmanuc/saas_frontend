/**
 * Contacts API Client
 * 
 * DOMAIN-07: Contact Tokens — Balance, Ledger, Purchase
 * 
 * API methods for contact token management.
 */

import apiClient from '@/utils/apiClient'

// Types
export interface ContactBalance {
  balance: number
  pending_grants: number
  last_grant_date: string | null
  next_allowance_date: string | null
  plan_allowance: number
}

export interface ContactLedgerEntry {
  id: number
  created_at: string
  type: 'PURCHASE' | 'DEDUCTION' | 'REFUND' | 'BONUS' | 'ADJUSTMENT' | 'GRANT'
  delta: number
  balance_after: number
  reason: string
  actor_user_id?: number
  idempotency_key?: string
}

export interface ContactPackage {
  id: string
  name: string
  tokens: number
  price: number
  currency: string
  price_per_token: number
}

export interface ContactGrantRequest {
  amount: number
  reason: string
  subscription_id?: number
}

export interface ContactPurchaseRequest {
  package_id: string
  success_url: string
  cancel_url: string
}

export interface ContactPurchaseResponse {
  provider: 'stripe' | 'liqpay'
  session_id: string
  redirect_url: string
}

export interface LedgerParams {
  limit?: number
  offset?: number
  type?: ContactLedgerEntry['type']
  date_from?: string
  date_to?: string
}

export interface PaginatedLedgerResponse {
  count: number
  next: string | null
  previous: string | null
  results: ContactLedgerEntry[]
}

export const contactsApi = {
  // Balance
  getBalance: (): Promise<ContactBalance> =>
    apiClient.get('/billing/contacts/balance/'),

  // Ledger
  getLedger: (params?: LedgerParams): Promise<PaginatedLedgerResponse> =>
    apiClient.get('/billing/contacts/ledger/', { params }),

  // Packages (for purchase)
  getPackages: (): Promise<ContactPackage[]> =>
    apiClient.get('/billing/contacts/packages/'),

  // Purchase
  purchaseTokens: (data: ContactPurchaseRequest): Promise<ContactPurchaseResponse> =>
    apiClient.post('/billing/contacts/purchase/', data),

  // Grant (admin/internal only)
  grantTokens: (data: ContactGrantRequest): Promise<void> =>
    apiClient.post('/billing/contacts/grant/', data),

  // Monthly allowance info
  getAllowanceInfo: (): Promise<{
    plan_allowance: number
    next_grant_date: string
    last_grant_date: string | null
    history: Array<{
      date: string
      amount: number
      plan: string
    }>
  }> => apiClient.get('/billing/contacts/allowance/'),
}

export default contactsApi
