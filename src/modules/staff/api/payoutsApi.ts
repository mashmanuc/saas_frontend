/**
 * Staff Payouts API
 * 
 * Endpoints for managing tutor payout requests.
 * Uses existing payments admin endpoints.
 */
import apiClient from '@/utils/apiClient'

const BASE_URL = '/v1/payments/v1/admin/payouts'

export interface PayoutItem {
  id: number
  tutor_id: number
  tutor_email: string
  tutor_name: string
  amount: number
  currency: string
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled'
  payout_method: string
  provider_payout_id: string | null
  failure_reason: string | null
  processed_by: string | null
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

export async function approvePayout(payoutId: number): Promise<PayoutItem> {
  return apiClient.post(`${BASE_URL}/${payoutId}/approve/`)
}

export async function processPayout(payoutId: number): Promise<PayoutItem> {
  return apiClient.post(`${BASE_URL}/${payoutId}/process/`)
}

export async function completePayout(payoutId: number, providerPayoutId?: string): Promise<PayoutItem> {
  return apiClient.post(`${BASE_URL}/${payoutId}/complete/`, {
    provider_payout_id: providerPayoutId || '',
  })
}

export async function failPayout(payoutId: number, reason: string): Promise<PayoutItem> {
  return apiClient.post(`${BASE_URL}/${payoutId}/fail/`, { reason })
}

export default {
  getAdminPayouts,
  approvePayout,
  processPayout,
  completePayout,
  failPayout,
}
