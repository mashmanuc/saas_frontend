/**
 * Staff Payouts API
 * 
 * Endpoints for managing tutor payout requests.
 * Uses existing payments admin endpoints.
 */
import apiClient from '@/utils/apiClient'

const BASE_URL = '/v1/staff/payouts'

export interface PayoutItem {
  id: number
  uuid: string
  tutor_id: number
  tutor_email: string
  tutor_name: string
  amount: number
  amount_decimal: number
  currency: string
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled'
  payout_method: string
  bank_name: string
  bank_account: string
  bank_holder_name: string
  provider_payout_id: string
  failure_reason: string
  notes: string
  is_cancellable: boolean
  created_at: string
  updated_at: string
  processed_at: string | null
}

export interface PayoutListResponse {
  results: PayoutItem[]
  count: number
}

export async function getAdminPayouts(params?: {
  status?: string
  limit?: number
  offset?: number
}): Promise<PayoutListResponse> {
  const res = await apiClient.get(`${BASE_URL}/`, { params })
  return Array.isArray(res)
    ? { results: res, count: res.length }
    : { results: res.results || [], count: res.count || 0 }
}

export async function approvePayout(payoutUuid: string): Promise<PayoutItem> {
  return apiClient.post(`${BASE_URL}/${payoutUuid}/approve/`)
}

export async function processPayout(payoutUuid: string): Promise<PayoutItem> {
  return apiClient.post(`${BASE_URL}/${payoutUuid}/process/`)
}

export async function completePayout(payoutUuid: string, providerPayoutId?: string): Promise<PayoutItem> {
  return apiClient.post(`${BASE_URL}/${payoutUuid}/complete/`, {
    provider_payout_id: providerPayoutId || '',
  })
}

export async function failPayout(payoutUuid: string, reason: string): Promise<PayoutItem> {
  return apiClient.post(`${BASE_URL}/${payoutUuid}/fail/`, { reason })
}

export default {
  getAdminPayouts,
  approvePayout,
  processPayout,
  completePayout,
  failPayout,
}
